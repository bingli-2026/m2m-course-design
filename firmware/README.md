# ESP32 Firmware Workspace

本目录包含三个 ESP32 子项目：

- `esp32-terminal-a`
- `esp32-terminal-b`
- `esp32-gateway`

## 当前状态检查（2026-04-30）

### 1) 项目初始化

已初始化（目录结构、`platformio.ini`、`CMakeLists.txt`、`src/main.c` 均存在）。

### 2) 环境固定（可复现构建）

当前为“基本完成”，关键工具链版本已固定：

- 三个项目均使用 `framework = espidf` 和 `board = nodemcu-32s`。
- 三个项目均配置了统一 `core_dir = ../../.pio-core`。
- `esp32-gateway` 目录下已出现 `.pio/` 与 `.pio-core/`（说明至少执行过一次 PlatformIO 初始化/构建）。
- 仓库根目录共享的 `.pio-core/packages.lock` 目前为空文件。
- 三个项目均固定 `platform = espressif32@6.8.1`。
- 已去除 Linux 专属串口硬编码，改为命令行传入端口，兼容 Linux / Windows。

结论：项目已初始化，且已完成核心构建环境版本固定。串口设备号按本机实际端口传参即可复现。

## 建议的固定方式

1. 清理后重新安装依赖，确保本机包缓存一致：

```bash
# 在 firmware/esp32-gateway 下示例执行
pio pkg update
pio run
```

2. 将可用于复现的锁文件纳入版本控制（若团队流程允许）。

## 常用命令

```bash
# 以 gateway 为例
cd firmware/esp32-gateway
pio run
pio run -t upload --upload-port <PORT>
pio device monitor -b 115200 --port <PORT>
```

Linux 端口示例：`/dev/ttyUSB0`  
Windows 端口示例：`COM3`
