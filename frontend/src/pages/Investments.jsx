import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { formatCurrency, cx } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";

const ACCOUNT_TYPES = ["brokerage", "retirement", "roth_ira", "traditional_ira", "401k", "hsa", "other"];
const HOLDING_TYPES = ["stock", "mutual_fund", "etf", "bond", "cd", "cash", "crypto", "other"];

// ── Account form ────────────────────────────────────────────────────────────

function AccountForm({ account, onSaved, onClose }) {
  const [form, setForm] = useState({
    name: account?.name ?? "",
    institution: account?.institution ?? "",
    account_type: account?.account_type ?? "brokerage",
    account_number_last4: account?.account_number_last4 ?? "",
    total_value: account?.total_value ?? "",
    as_of_date: account?.as_of_date
      ? new Date(account.as_of_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        total_value: form.total_value !== "" ? parseFloat(form.total_value) : null,
        account_number_last4: form.account_number_last4 || null,
      };
      if (account?.id) await api.investments.update(account.id, payload);
      else await api.investments.create(payload);
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
      <Input label="Institution *" placeholder="Fidelity, Schwab, etc." value={form.institution} onChange={set("institution")} required />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Account type" value={form.account_type} onChange={set("account_type")}>
          {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input label="Account # (last 4)" maxLength={4} value={form.account_number_last4} onChange={set("account_number_last4")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Total value ($)" type="number" step="0.01" value={form.total_value} onChange={set("total_value")} />
        <Input label="As of date" type="date" value={form.as_of_date} onChange={set("as_of_date")} />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

// ── Holding form ────────────────────────────────────────────────────────────

function HoldingForm({ holding, onSaved, onClose }) {
  const [form, setForm] = useState({
    symbol: holding?.symbol ?? "",
    description: holding?.description ?? "",
    holding_type: holding?.holding_type ?? "stock",
    shares: holding?.shares ?? "",
    price_per_share: holding?.price_per_share ?? "",
    market_value: holding?.market_value ?? "",
    cost_basis: holding?.cost_basis ?? "",
    unrealized_gain_loss: holding?.unrealized_gain_loss ?? "",
    annualized_return_pct: holding?.annualized_return_pct ?? "",
    return_dollars: holding?.return_dollars ?? "",
    as_of_date: holding?.as_of_date
      ? new Date(holding.as_of_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v) => v !== "" ? parseFloat(v) : null;

  // Auto-compute market value from shares × price
  function handleSharesOrPrice(k) {
    return (e) => {
      const val = e.target.value;
      setForm((f) => {
        const next = { ...f, [k]: val };
        const shares = parseFloat(k === "shares" ? val : next.shares);
        const price = parseFloat(k === "price_per_share" ? val : next.price_per_share);
        if (!isNaN(shares) && !isNaN(price)) {
          next.market_value = (shares * price).toFixed(2);
        }
        return next;
      });
    };
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        symbol: form.symbol || null,
        description: form.description || null,
        holding_type: form.holding_type,
        shares: num(form.shares),
        price_per_share: num(form.price_per_share),
        market_value: num(form.market_value),
        cost_basis: num(form.cost_basis),
        unrealized_gain_loss: num(form.unrealized_gain_loss),
        annualized_return_pct: num(form.annualized_return_pct),
        return_dollars: num(form.return_dollars),
        as_of_date: form.as_of_date,
      };
      await onSaved(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Symbol" placeholder="GOOGL, PCOXX…" value={form.symbol} onChange={set("symbol")} />
        <Select label="Type" value={form.holding_type} onChange={set("holding_type")}>
          {HOLDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>
      <Input label="Description" value={form.description} onChange={set("description")} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Shares / Qty" type="number" step="any" value={form.shares} onChange={handleSharesOrPrice("shares")} />
        <Input label="Price / share ($)" type="number" step="any" value={form.price_per_share} onChange={handleSharesOrPrice("price_per_share")} />
        <Input label="Market value ($)" type="number" step="0.01" value={form.market_value} onChange={set("market_value")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cost basis ($)" type="number" step="0.01" value={form.cost_basis} onChange={set("cost_basis")} />
        <Input label="Unrealized G/L ($)" type="number" step="0.01" value={form.unrealized_gain_loss} onChange={set("unrealized_gain_loss")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Ann. return (%)" type="number" step="any" value={form.annualized_return_pct} onChange={set("annualized_return_pct")} />
        <Input label="Return ($)" type="number" step="0.01" value={form.return_dollars} onChange={set("return_dollars")} />
        <Input label="As of date" type="date" value={form.as_of_date} onChange={set("as_of_date")} />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

// ── Account card with expandable holdings ───────────────────────────────────

function InvestmentAccountCard({ account, onEdit, onDelete, onRefetch }) {
  const [expanded, setExpanded] = useState(false);
  const [holdingModal, setHoldingModal] = useState(false);
  const [editHolding, setEditHolding] = useState(null);

  const gain = (account.holdings ?? []).reduce((s, h) => s + (h.unrealized_gain_loss ?? 0), 0);
  const gainColor = gain >= 0 ? "text-emerald-400" : "text-rose-400";

  async function handleSaveHolding(payload) {
    if (editHolding?.id) {
      await api.investments.updateHolding(account.id, editHolding.id, payload);
    } else {
      await api.investments.addHolding(account.id, payload);
    }
    onRefetch();
  }

  async function handleDeleteHolding(holding) {
    if (!confirm(`Remove ${holding.symbol ?? holding.description}?`)) return;
    await api.investments.deleteHolding(account.id, holding.id);
    onRefetch();
  }

  const asOf = account.as_of_date
    ? new Date(account.as_of_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900">
      {/* Header row */}
      <div className="flex items-start justify-between p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide bg-slate-800 px-2 py-0.5 rounded-md">
              {account.institution}
            </span>
            <span className="text-xs text-slate-600">{account.account_type}</span>
          </div>
          <p className="mt-1.5 font-semibold text-slate-100 truncate">{account.name}</p>
          {asOf && <p className="text-xs text-slate-500 mt-0.5">as of {asOf}</p>}
        </div>
        <div className="text-right ml-4 shrink-0">
          <p className="text-xl font-bold font-mono text-slate-100">
            {formatCurrency(account.total_value ?? 0)}
          </p>
          {gain !== 0 && (
            <p className={cx("text-xs font-mono mt-0.5", gainColor)}>
              {gain >= 0 ? "+" : ""}{formatCurrency(gain)} unrealized
            </p>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between px-5 pb-4 border-t border-slate-800/60 pt-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {account.holdings?.length ?? 0} holdings
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setEditHolding(null); setHoldingModal(true); }}>
            <Plus className="h-3 w-3" /> Add Holding
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(account)}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(account)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Holdings table */}
      {expanded && (account.holdings?.length ?? 0) > 0 && (
        <div className="border-t border-slate-800 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="px-4 py-2 text-left text-slate-400 font-medium">Symbol</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium">Description</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium">Type</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium">Shares</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium">Price</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium">Market Value</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium">G/L</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {account.holdings.map((h) => (
                <tr key={h.id} className="border-t border-slate-800/40 hover:bg-slate-800/20 group">
                  <td className="px-4 py-2 font-mono text-blue-500 font-medium">{h.symbol ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-300 max-w-[200px] truncate">{h.description ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{h.holding_type}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">{h.shares?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">
                    {h.price_per_share != null ? `$${h.price_per_share.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-200 font-medium">
                    {h.market_value != null ? formatCurrency(h.market_value) : "—"}
                  </td>
                  <td className={cx("px-4 py-2 text-right font-mono",
                    (h.unrealized_gain_loss ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {h.unrealized_gain_loss != null
                      ? `${h.unrealized_gain_loss >= 0 ? "+" : ""}${formatCurrency(h.unrealized_gain_loss)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => { setEditHolding(h); setHoldingModal(true); }}
                        className="rounded p-1 text-slate-500 hover:text-blue-500 hover:bg-slate-800 transition"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteHolding(h)}
                        className="rounded p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Holding form modal */}
      <Modal
        open={holdingModal}
        onClose={() => setHoldingModal(false)}
        title={editHolding ? "Edit Holding" : `Add Holding — ${account.name}`}
      >
        <HoldingForm
          holding={editHolding}
          onSaved={handleSaveHolding}
          onClose={() => setHoldingModal(false)}
        />
      </Modal>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Investments() {
  const { data: accounts, loading, refetch } = useApi(() => api.investments.list(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);

  // Need full account data (with holdings) for each card
  const { data: detailedAccounts, refetch: refetchDetails } = useApi(
    () => Promise.all((accounts ?? []).map((a) => api.investments.get(a.id))),
    [accounts]
  );

  const allAccounts = detailedAccounts ?? [];
  const totalPortfolio = allAccounts.reduce((s, a) => s + (a.total_value ?? 0), 0);
  const totalGain = allAccounts.flatMap((a) => a.holdings ?? [])
    .reduce((s, h) => s + (h.unrealized_gain_loss ?? 0), 0);

  async function handleDelete(account) {
    if (!confirm(`Remove "${account.name}"?`)) return;
    await api.investments.delete(account.id);
    refetch();
  }

  function handleRefetch() {
    refetch();
    refetchDetails();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Investments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Retirement &amp; brokerage accounts</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditAccount(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Account
        </Button>
      </div>

      {/* Portfolio summary bar */}
      {!loading && allAccounts.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total Portfolio</p>
              <p className="text-3xl font-bold font-mono text-slate-100 mt-1">
                {formatCurrency(totalPortfolio)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Unrealized G/L</p>
              <p className={cx("text-xl font-bold font-mono mt-1 flex items-center gap-1 justify-end",
                totalGain >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {totalGain >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {totalGain >= 0 ? "+" : ""}{formatCurrency(totalGain)}
              </p>
            </div>
          </div>

          {/* Per-institution breakdown */}
          {allAccounts.length > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(
                allAccounts.reduce((acc, a) => {
                  acc[a.institution] = (acc[a.institution] ?? 0) + (a.total_value ?? 0);
                  return acc;
                }, {})
              ).map(([inst, val]) => (
                <div key={inst} className="text-center">
                  <p className="text-xs text-slate-500 truncate">{inst}</p>
                  <p className="text-sm font-bold font-mono text-slate-200 mt-0.5">{formatCurrency(val)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && allAccounts.length === 0 && (
        <EmptyState title="No investment accounts" description="Add your brokerage, 401k, or IRA accounts to track your portfolio." />
      )}

      {/* Account cards */}
      <div className="space-y-4">
        {allAccounts.map((a) => (
          <InvestmentAccountCard
            key={a.id}
            account={a}
            onEdit={(a) => { setEditAccount(a); setModalOpen(true); }}
            onDelete={handleDelete}
            onRefetch={handleRefetch}
          />
        ))}
      </div>

      {/* Add/Edit account modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editAccount ? "Edit Investment Account" : "Add Investment Account"}
      >
        <AccountForm
          account={editAccount}
          onSaved={handleRefetch}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
