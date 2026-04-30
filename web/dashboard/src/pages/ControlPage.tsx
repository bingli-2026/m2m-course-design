import { useState } from "react";
import { useStatePolling, useControl, useCommands } from "../hooks/useApi";
import { DEVICE_ROLES, COMMAND_LABELS } from "../types";
import {
  CommandPanelSkeleton,
  StatePanelSkeleton,
  TerminalSkeleton,
} from "../components/Skeleton";

const COMMANDS = ["start_sampling", "sync_config", "reboot", "reset_node"] as const;

export default function ControlPage() {
  const { devices, loading } = useStatePolling(3000);
  const { sendCommand, sending, error } = useControl();
  const { commands } = useCommands(50, 3000);

  const [activeDevice, setActiveDevice] = useState("terminal-a");

  const currentDevice = devices.find((d) => d.device_id === activeDevice);
  const hasData = !loading && devices.length > 0;

  const handleCommand = async (command: string) => {
    try {
      await sendCommand({ target_device: activeDevice, command });
    } catch {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-gutter">
      {/* 页头 & 设备选择 */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-surface-variant bg-surface-container-lowest p-md md:flex-row md:items-center">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">控制面板</h2>
          <p className="font-body-md text-body-md mt-1 text-secondary">
            直接向远端设备下发控制指令
          </p>
        </div>
        <div className="flex gap-2">
          {hasData ? (
            devices.map((d) => (
              <button
                key={d.device_id}
                onClick={() => setActiveDevice(d.device_id)}
                className={`flex items-center gap-2 rounded px-4 py-2 font-status-label text-status-label border transition-colors ${
                  activeDevice === d.device_id
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container-lowest text-on-surface-variant border-surface-variant hover:bg-surface-container-low"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    d.status === "ONLINE" ? "bg-emerald-400" : d.status === "WARNING" ? "bg-amber-400" : "bg-rose-400"
                  }`}
                />
                {DEVICE_ROLES[d.device_id] ?? d.device_id}
              </button>
            ))
          ) : (
            <>
              <div className="h-9 w-28 animate-pulse rounded bg-surface-variant" />
              <div className="h-9 w-28 animate-pulse rounded bg-surface-variant" />
              <div className="h-9 w-28 animate-pulse rounded bg-surface-variant" />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        {/* 左侧: 命令面板 + 设备状态 */}
        <div className="flex flex-col gap-gutter lg:col-span-1">
          {hasData ? (
            <>
              {/* 命令面板 */}
              <div className="flex flex-1 flex-col rounded-lg border border-surface-variant bg-surface-container-lowest">
                <div className="flex items-center justify-between rounded-t-lg border-b border-surface-variant bg-surface-bright px-md py-3">
                  <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface">
                    命令面板
                  </h3>
                  <span className="material-symbols-outlined text-sm text-outline">terminal</span>
                </div>
                <div className="grid grid-cols-2 gap-sm p-md">
                  {COMMANDS.map((cmd) => {
                    const info = COMMAND_LABELS[cmd] ?? { icon: "play_arrow", label: cmd };
                    return (
                      <button
                        key={cmd}
                        onClick={() => handleCommand(cmd)}
                        disabled={sending}
                        className="flex flex-col items-center justify-center gap-2 rounded border border-surface-variant bg-surface-container-lowest p-sm text-on-surface transition-all hover:border-primary hover:ring-1 hover:ring-primary disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-primary">{info.icon}</span>
                        <span className="font-status-label text-status-label">{info.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 当前状态 */}
              <div className="rounded-lg border border-surface-variant bg-surface-container-lowest">
                <div className="flex items-center justify-between rounded-t-lg border-b border-surface-variant bg-surface-bright px-md py-3">
                  <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface">
                    当前状态
                  </h3>
                  <span className="material-symbols-outlined text-sm text-outline">info</span>
                </div>
                <div className="space-y-4 p-md">
                  {currentDevice ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-status-label text-status-label text-on-surface-variant">设备 ID</span>
                        <span className="font-status-label text-status-label text-on-surface">{currentDevice.device_id}</span>
                      </div>
                      <div className="h-px w-full bg-surface-variant" />
                      <div className="flex items-center justify-between">
                        <span className="font-status-label text-status-label text-on-surface-variant">状态</span>
                        <span className="font-status-label text-status-label text-on-surface">{currentDevice.status}</span>
                      </div>
                      <div className="h-px w-full bg-surface-variant" />
                      <div className="flex items-center justify-between">
                        <span className="font-status-label text-status-label text-on-surface-variant">心跳序号</span>
                        <span className="font-status-label text-status-label text-primary font-bold">
                          #{currentDevice.heartbeat_seq}
                        </span>
                      </div>
                      <div className="h-px w-full bg-surface-variant" />
                      <div className="flex items-center justify-between">
                        <span className="font-status-label text-status-label text-on-surface-variant">故障码</span>
                        <span className="font-status-label text-status-label text-on-surface">
                          {currentDevice.fault_code ?? "无"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-outline">未找到设备</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <CommandPanelSkeleton />
              <StatePanelSkeleton />
            </>
          )}
        </div>

        {/* 右侧: 执行监视器 */}
        <div className="flex flex-col lg:col-span-2">
          {hasData ? (
            <div className="flex min-h-[400px] flex-1 flex-col rounded-lg border border-surface-variant bg-[#0f172a] shadow-sm">
              <div className="flex items-center justify-between rounded-t-lg border-b border-slate-700 bg-[#1e293b] px-md py-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-slate-300">
                    执行监视器
                  </h3>
                  {sending ? (
                    <span className="rounded px-2 py-0.5 font-mono text-[10px] border border-amber-500/20 bg-amber-500/10 text-amber-400">
                      执行中...
                    </span>
                  ) : (
                    <span className="rounded px-2 py-0.5 font-mono text-[10px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                      就绪
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-[11px] text-slate-400">真实命令日志</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-md font-mono text-sm text-slate-300">
                {commands.length === 0 ? (
                  <div className="text-slate-500">等待命令...</div>
                ) : (
                  commands.slice(0, 30).map((cmd) => (
                    <div key={cmd.id} className="flex gap-2">
                      <span className="text-slate-500">
                        [{new Date(cmd.updated_at).toLocaleTimeString("zh-CN", { hour12: false })}]
                      </span>
                      <span
                        className={
                          cmd.status === "acked"
                            ? "text-emerald-400"
                            : cmd.status === "failed"
                              ? "text-red-400"
                              : cmd.status === "sent"
                                ? "text-blue-400"
                                : "text-amber-400"
                        }
                      >
                        {cmd.status.toUpperCase()}:
                      </span>
                      <span>{cmd.command} --target={cmd.target_device}</span>
                    </div>
                  ))
                )}
                <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-2">
                  <span className="text-blue-400">root@term-a:~#</span>
                  <span className="h-4 w-2 animate-pulse bg-slate-400" />
                </div>
              </div>
            </div>
          ) : (
            <TerminalSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
