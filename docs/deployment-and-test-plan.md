# 部署与测试计划（本地演示版）

## 1. 真实部署（本机）

### 启动

```bash
cd /home/davisye/project/m2m/course-design
bash scripts/deploy-stack.sh
```

默认端口：

- 后端：`8080`
- 前端预览：`4173`
- MQTT：`1883`

### 停止

```bash
cd /home/davisye/project/m2m/course-design
bash scripts/stop-stack.sh
```

## 2. 现在只有一块开发板（/dev/ttyUSB0）如何测

### 阶段 A：仅验证平台链路（不依赖开发板）

```bash
cd /home/davisye/project/m2m/course-design
bash scripts/smoke-e2e.sh
```

目标：验证 telemetry -> command -> ack -> state/events 全链路。

### 阶段 B：单板刷 terminal-a，验证终端上行

1. 刷写 `firmware/esp32-terminal-a` 到 `/dev/ttyUSB0`。
2. 在后端看：
   - `GET /api/v1/state` 中 `terminal-a` 心跳增长
   - `GET /api/v1/events` 有上报事件
3. 在 broker 侧可用：

```bash
mosquitto_sub -h 127.0.0.1 -t 'm2m/up/#' -v
```

### 阶段 C：单板刷 gateway，验证网关桥接

1. 刷写 `firmware/esp32-gateway` 到 `/dev/ttyUSB0`。
2. 注意配置网关 `MQTT_BROKER_URI` 为宿主机可达地址（不能 127.0.0.1）。
3. 用 `mosquitto_sub` 看 gateway 是否发布到 `m2m/up/*`。

## 3. 三块板联测（同学到位后）

1. `terminal-a` + `terminal-b` + `gateway` 同时上电。
2. 后端运行 `make dev-mqtt` 或部署脚本模式。
3. 验证项：
   - 设备状态：3 个设备均可见
   - 控制下发：`POST /api/v1/control/command` 后状态变更
   - 回执：`/api/v1/control/commands/{id}` 进入 `acked/failed`
   - 事件流：`/api/v1/events` 有完整时间线

## 4. 常见坑

1. 网关 broker 地址误配为 `127.0.0.1`（ESP32 本机回环）。
2. 设备 `device_id` 不一致（必须使用 `terminal-a / terminal-b / gateway`）。
3. topic 混用旧路径（必须统一 `m2m/...`）。
