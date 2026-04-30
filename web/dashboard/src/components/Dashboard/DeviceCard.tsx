import type { DeviceState } from "../../api/types";
import { DEVICE_ROLES, STATUS_LABELS } from "../../types";

export default function DeviceCard({ device }: { device: DeviceState }) {
  const roleName = DEVICE_ROLES[device.device_id] ?? device.device_id;
  const statusText = STATUS_LABELS[device.status] ?? device.status;
  const isWarning = device.status === "WARNING";
  const isOffline = device.status === "OFFLINE";

  return (
    <article className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="font-label-caps text-label-caps uppercase text-on-surface">
          {roleName}
        </h3>
        <span className="material-symbols-outlined text-outline">
          {device.device_id === "gateway" ? "hub" : "router"}
        </span>
      </div>

      <div
        className={`mb-4 flex w-fit items-center gap-2 rounded-DEFAULT px-2 py-1 ${
          isWarning || isOffline ? "bg-error-container/20" : ""
        }`}
      >
        <div
          className={`h-2 w-2 rounded-full ${
            isOffline ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        <span
          className={`font-status-label text-status-label ${
            isWarning || isOffline ? "text-error" : "text-on-surface"
          }`}
        >
          {statusText}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-status-label text-status-label mb-1 text-outline">
            {device.device_id === "gateway" ? "心跳序号" : "心跳序号"}
          </div>
          <div
            className={`font-display-data text-display-data ${
              isWarning || isOffline ? "text-error" : "text-primary"
            }`}
          >
            #{device.heartbeat_seq}
          </div>
        </div>
        <div>
          <div className="font-status-label text-status-label mb-1 text-outline">
            最近更新
          </div>
          <div className="font-body-md text-body-md mt-2 text-on-surface">
            {device.last_seen}
          </div>
        </div>
      </div>

      {device.fault_code && (
        <div className="mt-3 rounded bg-error-container/30 px-2 py-1 font-status-label text-status-label text-error">
          故障: {device.fault_code}
        </div>
      )}
    </article>
  );
}
