import { useState, useEffect } from "react";
import { Plus, Trash2, Scissors } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { formatCurrency, cx } from "../../lib/utils";

function emptyRow(categories) {
  return { category_id: categories?.[0]?.id ?? "", amount: "", note: "" };
}

export function SplitTransactionModal({ open, onClose, transaction, onSaved }) {
  const { data: categories } = useApi(() => api.categories.list(), []);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = Math.abs(transaction?.amount ?? 0);

  // Initialize rows from existing splits or a sensible default
  useEffect(() => {
    if (!open || !transaction) return;
    if (transaction.splits?.length > 0) {
      setRows(
        transaction.splits.map((s) => ({
          category_id: s.category_id ?? "",
          amount: String(s.amount),
          note: s.note ?? "",
        }))
      );
    } else {
      // Seed two rows: first gets the full amount in the original category
      setRows([
        {
          category_id: transaction.category_id ?? "",
          amount: String(total.toFixed(2)),
          note: "",
        },
        { category_id: "", amount: "", note: "" },
      ]);
    }
    setError("");
  }, [open, transaction]);

  const allocated = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remainder = Math.round((total - allocated) * 100) / 100;
  const isBalanced = Math.abs(remainder) < 0.005;

  function updateRow(i, field, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { category_id: "", amount: "", note: "" }]);
  }

  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!isBalanced) {
      setError(`Split amounts must add up to ${formatCurrency(total)}. Remaining: ${formatCurrency(Math.abs(remainder))}.`);
      return;
    }
    const splits = rows.map((r) => ({
      category_id: r.category_id ? Number(r.category_id) : null,
      amount: parseFloat(r.amount) || 0,
      note: r.note || null,
    }));
    if (splits.some((s) => s.amount <= 0)) {
      setError("Each split must have an amount greater than $0.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.transactions.setSplits(transaction.id, splits);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError("");
    try {
      await api.transactions.clearSplits(transaction.id);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!transaction) return null;

  const hasSplits = transaction.splits?.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Split Transaction">
      {/* Transaction summary */}
      <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
        <p className="text-sm font-medium text-slate-200 truncate">
          {transaction.merchant_name || transaction.description || "—"}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {String(transaction.date).slice(0, 10)} &nbsp;·&nbsp;
          <span className="font-mono text-slate-300">{formatCurrency(total)}</span>
          &nbsp;total to allocate
        </p>
      </div>

      {/* Split rows */}
      <div className="space-y-2 mb-3">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2 items-end">
            {/* Category */}
            <Select
              label={i === 0 ? "Category" : undefined}
              value={row.category_id}
              onChange={(e) => updateRow(i, "category_id", e.target.value)}
            >
              <option value="">— none —</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>

            {/* Amount */}
            <div>
              {i === 0 && (
                <label className="block text-xs text-slate-500 mb-1">Amount</label>
              )}
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateRow(i, "amount", e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-6 pr-2 py-2 text-sm text-slate-200 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Remove button */}
            <div className={i === 0 ? "pb-0 pt-5" : ""}>
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length <= 2}
                className="rounded-lg p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Note (full width, second line) */}
            {row.note !== undefined && (
              <input
                type="text"
                placeholder="Note (optional)"
                value={row.note}
                onChange={(e) => updateRow(i, "note", e.target.value)}
                className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 placeholder-slate-600 focus:border-slate-600 focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>

      {/* Add split */}
      {rows.length < 10 && (
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 mb-4 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add split
        </button>
      )}

      {/* Balance meter */}
      <div className={cx(
        "flex items-center justify-between rounded-lg px-3 py-2 text-xs mb-4 border",
        isBalanced
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
          : remainder > 0
          ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
          : "border-rose-500/30 bg-rose-500/5 text-rose-400"
      )}>
        <span>
          Allocated: <span className="font-mono font-medium">{formatCurrency(allocated)}</span>
          {" / "}
          <span className="font-mono font-medium">{formatCurrency(total)}</span>
        </span>
        <span className="font-mono font-medium">
          {isBalanced
            ? "✓ Balanced"
            : remainder > 0
            ? `${formatCurrency(remainder)} remaining`
            : `${formatCurrency(Math.abs(remainder))} over`}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {hasSplits ? (
          <Button variant="ghost" onClick={handleClear} disabled={saving} className="text-slate-500 hover:text-rose-400">
            Remove splits
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !isBalanced}>
            {saving ? "Saving…" : "Save splits"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
