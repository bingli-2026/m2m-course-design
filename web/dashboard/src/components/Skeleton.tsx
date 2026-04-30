import type { ReactNode } from "react";

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-variant ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md">
      <div className="mb-4 flex items-start justify-between">
        <Bone className="h-4 w-24" />
        <Bone className="h-5 w-5 rounded-full" />
      </div>
      <div className="mb-4 flex items-center gap-2">
        <Bone className="h-2 w-2 rounded-full" />
        <Bone className="h-4 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Bone className="mb-1 h-3 w-12" />
          <Bone className="h-8 w-20" />
        </div>
        <div>
          <Bone className="mb-1 h-3 w-12" />
          <Bone className="mt-2 h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg">
      <Bone className="mb-6 h-3 w-40" />
      <Bone className="h-64 w-full" />
    </div>
  );
}

export function AlertListSkeleton() {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest lg:col-span-2">
      <div className="flex items-center justify-between border-b border-surface-variant p-md">
        <Bone className="h-3 w-24" />
        <Bone className="h-6 w-6 rounded-full" />
      </div>
      <div className="space-y-0">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-surface-variant p-md"
          >
            <div className="flex items-center gap-4">
              <Bone className="h-5 w-5 rounded-full" />
              <div>
                <Bone className="mb-1 h-4 w-48" />
                <Bone className="h-3 w-72" />
              </div>
            </div>
            <Bone className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest p-lg">
      <Bone className="mb-6 h-3 w-32 self-start" />
      <Bone className="h-48 w-48 rounded-full" />
    </div>
  );
}

export function CommandPanelSkeleton() {
  return (
    <div className="flex flex-1 flex-col rounded-lg border border-surface-variant bg-surface-container-lowest">
      <div className="flex items-center justify-between rounded-t-lg border-b border-surface-variant bg-surface-bright px-md py-3">
        <Bone className="h-3 w-24" />
        <Bone className="h-4 w-4" />
      </div>
      <div className="grid grid-cols-2 gap-sm p-md">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded border border-surface-variant p-sm">
            <Bone className="h-6 w-6 rounded-full" />
            <Bone className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatePanelSkeleton() {
  return (
    <div className="rounded-lg border border-surface-variant bg-surface-container-lowest">
      <div className="flex items-center justify-between rounded-t-lg border-b border-surface-variant bg-surface-bright px-md py-3">
        <Bone className="h-3 w-24" />
        <Bone className="h-4 w-4" />
      </div>
      <div className="space-y-4 p-md">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-20" />
              <Bone className="h-4 w-16" />
            </div>
            {i < 4 && <div className="mt-4 h-px w-full bg-surface-variant" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TerminalSkeleton() {
  return (
    <div className="flex min-h-[400px] flex-1 flex-col rounded-lg border border-surface-variant bg-[#0f172a]">
      <div className="flex items-center justify-between rounded-t-lg border-b border-slate-700 bg-[#1e293b] px-md py-3">
        <Bone className="h-3 w-28" />
      </div>
      <div className="flex-1 space-y-3 p-md">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-2">
            <Bone className="h-4 w-20 bg-slate-700" />
            <Bone className="h-4 w-12 bg-slate-700" />
            <Bone className="h-4 w-48 bg-slate-700" />
          </div>
        ))}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-2">
          <Bone className="h-4 w-32 bg-slate-700" />
          <Bone className="h-4 w-2 bg-slate-400" />
        </div>
      </div>
    </div>
  );
}

export function EventTimelineSkeleton() {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-DEFAULT border border-outline-variant bg-surface-container-lowest">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface-bright p-md">
        <Bone className="h-3 w-28" />
        <Bone className="h-4 w-32" />
      </div>
      <div className="flex-1 space-y-md overflow-y-auto p-md">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-4 rounded-DEFAULT border border-outline-variant bg-surface-bright p-md">
            <Bone className="mt-1 h-5 w-5 rounded-full" />
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between">
                <Bone className="h-4 w-24" />
                <Bone className="h-4 w-20" />
              </div>
              <Bone className="mb-2 h-4 w-48" />
              <Bone className="h-3 w-64" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FilterSidebarSkeleton() {
  return (
    <aside className="w-full shrink-0 md:w-64">
      <div className="rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-md">
        <Bone className="mb-md h-4 w-12" />
        <div className="space-y-lg">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <Bone className="mb-sm h-4 w-16" />
              <Bone className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function PageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-gutter">
      {children}
    </div>
  );
}
