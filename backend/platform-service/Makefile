.PHONY: help dev dev-mqtt test smoke lint fmt

PORT ?= 8080
HOST ?= 0.0.0.0
MQTT_HOST ?= 127.0.0.1
MQTT_PORT ?= 1883
ENABLE_MQTT ?= false

help:
	@echo "Targets:"
	@echo "  make dev         # start backend with reload on :$(PORT)"
	@echo "  make dev-mqtt    # start backend with MQTT bridge enabled"
	@echo "  make test        # run pytest"
	@echo "  make smoke       # run end-to-end smoke script from repo root"
	@echo "  make lint        # placeholder (add linter later)"
	@echo "  make fmt         # placeholder (add formatter later)"

dev:
	ENABLE_MQTT=$(ENABLE_MQTT) MQTT_HOST=$(MQTT_HOST) MQTT_PORT=$(MQTT_PORT) \
	uv run uvicorn app.main:app --reload --host $(HOST) --port $(PORT)

dev-mqtt:
	ENABLE_MQTT=true MQTT_HOST=$(MQTT_HOST) MQTT_PORT=$(MQTT_PORT) \
	uv run uvicorn app.main:app --reload --host $(HOST) --port $(PORT)

test:
	PYTHONPATH=. uv run pytest -q

smoke:
	bash ../../scripts/smoke-e2e.sh

lint:
	@echo "No linter configured yet"

fmt:
	@echo "No formatter configured yet"
