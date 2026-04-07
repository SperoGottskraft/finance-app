import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, CalendarDays, DollarSign, Award } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { formatCurrency, formatMonth, formatDate, cx } from "../lib/utils";

// ── Recharts tooltip ─────────────────────────────────────────────────────────
function IncomeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const active_entries = payload.filter((p) => (p.value ?? 0) > 0);
  if (!active_entries.length) return null;
  const total = active_entries.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl min-w-[160px]">
      <p className="font-medium text-slate-300 mb-2">{formatMonth(label)}</p>
      {active_entries.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.fill }} />
            <span className="text-slate-400 text-xs">{p.name}</span>
          </div>
          <span className="font-mono text-slate-200 text-xs">{formatCurrency(p.value)}</span>
        </div>
      ))}
      {active_entries.length > 1 && (
        <div className="flex justify-between mt-1.5 pt-1.5 border-t border-slate-700">
          <span className="text-xs text-slate-500">Total</span>
          <span className="font-mono text-emerald-400 text-xs font-medium">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "emerald" }) {
  const ring = {
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    cyan:    "border-blue-600/20 bg-blue-600/5",
    violet:  "border-violet-500/20 bg-violet-500/5",
    amber:   "border-amber-500/20 bg-amber-500/5",
  }[color];
  const icon = {
    emerald: "text-emerald-400",
    cyan:    "text-blue-500",
    violet:  "text-violet-400",
    amber:   "text-amber-400",
  }[color];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-slate-500">{label}</p>
        <div className={cx("flex h-8 w-8 items-center justify-center rounded-xl border", ring)}>
          <Icon className={cx("h-4 w-4", icon)} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-100 font-mono">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// Returns ISO strings for the first and last moment of a YYYY-MM string
function monthRange(yyyyMM) {
  const [y, m] = yyyyMM.split("-").map(Number);
  const start = `${yyyyMM}-01T00:00:00.000Z`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getDate();
  const end = `${yyyyMM}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
  return { start, end };
}

function currentYYYYMM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function Income() {
  const [mode, setMode] = useState("rolling"); // "rolling" | "month"
  const [months, setMonths] = useState(6);
  const [selectedMonth, setSelectedMonth] = useState(currentYYYYMM);
  const [txnPage, setTxnPage] = useState(1);
  const [search, setSearch] = useState("");

  // Build API params based on current mode
  const statsParams = mode === "month"
    ? { start_date: monthRange(selectedMonth).start, end_date: monthRange(selectedMonth).end }
    : { months };

  const txnDateParams = mode === "month"
    ? { start_date: monthRange(selectedMonth).start, end_date: monthRange(selectedMonth).end }
    : {};

  const { data: stats, loading: statsLoading } = useApi(
    () => api.analytics.income(statsParams),
    [mode, months, selectedMonth]
  );
  const { data: txns, loading: txnLoading } = useApi(
    () => api.transactions.list({
      income_only: true,
      ...txnDateParams,
      ...(search ? { search } : {}),
      page: txnPage,
      page_size: 50,
      sort: "date",
      order: "desc",
    }),
    [mode, selectedMonth, txnPage, search]
  );

  function handleModeChange(e) {
    setMode(e.target.value);
    setTxnPage(1);
  }

  const topSource = stats?.by_source?.[0];
  const catColors = stats?.cat_colors ?? {};
  // Only categories with actual income in the period — filters out zero/non-income entries
  const allCats   = (stats?.by_source ?? []).filter(s => s.total > 0).map(s => s.category_name);
  const chartData = (stats?.monthly ?? []).map((d) => {
    const entry = { ...d, label: d.month };
    allCats.forEach((cat) => { if (!(cat in entry)) entry[cat] = 0; });
    return entry;
  });
  const sourceMax = stats?.by_source?.[0]?.total ?? 1;

  // Rolling 3-month average — last 3 months from current view
  const rollingMonths = (stats?.monthly ?? []).slice(-3);
  const rollingRows = allCats
    .map((cat) => {
      const amounts = rollingMonths.map((m) => m[cat] ?? 0);
      const avg = amounts.reduce((s, v) => s + v, 0) / 3;
      return { cat, color: catColors[cat], amounts, avg };
    })
    .filter((r) => r.avg > 0 || r.amounts.some((v) => v > 0))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Income</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All accounts · transfers excluded · negative-amount transactions only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={handleModeChange}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-600"
          >
            <option value="rolling">Rolling</option>
            <option value="month">Month</option>
          </select>

          {mode === "rolling" && (
            <select
              value={months}
              onChange={(e) => { setMonths(Number(e.target.value)); setTxnPage(1); }}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-600"
            >
              {[3, 6, 12, 24].map((m) => (
                <option key={m} value={m}>{m} months</option>
              ))}
            </select>
          )}

          {mode === "month" && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setTxnPage(1); }}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-600 [color-scheme:dark]"
            />
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label={`Total (${months}mo)`}
          value={statsLoading ? "—" : formatCurrency(stats?.total_period ?? 0)}
          sub={`across ${stats?.monthly?.length ?? 0} months`}
          color="emerald"
        />
        <StatCard
          icon={CalendarDays}
          label="Year to Date"
          value={statsLoading ? "—" : formatCurrency(stats?.ytd ?? 0)}
          sub={`${new Date().getFullYear()}`}
          color="cyan"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg / Month"
          value={statsLoading ? "—" : formatCurrency(stats?.avg_monthly ?? 0)}
          sub="for selected period"
          color="violet"
        />
        <StatCard
          icon={Award}
          label="Top Source"
          value={statsLoading ? "—" : (topSource?.category_name ?? "—")}
          sub={topSource ? formatCurrency(topSource.total) : undefined}
          color="amber"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Monthly bar chart — stacked by source */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Monthly Income by Source</h2>
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickFormatter={formatMonth}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip content={<IncomeTooltip />} cursor={{ fill: "#1e293b" }} />
                  {allCats.map((cat, i) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      name={cat}
                      stackId="income"
                      fill={catColors[cat]}
                      radius={i === allCats.length - 1 ? [3, 3, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              {allCats.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-slate-800">
                  {allCats.map((cat) => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: catColors[cat] }} />
                      <span className="text-xs text-slate-400">{cat}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-60 items-center justify-center">
              <p className="text-sm text-slate-600">No income data for this period</p>
            </div>
          )}
        </div>

        {/* By-source breakdown */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">By Source</h2>
          <div className="space-y-3">
            {(stats?.by_source ?? []).map((s, i) => {
              const pct = (s.total / sourceMax) * 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: s.color }}
                      />
                      <span className="text-xs text-slate-300 truncate">{s.category_name}</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 ml-2 shrink-0">
                      {formatCurrency(s.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              );
            })}
            {!statsLoading && !stats?.by_source?.length && (
              <p className="text-sm text-slate-600 py-4 text-center">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Rolling 3-month average by source ── */}
      {rollingRows.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300">Rolling 3-Month Average by Source</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Based on the last 3 months of data in the current view · zero months counted in average
            </p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/40">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Source</th>
                  {rollingMonths.map((m) => (
                    <th key={m.month} className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 whitespace-nowrap">
                      {formatMonth(m.month)}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-blue-600 whitespace-nowrap">
                    3-mo Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {rollingRows.map((row) => (
                  <tr key={row.cat} className="border-t border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                        <span className="text-sm text-slate-200">{row.cat}</span>
                      </div>
                    </td>
                    {row.amounts.map((amt, i) => (
                      <td key={i} className={cx(
                        "px-4 py-3 text-right font-mono text-sm",
                        amt > 0 ? "text-emerald-400" : "text-slate-600"
                      )}>
                        {amt > 0 ? formatCurrency(amt) : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-blue-500">
                      {formatCurrency(row.avg)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {rollingRows.length > 1 && (
                <tfoot className="border-t border-slate-700">
                  <tr className="bg-slate-800/30">
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-400">Total</td>
                    {rollingMonths.map((m, i) => {
                      const colTotal = rollingRows.reduce((s, r) => s + (r.amounts[i] ?? 0), 0);
                      return (
                        <td key={m.month} className="px-4 py-2.5 text-right font-mono text-xs font-medium text-emerald-400">
                          {formatCurrency(colTotal)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-blue-500">
                      {formatCurrency(rollingRows.reduce((s, r) => s + r.avg, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Income transactions ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300">Income Transactions</h2>
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setTxnPage(1); }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-blue-600 w-48"
          />
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txnLoading
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="border-t border-slate-800/60">
                      {Array.from({ length: 5 }, (_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 rounded bg-slate-800 animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : (txns ?? []).map((t) => (
                    <tr key={t.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200 font-medium truncate max-w-[220px]">
                          {t.merchant_name || t.description || "—"}
                        </div>
                        {t.merchant_name && t.description && (
                          <div className="text-xs text-slate-500 truncate max-w-[220px]">{t.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {t.account?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {t.category ? (
                          <span
                            className="rounded-md px-1.5 py-0.5 text-xs"
                            style={{
                              background: `${t.category.color}22`,
                              color: t.category.color,
                              border: `1px solid ${t.category.color}44`,
                            }}
                          >
                            {t.category.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-emerald-400 whitespace-nowrap">
                        +{formatCurrency(Math.abs(t.amount))}
                      </td>
                    </tr>
                  ))}
              {!txnLoading && !txns?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-600">
                    No income transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {((txns?.length ?? 0) >= 50 || txnPage > 1) && (
          <div className="flex justify-center gap-2 px-4 py-3 border-t border-slate-800">
            {txnPage > 1 && (
              <button
                onClick={() => setTxnPage((p) => p - 1)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition"
              >
                ← Prev
              </button>
            )}
            {(txns?.length ?? 0) >= 50 && (
              <button
                onClick={() => setTxnPage((p) => p + 1)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 transition"
              >
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
