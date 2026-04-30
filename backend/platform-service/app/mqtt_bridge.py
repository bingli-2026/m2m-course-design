from __future__ import annotations

import json
import os
from typing import Any

import paho.mqtt.client as mqtt

from app.state_store import InMemoryStateStore


class MqttBridge:
    def __init__(self, state_store: InMemoryStateStore) -> None:
        self._state_store = state_store
        self._enabled = os.getenv("ENABLE_MQTT", "false").lower() in {"1", "true", "yes"}
        self._host = os.getenv("MQTT_HOST", "127.0.0.1")
        self._port = int(os.getenv("MQTT_PORT", "1883"))
        self._client_id = os.getenv("MQTT_CLIENT_ID", "platform-service")
        self._topic_up_heartbeat = os.getenv("MQTT_TOPIC_UP_HEARTBEAT", "m2m/up/heartbeat")
        self._topic_up_telemetry = os.getenv("MQTT_TOPIC_UP_TELEMETRY", "m2m/up/telemetry")
        self._topic_up_event = os.getenv("MQTT_TOPIC_UP_EVENT", "m2m/up/event")
        self._topic_up_command_ack = os.getenv("MQTT_TOPIC_UP_COMMAND_ACK", "m2m/up/command_ack")
        self._topic_down_command_prefix = os.getenv("MQTT_TOPIC_DOWN_COMMAND_PREFIX", "m2m/down/command")
        self._client: mqtt.Client | None = None

    @staticmethod
    def _parse_optional_int(value: Any) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return None

    @property
    def enabled(self) -> bool:
        return self._enabled

    def start(self) -> None:
        if not self._enabled:
            self._state_store.append_event(
                level="INFO",
                title="MQTT bridge disabled",
                detail="ENABLE_MQTT is false",
                device_id=None,
            )
            return

        client = mqtt.Client(client_id=self._client_id, protocol=mqtt.MQTTv311)
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        client.connect(self._host, self._port, keepalive=60)
        client.loop_start()
        self._client = client
        self._state_store.append_event(
            level="INFO",
            title="MQTT bridge started",
            detail=f"connected to {self._host}:{self._port}",
            device_id=None,
        )

    def stop(self) -> None:
        if self._client is None:
            return
        self._client.loop_stop()
        self._client.disconnect()
        self._state_store.append_event(
            level="INFO",
            title="MQTT bridge stopped",
            detail="client disconnected",
            device_id=None,
        )
        self._client = None

    def publish_command(self, *, target_device: str, command: str, params: dict[str, Any] | None, command_id: int) -> bool:
        if not self._enabled or self._client is None:
            return False
        topic = f"{self._topic_down_command_prefix}/{target_device}"
        payload = json.dumps(
            {
                "command_id": command_id,
                "target_device": target_device,
                "command": command,
                "params": params or {},
            },
            ensure_ascii=False,
        )
        info = self._client.publish(topic, payload=payload, qos=0, retain=False)
        return int(info.rc) == mqtt.MQTT_ERR_SUCCESS

    def _on_connect(self, client: mqtt.Client, _userdata: Any, _flags: Any, reason_code: Any, _properties: Any = None) -> None:
        if int(reason_code) != 0:
            self._state_store.append_event(
                level="WARN",
                title="MQTT connect failed",
                detail=f"reason_code={reason_code}",
                device_id=None,
            )
            return
        client.subscribe(self._topic_up_heartbeat)
        client.subscribe(self._topic_up_telemetry)
        client.subscribe(self._topic_up_event)
        client.subscribe(self._topic_up_command_ack)

    def _on_message(self, _client: mqtt.Client, _userdata: Any, msg: mqtt.MQTTMessage) -> None:
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except Exception:
            self._state_store.append_event(
                level="WARN",
                title="MQTT payload decode failed",
                detail=f"topic={msg.topic}",
                device_id=None,
            )
            return

        if msg.topic == self._topic_up_heartbeat:
            device_id = str(payload.get("device_id", "")).strip()
            if not device_id:
                return
            seq = payload.get("heartbeat_seq")
            seq_int = self._parse_optional_int(seq)
            self._state_store.ingest_heartbeat(device_id=device_id, heartbeat_seq=seq_int)
            self._state_store.append_event(
                level="INFO",
                title="Heartbeat received via MQTT",
                detail=f"device={device_id}, seq={seq_int}",
                device_id=device_id,
            )
            return

        if msg.topic == self._topic_up_telemetry:
            device_id = str(payload.get("device_id", "")).strip()
            if not device_id:
                return
            status = payload.get("status")
            seq = payload.get("heartbeat_seq")
            fault_code = payload.get("fault_code")
            seq_int = self._parse_optional_int(seq)
            self._state_store.ingest_telemetry(
                device_id=device_id,
                status=str(status) if status is not None else None,
                heartbeat_seq=seq_int,
                fault_code=str(fault_code) if fault_code is not None else None,
            )
            self._state_store.append_event(
                level="INFO",
                title="Telemetry received via MQTT",
                detail=f"device={device_id}",
                device_id=device_id,
            )
            return

        if msg.topic == self._topic_up_event:
            level = str(payload.get("level", "INFO")).upper()
            title = str(payload.get("title", "MQTT event"))
            detail = str(payload.get("detail", payload))
            device_id = payload.get("device_id")
            self._state_store.append_event(
                level=level,
                title=title,
                detail=detail,
                device_id=str(device_id) if device_id else None,
            )
            return

        if msg.topic == self._topic_up_command_ack:
            cmd_id = self._parse_optional_int(payload.get("command_id"))
            status = str(payload.get("status", "")).strip().lower()
            device_id = str(payload.get("device_id", "")).strip() or None
            detail = str(payload.get("detail", ""))
            if cmd_id is None or status not in {"acked", "failed"}:
                self._state_store.append_event(
                    level="WARN",
                    title="Invalid command ack payload",
                    detail=f"payload={payload}",
                    device_id=device_id,
                )
                return
            updated = self._state_store.update_command_status(command_id=cmd_id, status=status)
            self._state_store.append_event(
                level="INFO" if status == "acked" else "WARN",
                title=f"Command {status}",
                detail=f"command_id={cmd_id}; {detail}",
                device_id=device_id,
            )
            if not updated:
                self._state_store.append_event(
                    level="WARN",
                    title="Command ack references unknown command",
                    detail=f"command_id={cmd_id}",
                    device_id=device_id,
                )
