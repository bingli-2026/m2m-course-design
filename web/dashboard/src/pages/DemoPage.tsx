import { useState, useCallback } from "react";
import { useStatePolling, useControl } from "../hooks/useApi";
import { STATUS_LABELS } from "../types";

type StepStatus = "done" | "active" | "pending";

type DemoStep = {
  step: number;
  title: string;
  desc: string;
  status: StepStatus;
  command?: string;
};

const initialSteps: DemoStep[] = [
  { step: 1, title: "系统检查", desc: "验证终端连通性与网关握手协议", status: "active", command: undefined },
  { step: 2, title: "数据采样", desc: "启动高频遥测数据采集流程", status: "pending", command: "start_sampling" },
  { step: 3, title: "控制指令", desc: "从服务器向终端发送反向控制指令", status: "pending", command: "sync_config" },
  { step: 4, title: "异常触发", desc: "模拟边缘节点故障，观察自动故障转移响应", status: "pending", command: "clear_fault" },
];

function stepLabel(s: StepStatus): string {
  if (s === "done") return "通过";
  if (s === "active") return "进行中";
  return "--";
}

export default function DemoPage() {
  const { devices, loading } = useStatePolling(3000);
  const { sendCommand, sending } = useControl();

  const [steps, setSteps] = useState<DemoStep[]>(initialSteps);
  const [demoActive, setDemoActive] = useState(true);
  const [cmdOutput, setCmdOutput] = useState<string | null>(null);

  const activeStep = steps.find((s) => s.status === "active");
  const completedCount = steps.filter((s) => s.status === "done").length;

  const reset = useCallback(() => {
    setSteps(initialSteps.map((s) => ({ ...s })));
    setCmdOutput(null);
    setDemoActive(true);
  }, []);

  const advanceStep = useCallback(() => {
    setSteps((prev) => {
      const next = prev.map((s) => (s.status === "active" ? { ...s, status: "done" as StepStatus } : s));
      const firstPending = next.find((s) => s.status === "pending");
      if (firstPending) {
        next[next.indexOf(firstPending)] = { ...firstPending, status: "active" };
      } else {
        setDemoActive(false);
      }
      return next;
    });
  }, []);

  const executeStep = useCallback(async () => {
    if (!activeStep || sending) return;

    // 步骤 1 无需命令，直接通过
    if (!activeStep.command) {
      setCmdOutput("> 系统检查通过\n> 所有设备握手成功");
      advanceStep();
      return;
    }

    const target = devices[0]?.device_id ?? "terminal-a";
    const command = activeStep.command;

    setCmdOutput(`> ${command} --target=${target}\n> AWAITING_ACK...`);

    try {
      const res = await sendCommand({ target_device: target, command });
      setCmdOutput(
        `> ${command} --target=${target}\n> ACK: ${res.status}\n> event_id=${res.event_id}\n> device=${res.state.device_id} status=${res.state.status}`
      );
      advanceStep();
    } catch {
      setCmdOutput(`> ${command} --target=${target}\n> ERROR: 命令执行失败`);
    }
  }, [activeStep, sending, devices, sendCommand, advanceStep]);

  // 从真实设备数据拼装节点信息
  const terminalA = devices.find((d) => d.device_id === "terminal-a");
  const gateway = devices.find((d) => d.device_id === "gateway");

  return (
    <main className="flex flex-1 gap-gutter overflow-auto">
      {/* 中间区域 */}
      <div className="flex flex-1 flex-col gap-gutter">
        {/* 页头 */}
        <div className="rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-headline-sm text-headline-sm mb-1 text-on-background">
                实时遥测仿真
              </h2>
              <p className="font-body-md text-body-md text-secondary">
                演示端到端数据流与异常检测能力（{completedCount}/{steps.length} 步骤完成）
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-status-label text-status-label ${
                  demoActive
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${demoActive ? "animate-pulse bg-primary" : "bg-emerald-500"}`}
                />
                {demoActive ? "演示运行中" : "演示完成"}
              </span>
              <button
                onClick={reset}
                className="ml-2 flex items-center gap-2 rounded-DEFAULT border border-outline-variant px-4 py-2 font-label-caps text-label-caps uppercase text-secondary transition-colors hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 数据流可视化 */}
        <div className="flex min-h-[400px] flex-1 flex-col rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-lg">
          <h3 className="font-label-caps text-label-caps mb-6 uppercase tracking-widest text-secondary">
            数据环路可视化
          </h3>
          <div className="flex flex-1 items-center justify-center">
            <div className="relative flex w-full max-w-4xl items-center justify-between">
              {/* 连接线 */}
              <div className="absolute left-[80px] right-[50%] top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-outline-variant">
                <div
                  className={`h-full bg-primary transition-all duration-1000 ${
                    loading ? "w-0" : completedCount >= 2 ? "w-full" : "w-1/2 animate-[progress_2s_ease-in-out_infinite]"
                  }`}
                />
              </div>
              <div className="absolute left-[50%] right-[80px] top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-outline-variant">
                <div
                  className={`h-full bg-primary transition-all duration-1000 ${
                    loading ? "w-0" : completedCount >= 3 ? "w-full" : completedCount >= 2 ? "w-1/2" : "w-1/4 animate-[progress_2s_ease-in-out_infinite_1s]"
                  }`}
                />
              </div>

              {/* 终端 */}
              <div className="relative z-10 flex w-40 flex-col items-center gap-4 rounded-DEFAULT border border-outline-variant bg-surface-bright p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container">
                  <span className="material-symbols-outlined text-[32px] text-secondary">sensors</span>
                </div>
                <span className="font-label-caps text-label-caps uppercase text-on-background">终端</span>
                <div className="text-center font-status-label text-status-label text-secondary">
                  {loading ? (
                    <span className="animate-pulse">加载中...</span>
                  ) : terminalA ? (
                    <>
                      {STATUS_LABELS[terminalA.status]} | 心跳 #{terminalA.heartbeat_seq}
                      {terminalA.fault_code && (
                        <br />
                      )}
                      {terminalA.fault_code && (
                        <span className="text-error">故障: {terminalA.fault_code}</span>
                      )}
                    </>
                  ) : (
                    "等待连接..."
                  )}
                </div>
              </div>

              {/* 网关 */}
              <div className="relative z-10 flex w-40 scale-110 flex-col items-center gap-4 rounded-DEFAULT border-2 border-primary bg-surface-bright p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary-container/20">
                  <span className="material-symbols-outlined text-[40px] text-primary">router</span>
                </div>
                <span className="font-label-caps text-label-caps uppercase text-on-background">边缘网关</span>
                <div className="text-center font-status-label text-status-label text-primary">
                  {loading ? (
                    <span className="animate-pulse">加载中...</span>
                  ) : gateway ? (
                    <>
                      {STATUS_LABELS[gateway.status]} | 心跳 #{gateway.heartbeat_seq}
                      <br />
                      运行中
                    </>
                  ) : (
                    "等待连接..."
                  )}
                </div>
              </div>

              {/* 服务器 */}
              <div className="relative z-10 flex w-40 flex-col items-center gap-4 rounded-DEFAULT border border-outline-variant bg-surface-bright p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container">
                  <span className="material-symbols-outlined text-[32px] text-secondary">database</span>
                </div>
                <span className="font-label-caps text-label-caps uppercase text-on-background">主服务器</span>
                <div className="text-center font-status-label text-status-label text-secondary">
                  {loading ? (
                    <span className="animate-pulse">加载中...</span>
                  ) : (
                    <>
                      设备: {devices.length} 台
                      <br />
                      在线率: {devices.length > 0
                        ? Math.round((devices.filter((d) => d.status === "ONLINE").length / devices.length) * 100)
                        : 0}%
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 步骤反馈卡片 */}
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

      {/* 右侧: 演示脚本 */}
      <div className="flex w-80 flex-col rounded-DEFAULT border border-outline-variant bg-surface-container-lowest">
        <div className="rounded-t-DEFAULT border-b border-outline-variant bg-surface-bright p-md">
          <h3 className="flex items-center gap-2 font-label-caps text-label-caps uppercase tracking-widest text-on-background">
            <span className="material-symbols-outlined text-[18px]">list_alt</span>
            演示脚本
          </h3>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-md">
          {steps.map((s, idx) => (
            <div key={s.step} className={`flex gap-4 ${s.status === "pending" ? "opacity-50" : ""}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-label-caps text-label-caps ${
                    s.status === "done"
                      ? "bg-emerald-500 text-white"
                      : s.status === "active"
                        ? "bg-primary text-on-primary shadow-[0_0_0_2px_rgba(0,102,255,0.2)]"
                        : "border border-outline-variant bg-surface-container text-secondary"
                  }`}
                >
                  {s.status === "done" ? (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  ) : (
                    s.step
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`my-1 h-full w-px ${s.status === "done" ? "bg-emerald-300" : "bg-outline-variant"}`}
                  />
                )}
              </div>
              <div className="flex-1 pb-4">
                <h4
                  className={`font-headline-sm text-headline-sm text-[14px] ${
                    s.status === "active" ? "flex items-center justify-between text-primary" : s.status === "done" ? "text-emerald-700" : "text-on-background"
                  }`}
                >
                  {s.title}
                  {s.status === "active" && (
                    <button
                      onClick={executeStep}
                      disabled={sending}
                      className="rounded bg-primary px-2 py-1 font-status-label text-[10px] uppercase text-on-primary transition-colors hover:bg-surface-tint disabled:opacity-50"
                    >
                      {sending ? "执行中..." : "执行"}
                    </button>
                  )}
                </h4>
                <p className="font-body-md text-body-md mt-1 text-[12px] text-secondary">{s.desc}</p>
                {s.status === "active" && cmdOutput && (
                  <div className="mt-3 rounded border border-outline-variant bg-surface-container-low p-3 font-mono text-[11px] text-secondary whitespace-pre-wrap">
                    {cmdOutput}
                  </div>
                )}
                {s.status === "done" && (
                  <div className="mt-2 font-status-label text-[11px] text-emerald-600">已完成</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
