# Windows 环境复现（ESP32 / PlatformIO）

本文用于在 Windows 上复现本仓库 ESP32 固件构建与烧录环境。

## 适用项目

- `firmware/esp32-terminal-a`
- `firmware/esp32-terminal-b`
- `firmware/esp32-gateway`

## 已固定项

- 板卡：`nodemcu-32s`
- 框架：`espidf`
- PlatformIO 平台版本：`espressif32@6.8.1`

## 前置准备

1. 安装 VS Code。
2. 在 VS Code 扩展中安装 `PlatformIO IDE`。
3. 用 USB 连接 NodeMCU-32S，确认设备管理器中的串口号（如 `COM3`）。

## 构建与烧录

以 `esp32-gateway` 为例：

```powershell
cd firmware/esp32-gateway
pio run
pio run -t upload --upload-port COM3
pio device monitor -b 115200 --port COM3
```

`terminal-a` / `terminal-b` 同理，只需要切换目录。

## 常见问题

### 1) 找不到 `pio` 命令

优先在 VS Code 的 PlatformIO Terminal 执行命令；或确认 PlatformIO Core 已安装并在 PATH 中。

### 2) 串口占用/烧录失败

- 关闭串口监视器后再烧录。
- 确认串口号正确（`COMx`）。
- 更换 USB 数据线或 USB 口。

### 3) 首次下载依赖较慢

首次构建会拉取工具链和依赖包，等待完成后再重试。

## 一次性验证标准

满足以下条件可视为 Windows 端复现成功：

1. `pio run` 编译通过。
2. `pio run -t upload --upload-port COMx` 烧录成功。
3. `pio device monitor -b 115200 --port COMx` 能看到串口日志输出。
