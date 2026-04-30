# esp32-gateway

角色：网关节点（ESP32）

职责：
- 通过 ESP-NOW 接收 terminal-a / terminal-b 的上报。
- 通过 MQTT 转发到电脑端 backend。
- 订阅 backend 的下行命令并定向转发到对应 terminal。
