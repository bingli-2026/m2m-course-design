export type NavKey = "dashboard" | "control" | "events" | "demo";

// 设备角色映射
export const DEVICE_ROLES: Record<string, string> = {
  "terminal-a": "工位 A",
  "terminal-b": "工位 B",
  gateway: "边缘网关",
};

// 状态中文
export const STATUS_LABELS: Record<string, string> = {
  ONLINE: "在线",
  WARNING: "告警",
  OFFLINE: "离线",
};

// 事件级别中文
export const LEVEL_LABELS: Record<string, string> = {
  INFO: "信息",
  WARN: "警告",
  CRITICAL: "严重",
};

// 命令中文标签
export const COMMAND_LABELS: Record<string, { icon: string; label: string }> = {
  reboot: { icon: "restart_alt", label: "重启" },
  start_sampling: { icon: "science", label: "开始采样" },
  sync_config: { icon: "sync", label: "同步配置" },
  reset_node: { icon: "restart_alt", label: "重置节点" },
  emergency_stop: { icon: "stop_circle", label: "紧急停止" },
  stop: { icon: "stop_circle", label: "停止" },
  clear_fault: { icon: "check_circle", label: "清除故障" },
  recover: { icon: "check_circle", label: "恢复" },
};
