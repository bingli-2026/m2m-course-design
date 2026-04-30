export type DeviceState = {
  device_id: string;
  status: "ONLINE" | "WARNING" | "OFFLINE";
  last_seen: string;
  heartbeat_seq: number;
  fault_code: string | null;
};

export type EventItem = {
  id: number;
  ts: string;
  timestamp?: string;
  level: "INFO" | "WARN" | "CRITICAL";
  device_id: string | null;
  title: string;
  detail: string;
};

export type CommandRequest = {
  target_device: string;
  command: string;
  params?: Record<string, unknown>;
};

export type CommandResponse = {
  status: string;
  target_device: string;
  command: string;
  applied_at: string;
  event_id: number;
  command_id: number;
  state: DeviceState;
};

export type MetricsSummary = {
  device_total: number;
  online_count: number;
  warning_count: number;
  fault_count: number;
  online_rate: number;
  event_total: number;
  command_total: number;
};

export type StateResponse = {
  updated_at: string;
  workstations: DeviceState[];
};

export type EventsResponse = {
  updated_at: string;
  events: Array<{
    id: number;
    timestamp: string;
    level: "INFO" | "WARN" | "CRITICAL";
    device_id: string | null;
    title: string;
    detail: string;
  }>;
};

export type CommandsResponse = {
  updated_at: string;
  commands: Array<{
    id: number;
    target_device: string;
    command: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
};
