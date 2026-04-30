import { useMetrics } from "../../hooks/useApi";
import type { NavKey } from "../../types";

const navItems: { key: NavKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "总览", icon: "dashboard" },
  { key: "control", label: "控制", icon: "settings_remote" },
  { key: "events", label: "事件", icon: "list_alt" },
  { key: "demo", label: "演示", icon: "play_circle" },
];

export default function SideNav({
  active,
  onChange,
}: {
  active: NavKey;
  onChange: (key: NavKey) => void;
}) {
  const { metrics } = useMetrics();
  const onlineRate = metrics ? Math.round(metrics.online_rate) : 100;
  const statusText = onlineRate >= 100 ? "正常" : onlineRate >= 50 ? "注意" : "异常";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-outline-variant bg-surface-bright py-6">
      <div className="mb-8 px-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-primary">
          M2M 指令中心
        </h1>
        <p className="font-status-label text-status-label mt-1 text-secondary">
          系统状态: {statusText}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 ${
                isActive
                  ? "border-r-4 border-primary bg-surface-container-lowest font-label-caps text-label-caps uppercase tracking-widest text-primary"
                  : "font-label-caps text-label-caps uppercase tracking-widest text-secondary hover:bg-surface-container"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-4">
        <button className="flex w-full items-center justify-center gap-2 rounded-DEFAULT bg-tertiary py-3 font-label-caps text-label-caps uppercase tracking-widest text-on-tertiary transition-colors hover:bg-tertiary-container">
          <span className="material-symbols-outlined text-[16px]">warning</span>
          紧急停止
        </button>
      </div>
    </aside>
  );
}
