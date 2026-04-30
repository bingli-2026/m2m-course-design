# Terminal B State Machine

States:
- `BOOT`
- `INIT_RADIO`
- `REGISTERING`
- `ONLINE`
- `FAULT`
- `OFFLINE_RETRY`

Transitions:
- `BOOT -> INIT_RADIO`: board and runtime init complete
- `INIT_RADIO -> REGISTERING`: ESP-NOW init and peer config ready
- `REGISTERING -> ONLINE`: registration uplink succeeds
- `ONLINE -> FAULT`: sensor/runtime fault detected
- `ONLINE -> OFFLINE_RETRY`: gateway timeout or repeated send failure
- `FAULT -> OFFLINE_RETRY`: fault cleared, retry scheduled
- `OFFLINE_RETRY -> REGISTERING`: link restored
