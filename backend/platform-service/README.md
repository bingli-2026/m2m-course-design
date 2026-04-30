# platform-service

## Run

```bash
uv run uvicorn app.main:app --reload --port 8080
```

Default SQLite database file: `platform.db` (override via `SQLITE_DB_PATH`).

Enable MQTT bridge:

```bash
ENABLE_MQTT=true MQTT_HOST=127.0.0.1 MQTT_PORT=1883 uv run uvicorn app.main:app --reload --port 8080
```

## Test

```bash
PYTHONPATH=. uv run pytest -q
```

## API Doc

- `docs/api.md`
