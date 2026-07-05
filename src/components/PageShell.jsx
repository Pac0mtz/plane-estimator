/** Centered desktop page layout — title bar, optional stats, toolbar slot. */
export default function PageShell({ title, icon: Icon, subtitle, stats = [], toolbar, children, className = "" }) {
  return (
    <div className={`flex-1 flex flex-col min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain ${className}`}>
      <div className="page-shell w-full mx-auto flex flex-col gap-4 md:gap-5 px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        {(title || toolbar) && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {title && (
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  {Icon && <Icon size={22} className="text-brand shrink-0" strokeWidth={2} />}
                  <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-100 truncate">{title}</h1>
                </div>
                {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-2xl">{subtitle}</p>}
              </div>
            )}
            {toolbar && <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">{toolbar}</div>}
          </div>
        )}

        {stats.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map(({ label, value }) => (
              <div key={label} className="desk-stat rounded-lg border border-slate-800/80 bg-slate-950/60 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                <div className="text-lg lg:text-xl font-semibold text-slate-100 tabular-nums mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
