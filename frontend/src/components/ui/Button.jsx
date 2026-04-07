import { cx } from "../../lib/utils";

const VARIANTS = {
  primary:  "bg-blue-600 hover:bg-blue-700 text-white font-semibold",
  secondary:"bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700",
  ghost:    "hover:bg-slate-800 text-slate-300",
  danger:   "bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-5 py-2.5 text-base rounded-xl",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  ...props
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
