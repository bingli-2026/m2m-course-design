# course-design

三块 NodeMCU-32S + 电脑前后端分离架构：

- terminal-a（ESP32）
- terminal-b（ESP32）
- gateway（ESP32）
- backend/platform-service（PC 后端）
- web/dashboard（PC 前端）

## 数据流

1. terminal-a / terminal-b ->(ESP-NOW)-> gateway
2. gateway ->(MQTT)-> backend
3. backend ->(WebSocket/HTTP)-> dashboard
4. dashboard 控制 -> backend ->(MQTT)-> gateway ->(ESP-NOW)-> terminal

## 目录

- `firmware/esp32-terminal-a`
- `firmware/esp32-terminal-b`
- `firmware/esp32-gateway`
- `backend/platform-service`
- `web/dashboard`
- `docs`

## 复现文档

- Windows ESP32 环境复现：`docs/windows-esp32-setup.md`
- 产品需求文档（PRD）：`docs/product-prd.md`
- 全局协议基线（MQTT/HTTP）：`docs/protocol-contract.md`

## 全栈联调（热更新）

- Linux/macOS：`bash scripts/dev-fullstack.sh`
- Windows：`powershell -File scripts/dev-fullstack.ps1`
- 服务端口：
  - 后端 API：`http://127.0.0.1:8080`
  - 前端开发服务器：`http://127.0.0.1:5173`

## 联调冒烟脚本

- Linux/macOS：`bash scripts/smoke-e2e.sh`
- Windows：`powershell -File scripts/smoke-e2e.ps1`
- 一键验证 telemetry -> command -> mqtt ack -> 状态/事件回写链路

## 本地真实部署

- 启动（非 dev 模式）：
  - Linux/macOS：`bash scripts/deploy-stack.sh`
  - Windows：`powershell -File scripts/deploy-stack.ps1`
- 停止：
  - Linux/macOS：`bash scripts/stop-stack.sh`
  - Windows：`powershell -File scripts/stop-stack.ps1`
- 详细流程：
  - `docs/deployment-and-test-plan.md`

## Windows 前置依赖

- 安装 [Node.js](https://nodejs.org)（含 npm）
- 安装 [uv](https://docs.astral.sh/uv/)：`powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`
- 冒烟测试需 Mosquitto：`winget install EclipseFoundation.Mosquitto`（可选）
