import { useState } from "react";
import { Plus } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { BudgetCard } from "../components/budgets/BudgetCard";
import { EmptyState } from "../components/ui/EmptyState";
import { BUDGET_PERIODS } from "../lib/constants";

function BudgetForm({ budget, categories, onSaved, onClose }) {
  const [form, setForm] = useState({
    category_id: budget?.category_id ?? "",
    amount_limit: budget?.amount_limit ?? "",
    period: budget?.period ?? "monthly",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.category_id || !form.amount_limit) { setError("Category and limit required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, category_id: Number(form.category_id), amount_limit: parseFloat(form.amount_limit) };
      if (budget?.id) await api.budgets.update(budget.id, payload);
      else await api.budgets.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Select label="Category *" value={form.category_id} onChange={set("category_id")} required>
        <option value="">— select —</option>
        {(categories ?? []).filter(c => !c.is_income).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <Input label="Monthly limit ($) *" type="number" step="0.01" value={form.amount_limit} onChange={set("amount_limit")} />
      <Select label="Period" value={form.period} onChange={set("period")}>
        {BUDGET_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
      </Select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

export default function Budgets() {
  const { data: budgets, loading, refetch } = useApi(() => api.analytics.budgetStatus(), []);
  const { data: categories } = useApi(() => api.categories.list(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBudget, setEditBudget] = useState(null);

  async function handleDelete(budget) {
    if (!confirm(`Remove budget for "${budget.category_name}"?`)) return;
    await api.budgets.delete(budget.budget_id);
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Budgets</h1>
        <Button variant="primary" size="sm" onClick={() => { setEditBudget(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Set Budget
        </Button>
      </div>

      {!loading && !budgets?.length && (
        <EmptyState title="No budgets set" description="Set monthly spending limits per category." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(budgets ?? []).map((b) => (
          <BudgetCard
            key={b.budget_id}
            budget={b}
            onEdit={(b) => { setEditBudget(b); setModalOpen(true); }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editBudget ? "Edit Budget" : "New Budget"}>
        <BudgetForm
          budget={editBudget}
          categories={categories}
          onSaved={refetch}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
