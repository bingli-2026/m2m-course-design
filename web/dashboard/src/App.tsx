import { useEffect, useState } from "react";
import "./App.css";

type WorkstationState = {
  device_id: string;
  status: string;
  last_seen: string;
  heartbeat_seq: number;
  fault_code?: string | null;
};

type Snapshot = {
  updated_at: string;
  workstations: WorkstationState[];
};

function borderColor(status: string): string {
  if (status === "ONLINE") return "#2e7d32";
  if (status === "FAULT") return "#c62828";
  return "#616161";
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    updated_at: "",
    workstations: [
      { device_id: "terminal-a", status: "UNKNOWN", last_seen: "", heartbeat_seq: 0 },
      { device_id: "terminal-b", status: "UNKNOWN", last_seen: "", heartbeat_seq: 0 },
    ],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let timer: number | undefined;

    const loadState = async () => {
      try {
        const res = await fetch("/api/v1/state");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Snapshot;
        setSnapshot(data);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    };

    void loadState();
    timer = window.setInterval(() => void loadState(), 2000);

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="page">
      <h1>M2M 产线实时看板</h1>
      <p className="meta">更新时间: {snapshot.updated_at || "-"}</p>
      {error ? <p className="error">状态拉取失败: {error}</p> : null}

      <section className="grid">
        {snapshot.workstations.map((node) => (
          <article key={node.device_id} className="card" style={{ borderColor: borderColor(node.status) }}>
            <h2>{node.device_id}</h2>
            <p>状态: {node.status}</p>
            <p>心跳序号: {node.heartbeat_seq}</p>
            <p>故障码: {node.fault_code ?? "-"}</p>
            <p>最后心跳: {node.last_seen || "-"}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
