import { useState } from "react";
import { useEvents } from "../hooks/useApi";
import { DEVICE_ROLES, LEVEL_LABELS } from "../types";
import { EventTimelineSkeleton, FilterSidebarSkeleton } from "../components/Skeleton";

const LEVEL_CONFIG = {
  CRITICAL: { color: "text-error", bg: "bg-error/10", dot: "bg-error", icon: "error", border: "border-error/30 bg-error-container/20" },
  WARN: { color: "text-tertiary-container", bg: "bg-tertiary-container/10", dot: "bg-tertiary-container", icon: "warning", border: "" },
  INFO: { color: "text-primary", bg: "bg-primary/10", dot: "bg-primary", icon: "info", border: "" },
};

type EventLevel = "INFO" | "WARN" | "CRITICAL";

export default function EventsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { events, total, loading } = useEvents(page, pageSize);
  const [deviceFilter, setDeviceFilter] = useState("全部设备");
  const [levels, setLevels] = useState<EventLevel[]>(["INFO", "WARN", "CRITICAL"]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleLevel = (l: EventLevel) => {
    setLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  };

  const deviceIds = [...new Set(events.map((e) => e.device_id).filter((id): id is string => Boolean(id)))];
  const filtered = events.filter(
    (e) =>
      levels.includes(e.level) &&
      (deviceFilter === "全部设备" || e.device_id === deviceFilter)
  );
  const hasData = !loading;

  return (
    <div className="flex flex-col gap-gutter md:flex-row">
      {/* 过滤器侧边栏 */}
      {hasData ? (
        <aside className="w-full shrink-0 md:w-64">
          <div className="rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-md">
            <h3 className="font-label-caps text-label-caps mb-md text-secondary">筛选</h3>
            <div className="space-y-lg">
              <div>
                <label className="font-status-label text-status-label mb-sm block text-on-surface-variant">设备</label>
                <select
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  className="w-full rounded-DEFAULT border border-outline-variant bg-surface-bright px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option>全部设备</option>
                  {deviceIds.map((id) => (
                    <option key={id} value={id}>
                      {DEVICE_ROLES[id] ?? id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-status-label text-status-label mb-sm block text-on-surface-variant">事件级别</label>
                <div className="space-y-2">
                  {([
                    ["INFO", "text-primary"],
                    ["WARN", "text-tertiary-container"],
                    ["CRITICAL", "text-error"],
                  ] as const).map(([lvl, textColor]) => (
                    <label key={lvl} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={levels.includes(lvl)}
                        onChange={() => toggleLevel(lvl)}
                        className={`rounded border-outline-variant ${textColor}`}
                      />
                      <span className="font-status-label text-status-label">{LEVEL_LABELS[lvl]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-status-label text-status-label mb-sm block text-on-surface-variant">时间范围</label>
                <select className="w-full rounded-DEFAULT border border-outline-variant bg-surface-bright px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <option>最近 1 小时</option>
                  <option>最近 24 小时</option>
                  <option>最近 7 天</option>
                  <option>自定义...</option>
                </select>
              </div>
            </div>
          </div>
        </aside>
      ) : (
        <FilterSidebarSkeleton />
      )}

      {/* 事件时间线 */}
      {hasData ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-DEFAULT border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-bright p-md">
            <h2 className="font-label-caps text-label-caps text-on-surface">事件时间线</h2>
            <span className="font-status-label text-status-label text-secondary">
              共 {total} 条，第 {page} / {totalPages} 页
            </span>
          </div>
          <div className="flex-1 space-y-md overflow-y-auto p-md" style={{ maxHeight: "calc(100vh - 320px)" }}>
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-outline">暂无事件</div>
            ) : (
              filtered.map((e) => {
                const cfg = LEVEL_CONFIG[e.level] ?? LEVEL_CONFIG.INFO;
                return (
                  <div
                    key={e.id}
                    className={`flex items-start gap-4 rounded-DEFAULT border border-outline-variant bg-surface-bright p-md transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${cfg.border}`}
                  >
                    <div className="mt-1 shrink-0">
                      <span className={`material-symbols-outlined text-[20px] ${cfg.color}`}>{cfg.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`font-label-caps text-label-caps ${cfg.color}`}>
                          {DEVICE_ROLES[e.device_id ?? ""] ?? e.device_id ?? "system"}
                        </span>
                        <span className="font-status-label text-status-label text-outline">{e.ts}</span>
                      </div>
                      <p className="font-body-md text-body-md mb-2 text-on-surface">{e.title}</p>
                      <p className="font-body-md text-body-md text-xs text-outline">{e.detail}</p>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full px-2 py-1">
                        <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 ${cfg.bg}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          <span className={`font-status-label text-status-label ${cfg.color}`}>
                            {LEVEL_LABELS[e.level]}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between border-t border-outline-variant bg-surface-bright px-md py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-DEFAULT border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              上一页
            </button>
            <span className="font-status-label text-status-label text-secondary">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-DEFAULT border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
            >
              下一页
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </section>
      ) : (
        <EventTimelineSkeleton />
      )}
    </div>
  );
}
