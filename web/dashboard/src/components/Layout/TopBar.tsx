export default function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-bright px-6">
      <span className="font-headline-sm text-headline-sm font-black uppercase tracking-wider text-on-background">
        M2M_CONTROL_SYS
      </span>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-secondary">
            search
          </span>
          <input
            className="w-64 rounded-DEFAULT border border-outline-variant bg-surface-container-low py-2 pl-10 pr-4 font-body-md text-body-md text-on-background outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="搜索..."
            type="text"
          />
        </div>
        <button className="rounded-full p-2 text-secondary transition-colors hover:bg-surface-container">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="rounded-full p-2 text-secondary transition-colors hover:bg-surface-container">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-primary-container text-on-primary-container">
          <span className="material-symbols-outlined text-[20px]">person</span>
        </div>
      </div>
    </header>
  );
}
