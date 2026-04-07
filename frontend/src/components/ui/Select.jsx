import { cx } from "../../lib/utils";

export function Select({ label, error, children, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-slate-400 font-medium">{label}</label>}
      <select
        className={cx(
          "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100",
          "outline-none transition focus:border-blue-600/60 focus:ring-1 focus:ring-blue-600/20",
          error && "border-rose-500/60",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
