import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import * as Icons from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";

const ICON_OPTIONS = [
  "CircleHelp","ShoppingCart","Car","House","Zap","HeartPulse","Plane","Gift",
  "Coffee","UtensilsCrossed","Fuel","Bus","Dumbbell","ShoppingBag","Monitor",
  "Package","Play","Gamepad2","RefreshCw","Shield","Landmark","Receipt",
  "GraduationCap","Banknote","Laptop","TrendingUp","RotateCcw","Wifi","Pill","Truck",
];

function CategoryForm({ cat, onSaved, onClose }) {
  const [form, setForm] = useState({
    name: cat?.name ?? "",
    color: cat?.color ?? "#06b6d4",
    icon: cat?.icon ?? "CircleHelp",
    is_income: cat?.is_income ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: typeof e === "string" ? e : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (cat?.id) await api.categories.update(cat.id, form);
      else await api.categories.create(form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const Icon = Icons[form.icon] ?? Icons.CircleHelp;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Name *" value={form.name} onChange={set("name")} required />
      <div className="flex gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-slate-400 font-medium">Color</label>
          <input type="color" value={form.color} onChange={set("color")}
            className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900 p-1 cursor-pointer" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 font-medium">Preview</label>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700"
            style={{ background: `${form.color}18`, borderColor: `${form.color}30` }}>
            <Icon className="h-4 w-4" style={{ color: form.color }} />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400 font-medium block mb-2">Icon</label>
        <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto">
          {ICON_OPTIONS.map((name) => {
            const I = Icons[name] ?? Icons.CircleHelp;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setForm((f) => ({ ...f, icon: name }))}
                className={`flex items-center justify-center rounded-lg p-2 transition
                  ${form.icon === name ? "bg-blue-600/20 border border-blue-600/40" : "hover:bg-slate-800 border border-transparent"}`}
              >
                <I className="h-3.5 w-3.5 text-slate-300" />
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_income} onChange={(e) => setForm(f => ({...f, is_income: e.target.checked}))}
          className="rounded border-slate-600" />
        <span className="text-sm text-slate-300">This is an income category</span>
      </label>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

export default function Categories() {
  const { data: cats, loading, refetch } = useApi(() => api.categories.list(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);

  async function handleDelete(cat) {
    if (cat.is_system) return alert("System categories can't be deleted.");
    if (!confirm(`Delete "${cat.name}"?`)) return;
    await api.categories.delete(cat.id);
    refetch();
  }

  const income = (cats ?? []).filter(c => c.is_income);
  const expense = (cats ?? []).filter(c => !c.is_income);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Categories</h1>
        <Button variant="primary" size="sm" onClick={() => { setEditCat(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {["Income", "Expense"].map((type) => {
        const list = type === "Income" ? income : expense;
        return (
          <div key={type}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{type}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((cat) => {
                const Icon = Icons[cat.icon] ?? Icons.CircleHelp;
                return (
                  <div key={cat.id}
                    className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 hover:border-slate-700 transition">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}>
                        <Icon className="h-4 w-4" style={{ color: cat.color }} />
                      </div>
                      <span className="text-sm text-slate-200">{cat.name}</span>
                      {cat.is_system && <span className="text-[10px] text-slate-600 border border-slate-700 rounded px-1">system</span>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => { setEditCat(cat); setModalOpen(true); }}
                        className="p-1 text-slate-500 hover:text-blue-500 rounded transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!cat.is_system && (
                        <button onClick={() => handleDelete(cat)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editCat ? "Edit Category" : "New Category"}>
        <CategoryForm cat={editCat} onSaved={refetch} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
