import { CreditCard, Building2, Trash2, Pencil } from "lucide-react";
import { formatCurrency, cx } from "../../lib/utils";

const TYPE_COLORS = {
  checking:   "text-blue-500   bg-blue-600/10   border-blue-600/20",
  savings:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  credit:     "text-rose-400   bg-rose-500/10   border-rose-500/20",
  investment: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  default:    "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

export function AccountCard({ account, onEdit, onDelete }) {
  const colorClass = TYPE_COLORS[account.account_type] ?? TYPE_COLORS.default;
  const isCredit = account.account_type === "credit";

  return (
    <div className="group relative rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cx("flex h-10 w-10 items-center justify-center rounded-xl border", colorClass)}>
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-100">{account.name}</p>
            <p className="text-xs text-slate-500">{account.institution ?? account.account_type}</p>
          </div>
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onEdit(account)} className="rounded-lg p-1.5 text-slate-500 hover:text-blue-500 hover:bg-slate-800 transition">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(account)} className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-slate-500 mb-0.5">Current balance</p>
        <p className={cx("text-2xl font-bold font-mono", isCredit ? "text-rose-400" : "text-emerald-400")}>
          {formatCurrency(account.balance_current)}
        </p>
        {account.balance_available != null && (
          <p className="text-xs text-slate-500 mt-0.5">
            {formatCurrency(account.balance_available)} available
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={cx("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium", colorClass)}>
          {account.account_type}
        </span>
        <span className="text-xs text-slate-600">{account.currency}</span>
      </div>
    </div>
  );
}
