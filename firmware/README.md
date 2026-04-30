# ESP32 Firmware Workspace

本目录包含三个 ESP32 子项目：

- `esp32-terminal-a`
- `esp32-terminal-b`
- `esp32-gateway`

## 当前状态检查（2026-04-30）

### 1) 项目初始化

已初始化（目录结构、`platformio.ini`、`CMakeLists.txt`、`src/main.c` 均存在）。

### 2) 环境固定（可复现构建）

当前为“部分完成”，尚未完全固定：

- 三个项目均使用 `framework = espidf` 和 `board = nodemcu-32s`。
- 三个项目均配置了统一 `core_dir = ../../.pio-core`。
- `esp32-gateway` 目录下已出现 `.pio/` 与 `.pio-core/`（说明至少执行过一次 PlatformIO 初始化/构建）。
- 仓库根目录共享的 `.pio-core/packages.lock` 目前为空文件。
- `platformio.ini` 里 `platform = espressif32` 未指定固定版本（例如 `espressif32@x.y.z`）。

结论：项目已初始化，但严格意义上的“版本锁定环境”尚未完成。

## 建议的固定方式

1. 在三个 `platformio.ini` 中统一锁定平台版本（示例）：

```ini
platform = espressif32@6.8.1
```

2. 清理后重新安装依赖，确保锁文件有有效内容：

```bash
# 在 firmware/esp32-gateway 下示例执行
pio pkg update
pio run
```

3. 将可用于复现的锁文件纳入版本控制（若团队流程允许）。

## 常用命令

```bash
# 以 gateway 为例
cd firmware/esp32-gateway
pio run
pio run -t upload
pio device monitor -b 115200
```

若串口不是 `/dev/ttyUSB0`，请先修改对应 `platformio.ini` 的 `upload_port` 与 `monitor_port`。
