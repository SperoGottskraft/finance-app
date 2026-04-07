import { useState } from "react";
import { Plus, Search, Receipt, Sparkles, Calendar, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { TransactionRow } from "../components/transactions/TransactionRow";
import { TransactionForm } from "../components/transactions/TransactionForm";
import { SplitTransactionModal } from "../components/transactions/SplitTransactionModal";
import { SkeletonRow } from "../components/ui/SkeletonRow";
import { EmptyState } from "../components/ui/EmptyState";

// Build YYYY-MM-DD for the first/last day of a month string "YYYY-MM"
function monthBounds(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0));
  const lastStr = last.toISOString().slice(0, 10);
  return { first, last: lastStr };
}

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get("month") ?? ""; // e.g. "2024-01" from dashboard click

  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState(searchParams.get("category_id") ?? "");
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [noReceiptOnly, setNoReceiptOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [editTxn, setEditTxn] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [splitTxn, setSplitTxn] = useState(null);

  // Timeframe filter
  const [timePreset, setTimePreset] = useState(() => monthParam ? "custom" : "all");
  const [dateFrom, setDateFrom] = useState(() => monthParam ? monthBounds(monthParam).first : "");
  const [dateTo,   setDateTo]   = useState(() => monthParam ? monthBounds(monthParam).last  : "");

  function applyPreset(preset) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    if (preset === "all") {
      setDateFrom(""); setDateTo("");
    } else if (preset === "this_month") {
      const { first, last } = monthBounds(`${y}-${String(m).padStart(2, "0")}`);
      setDateFrom(first); setDateTo(last);
    } else if (preset === "last_month") {
      const lm = m === 1 ? 12 : m - 1;
      const ly = m === 1 ? y - 1 : y;
      const { first, last } = monthBounds(`${ly}-${String(lm).padStart(2, "0")}`);
      setDateFrom(first); setDateTo(last);
    } else if (preset === "last_3m") {
      const from = new Date(Date.UTC(y, m - 4, 1));
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10));
    } else if (preset === "last_6m") {
      const from = new Date(Date.UTC(y, m - 7, 1));
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10));
    } else if (preset === "this_year") {
      setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`);
    }
    setTimePreset(preset);
    setPage(1);
  }

  // Label shown when a date filter is active
  function activeRangeLabel() {
    if (!dateFrom && !dateTo) return null;
    const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
    if (dateFrom) return `From ${fmt(dateFrom)}`;
    return `Until ${fmt(dateTo)}`;
  }

  const params = {
    page,
    page_size: 50,
    ...(search && { search }),
    ...(accountId && { account_id: accountId }),
    ...(categoryId && { category_id: categoryId }),
    ...(dateFrom && { start_date: dateFrom }),
    ...(dateTo   && { end_date:   dateTo   }),
  };

  // Client-side filter for no-receipt (API doesn't support this param yet)
  function filterNoReceipt(list) {
    if (!noReceiptOnly) return list;
    return list.filter(t => t.amount > 0 && t.receipt_id == null);
  }

  const { data: txns, loading, refetch } = useApi(
    () => api.transactions.list(params),
    [search, accountId, categoryId, page, dateFrom, dateTo]
  );
  const { data: accounts } = useApi(() => api.accounts.list(), []);
  const { data: categories } = useApi(() => api.categories.list(), []);

  async function handleDelete(txn) {
    if (!confirm(`Delete "${txn.merchant_name || txn.description}"?`)) return;
    await api.transactions.delete(txn.id);
    refetch();
  }

  async function handleAutoCategorize() {
    setAutoRunning(true);
    setAutoResult(null);
    try {
      const r = await api.transactions.autoCategorize();
      setAutoResult(r);
      refetch();
    } finally {
      setAutoRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleAutoCategorize} disabled={autoRunning}>
            <Sparkles className="h-4 w-4" />
            {autoRunning ? "Running…" : "Auto-categorize"}
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setEditTxn(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {autoResult && (
        <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
          Auto-categorized {autoResult.updated} transactions · {autoResult.skipped} remain uncategorized
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search transactions…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-600/60"
          />
        </div>
        <select
          value={accountId}
          onChange={(e) => { setAccountId(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-600/60"
        >
          <option value="">All accounts</option>
          {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-600/60"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setNoReceiptOnly(v => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
            noReceiptOnly
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Receipt className="h-4 w-4" />
          No receipt
        </button>
      </div>

      {/* Timeframe filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
        {["all", "this_month", "last_month", "last_3m", "last_6m", "this_year", "custom"].map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              timePreset === p
                ? "border-blue-600/40 bg-blue-600/10 text-blue-400"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            {{ all: "All time", this_month: "This month", last_month: "Last month",
               last_3m: "Last 3M", last_6m: "Last 6M", this_year: "This year", custom: "Custom" }[p]}
          </button>
        ))}
        {timePreset === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-600/60"
            />
            <span className="text-slate-500 text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-600/60"
            />
          </div>
        )}
        {activeRangeLabel() && timePreset !== "custom" && (
          <span className="text-xs text-slate-500">{activeRangeLabel()}</span>
        )}
        {(dateFrom || dateTo) && (
          <button
            onClick={() => applyPreset("all")}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition"
            title="Clear date filter"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Account</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} cols={6} />)
              : filterNoReceipt(txns ?? []).map((t) => (
                  <TransactionRow
                    key={t.id}
                    txn={t}
                    onEdit={(t) => { setEditTxn(t); setFormOpen(true); }}
                    onDelete={handleDelete}
                    onSplit={(t) => setSplitTxn(t)}
                  />
                ))
            }
          </tbody>
        </table>
        {!loading && !txns?.length && (
          <EmptyState title="No transactions" description="Add one manually, import a CSV, or connect a bank." />
        )}
      </div>

      {/* Pagination */}
      {(txns?.length ?? 0) === 50 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)}>← Prev</Button>}
          <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)}>Next →</Button>
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        transaction={editTxn}
        onSaved={refetch}
      />
      <SplitTransactionModal
        open={!!splitTxn}
        onClose={() => setSplitTxn(null)}
        transaction={splitTxn}
        onSaved={refetch}
      />
    </div>
  );
}
