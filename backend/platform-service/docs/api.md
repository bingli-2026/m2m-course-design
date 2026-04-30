# Platform Service API (v1)

本文档用于课程设计联调，假设 Mosquitto 已独立运行。  
Python `platform-service` 负责 HTTP API、状态聚合、控制编排与事件记录。

## 1. 架构约定

- Broker: Mosquitto（独立服务，不由 Python 进程启动）
- Platform Service: FastAPI
- Dashboard: 通过 HTTP API 读取状态/事件并下发控制

## 2. 基础信息

- Base URL: `http://localhost:8000`
- Content-Type: `application/json`

## 3. Health

### `GET /healthz`

服务健康检查。

Response:

```json
{ "status": "ok" }
```

## 4. State & Events

### `GET /api/v1/state`

获取当前设备快照（terminal-a / terminal-b / gateway）。

### `GET /api/v1/events?limit=50`

获取事件流，`limit` 范围 1~200。

支持过滤参数：

- `level`（如 `INFO`/`WARN`/`CRITICAL`）
- `device_id`
- `start`（ISO 时间）
- `end`（ISO 时间）

## 5. Control API

### `POST /api/v1/control/command`

下发控制命令。

Request:

```json
{
  "target_device": "terminal-a",
  "command": "start_sampling",
  "params": { "rate": 2 }
}
```

Response:

```json
{
  "status": "ok",
  "target_device": "terminal-a",
  "command": "start_sampling",
  "applied_at": "2026-04-30T09:00:00+00:00",
  "event_id": 12,
  "command_id": 3,
  "state": {
    "device_id": "terminal-a",
    "status": "ONLINE",
    "last_seen": "2026-04-30T09:00:00+00:00",
    "heartbeat_seq": 21,
    "fault_code": null
  }
}
```

支持命令（当前内存实现）：

- `start_sampling`
- `sync_config`
- `reboot`
- `reset_node`
- `emergency_stop` / `stop`
- `clear_fault` / `recover`

### `GET /api/v1/control/commands/{command_id}`

查询某条命令记录。

- `404`: 命令不存在

### `GET /api/v1/control/commands?limit=50&status=&target_device=`

分页查询命令记录，支持按状态和设备过滤。

命令状态说明：

- `pending`: 已入库，等待下发
- `sent`: 已发布到 MQTT 下行 topic
- `acked`: 设备回执成功
- `failed`: 设备回执失败
- `ignored`: 平台判定为未知命令，未执行

### `POST /api/v1/control/commands/{command_id}/ack`

手动回写命令状态（用于设备侧 ACK 尚未打通时的联调）。

Request:

```json
{
  "status": "acked",
  "detail": "simulated ack",
  "device_id": "terminal-a"
}
```

`status` 仅允许：`acked` 或 `failed`。

## 6. Ingest API

### `POST /api/v1/ingest/heartbeat`

设备心跳上报。

Request:

```json
{
  "device_id": "gateway",
  "heartbeat_seq": 99
}
```

### `POST /api/v1/ingest/telemetry`

设备状态/遥测上报。

Request:

```json
{
  "device_id": "terminal-b",
  "status": "WARNING",
  "heartbeat_seq": 33,
  "fault_code": "TEMP_HIGH"
}
```

### `POST /api/v1/ingest/event`

设备侧事件上报。

Request:

```json
{
  "level": "WARN",
  "title": "Temperature near threshold",
  "detail": "terminal-b temperature 41.8C",
  "device_id": "terminal-b"
}
```

## 7. Metrics API

### `GET /api/v1/metrics/summary`

返回演示指标摘要：

- `device_total`
- `online_count`
- `warning_count`
- `fault_count`
- `online_rate`
- `event_total`
- `command_total`

## 8. Realtime API

### `GET /api/v1/stream` (WebSocket)

建立 WebSocket 连接后，服务端每秒推送一次聚合快照：

- `state`（`/api/v1/state`）
- `events`（最近 20 条）
- `metrics`（`/api/v1/metrics/summary`）
- `commands`（最近 20 条）

示例前端使用方式：连接后持续接收 JSON 消息并更新大屏状态。

## 9. MQTT 说明（当前阶段）

当前服务已支持 MQTT bridge（默认关闭）。开启后会：

- 订阅设备上报 topic（heartbeat/telemetry/event）
- 控制 API 调用后发布命令到下行 topic

### 8.1 环境变量

- `ENABLE_MQTT=true` 开启 bridge（默认 `false`）
- `MQTT_HOST=127.0.0.1`
- `MQTT_PORT=1883`
- `MQTT_CLIENT_ID=platform-service`
- `MQTT_TOPIC_UP_HEARTBEAT=m2m/up/heartbeat`
- `MQTT_TOPIC_UP_TELEMETRY=m2m/up/telemetry`
- `MQTT_TOPIC_UP_EVENT=m2m/up/event`
- `MQTT_TOPIC_UP_COMMAND_ACK=m2m/up/command_ack`
- `MQTT_TOPIC_DOWN_COMMAND_PREFIX=m2m/down/command`

### 8.2 Topic 约定

- 上报心跳: `m2m/up/heartbeat`
- 上报遥测: `m2m/up/telemetry`
- 上报事件: `m2m/up/event`
- 命令回执: `m2m/up/command_ack`
- 下发命令: `m2m/down/command/{device_id}`

命令回执 payload 示例：

```json
{
  "command_id": 12,
  "device_id": "terminal-a",
  "status": "acked",
  "detail": "sampling started"
}
```

结论：保留一个 Python `platform-service` 进程 + 一个 Mosquitto broker 进程即可，不需要 Python 实现 broker。
