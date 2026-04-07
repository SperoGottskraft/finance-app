import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";

const now = () => new Date().toISOString().slice(0, 16);

export function TransactionForm({ open, onClose, transaction, onSaved }) {
  const { data: categories } = useApi(() => api.categories.list(), []);
  const { data: accounts } = useApi(() => api.accounts.list(), []);

  const [form, setForm] = useState({
    date: now(),
    amount: "",
    description: "",
    merchant_name: "",
    category_id: "",
    account_id: "",
    notes: "",
    source: "manual",
  });
  const [applyToAll, setApplyToAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (transaction) {
      setForm({
        date: transaction.date?.slice(0, 16) ?? now(),
        amount: String(Math.abs(transaction.amount)),
        description: transaction.description ?? "",
        merchant_name: transaction.merchant_name ?? "",
        category_id: transaction.category_id ?? "",
        account_id: transaction.account_id ?? "",
        notes: transaction.notes ?? "",
        source: transaction.source ?? "manual",
      });
    } else {
      setForm({ date: now(), amount: "", description: "", merchant_name: "", category_id: "", account_id: "", notes: "", source: "manual" });
    }
    setApplyToAll(false);
  }, [transaction, open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || !form.date) {
      setError("Date and amount are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const catId = form.category_id ? Number(form.category_id) : null;
      const accId = form.account_id ? Number(form.account_id) : null;
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        category_id: catId,
        account_id: accId,
        date: new Date(form.date).toISOString(),
      };
      if (transaction?.id) {
        await api.transactions.update(transaction.id, payload);
        // Mass re-categorize: apply to all with same description + account
        if (applyToAll && form.description && accId && catId !== transaction.category_id) {
          await api.transactions.categorizeMatching(form.description, accId, catId);
        }
      } else {
        await api.transactions.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={transaction ? "Edit Transaction" : "Add Transaction"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="datetime-local" value={form.date} onChange={set("date")} />
          <Input label="Amount ($)" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={set("amount")} />
        </div>
        <Input label="Description" placeholder="What was this?" value={form.description} onChange={set("description")} />
        <Input label="Merchant" placeholder="Optional" value={form.merchant_name} onChange={set("merchant_name")} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={form.category_id} onChange={set("category_id")}>
            <option value="">— none —</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select label="Account" value={form.account_id} onChange={set("account_id")}>
            <option value="">— none —</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
        <Input label="Notes" placeholder="Optional notes" value={form.notes} onChange={set("notes")} />

        {/* "Apply to all" — only when editing an existing transaction */}
        {transaction?.id && (
          <label className="flex items-start gap-2 cursor-pointer rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-blue-600 cursor-pointer"
            />
            <span className="text-xs text-slate-300">
              <span className="font-medium">Apply category to all matching transactions</span>
              <span className="block text-slate-500 mt-0.5">
                Re-categorizes every transaction with the same description + account.
              </span>
            </span>
          </label>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
