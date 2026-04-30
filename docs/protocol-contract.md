# M2M 全局协议基线（联调版）

日期：2026-04-30  
用途：统一前端 / 后端 / 网关 / 终端的数据与 topic 约定，避免各端各写一套。

## 1. 统一命名

- `device_id` 固定集合：
  - `terminal-a`
  - `terminal-b`
  - `gateway`
- 状态枚举：`ONLINE` / `WARNING` / `FAULT` / `UNKNOWN`
- 事件级别：`INFO` / `WARN` / `CRITICAL`

## 2. MQTT Topic 规范（统一使用 `m2m/...`）

### 2.1 上行（设备 -> 平台）

- 心跳：`m2m/up/heartbeat`
- 遥测：`m2m/up/telemetry`
- 事件：`m2m/up/event`
- 命令回执：`m2m/up/command_ack`

### 2.2 下行（平台 -> 设备）

- 命令：`m2m/down/command/{device_id}`

## 3. Payload 规范

### 3.1 `m2m/up/heartbeat`

```json
{
  "device_id": "terminal-a",
  "heartbeat_seq": 101
}
```

### 3.2 `m2m/up/telemetry`

```json
{
  "device_id": "terminal-a",
  "status": "ONLINE",
  "heartbeat_seq": 101,
  "fault_code": null
}
```

### 3.3 `m2m/up/event`

```json
{
  "level": "INFO",
  "title": "Sampling started",
  "detail": "terminal-a entered RUNNING",
  "device_id": "terminal-a"
}
```

### 3.4 `m2m/down/command/{device_id}`

```json
{
  "command_id": 12,
  "target_device": "terminal-a",
  "command": "start_sampling",
  "params": {
    "rate": 2
  }
}
```

### 3.5 `m2m/up/command_ack`

```json
{
  "command_id": 12,
  "device_id": "terminal-a",
  "status": "acked",
  "detail": "sampling started"
}
```

`status` 只允许：`acked` / `failed`

## 4. HTTP API 与 MQTT 对应关系

- `POST /api/v1/control/command` -> publish `m2m/down/command/{device_id}`
- subscribe `m2m/up/command_ack` -> update `command_log.status`
- subscribe `m2m/up/heartbeat|telemetry|event` -> 更新 state/events

## 5. 当前待固件侧对齐项

1. Gateway topic 当前是 `factory/line1/...`，需统一改到 `m2m/...`。
2. `terminal-a` 当前 `DEVICE_ID` 为 `term-a`，需改为 `terminal-a`。
3. Gateway MQTT broker URI 不能用 `127.0.0.1`（ESP32 本机回环），应配置为宿主机可达地址。

## 6. 联调验收标准

1. 终端发 `m2m/up/telemetry` 后，`GET /api/v1/state` 中对应设备状态更新。
2. 前端控制下发后，`GET /api/v1/control/commands/{id}` 状态从 `pending/sent` 进入 `acked/failed`。
3. `/api/v1/events` 中可看到上报事件与命令状态事件。
4. `/api/v1/stream` 可持续收到 state/events/metrics/commands 推送。
