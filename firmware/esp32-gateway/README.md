# esp32-gateway

角色：网关节点（ESP32）

职责：
- 通过 ESP-NOW 接收 terminal-a / terminal-b 的上报。
- 通过 MQTT 转发到电脑端 backend。
- 订阅 backend 的下行命令并定向转发到对应 terminal。

## 当前实现说明

`src/main.c` 已实现基础桥接闭环（状态机 + Wi-Fi + MQTT + ESP-NOW）：

并新增 ESP-NOW 协议框架（`src/espnow_protocol.h/.c`）：
- 协议版本：`espnow-v1`
- 消息类型：`REGISTER` / `TELEMETRY` / `COMMAND` / `ACK`
- 统一头字段：`magic`、`version`、`msg_type`、`seq`、`ts`、`device_id`、`payload_len`
- 终端与网关后续建议统一走该帧格式（当前保留对旧 JSON 裸 payload 的兼容接收）

1. `ESP-NOW -> MQTT`：
- 接收终端上报（建议 JSON，含 `device_id` 字段）。
- 自动学习 `device_id -> terminal_mac` 映射。
- 上报到 `factory/line1/up/terminal/{device_id}/telemetry`。

2. `MQTT -> ESP-NOW`：
- 订阅 `factory/line1/down/terminal/+/command`。
- 从 topic 解析目标 `device_id`，查表找到终端 MAC。
- 原样透传 payload 给目标 terminal。

## 联调前需要修改

在 `src/main.c` 顶部替换以下常量：

- `WIFI_SSID`
- `WIFI_PASS`
- `MQTT_BROKER_URI`

例如：

```c
#define WIFI_SSID "your-ssid"
#define WIFI_PASS "your-password"
#define MQTT_BROKER_URI "mqtt://192.168.1.100:1883"
```
