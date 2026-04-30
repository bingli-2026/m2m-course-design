import { useEffect, useRef, useState } from "react";
import { get, post } from "../api/client";
import type {
  DeviceState,
  EventItem,
  CommandRequest,
  CommandResponse,
  MetricsSummary,
  StateResponse,
  EventsResponse,
  CommandsResponse,
  RealtimeMetricsResponse,
} from "../api/types";

export function useStatePolling(intervalMs = 3000) {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const fetchState = async () => {
    try {
      const data = await get<StateResponse>("/api/v1/state");
      setDevices(data.workstations ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    timer.current = setInterval(fetchState, intervalMs);
    return () => clearInterval(timer.current);
  }, [intervalMs]);

  return { devices, loading, error, refetch: fetchState };
}

export function useEvents(page = 1, pageSize = 20) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offset = (page - 1) * pageSize;

  const fetchEvents = async () => {
    try {
      const data = await get<EventsResponse>(`/api/v1/events?limit=${pageSize}&offset=${offset}`);
      const normalized: EventItem[] = (data.events ?? []).map((e) => ({
        ...e,
        ts: new Date(e.timestamp).toLocaleTimeString("zh-CN", { hour12: false }),
      }));
      setEvents(normalized);
      setTotal(data.total ?? 0);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchEvents();
    const timer = setInterval(fetchEvents, 5000);
    return () => clearInterval(timer);
  }, [page, pageSize]);

  return { events, total, loading, error, refetch: fetchEvents };
}

export function useMetrics(intervalMs = 5000) {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const data = await get<MetricsSummary>("/api/v1/metrics/summary");
      setMetrics(data);
    } catch {
      // metrics may not be available yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const timer = setInterval(fetchMetrics, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return { metrics, loading };
}

export function useRealtimeMetrics(intervalMs = 5000) {
  const [realtime, setRealtime] = useState<RealtimeMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRealtime = async () => {
    try {
      const data = await get<RealtimeMetricsResponse>("/api/v1/metrics/realtime?points=12&bucket_seconds=5");
      setRealtime(data);
    } catch {
      // keep last
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealtime();
    const timer = setInterval(fetchRealtime, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return { realtime, loading };
}

export function useCommands(limit = 50, intervalMs = 3000) {
  const [commands, setCommands] = useState<CommandsResponse["commands"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommands = async () => {
    try {
      const data = await get<CommandsResponse>(`/api/v1/control/commands?limit=${limit}`);
      setCommands(data.commands ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommands();
    const timer = setInterval(fetchCommands, intervalMs);
    return () => clearInterval(timer);
  }, [limit, intervalMs]);

  return { commands, loading, error, refetch: fetchCommands };
}

export function useControl() {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendCommand = async (req: CommandRequest) => {
    setSending(true);
    setError(null);
    try {
      const res = await post<CommandResponse>("/api/v1/control/command", req);
      setLastResult(res);
      return res;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setSending(false);
    }
  };

  return { sendCommand, sending, lastResult, error };
}
