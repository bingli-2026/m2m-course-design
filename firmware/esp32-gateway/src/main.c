#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <inttypes.h>
#include <stdlib.h>
#include "esp_event.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_now.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "mqtt_client.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "cJSON.h"
#include "espnow_protocol.h"

static const char *TAG = "gateway";

#define WIFI_SSID "REPLACE_WITH_WIFI_SSID"
#define WIFI_PASS "REPLACE_WITH_WIFI_PASS"
#ifndef MQTT_BROKER_URI
#define MQTT_BROKER_URI "mqtt://REPLACE_WITH_BROKER_HOST:1883"
#endif
#define MQTT_UP_HEARTBEAT_TOPIC "m2m/up/heartbeat"
#define MQTT_UP_TELEMETRY_TOPIC "m2m/up/telemetry"
#define MQTT_UP_EVENT_TOPIC "m2m/up/event"
#define MQTT_UP_COMMAND_ACK_TOPIC "m2m/up/command_ack"
#define MQTT_DOWNLINK_TOPIC "m2m/down/command/+"
#define MQTT_CLIENT_ID "m2m-gateway-esp32"
#define ESPNOW_MAX_PAYLOAD 250
#define DEVICE_ID_MAX_LEN 31
#define MAX_TERMINAL_PEERS 12

#define WIFI_CONNECTED_BIT BIT0
#define MQTT_CONNECTED_BIT BIT1

typedef enum {
    GATEWAY_BOOT = 0,
    GATEWAY_WIFI_CONNECTING,
    GATEWAY_MQTT_CONNECTING,
    GATEWAY_BRIDGING,
    GATEWAY_DEGRADED,
    GATEWAY_RECOVERING,
} gateway_state_t;

typedef struct {
    gateway_state_t state;
    uint32_t boot_id;
    uint32_t uplink_count;
    uint32_t downlink_count;
    uint32_t downlink_fail_count;
    uint32_t frame_decode_fail_count;
    uint32_t espnow_seq;
    int64_t last_uplink_ms;
    int64_t last_downlink_ms;
} gateway_ctx_t;

typedef struct {
    bool used;
    char device_id[DEVICE_ID_MAX_LEN + 1];
    uint8_t mac[ESP_NOW_ETH_ALEN];
    uint32_t seen_count;
    int64_t last_seen_ms;
} terminal_peer_t;

static EventGroupHandle_t s_evt_group;
static esp_mqtt_client_handle_t s_mqtt_client;
static gateway_ctx_t s_ctx;
static terminal_peer_t s_peers[MAX_TERMINAL_PEERS];

static int64_t now_ms(void)
{
    return esp_timer_get_time() / 1000;
}

static const char *state_to_str(gateway_state_t state)
{
    switch (state) {
    case GATEWAY_BOOT: return "BOOT";
    case GATEWAY_WIFI_CONNECTING: return "WIFI_CONNECTING";
    case GATEWAY_MQTT_CONNECTING: return "MQTT_CONNECTING";
    case GATEWAY_BRIDGING: return "BRIDGING";
    case GATEWAY_DEGRADED: return "DEGRADED";
    case GATEWAY_RECOVERING: return "RECOVERING";
    default: return "UNKNOWN";
    }
}

static void set_state(gateway_state_t next, const char *reason)
{
    if (s_ctx.state == next) {
        return;
    }
    ESP_LOGI(TAG, "state transition: %s -> %s (%s)",
             state_to_str(s_ctx.state), state_to_str(next), reason);
    s_ctx.state = next;
}

static void mac_to_str(const uint8_t *mac, char *out, size_t out_len)
{
    snprintf(out, out_len, "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static terminal_peer_t *find_peer_by_device_id(const char *device_id)
{
    for (size_t i = 0; i < MAX_TERMINAL_PEERS; ++i) {
        if (s_peers[i].used && strncmp(s_peers[i].device_id, device_id, DEVICE_ID_MAX_LEN) == 0) {
            return &s_peers[i];
        }
    }
    return NULL;
}

static terminal_peer_t *upsert_peer(const char *device_id, const uint8_t *mac)
{
    terminal_peer_t *empty_slot = NULL;
    for (size_t i = 0; i < MAX_TERMINAL_PEERS; ++i) {
        if (!s_peers[i].used && empty_slot == NULL) {
            empty_slot = &s_peers[i];
        }
        if (s_peers[i].used && strncmp(s_peers[i].device_id, device_id, DEVICE_ID_MAX_LEN) == 0) {
            memcpy(s_peers[i].mac, mac, ESP_NOW_ETH_ALEN);
            s_peers[i].seen_count++;
            s_peers[i].last_seen_ms = now_ms();
            return &s_peers[i];
        }
    }

    if (empty_slot == NULL) {
        return NULL;
    }

    empty_slot->used = true;
    strncpy(empty_slot->device_id, device_id, DEVICE_ID_MAX_LEN);
    empty_slot->device_id[DEVICE_ID_MAX_LEN] = '\0';
    memcpy(empty_slot->mac, mac, ESP_NOW_ETH_ALEN);
    empty_slot->seen_count = 1;
    empty_slot->last_seen_ms = now_ms();
    return empty_slot;
}

static esp_err_t ensure_espnow_peer(const uint8_t *mac)
{
    if (esp_now_is_peer_exist(mac)) {
        return ESP_OK;
    }

    esp_now_peer_info_t peer = {0};
    memcpy(peer.peer_addr, mac, ESP_NOW_ETH_ALEN);
    peer.ifidx = WIFI_IF_STA;
    peer.channel = 0;
    peer.encrypt = false;
    return esp_now_add_peer(&peer);
}

static bool payload_event_is_command_ack(const char *payload, int *command_id_out, const char **status_out)
{
    if (payload == NULL) {
        return false;
    }
    cJSON *root = cJSON_Parse(payload);
    if (root == NULL) {
        return false;
    }

    cJSON *event_item = cJSON_GetObjectItemCaseSensitive(root, "event");
    cJSON *command_id_item = cJSON_GetObjectItemCaseSensitive(root, "command_id");
    cJSON *status_item = cJSON_GetObjectItemCaseSensitive(root, "status");

    bool ok = false;
    if (cJSON_IsString(event_item) && event_item->valuestring != NULL &&
        strcmp(event_item->valuestring, "COMMAND_ACK") == 0 &&
        cJSON_IsNumber(command_id_item) &&
        cJSON_IsString(status_item) && status_item->valuestring != NULL) {
        if (command_id_out != NULL) {
            *command_id_out = command_id_item->valueint;
        }
        if (status_out != NULL) {
            *status_out = status_item->valuestring;
        }
        ok = true;
    }
    cJSON_Delete(root);
    return ok;
}

static void publish_uplink_payload(const char *device_id, const char *payload)
{
    const char *topic = MQTT_UP_TELEMETRY_TOPIC;
    int command_id = 0;
    const char *ack_status = NULL;
    if (payload_event_is_command_ack(payload, &command_id, &ack_status)) {
        topic = MQTT_UP_COMMAND_ACK_TOPIC;
    }
    int msg_id = esp_mqtt_client_publish(s_mqtt_client, topic, payload, 0, 1, 0);
    if (msg_id >= 0) {
        s_ctx.uplink_count++;
        s_ctx.last_uplink_ms = now_ms();
        ESP_LOGI(TAG, "uplink published topic=%s msg_id=%d count=%" PRIu32 " device_id=%s",
                 topic, msg_id, s_ctx.uplink_count, device_id);
    } else {
        ESP_LOGW(TAG, "uplink publish failed topic=%s", topic);
        set_state(GATEWAY_DEGRADED, "mqtt publish failed");
    }
}

static void publish_uplink_frame(const espnow_proto_frame_t *frame)
{
    const char *topic = MQTT_UP_TELEMETRY_TOPIC;
    const char *msg_type = espnow_proto_msg_type_str(frame->header.msg_type);
    char safe_device_id[DEVICE_ID_MAX_LEN + 1] = {0};
    memcpy(safe_device_id, frame->header.device_id, ESPNOW_PROTO_DEVICE_ID_MAX);
    safe_device_id[DEVICE_ID_MAX_LEN] = '\0';

    cJSON *root = cJSON_CreateObject();
    cJSON *payload_json = NULL;
    char payload_text[ESPNOW_PROTO_PAYLOAD_MAX + 1] = {0};
    if (frame->header.payload_len > 0) {
        memcpy(payload_text, frame->payload, frame->header.payload_len);
        payload_text[frame->header.payload_len] = '\0';
        payload_json = cJSON_Parse(payload_text);
    }

    cJSON_AddStringToObject(root, "device_id", safe_device_id);
    if (payload_json != NULL) {
        cJSON_AddItemToObject(root, "payload", payload_json);
    } else if (frame->header.payload_len > 0) {
        cJSON_AddStringToObject(root, "payload_raw", payload_text);
    }
    cJSON_AddStringToObject(root, "protocol", "espnow-v1");
    cJSON_AddStringToObject(root, "msg_type", msg_type);
    cJSON_AddNumberToObject(root, "seq", frame->header.seq);
    cJSON_AddNumberToObject(root, "ts", frame->header.ts);

    char *json_str = cJSON_PrintUnformatted(root);
    if (json_str != NULL) {
        int msg_id = esp_mqtt_client_publish(s_mqtt_client, topic, json_str, 0, 1, 0);
        if (msg_id >= 0) {
            s_ctx.uplink_count++;
            s_ctx.last_uplink_ms = now_ms();
            ESP_LOGI(TAG, "uplink frame published topic=%s type=%s seq=%" PRIu32,
                     topic, msg_type, frame->header.seq);
        } else {
            ESP_LOGW(TAG, "uplink frame publish failed topic=%s", topic);
            set_state(GATEWAY_DEGRADED, "mqtt frame publish failed");
        }
        free(json_str);
    }
    cJSON_Delete(root);
}

static bool parse_device_id_from_json(const char *payload, char *out, size_t out_len)
{
    if (payload == NULL || out == NULL || out_len == 0) {
        return false;
    }
    cJSON *root = cJSON_Parse(payload);
    if (root == NULL) {
        return false;
    }
    cJSON *device_item = cJSON_GetObjectItemCaseSensitive(root, "device_id");
    bool ok = false;
    if (cJSON_IsString(device_item) && device_item->valuestring != NULL) {
        strncpy(out, device_item->valuestring, out_len - 1);
        out[out_len - 1] = '\0';
        ok = true;
    }
    cJSON_Delete(root);
    return ok;
}

static void on_espnow_recv(const esp_now_recv_info_t *recv_info, const uint8_t *data, int len)
{
    if (recv_info == NULL || recv_info->src_addr == NULL || data == NULL || len <= 0 || len > ESPNOW_MAX_PAYLOAD) {
        return;
    }

    char device_id[DEVICE_ID_MAX_LEN + 1] = {0};
    espnow_proto_frame_t frame;
    bool is_proto_frame = espnow_proto_decode(data, (size_t)len, &frame);

    if (is_proto_frame) {
        memcpy(device_id, frame.header.device_id, ESPNOW_PROTO_DEVICE_ID_MAX);
        device_id[DEVICE_ID_MAX_LEN] = '\0';
        if (device_id[0] == '\0') {
            snprintf(device_id, sizeof(device_id), "unknown-%02X%02X", recv_info->src_addr[4], recv_info->src_addr[5]);
        }
    } else {
        s_ctx.frame_decode_fail_count++;
        char payload_text[ESPNOW_MAX_PAYLOAD + 1];
        memcpy(payload_text, data, (size_t)len);
        payload_text[len] = '\0';
        if (!parse_device_id_from_json(payload_text, device_id, sizeof(device_id))) {
            snprintf(device_id, sizeof(device_id), "unknown-%02X%02X", recv_info->src_addr[4], recv_info->src_addr[5]);
        }
    }

    terminal_peer_t *peer = upsert_peer(device_id, recv_info->src_addr);
    if (peer == NULL) {
        ESP_LOGW(TAG, "peer table full; dropped mapping for device_id=%s", device_id);
    } else {
        esp_err_t peer_err = ensure_espnow_peer(recv_info->src_addr);
        if (peer_err != ESP_OK && peer_err != ESP_ERR_ESPNOW_EXIST) {
            ESP_LOGW(TAG, "add peer failed for %s err=0x%x", device_id, peer_err);
        }
    }

    if (is_proto_frame) {
        ESP_LOGI(TAG, "esp-now frame recv device=%s type=%s seq=%" PRIu32,
                 device_id, espnow_proto_msg_type_str(frame.header.msg_type), frame.header.seq);
        publish_uplink_frame(&frame);
    } else {
        char payload_text[ESPNOW_MAX_PAYLOAD + 1];
        memcpy(payload_text, data, (size_t)len);
        payload_text[len] = '\0';
        publish_uplink_payload(device_id, payload_text);
    }
}

static void on_espnow_sent(const uint8_t *mac_addr, esp_now_send_status_t status)
{
    char mac_str[24];
    if (mac_addr != NULL) {
        mac_to_str(mac_addr, mac_str, sizeof(mac_str));
    } else {
        strncpy(mac_str, "unknown", sizeof(mac_str) - 1);
        mac_str[sizeof(mac_str) - 1] = '\0';
    }
    ESP_LOGI(TAG, "esp-now send complete mac=%s status=%s", mac_str,
             status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAIL");
    if (status != ESP_NOW_SEND_SUCCESS) {
        s_ctx.downlink_fail_count++;
        set_state(GATEWAY_DEGRADED, "esp-now downlink send failed");
    }
}

static void handle_mqtt_downlink(const char *topic, const char *payload)
{
    const char *prefix = "m2m/down/command/";
    const char *suffix = "";
    size_t prefix_len = strlen(prefix);
    size_t suffix_len = strlen(suffix);
    size_t topic_len = strlen(topic);
    if (topic_len <= prefix_len + suffix_len || strncmp(topic, prefix, prefix_len) != 0) {
        return;
    }
    if (strcmp(topic + topic_len - suffix_len, suffix) != 0) {
        return;
    }

    size_t device_id_len = topic_len - prefix_len;
    if (device_id_len == 0 || device_id_len > DEVICE_ID_MAX_LEN) {
        ESP_LOGW(TAG, "invalid device_id in topic=%s", topic);
        return;
    }

    char device_id[DEVICE_ID_MAX_LEN + 1];
    memcpy(device_id, topic + prefix_len, device_id_len);
    device_id[device_id_len] = '\0';

    terminal_peer_t *peer = find_peer_by_device_id(device_id);
    if (peer == NULL) {
        ESP_LOGW(TAG, "downlink dropped: unknown device_id=%s payload=%s", device_id, payload);
        s_ctx.downlink_fail_count++;
        set_state(GATEWAY_DEGRADED, "downlink target unknown");
        return;
    }

    size_t payload_len = strlen(payload);
    if (payload_len == 0 || payload_len > ESPNOW_PROTO_PAYLOAD_MAX) {
        ESP_LOGW(TAG, "downlink payload invalid length=%u", (unsigned)payload_len);
        return;
    }

    esp_err_t err = ensure_espnow_peer(peer->mac);
    if (err != ESP_OK && err != ESP_ERR_ESPNOW_EXIST) {
        ESP_LOGW(TAG, "downlink add peer failed device_id=%s err=0x%x", device_id, err);
        s_ctx.downlink_fail_count++;
        set_state(GATEWAY_DEGRADED, "downlink add peer failed");
        return;
    }

    espnow_proto_frame_t cmd_frame;
    s_ctx.espnow_seq++;
    espnow_proto_init_frame(&cmd_frame,
                            ESPNOW_MSG_COMMAND,
                            device_id,
                            s_ctx.espnow_seq,
                            (uint32_t)(now_ms() / 1000),
                            (const uint8_t *)payload,
                            payload_len);
    uint8_t raw[ESPNOW_MAX_PAYLOAD];
    size_t raw_len = espnow_proto_encode(&cmd_frame, raw, sizeof(raw));
    if (raw_len == 0) {
        ESP_LOGW(TAG, "downlink command frame encode failed device_id=%s", device_id);
        s_ctx.downlink_fail_count++;
        return;
    }

    err = esp_now_send(peer->mac, raw, raw_len);
    if (err == ESP_OK) {
        s_ctx.downlink_count++;
        s_ctx.last_downlink_ms = now_ms();
        ESP_LOGI(TAG, "downlink frame sent device_id=%s count=%" PRIu32 " seq=%" PRIu32,
                 device_id, s_ctx.downlink_count, s_ctx.espnow_seq);
    } else {
        ESP_LOGW(TAG, "downlink send failed device_id=%s err=0x%x", device_id, err);
        s_ctx.downlink_fail_count++;
        set_state(GATEWAY_DEGRADED, "downlink send error");
    }
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    (void)handler_args;
    (void)base;
    esp_mqtt_event_handle_t event = event_data;
    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
    ESP_LOGI(TAG, "mqtt connected");
        xEventGroupSetBits(s_evt_group, MQTT_CONNECTED_BIT);
        set_state(GATEWAY_BRIDGING, "mqtt connected and subscribe ready");
        esp_mqtt_client_subscribe(s_mqtt_client, MQTT_DOWNLINK_TOPIC, 1);
        break;
    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "mqtt disconnected");
        xEventGroupClearBits(s_evt_group, MQTT_CONNECTED_BIT);
        set_state(GATEWAY_DEGRADED, "mqtt disconnected");
        break;
    case MQTT_EVENT_DATA: {
        char topic[128];
        char payload[ESPNOW_MAX_PAYLOAD + 1];
        int tlen = event->topic_len < (int)(sizeof(topic) - 1) ? event->topic_len : (int)(sizeof(topic) - 1);
        int dlen = event->data_len < (int)(sizeof(payload) - 1) ? event->data_len : (int)(sizeof(payload) - 1);
        memcpy(topic, event->topic, (size_t)tlen);
        topic[tlen] = '\0';
        memcpy(payload, event->data, (size_t)dlen);
        payload[dlen] = '\0';
        handle_mqtt_downlink(topic, payload);
        break;
    }
    default:
        break;
    }
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    (void)arg;
    (void)event_data;
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        xEventGroupClearBits(s_evt_group, WIFI_CONNECTED_BIT);
        set_state(GATEWAY_DEGRADED, "wifi disconnected");
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        xEventGroupSetBits(s_evt_group, WIFI_CONNECTED_BIT);
        set_state(GATEWAY_MQTT_CONNECTING, "wifi connected");
    }
}

static void init_wifi(void)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));

    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, WIFI_SSID, sizeof(wifi_config.sta.ssid) - 1);
    strncpy((char *)wifi_config.sta.password, WIFI_PASS, sizeof(wifi_config.sta.password) - 1);
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.sta.pmf_cfg.capable = true;
    wifi_config.sta.pmf_cfg.required = false;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
}

static void init_espnow(void)
{
    ESP_ERROR_CHECK(esp_now_init());
    ESP_ERROR_CHECK(esp_now_register_recv_cb(on_espnow_recv));
    ESP_ERROR_CHECK(esp_now_register_send_cb(on_espnow_sent));
}

static void init_mqtt(void)
{
    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URI,
        .credentials.client_id = MQTT_CLIENT_ID,
    };
    s_mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    ESP_ERROR_CHECK(esp_mqtt_client_register_event(s_mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL));
    ESP_ERROR_CHECK(esp_mqtt_client_start(s_mqtt_client));
}

static void health_task(void *arg)
{
    (void)arg;
    while (1) {
        EventBits_t bits = xEventGroupGetBits(s_evt_group);
        bool wifi_ok = (bits & WIFI_CONNECTED_BIT) != 0;
        bool mqtt_ok = (bits & MQTT_CONNECTED_BIT) != 0;

        if (wifi_ok && mqtt_ok && s_ctx.state != GATEWAY_BRIDGING) {
            set_state(GATEWAY_RECOVERING, "channels restored");
            set_state(GATEWAY_BRIDGING, "bridge healthy");
        } else if ((!wifi_ok || !mqtt_ok) && s_ctx.state == GATEWAY_BRIDGING) {
            set_state(GATEWAY_DEGRADED, "channel unhealthy");
        }

        ESP_LOGI(TAG,
                 "health state=%s uplink=%" PRIu32 " downlink=%" PRIu32 " downlink_fail=%" PRIu32 " frame_decode_fail=%" PRIu32,
                 state_to_str(s_ctx.state), s_ctx.uplink_count, s_ctx.downlink_count,
                 s_ctx.downlink_fail_count, s_ctx.frame_decode_fail_count);
        vTaskDelay(pdMS_TO_TICKS(3000));
    }
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    s_evt_group = xEventGroupCreate();
    memset(&s_ctx, 0, sizeof(s_ctx));
    s_ctx.state = GATEWAY_BOOT;
    s_ctx.boot_id = (uint32_t)(esp_timer_get_time() & 0xFFFFFFFFu);

    ESP_LOGI(TAG, "gateway boot_id=%" PRIu32 " starting", s_ctx.boot_id);
    set_state(GATEWAY_WIFI_CONNECTING, "boot complete");

    init_wifi();
    init_espnow();
    init_mqtt();

    xTaskCreate(health_task, "health_task", 4096, NULL, 5, NULL);
}
