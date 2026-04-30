# Gateway State Machine

States:
- `BOOT`
- `WIFI_CONNECTING`
- `MQTT_CONNECTING`
- `BRIDGING`
- `DEGRADED`
- `RECOVERING`

Transitions:
- `BOOT -> WIFI_CONNECTING`: network stack ready
- `WIFI_CONNECTING -> MQTT_CONNECTING`: Wi-Fi connected
- `MQTT_CONNECTING -> BRIDGING`: broker connected and subscriptions ready
- `BRIDGING -> DEGRADED`: ESP-NOW or MQTT channel unhealthy
- `DEGRADED -> RECOVERING`: reconnect loop starts
- `RECOVERING -> BRIDGING`: both channels healthy again
