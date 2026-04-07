import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency, cx } from "../../lib/utils";

export function BudgetCard({ budget, onEdit, onDelete }) {
  const { spent = 0, limit, remaining = 0, pct = 0, category_name, color } = budget;

  const clampedPct = Math.min(pct, 100);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - clampedPct / 100);

  const ringColor = pct >= 100 ? "#fb7185" : pct >= 80 ? "#fbbf24" : color ?? "#1d4ed8";

  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 truncate">{category_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{budget.period ?? "monthly"}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition ml-2">
          <button onClick={() => onEdit(budget)} className="rounded-lg p-1 text-slate-500 hover:text-blue-500 hover:bg-slate-800 transition">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(budget)} className="rounded-lg p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {/* Donut ring */}
        <div className="relative shrink-0">
          <svg width={72} height={72} viewBox="0 0 72 72" className="-rotate-90">
            <circle cx={36} cy={36} r={r} fill="none" stroke="#1e293b" strokeWidth={6} />
            <circle
              cx={36} cy={36} r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={6}
              strokeDasharray={circ}
              strokeDashoffset={dash}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-200">
            {Math.round(pct)}%
          </span>
        </div>

        {/* Numbers */}
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Spent</span>
            <span className="font-mono text-slate-200">{formatCurrency(spent)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Budget</span>
            <span className="font-mono text-slate-400">{formatCurrency(limit)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Left</span>
            <span className={cx("font-mono font-medium", remaining < 0 ? "text-rose-400" : "text-emerald-400")}>
              {formatCurrency(Math.abs(remaining))}
              {remaining < 0 ? " over" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
