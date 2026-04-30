# Lifecycle and State Machines

## 1. System Lifecycle

1. Provision
- Flash firmware to `esp32-terminal-a`, `esp32-terminal-b`, `esp32-gateway`.
- Configure gateway Wi-Fi + MQTT broker endpoint.
- Start backend and dashboard on PC.

2. Bootstrap
- Gateway starts first, joins Wi-Fi, connects to MQTT broker.
- Terminal nodes start, initialize sensors/IO, and bind ESP-NOW peer (gateway).
- Backend starts HTTP API and in-memory state store.
- Dashboard loads and polls backend state API.

3. Registration
- Terminals send `REGISTER` event over ESP-NOW.
- Gateway publishes registration messages to MQTT.
- Backend creates/updates node records, sets node status `ONLINE`.

4. Running
- Terminals send heartbeat + telemetry periodically.
- Gateway forwards upstream and handles downstream control commands.
- Backend maintains latest state and computes online/offline by heartbeat timeout.
- Dashboard renders live state cards and warning indicators.

5. Fault/Recovery
- Any node can enter degraded/fault mode.
- Backend records fault event and exposes fault fields to dashboard.
- Recovery is triggered by auto-retry or operator command.

6. Shutdown
- Backend/dash process exits gracefully.
- Gateway and terminals continue edge operation; reconnect when backend returns.

## 2. Node State Machines

## 2.1 Terminal Node (A/B)

States:
- `BOOT`
- `INIT_RADIO`
- `REGISTERING`
- `ONLINE`
- `FAULT`
- `OFFLINE_RETRY`

Transitions:
- `BOOT -> INIT_RADIO`: hardware init complete.
- `INIT_RADIO -> REGISTERING`: ESP-NOW ready.
- `REGISTERING -> ONLINE`: register ACK or first successful uplink.
- `ONLINE -> FAULT`: local sensor/runtime error.
- `ONLINE -> OFFLINE_RETRY`: repeated send failures / gateway timeout.
- `FAULT -> OFFLINE_RETRY`: fault cleared and retry requested.
- `OFFLINE_RETRY -> REGISTERING`: link restored.

## 2.2 Gateway Node

States:
- `BOOT`
- `WIFI_CONNECTING`
- `MQTT_CONNECTING`
- `BRIDGING`
- `DEGRADED`
- `RECOVERING`

Transitions:
- `BOOT -> WIFI_CONNECTING`: network stack ready.
- `WIFI_CONNECTING -> MQTT_CONNECTING`: Wi-Fi connected.
- `MQTT_CONNECTING -> BRIDGING`: broker connected and subscribed.
- `BRIDGING -> DEGRADED`: ESP-NOW or MQTT side unhealthy.
- `DEGRADED -> RECOVERING`: reconnect attempts start.
- `RECOVERING -> BRIDGING`: both ESP-NOW and MQTT healthy.

## 2.3 Backend (Platform Service)

States:
- `STARTING`
- `READY`
- `PARTIAL_DEGRADED`
- `UNAVAILABLE`

Transitions:
- `STARTING -> READY`: HTTP server and state store ready.
- `READY -> PARTIAL_DEGRADED`: missing heartbeat from some nodes.
- `PARTIAL_DEGRADED -> READY`: all required nodes healthy.
- `READY|PARTIAL_DEGRADED -> UNAVAILABLE`: process stop/crash.

## 2.4 Dashboard

States:
- `LOADING`
- `LIVE`
- `STALE`
- `ERROR`

Transitions:
- `LOADING -> LIVE`: first successful `/api/v1/state`.
- `LIVE -> STALE`: polling timeout or stale timestamp threshold exceeded.
- `LIVE|STALE -> ERROR`: repeated API failures.
- `STALE|ERROR -> LIVE`: API recovers with fresh data.

## 3. Key Event Flows

## 3.1 Startup
1. Gateway enters `BRIDGING`.
2. Terminal A/B enter `REGISTERING` then `ONLINE`.
3. Backend receives first updates, exposes consolidated state.
4. Dashboard enters `LIVE`.

## 3.2 Registration
1. Terminal sends registration payload with `device_id`, `fw_version`, `boot_id`.
2. Gateway forwards to backend topic.
3. Backend writes node state: `registered=true`, `status=ONLINE`, `last_seen=now`.

## 3.3 Heartbeat
1. Terminal publishes heartbeat every N seconds.
2. Gateway forwards unchanged (adds gateway metadata if needed).
3. Backend updates `last_seen`, computes `online=true`.
4. Dashboard card shows green/online.

## 3.4 Fault
1. Terminal detects error and emits fault code.
2. Gateway forwards event immediately.
3. Backend sets node status `FAULT`, stores `fault_code` and `fault_at`.
4. Dashboard highlights node and fault detail.

## 3.5 Control Command
1. Operator clicks dashboard action.
2. Frontend calls backend command API (future extension).
3. Backend publishes MQTT command to gateway downlink topic.
4. Gateway forwards command over ESP-NOW to target terminal.
5. Terminal applies command and emits ACK/state update.

## 3.6 Offline and Recovery
1. Backend marks node offline when `now - last_seen > timeout`.
2. Dashboard marks card gray/offline.
3. Node reconnects and sends registration/heartbeat.
4. Backend flips node to online and clears offline alarm.
