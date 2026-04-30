import { useMemo, useState } from "react";
import { useCommands, useControl, useEvents, useRealtimeMetrics, useStatePolling } from "../hooks/useApi";
import { STATUS_LABELS } from "../types";

type StepStatus = "done" | "active" | "pending";

type RuntimeStep = {
  step: number;
  title: string;
  desc: string;
  status: StepStatus;
};

function deriveSteps(
  terminalOnline: boolean,
  hasTelemetryFlow: boolean,
  hasAckedCommand: boolean,
  hasAlertEvent: boolean,
): RuntimeStep[] {
  const flags = [terminalOnline, hasTelemetryFlow, hasAckedCommand, hasAlertEvent];
  const firstPending = flags.findIndex((v) => !v);

  return [
    {
      step: 1,
      title: "系统检查",
      desc: "终端与网关在线状态检查",
      status: terminalOnline ? "done" : firstPending === 0 ? "active" : "pending",
    },
    {
      step: 2,
      title: "数据采样",
      desc: "检测实时数据吞吐量是否持续更新",
      status: hasTelemetryFlow ? "done" : firstPending === 1 ? "active" : "pending",
    },
    {
      step: 3,
      title: "控制指令",
      desc: "下发命令并等待设备回执 acked",
      status: hasAckedCommand ? "done" : firstPending === 2 ? "active" : "pending",
    },
    {
      step: 4,
      title: "异常与告警",
      desc: "出现 WARN/CRITICAL 事件并可在事件流看到",
      status: hasAlertEvent ? "done" : firstPending === 3 ? "active" : "pending",
    },
  ];
}

function stepLabel(s: StepStatus): string {
  if (s === "done") return "通过";
  if (s === "active") return "进行中";
  return "--";
}

export default function DemoPage() {
  const { devices } = useStatePolling(3000);
  const { realtime } = useRealtimeMetrics(3000);
  const { events } = useEvents(100);
  const { commands } = useCommands(100, 3000);
  const { sendCommand, sending } = useControl();

  const [activeDevice] = useState("terminal-a");
  const [cmdOutput, setCmdOutput] = useState<string | null>(null);

  const terminalA = devices.find((d) => d.device_id === "terminal-a");
  const gateway = devices.find((d) => d.device_id === "gateway");

  const terminalOnline = Boolean(terminalA && terminalA.status === "ONLINE");
  const hasTelemetryFlow = Boolean(realtime && realtime.throughput.some((x) => x > 0));
  const hasAckedCommand = commands.some((c) => c.target_device === activeDevice && c.status === "acked");
  const hasAlertEvent = events.some((e) => e.level === "WARN" || e.level === "CRITICAL");

  const steps = useMemo(
    () => deriveSteps(terminalOnline, hasTelemetryFlow, hasAckedCommand, hasAlertEvent),
    [terminalOnline, hasTelemetryFlow, hasAckedCommand, hasAlertEvent],
  );

  const activeStep = steps.find((s) => s.status === "active");
  const completedCount = steps.filter((s) => s.status === "done").length;
  const demoActive = completedCount < steps.length;

  const executeStep = async () => {
    if (!activeStep || sending) return;

    if (activeStep.step === 1) {
      setCmdOutput("> 检查 terminal-a / gateway 状态...\n" +
        `> terminal-a=${terminalA?.status ?? "UNKNOWN"}, gateway=${gateway?.status ?? "UNKNOWN"}`,
      );
      return;
    }

    if (activeStep.step === 2) {
      setCmdOutput(
        "> 检查实时吞吐...\n" +
          `> throughput=${(realtime?.throughput ?? []).join(",")}`,
      );
      return;
    }

    if (activeStep.step === 3) {
      const command = "start_sampling";
      setCmdOutput(`> ${command} --target=${activeDevice}\n> AWAITING_ACK...`);
      try {
        const res = await sendCommand({ target_device: activeDevice, command });
        setCmdOutput(
          `> ${command} --target=${activeDevice}\n` +
            `> command_id=${res.command_id}\n` +
            `> command_status=${res.command_status ?? res.status}`,
        );
      } catch {
        setCmdOutput(`> ${command} --target=${activeDevice}\n> ERROR: 命令下发失败`);
      }
      return;
    }

    if (activeStep.step === 4) {
      setCmdOutput(
        "> 检查告警事件流...\n" +
          `> warn+critical=${events.filter((e) => e.level === "WARN" || e.level === "CRITICAL").length}`,
      );
    }
  };

  return (
    <main className="flex flex-1 gap-gutter overflow-auto">
      <div className="flex flex-1 flex-col gap-gutter">
        <div className="rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-headline-sm text-headline-sm mb-1 text-on-background">实时联调演示</h2>
              <p className="font-body-md text-body-md text-secondary">
                全部步骤由真实后端数据驱动（{completedCount}/{steps.length}）
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-status-label text-status-label ${
                demoActive
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${demoActive ? "animate-pulse bg-primary" : "bg-emerald-500"}`} />
              {demoActive ? "演示运行中" : "演示完成"}
            </span>
          </div>
        </div>

        <div className="flex min-h-[340px] flex-1 flex-col rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-lg">
          <h3 className="font-label-caps text-label-caps mb-6 uppercase tracking-widest text-secondary">实时链路观测</h3>
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
            <div className="rounded-DEFAULT border border-outline-variant bg-surface-bright p-md">
              <p className="font-label-caps text-label-caps text-secondary">terminal-a</p>
              <p className="font-display-data text-display-data text-primary">{terminalA ? STATUS_LABELS[terminalA.status] ?? terminalA.status : "UNKNOWN"}</p>
              <p className="text-xs text-outline">heartbeat #{terminalA?.heartbeat_seq ?? 0}</p>
            </div>
            <div className="rounded-DEFAULT border border-outline-variant bg-surface-bright p-md">
              <p className="font-label-caps text-label-caps text-secondary">gateway</p>
              <p className="font-display-data text-display-data text-primary">{gateway ? STATUS_LABELS[gateway.status] ?? gateway.status : "UNKNOWN"}</p>
              <p className="text-xs text-outline">heartbeat #{gateway?.heartbeat_seq ?? 0}</p>
            </div>
            <div className="rounded-DEFAULT border border-outline-variant bg-surface-bright p-md">
              <p className="font-label-caps text-label-caps text-secondary">throughput</p>
              <p className="font-display-data text-display-data text-primary">
                {realtime?.throughput?.[realtime.throughput.length - 1] ?? 0}
              </p>
              <p className="text-xs text-outline">events / bucket</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-gutter">
          {steps.map((s) => (
            <div
              key={s.step}
              className={`rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-md transition-all duration-300 ${
                s.status === "active"
                  ? "border-primary ring-1 ring-primary shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                  : s.status === "pending"
                    ? "opacity-50"
                    : "border-emerald-300"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    s.status === "active" ? "animate-spin" : ""
                  } ${s.status === "done" ? "text-emerald-500" : s.status === "active" ? "text-primary" : "text-secondary"}`}
                >
                  {s.status === "done" ? "check_circle" : s.status === "active" ? "sync" : "pending"}
                </span>
                <span
                  className={`font-label-caps text-label-caps uppercase ${
                    s.status === "active" ? "text-primary" : s.status === "done" ? "text-emerald-600" : "text-on-background"
                  }`}
                >
                  {s.title}
                </span>
              </div>
              <div className="font-status-label text-status-label text-outline mb-2">{s.desc}</div>
              <div
                className={`font-display-data text-display-data ${
                  s.status === "active" ? "text-primary" : s.status === "pending" ? "text-secondary" : "text-emerald-600"
                }`}
              >
                {stepLabel(s.status)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="w-[360px] shrink-0 rounded-DEFAULT border border-outline-variant bg-[#0f172a] p-md text-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-slate-300">执行控制台</h3>
          <button
            onClick={executeStep}
            disabled={sending || !activeStep}
            className="rounded border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300 disabled:opacity-40"
          >
            执行当前步骤
          </button>
        </div>
        <div className="min-h-[320px] whitespace-pre-wrap font-mono text-sm text-slate-300">
          {cmdOutput ?? "等待执行..."}
        </div>
      </aside>
    </main>
  );
}
