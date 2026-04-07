import { Pencil, Trash2, Scissors } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { formatDate, formatCurrency, amountColor, cx } from "../../lib/utils";

export function TransactionRow({ txn, onEdit, onDelete, onSplit }) {
  const isIncome = txn.amount < 0;
  const isSplit = txn.splits?.length > 0;

  return (
    <tr className="group border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
        {formatDate(txn.date)}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-slate-200 font-medium truncate max-w-[200px]">
          {txn.merchant_name || txn.description || "—"}
        </div>
        {txn.merchant_name && txn.description && (
          <div className="text-xs text-slate-500 truncate max-w-[200px]">{txn.description}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {isSplit ? (
          <div className="flex flex-wrap gap-1">
            {txn.splits.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-slate-800 text-slate-300"
                style={{ borderLeft: `2px solid ${s.category?.color ?? "#6b7280"}` }}
              >
                {s.category?.name ?? "Uncategorized"}
              </span>
            ))}
          </div>
        ) : (
          <CategoryBadge category={txn.category} />
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {txn.account?.name ?? "—"}
      </td>
      <td className={cx("px-4 py-3 text-sm font-mono font-medium text-right", amountColor(txn.amount))}>
        {isIncome ? "+" : "-"}{formatCurrency(Math.abs(txn.amount))}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSplit(txn)}
            title="Split transaction"
            className={cx(
              "rounded-lg p-1.5 transition hover:bg-slate-700",
              isSplit ? "text-blue-500" : "text-slate-500 hover:text-blue-500"
            )}
          >
            <Scissors className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(txn)}
            className="rounded-lg p-1.5 text-slate-500 hover:text-blue-500 hover:bg-slate-700 transition"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(txn)}
            className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-700 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
