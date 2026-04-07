import { useState, useEffect } from "react";
import { Plus, Upload, History, Trash2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { AccountCard } from "../components/accounts/AccountCard";
import { EmptyState } from "../components/ui/EmptyState";
import { CsvImportWizard } from "../components/import/CsvImportWizard";
import { ACCOUNT_TYPES } from "../lib/constants";
import { formatCurrency } from "../lib/utils";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Account types that support CSV transaction import
const CSV_ACCOUNT_TYPES = new Set(["checking", "savings", "credit", "depository"]);

function AccountForm({ account, onSaved, onClose }) {
  const [form, setForm] = useState({
    name: account?.name ?? "",
    institution: account?.institution ?? "",
    account_type: account?.account_type ?? "checking",
    balance_current: account?.balance_current ?? 0,
    currency: account?.currency ?? "USD",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, balance_current: parseFloat(form.balance_current) };
      if (account?.id) await api.accounts.update(account.id, payload);
      else await api.accounts.create(payload);
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
      <Input label="Account name *" value={form.name} onChange={set("name")} required />
      <Input label="Institution" placeholder="Chase, BoA, etc." value={form.institution} onChange={set("institution")} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Type" value={form.account_type} onChange={set("account_type")}>
          {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input label="Current balance" type="number" step="0.01" value={form.balance_current} onChange={set("balance_current")} />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

function BalanceHistoryModal({ account }) {
  const today = new Date();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    year:    today.getFullYear(),
    month:   today.getMonth() + 1,
    balance: "",
    notes:   "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.accounts.balanceHistory(account.id)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [account.id]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.balance) { setError("Balance is required."); return; }
    setSaving(true);
    setError("");
    try {
      await api.accounts.addBalanceSnapshot(account.id, {
        year:    Number(form.year),
        month:   Number(form.month),
        balance: parseFloat(form.balance),
        notes:   form.notes || null,
      });
      const updated = await api.accounts.balanceHistory(account.id);
      setHistory(updated);
      setForm((f) => ({ ...f, balance: "", notes: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(snapshotId) {
    await api.accounts.deleteBalanceSnapshot(account.id, snapshotId);
    setHistory((h) => h.filter((r) => r.id !== snapshotId));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Track monthly balances for <span className="text-slate-200 font-medium">{account.name}</span> over time.
        This builds a history used in the Cumulative Savings chart.
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 space-y-3">
        <p className="text-xs font-medium text-slate-400">Add / update a monthly balance</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Year</label>
            <input type="number" value={form.year} onChange={set("year")}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-blue-600/60" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Month</label>
            <select value={form.month} onChange={set("month")}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-600/60">
              {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Balance ($)</label>
          <input type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={set("balance")}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-blue-600/60" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notes (optional)</label>
          <input type="text" placeholder="e.g. after paycheck" value={form.notes} onChange={set("notes")}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-blue-600/60" />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save snapshot"}
        </Button>
      </form>

      {/* History table */}
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-4">Loading…</p>
      ) : !history.length ? (
        <p className="text-sm text-slate-500 text-center py-4">No snapshots yet.</p>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left text-slate-400 font-medium">Month</th>
                <th className="px-3 py-2 text-right text-slate-400 font-medium">Balance</th>
                <th className="px-3 py-2 text-left text-slate-400 font-medium">Notes</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((r) => (
                <tr key={r.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                    {MONTH_NAMES[r.month - 1]} {r.year}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-400">
                    {formatCurrency(r.balance)}
                  </td>
                  <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{r.notes ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(r.id)}
                      className="rounded p-1 text-slate-600 hover:text-rose-400 hover:bg-slate-700 transition">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CsvImportModal({ account, allAccounts, onClose, onDone }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Importing to: <span className="text-slate-200 font-medium">{account.name}</span>
        {" "}· Duplicates are automatically skipped.
      </p>
      <CsvImportWizard
        accounts={allAccounts}
        preselectedAccountId={account.id}
        onDone={() => { onDone(); onClose(); }}
      />
    </div>
  );
}

export default function Accounts() {
  const { data: accounts, loading, refetch } = useApi(() => api.accounts.list(), []);
  const [modalOpen, setModalOpen]         = useState(false);
  const [csvModalOpen, setCsvModalOpen]   = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editAccount, setEditAccount]     = useState(null);
  const [csvAccount, setCsvAccount]       = useState(null);
  const [historyAccount, setHistoryAccount] = useState(null);

  function openHistory(account) {
    setHistoryAccount(account);
    setHistoryModalOpen(true);
  }

  async function handleDelete(account) {
    if (!confirm(`Remove "${account.name}"?`)) return;
    await api.accounts.delete(account.id);
    refetch();
  }

  function openCsv(account) {
    setCsvAccount(account);
    setCsvModalOpen(true);
  }

  // Separate bank/credit from other accounts for display
  const bankAccounts = (accounts ?? []).filter((a) => CSV_ACCOUNT_TYPES.has(a.account_type));
  const otherAccounts = (accounts ?? []).filter((a) => !CSV_ACCOUNT_TYPES.has(a.account_type));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Accounts</h1>
        <Button variant="primary" size="sm" onClick={() => { setEditAccount(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Account
        </Button>
      </div>

      {!loading && !accounts?.length && (
        <EmptyState title="No accounts" description="Add a manual account or connect via Plaid in Settings." />
      )}

      {/* Bank & Credit accounts — show CSV import button */}
      {bankAccounts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Bank &amp; Credit Accounts
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bankAccounts.map((a) => (
              <div key={a.id} className="relative group">
                <AccountCard
                  account={a}
                  onEdit={(a) => { setEditAccount(a); setModalOpen(true); }}
                  onDelete={handleDelete}
                />
                {/* Hover action buttons */}
                <div className="absolute top-3 right-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openHistory(a)} title="Balance history"
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-slate-800 text-slate-400 border border-slate-700 hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/30 transition">
                    <History className="h-3 w-3" />
                  </button>
                  <button onClick={() => openCsv(a)} title="Import CSV"
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-slate-800 text-slate-400 border border-slate-700 hover:bg-blue-600/10 hover:text-blue-500 hover:border-blue-600/30 transition">
                    <Upload className="h-3 w-3" />
                    CSV
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Other accounts */}
      {otherAccounts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Other Accounts
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherAccounts.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                onEdit={(a) => { setEditAccount(a); setModalOpen(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Edit / Add modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editAccount ? "Edit Account" : "Add Account"}
      >
        <AccountForm
          account={editAccount}
          onSaved={refetch}
          onClose={() => setModalOpen(false)}
        />
      </Modal>

      {/* CSV Import modal */}
      <Modal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title={`Import CSV → ${csvAccount?.name ?? ""}`}
      >
        {csvAccount && (
          <CsvImportModal
            account={csvAccount}
            allAccounts={accounts ?? []}
            onClose={() => setCsvModalOpen(false)}
            onDone={refetch}
          />
        )}
      </Modal>

      {/* Balance History modal */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Balance History — ${historyAccount?.name ?? ""}`}
      >
        {historyAccount && <BalanceHistoryModal account={historyAccount} />}
      </Modal>
    </div>
  );
}
