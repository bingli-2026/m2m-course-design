import type { EventItem } from "../../api/types";
import { LEVEL_LABELS } from "../../types";

const LEVEL_CONFIG = {
  CRITICAL: { color: "text-error", bg: "bg-error/10", dot: "bg-error", icon: "error" },
  WARN: { color: "text-tertiary-container", bg: "bg-tertiary-container/10", dot: "bg-tertiary-container", icon: "warning" },
  INFO: { color: "text-primary", bg: "bg-primary/10", dot: "bg-primary", icon: "info" },
};

export default function AlertList({ events }: { events: EventItem[] }) {
  const criticalCount = events.filter((e) => e.level === "CRITICAL").length;

  return (
    <article className="flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest lg:col-span-2">
      <div className="flex items-center justify-between border-b border-surface-variant p-md">
        <h3 className="font-label-caps text-label-caps uppercase text-on-surface">
          活动告警
        </h3>
        {criticalCount > 0 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-error-container font-status-label text-status-label text-error">
            {criticalCount}
          </div>
        )}
      </div>
      <div className="flex flex-col">
        {events.length === 0 ? (
          <div className="p-md text-center font-body-md text-body-md text-outline">
            暂无告警
          </div>
        ) : (
          events.slice(0, 5).map((e) => {
            const cfg = LEVEL_CONFIG[e.level] ?? LEVEL_CONFIG.INFO;
            return (
              <div
                key={e.id}
                className="flex items-center justify-between border-b border-surface-variant p-md transition-colors hover:bg-surface-container-low"
              >
                <div className="flex items-center gap-4">
                  <span className={`material-symbols-outlined ${cfg.color}`}>
                    {cfg.icon}
                  </span>
                  <div>
                    <div className="font-status-label text-status-label mb-1 font-semibold text-on-surface">
                      {(e.device_id ?? "system")}: {e.title}
                    </div>
                    <div className="font-body-md text-body-md text-outline text-xs">
                      {e.detail}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full px-2 py-1 ${cfg.bg}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    <span className={`font-status-label text-status-label ${cfg.color}`}>
                      {LEVEL_LABELS[e.level]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}
