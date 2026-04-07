import { cx } from "../../lib/utils";

export function Input({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-slate-400 font-medium">{label}</label>}
      <input
        className={cx(
          "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100",
          "placeholder:text-slate-500 outline-none transition",
          "focus:border-blue-600/60 focus:ring-1 focus:ring-blue-600/20",
          error && "border-rose-500/60",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
