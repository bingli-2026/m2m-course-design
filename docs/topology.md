# 三板 + 前后端分离拓扑

- ESP32 #1: terminal-a（工位A）
- ESP32 #2: terminal-b（工位B）
- ESP32 #3: gateway（网关）
- PC 后端: MQTT 消息接入、设备状态管理、命令下发 API
- PC 前端: 实时大屏（设备状态/产量/告警/趋势）

## MQTT 建议主题

上行：
- `factory/line1/up/term-a/telemetry`
- `factory/line1/up/term-b/telemetry`

下行：
- `factory/line1/down/term-a/command`
- `factory/line1/down/term-b/command`
