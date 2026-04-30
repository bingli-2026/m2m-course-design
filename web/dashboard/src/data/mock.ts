// 模拟数据，后端不可用时作为 fallback 使用
import type { DeviceState, EventItem } from "../api/types";

export const fallbackDevices: DeviceState[] = [
  { device_id: "terminal-a", status: "ONLINE", last_seen: "2s ago", heartbeat_seq: 21, fault_code: null },
  { device_id: "terminal-b", status: "WARNING", last_seen: "5s ago", heartbeat_seq: 33, fault_code: "TEMP_HIGH" },
  { device_id: "gateway", status: "ONLINE", last_seen: "1s ago", heartbeat_seq: 99, fault_code: null },
];

export const fallbackEvents: EventItem[] = [
  { id: 1, ts: "16:21:04", level: "INFO", device_id: "terminal-a", title: "数据上载成功", detail: "terminal-a 开始周期采样" },
  { id: 2, ts: "16:21:12", level: "WARN", device_id: "terminal-b", title: "温度接近阈值", detail: "terminal-b 温度 41.8°C" },
  { id: 3, ts: "16:21:19", level: "CRITICAL", device_id: "terminal-b", title: "告警触发", detail: "terminal-b 温度越界，进入保护模式" },
  { id: 4, ts: "16:21:25", level: "INFO", device_id: "gateway", title: "下发恢复指令", detail: "控制台已发送降载指令至 terminal-b" },
];

export const demoSteps = [
  { step: 1, title: "系统检查", desc: "验证终端连通性与网关握手协议", status: "done" as const },
  { step: 2, title: "数据采样", desc: "启动高频遥测数据采集流程", status: "done" as const },
  { step: 3, title: "控制指令", desc: "从服务器向终端发送反向控制指令", status: "active" as const },
  { step: 4, title: "异常触发", desc: "模拟边缘节点故障，观察自动故障转移响应", status: "pending" as const },
];
