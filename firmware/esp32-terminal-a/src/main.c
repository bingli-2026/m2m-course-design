#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <inttypes.h>
#include "cJSON.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_now.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"

static const char *TAG = "terminal-a";
static const char *DEVICE_ID = "terminal-a";
#define ESPNOW_CHANNEL 1
#define ESPNOW_MAX_PAYLOAD 250
#define TERMINAL_FW_VERSION "0.1.0"

#ifndef TERMINAL_GATEWAY_MAC0
#define TERMINAL_GATEWAY_MAC0 0xFF
#endif
#ifndef TERMINAL_GATEWAY_MAC1
#define TERMINAL_GATEWAY_MAC1 0xFF
#endif
#ifndef TERMINAL_GATEWAY_MAC2
#define TERMINAL_GATEWAY_MAC2 0xFF
#endif
#ifndef TERMINAL_GATEWAY_MAC3
#define TERMINAL_GATEWAY_MAC3 0xFF
#endif
#ifndef TERMINAL_GATEWAY_MAC4
#define TERMINAL_GATEWAY_MAC4 0xFF
#endif
#ifndef TERMINAL_GATEWAY_MAC5
#define TERMINAL_GATEWAY_MAC5 0xFF
#endif

#define ESPNOW_READY_BIT BIT0

static EventGroupHandle_t s_evt_group;
static bool s_last_send_ok = true;
static uint32_t s_downlink_cmd_count = 0;
static uint8_t s_gateway_mac[ESP_NOW_ETH_ALEN] = {
    TERMINAL_GATEWAY_MAC0, TERMINAL_GATEWAY_MAC1, TERMINAL_GATEWAY_MAC2,
    TERMINAL_GATEWAY_MAC3, TERMINAL_GATEWAY_MAC4, TERMINAL_GATEWAY_MAC5,
};

typedef enum {
    STATE_BOOT = 0,
    STATE_INIT_RADIO,
    STATE_REGISTERING,
    STATE_ONLINE,
    STATE_FAULT,
    STATE_OFFLINE_RETRY,
} terminal_state_t;

typedef struct {
    terminal_state_t state;
    uint32_t boot_id;
    uint32_t seq;
    uint32_t send_fail_count;
    uint32_t output_count;
    uint32_t fault_code;
    int64_t online_since_ms;
    int64_t last_tx_ms;
} terminal_ctx_t;

typedef struct {
    const char *event;
    const char *state;
    uint32_t seq;
    uint32_t boot_id;
    uint32_t output;
    float temp;
    uint32_t fault;
} telemetry_frame_t;

static terminal_ctx_t s_ctx;

static const char *state_to_str(terminal_state_t state)
{
    switch (state) {
    case STATE_BOOT: return "BOOT";
    case STATE_INIT_RADIO: return "INIT_RADIO";
    case STATE_REGISTERING: return "REGISTERING";
    case STATE_ONLINE: return "ONLINE";
    case STATE_FAULT: return "FAULT";
    case STATE_OFFLINE_RETRY: return "OFFLINE_RETRY";
    default: return "UNKNOWN";
    }
}

static int64_t now_ms(void)
{
    return esp_timer_get_time() / 1000;
}

static void mac_to_str(const uint8_t *mac, char *out, size_t out_len)
{
    snprintf(out, out_len, "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static bool is_broadcast_like_mac(const uint8_t *mac)
{
    for (int i = 0; i < ESP_NOW_ETH_ALEN; ++i) {
        if (mac[i] != 0xFF) {
            return false;
        }
    }
    return true;
}

static void set_state(terminal_ctx_t *ctx, terminal_state_t next, const char *reason)
{
    if (ctx->state == next) {
        return;
    }
    ESP_LOGI(TAG, "state transition: %s -> %s (%s)",
             state_to_str(ctx->state), state_to_str(next), reason);
    ctx->state = next;
    if (next == STATE_ONLINE) {
        ctx->online_since_ms = now_ms();
    }
}

static void on_espnow_send(const uint8_t *mac_addr, esp_now_send_status_t status)
{
    char mac_str[24];
    if (mac_addr != NULL) {
        mac_to_str(mac_addr, mac_str, sizeof(mac_str));
    } else {
        strncpy(mac_str, "unknown", sizeof(mac_str) - 1);
        mac_str[sizeof(mac_str) - 1] = '\0';
    }
    s_last_send_ok = (status == ESP_NOW_SEND_SUCCESS);
    ESP_LOGI(TAG, "esp-now send complete mac=%s status=%s", mac_str,
             s_last_send_ok ? "SUCCESS" : "FAIL");
}

static void on_espnow_recv(const esp_now_recv_info_t *recv_info, const uint8_t *data, int len)
{
    if (recv_info == NULL || recv_info->src_addr == NULL || data == NULL || len <= 0 || len > ESPNOW_MAX_PAYLOAD) {
        return;
    }

    char payload[ESPNOW_MAX_PAYLOAD + 1];
    memcpy(payload, data, (size_t)len);
    payload[len] = '\0';

    cJSON *root = cJSON_ParseWithLength(payload, (size_t)len);
    if (root == NULL) {
        ESP_LOGW(TAG, "downlink parse failed raw=%s", payload);
        return;
    }

    cJSON *cmd_item = cJSON_GetObjectItemCaseSensitive(root, "command");
    if (!cJSON_IsString(cmd_item) || cmd_item->valuestring == NULL) {
        cmd_item = cJSON_GetObjectItemCaseSensitive(root, "cmd");
    }
    cJSON *command_id_item = cJSON_GetObjectItemCaseSensitive(root, "command_id");
    const char *cmd = (cJSON_IsString(cmd_item) && cmd_item->valuestring != NULL) ? cmd_item->valuestring : "unknown";
    int command_id = cJSON_IsNumber(command_id_item) ? command_id_item->valueint : -1;

    s_downlink_cmd_count++;
    ESP_LOGI(TAG, "downlink cmd received command=%s command_id=%d count=%" PRIu32, cmd, command_id, s_downlink_cmd_count);

    cJSON *ack = cJSON_CreateObject();
    if (ack != NULL) {
        cJSON_AddStringToObject(ack, "event", "COMMAND_ACK");
        cJSON_AddStringToObject(ack, "device_id", DEVICE_ID);
        if (command_id >= 0) {
            cJSON_AddNumberToObject(ack, "command_id", command_id);
        }
        cJSON_AddStringToObject(ack, "status", "acked");
        cJSON_AddStringToObject(ack, "detail", cmd);
        cJSON_AddNumberToObject(ack, "ts", (double)(now_ms() / 1000));

        char *ack_json = cJSON_PrintUnformatted(ack);
        if (ack_json != NULL) {
            size_t ack_len = strlen(ack_json);
            if (ack_len > 0 && ack_len <= ESPNOW_MAX_PAYLOAD) {
                esp_err_t err = esp_now_send(s_gateway_mac, (const uint8_t *)ack_json, ack_len);
                if (err != ESP_OK) {
                    ESP_LOGW(TAG, "command ack send failed err=0x%x payload=%s", err, ack_json);
                }
            } else {
                ESP_LOGW(TAG, "command ack payload invalid len=%u", (unsigned)ack_len);
            }
            cJSON_free(ack_json);
        }
        cJSON_Delete(ack);
    }
    cJSON_Delete(root);
}

static esp_err_t espnow_radio_init(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    if (err != ESP_OK) {
        return err;
    }

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_ERROR_CHECK(esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE));

    ESP_ERROR_CHECK(esp_now_init());
    ESP_ERROR_CHECK(esp_now_register_send_cb(on_espnow_send));
    ESP_ERROR_CHECK(esp_now_register_recv_cb(on_espnow_recv));

    esp_now_peer_info_t peer = {0};
    memcpy(peer.peer_addr, s_gateway_mac, ESP_NOW_ETH_ALEN);
    peer.channel = ESPNOW_CHANNEL;
    peer.ifidx = WIFI_IF_STA;
    peer.encrypt = false;

    if (!esp_now_is_peer_exist(s_gateway_mac)) {
        ESP_ERROR_CHECK(esp_now_add_peer(&peer));
    }

    char gw_mac_str[24];
    mac_to_str(s_gateway_mac, gw_mac_str, sizeof(gw_mac_str));
    ESP_LOGI(TAG, "esp-now ready channel=%d gateway_mac=%s", ESPNOW_CHANNEL, gw_mac_str);
    if (is_broadcast_like_mac(s_gateway_mac)) {
        ESP_LOGW(TAG,
                 "gateway MAC is using FF:FF:FF:FF:FF:FF placeholder; set TERMINAL_GATEWAY_MAC[0-5] via build_flags");
    }
    xEventGroupSetBits(s_evt_group, ESPNOW_READY_BIT);
    return ESP_OK;
}

static bool send_uplink_frame(const telemetry_frame_t *frame)
{
    EventBits_t bits = xEventGroupGetBits(s_evt_group);
    if ((bits & ESPNOW_READY_BIT) == 0) {
        return false;
    }

    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        return false;
    }

    cJSON_AddStringToObject(root, "event", frame->event);
    cJSON_AddStringToObject(root, "device_id", DEVICE_ID);
    cJSON_AddStringToObject(root, "state", frame->state);
    cJSON_AddNumberToObject(root, "seq", (double)frame->seq);
    cJSON_AddNumberToObject(root, "boot_id", (double)frame->boot_id);
    cJSON_AddNumberToObject(root, "ts", (double)(now_ms() / 1000));
    cJSON_AddStringToObject(root, "fw_version", TERMINAL_FW_VERSION);
    cJSON_AddNumberToObject(root, "output", (double)frame->output);
    cJSON_AddNumberToObject(root, "temp", (double)frame->temp);
    cJSON_AddNumberToObject(root, "fault", (double)frame->fault);

    char *json = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (json == NULL) {
        return false;
    }

    size_t payload_len = strlen(json);
    if (payload_len == 0 || payload_len > ESPNOW_MAX_PAYLOAD) {
        ESP_LOGW(TAG, "payload too large len=%u", (unsigned)payload_len);
        cJSON_free(json);
        return false;
    }

    esp_err_t err = esp_now_send(s_gateway_mac, (const uint8_t *)json, payload_len);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "esp-now send enqueue failed err=0x%x payload=%s", err, json);
        cJSON_free(json);
        return false;
    }

    ESP_LOGI(TAG, "uplink queued payload=%s", json);
    cJSON_free(json);
    return true;
}

static void emit_register_event(terminal_ctx_t *ctx)
{
    telemetry_frame_t frame = {
        .event = "REGISTER",
        .state = state_to_str(ctx->state),
        .seq = ctx->seq,
        .boot_id = ctx->boot_id,
        .output = ctx->output_count,
        .temp = 26.0f,
        .fault = ctx->fault_code,
    };
    bool ok = send_uplink_frame(&frame);
    ctx->last_tx_ms = now_ms();
    if (!ok) {
        ctx->send_fail_count++;
        ESP_LOGW(TAG, "register failed device_id=%s boot_id=%lu seq=%lu fail_count=%lu",
                 DEVICE_ID, (unsigned long)ctx->boot_id, (unsigned long)ctx->seq,
                 (unsigned long)ctx->send_fail_count);
        set_state(ctx, STATE_OFFLINE_RETRY, "register send failed");
        return;
    }

    ctx->seq++;
    ctx->send_fail_count = 0;
    ESP_LOGI(TAG, "register queued device_id=%s boot_id=%lu seq=%lu fw_version=%s",
             DEVICE_ID, (unsigned long)ctx->boot_id, (unsigned long)ctx->seq, TERMINAL_FW_VERSION);
    set_state(ctx, STATE_ONLINE, "register uplink success");
}

static void emit_telemetry_event(terminal_ctx_t *ctx)
{
    float temp = 26.0f + (float)(ctx->output_count % 5u) * 0.2f;
    telemetry_frame_t frame = {
        .event = "HEARTBEAT",
        .state = "RUNNING",
        .seq = ctx->seq,
        .boot_id = ctx->boot_id,
        .output = ctx->output_count,
        .temp = temp,
        .fault = ctx->fault_code,
    };
    bool ok = send_uplink_frame(&frame);
    ctx->last_tx_ms = now_ms();

    if (!ok) {
        ctx->send_fail_count++;
        ESP_LOGW(TAG, "heartbeat/telemetry failed device_id=%s seq=%lu fail_count=%lu",
                 DEVICE_ID, (unsigned long)ctx->seq, (unsigned long)ctx->send_fail_count);
        if (ctx->send_fail_count >= 3u) {
            set_state(ctx, STATE_OFFLINE_RETRY, "repeated send failures");
        }
        return;
    }

    ctx->send_fail_count = 0;
    ctx->seq++;
    ctx->output_count += 2u;
    ESP_LOGI(TAG,
             "telemetry ok device_id=%s seq=%lu state=RUNNING output=%lu temp=%.1f fault=%lu",
             DEVICE_ID, (unsigned long)ctx->seq, (unsigned long)ctx->output_count, temp,
             (unsigned long)ctx->fault_code);

    if ((ctx->seq % 19u) == 0u) {
        ctx->fault_code = 101u;
        set_state(ctx, STATE_FAULT, "simulated sensor/runtime fault");
    }
}

static void handle_fault_and_recover(terminal_ctx_t *ctx)
{
    ESP_LOGE(TAG, "fault reported device_id=%s fault_code=%lu", DEVICE_ID,
             (unsigned long)ctx->fault_code);
    vTaskDelay(pdMS_TO_TICKS(1500));
    ctx->fault_code = 0;
    set_state(ctx, STATE_OFFLINE_RETRY, "fault cleared, retry scheduled");
}

static void run_state_machine(terminal_ctx_t *ctx)
{
    switch (ctx->state) {
    case STATE_BOOT:
        set_state(ctx, STATE_INIT_RADIO, "boot init complete");
        break;
    case STATE_INIT_RADIO:
        if (espnow_radio_init() != ESP_OK) {
            set_state(ctx, STATE_OFFLINE_RETRY, "esp-now init failed");
            break;
        }
        set_state(ctx, STATE_REGISTERING, "radio ready");
        break;
    case STATE_REGISTERING:
        emit_register_event(ctx);
        break;
    case STATE_ONLINE:
        emit_telemetry_event(ctx);
        break;
    case STATE_FAULT:
        handle_fault_and_recover(ctx);
        break;
    case STATE_OFFLINE_RETRY:
        vTaskDelay(pdMS_TO_TICKS(1000));
        set_state(ctx, STATE_REGISTERING, "retry timer elapsed");
        break;
    default:
        set_state(ctx, STATE_BOOT, "unknown state guard");
        break;
    }
}

void app_main(void)
{
    s_evt_group = xEventGroupCreate();
    if (s_evt_group == NULL) {
        ESP_LOGE(TAG, "failed to create event group");
        return;
    }

    s_ctx = (terminal_ctx_t){
        .state = STATE_BOOT,
        .boot_id = (uint32_t)(esp_timer_get_time() & 0xFFFFFFFFu),
        .seq = 1,
        .send_fail_count = 0,
        .output_count = 100,
        .fault_code = 0,
        .online_since_ms = 0,
        .last_tx_ms = 0,
    };

    ESP_LOGI(TAG, "terminal node started device_id=%s", DEVICE_ID);
    while (1) {
        run_state_machine(&s_ctx);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
