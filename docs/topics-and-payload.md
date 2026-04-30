# MQTT Topic 与消息草案

## 上行（gateway -> platform）

Topic:
- `factory/line1/up/terminal/{device_id}/telemetry`

Payload 示例：
```json
{
  "ts": 1714380000,
  "device_id": "term-01",
  "state": "RUNNING",
  "output": 123,
  "temp": 27.3,
  "fault": 0
}
```

## 下行（platform -> gateway -> terminal）

Topic:
- `factory/line1/down/terminal/{device_id}/command`

Payload 示例：
```json
{
  "cmd": "pause",
  "request_id": "req-1001"
}
```
