#include "espnow_protocol.h"

#include <string.h>

static size_t frame_encoded_len(const espnow_proto_frame_t *frame)
{
    return sizeof(espnow_proto_header_t) + frame->header.payload_len;
}

bool espnow_proto_is_supported_type(uint8_t msg_type)
{
    return msg_type == ESPNOW_MSG_REGISTER ||
           msg_type == ESPNOW_MSG_TELEMETRY ||
           msg_type == ESPNOW_MSG_COMMAND ||
           msg_type == ESPNOW_MSG_ACK;
}

const char *espnow_proto_msg_type_str(uint8_t msg_type)
{
    switch (msg_type) {
    case ESPNOW_MSG_REGISTER: return "REGISTER";
    case ESPNOW_MSG_TELEMETRY: return "TELEMETRY";
    case ESPNOW_MSG_COMMAND: return "COMMAND";
    case ESPNOW_MSG_ACK: return "ACK";
    default: return "UNKNOWN";
    }
}

void espnow_proto_init_frame(espnow_proto_frame_t *frame,
                             espnow_msg_type_t type,
                             const char *device_id,
                             uint32_t seq,
                             uint32_t ts,
                             const uint8_t *payload,
                             size_t payload_len)
{
    memset(frame, 0, sizeof(*frame));
    frame->header.magic = ESPNOW_PROTO_MAGIC;
    frame->header.version = ESPNOW_PROTO_VERSION;
    frame->header.msg_type = (uint8_t)type;
    frame->header.seq = seq;
    frame->header.ts = ts;
    if (device_id != NULL) {
        strncpy(frame->header.device_id, device_id, ESPNOW_PROTO_DEVICE_ID_MAX - 1);
    }

    if (payload != NULL && payload_len > 0) {
        size_t copy_len = payload_len > ESPNOW_PROTO_PAYLOAD_MAX ? ESPNOW_PROTO_PAYLOAD_MAX : payload_len;
        memcpy(frame->payload, payload, copy_len);
        frame->header.payload_len = (uint16_t)copy_len;
    } else {
        frame->header.payload_len = 0;
    }
}

size_t espnow_proto_encode(const espnow_proto_frame_t *frame, uint8_t *out, size_t out_cap)
{
    size_t encoded_len = frame_encoded_len(frame);
    if (frame->header.payload_len > ESPNOW_PROTO_PAYLOAD_MAX || encoded_len > out_cap) {
        return 0;
    }

    memcpy(out, &frame->header, sizeof(espnow_proto_header_t));
    if (frame->header.payload_len > 0) {
        memcpy(out + sizeof(espnow_proto_header_t), frame->payload, frame->header.payload_len);
    }
    return encoded_len;
}

bool espnow_proto_decode(const uint8_t *data, size_t len, espnow_proto_frame_t *out)
{
    if (data == NULL || out == NULL || len < sizeof(espnow_proto_header_t)) {
        return false;
    }

    memset(out, 0, sizeof(*out));
    memcpy(&out->header, data, sizeof(espnow_proto_header_t));

    if (out->header.magic != ESPNOW_PROTO_MAGIC ||
        out->header.version != ESPNOW_PROTO_VERSION ||
        !espnow_proto_is_supported_type(out->header.msg_type)) {
        return false;
    }

    if (out->header.payload_len > ESPNOW_PROTO_PAYLOAD_MAX) {
        return false;
    }

    if (len != sizeof(espnow_proto_header_t) + out->header.payload_len) {
        return false;
    }

    if (out->header.payload_len > 0) {
        memcpy(out->payload, data + sizeof(espnow_proto_header_t), out->header.payload_len);
    }
    return true;
}
