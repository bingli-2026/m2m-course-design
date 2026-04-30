#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define ESPNOW_PROTO_MAGIC 0x4D32u
#define ESPNOW_PROTO_VERSION 1u
#define ESPNOW_PROTO_DEVICE_ID_MAX 16u
#define ESPNOW_PROTO_PAYLOAD_MAX 180u

typedef enum {
    ESPNOW_MSG_REGISTER = 1,
    ESPNOW_MSG_TELEMETRY = 2,
    ESPNOW_MSG_COMMAND = 3,
    ESPNOW_MSG_ACK = 4,
} espnow_msg_type_t;

typedef struct __attribute__((packed)) {
    uint16_t magic;
    uint8_t version;
    uint8_t msg_type;
    uint32_t seq;
    uint32_t ts;
    char device_id[ESPNOW_PROTO_DEVICE_ID_MAX];
    uint16_t payload_len;
} espnow_proto_header_t;

typedef struct {
    espnow_proto_header_t header;
    uint8_t payload[ESPNOW_PROTO_PAYLOAD_MAX];
} espnow_proto_frame_t;

bool espnow_proto_decode(const uint8_t *data, size_t len, espnow_proto_frame_t *out);
size_t espnow_proto_encode(const espnow_proto_frame_t *frame, uint8_t *out, size_t out_cap);
void espnow_proto_init_frame(espnow_proto_frame_t *frame,
                             espnow_msg_type_t type,
                             const char *device_id,
                             uint32_t seq,
                             uint32_t ts,
                             const uint8_t *payload,
                             size_t payload_len);
const char *espnow_proto_msg_type_str(uint8_t msg_type);
bool espnow_proto_is_supported_type(uint8_t msg_type);
