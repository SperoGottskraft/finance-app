import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, PiggyBank, BriefcaseBusiness,
  Wallet, BarChart3, ChevronLeft, ChevronRight, Landmark, CreditCard,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { formatCurrency, formatMonth, cx } from "../lib/utils";
import { SpendingPieChart } from "../components/charts/SpendingPieChart";
import { SkeletonCard } from "../components/ui/SkeletonRow";

// ── Month helpers ─────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];

function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59)).toISOString();
  return { start, end };
}

// ── Shared tooltip ────────────────────────────────────────────────────────────
function ChartTip({ title, rows }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      {title && <p className="font-medium text-slate-300 mb-1.5">{title}</p>}
      {rows.map(({ label, value, color, bold }) => (
        <p key={label} style={{ color }} className={cx("flex justify-between gap-5", bold && "font-semibold mt-1 pt-1 border-t border-slate-700")}>
          <span>{label}</span>
          <span className="font-mono text-slate-200">{value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, accent, sub, small }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-slate-500 uppercase tracking-wide leading-tight">{label}</p>
        <div className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={cx("mt-2 font-bold font-mono text-slate-100", small ? "text-lg" : "text-xl")}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 truncate">{sub}</p>}
    </div>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, description, children, className = "", action }) {
  return (
    <div className={cx("rounded-2xl border border-slate-800 bg-slate-900 p-4", className)}>
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-sm font-semibold text-slate-300">{title}</p>
        {action}
      </div>
      {description && <p className="text-xs text-slate-500 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      {children}
    </div>
  );
}

// ── Period selector pill ──────────────────────────────────────────────────────
function PeriodPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
      {[3, 6, 12].map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cx(
            "rounded-md px-2 py-0.5 text-xs font-medium transition",
            value === m ? "bg-slate-600 text-slate-100" : "text-slate-500 hover:text-slate-300"
          )}
        >
          {m}M
        </button>
      ))}
    </div>
  );
}

// ── Income vs Expenses area chart ─────────────────────────────────────────────
function IncomeExpensesArea({ data, onMonthClick }) {
  const fmt = data.map((d) => ({ ...d, label: d.month }));
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const inc = payload.find((p) => p.dataKey === "income")?.value ?? 0;
    const exp = payload.find((p) => p.dataKey === "expenses")?.value ?? 0;
    const gap = inc - exp;
    return (
      <ChartTip
        title={`${formatMonth(label)}${onMonthClick ? " · click to view transactions" : ""}`}
        rows={[
          { label: "Income",   value: formatCurrency(inc), color: "#34d399" },
          { label: "Expenses", value: formatCurrency(exp), color: "#fb7185" },
          { label: gap >= 0 ? "Surplus" : "Deficit", value: formatCurrency(Math.abs(gap)),
            color: gap >= 0 ? "#34d399" : "#fb7185", bold: true },
        ]}
      />
    );
  };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart
        data={fmt}
        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        onClick={(chartData) => {
          if (onMonthClick && chartData?.activeLabel) onMonthClick(chartData.activeLabel);
        }}
        style={onMonthClick ? { cursor: "pointer" } : undefined}
      >
        <defs>
          <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#34d399" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#fb7185" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tickFormatter={formatMonth} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />
        <Legend formatter={(v) => <span className="text-xs text-slate-400 capitalize">{v}</span>} iconSize={8} />
        <Area type="monotone" dataKey="income"   name="Income"   stroke="#34d399" strokeWidth={2} fill="url(#incG)" />
        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#fb7185" strokeWidth={2} fill="url(#expG)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Cumulative savings line chart ─────────────────────────────────────────────
function CumulativeSavingsChart({ data }) {
  let running = 0;
  const fmt = data.map((d) => {
    running += (d.income - d.expenses);
    return { label: d.month, cumulative: parseFloat(running.toFixed(2)) };
  });
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    return (
      <ChartTip
        title={formatMonth(label)}
        rows={[{ label: "Cumulative savings", value: formatCurrency(val), color: val >= 0 ? "#34d399" : "#fb7185" }]}
      />
    );
  };
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={fmt} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1d4ed8" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tickFormatter={formatMonth} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />
        <Area type="monotone" dataKey="cumulative" name="Cumulative" stroke="#1d4ed8" strokeWidth={2} fill="url(#cumG)" dot={{ fill: "#1d4ed8", r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Budget vs Actual line chart ───────────────────────────────────────────────
function BudgetVsActualLine({ data, budgetTarget }) {
  const fmt = data.map((d) => ({
    label: d.month,
    actual: parseFloat(d.expenses.toFixed(2)),
    budget: parseFloat(budgetTarget.toFixed(2)),
  }));
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <ChartTip
        title={formatMonth(label)}
        rows={payload.map((p) => ({ label: p.name, value: formatCurrency(p.value), color: p.stroke }))}
      />
    );
  };
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={fmt} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tickFormatter={formatMonth} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(v) => <span className="text-xs text-slate-400 capitalize">{v}</span>} iconSize={8} />
        <Line type="monotone" dataKey="budget" name="Budget" stroke="#475569" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
        <Line type="monotone" dataKey="actual" name="Actual" stroke="#f97316" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Compact Budget KPI vertical bar chart ─────────────────────────────────────
function BudgetKpiChart({ budgets, onCategoryClick }) {
  const data = budgets
    .slice()
    .sort((a, b) => b.pct - a.pct)
    .map((b) => ({
      name: b.category_name.length > 9 ? b.category_name.slice(0, 8) + "…" : b.category_name,
      fullName: b.category_name,
      category_id: b.category_id,
      spent:  parseFloat(b.spent.toFixed(2)),
      budget: parseFloat(b.limit.toFixed(2)),
      pct:    b.pct,
    }));

  const spentColor = (pct) => pct >= 100 ? "#fb7185" : pct >= 80 ? "#fbbf24" : "#34d399";

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const row = data.find((d) => d.name === label) ?? {};
    return (
      <ChartTip
        title={row.fullName ?? label}
        rows={[
          ...payload.map((p) => ({ label: p.name, value: formatCurrency(p.value), color: p.fill ?? p.color })),
          { label: "Used", value: `${Math.round(row.pct ?? 0)}%`, color: "#94a3b8", bold: true },
        ]}
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart
        data={data}
        barCategoryGap="28%"
        barGap={3}
        margin={{ top: 4, right: 4, bottom: 36, left: 0 }}
        onClick={(d) => { if (onCategoryClick && d?.activeLabel) { const row = data.find(r => r.name === d.activeLabel); if (row) onCategoryClick(row.category_id); } }}
        style={onCategoryClick ? { cursor: "pointer" } : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
        <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1e293b" }} />
        <Legend formatter={(v) => <span className="text-xs text-slate-400 capitalize">{v}</span>} iconSize={8} />
        <Bar dataKey="budget" name="Budget" radius={[3,3,0,0]}>
          {data.map((_, i) => <Cell key={i} fill="#334155" />)}
        </Bar>
        <Bar dataKey="spent" name="Spent" radius={[3,3,0,0]}>
          {data.map((d, i) => <Cell key={i} fill={spentColor(d.pct)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Compact KPI panel ─────────────────────────────────────────────────────────
function KpiPanel({ income, expenses, net, budgets }) {
  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent  = budgets.reduce((s, b) => s + b.spent, 0);
  const budgetEff   = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 999) : 0;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;
  const overBudget  = budgets.filter((b) => b.pct >= 100).length;

  function KpiBar({ label, value, pct, color }) {
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">{label}</span>
          <span className="font-mono text-slate-300">{value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 text-blue-500" />
        <p className="text-sm font-semibold text-slate-300">KPI</p>
        {overBudget > 0 && (
          <span className="ml-auto text-xs text-rose-400">⚠ {overBudget} over</span>
        )}
      </div>
      <div className="space-y-3">
        <KpiBar label="Budget efficiency" value={`${budgetEff.toFixed(1)}%`} pct={budgetEff}
          color={budgetEff >= 100 ? "#fb7185" : budgetEff >= 80 ? "#fbbf24" : "#34d399"} />
        <KpiBar label="Savings rate" value={`${savingsRate.toFixed(1)}%`} pct={savingsRate} color="#1d4ed8" />
      </div>
      <div className="space-y-1.5 mt-auto pt-2 border-t border-slate-800">
        <a href="/transactions?action=new"
          className="flex w-full items-center justify-center rounded-lg bg-blue-600/10 border border-blue-600/20 px-2 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-600/20 transition">
          + Add transaction
        </a>
        <div className="grid grid-cols-2 gap-1.5">
          <a href="/budgets" className="flex items-center justify-center rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-600 transition">Budgets</a>
          <a href="/accounts" className="flex items-center justify-center rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-600 transition">Import</a>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();

  // Month selector state
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  // Chart period
  const [chartMonths, setChartMonths] = useState(6);

  const { start, end } = useMemo(() => monthRange(viewYear, viewMonth), [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const { data: dash,    loading: dl } = useApi(
    () => api.analytics.dashboard({ start_date: start, end_date: end }),
    [start]
  );
  const { data: monthly } = useApi(
    () => api.analytics.monthly({ months: chartMonths }),
    [chartMonths]
  );
  const { data: byCategory } = useApi(
    () => api.analytics.byCategory({ start_date: start, end_date: end }),
    [start]
  );

  const budgets      = dash?.budgets ?? [];
  const hasBudgets   = budgets.length > 0;
  const monthlyData  = monthly ?? [];
  const budgetTarget = budgets.reduce((s, b) => s + b.limit, 0);

  function drillToCategory(category_id) {
    navigate(`/transactions?category_id=${category_id}`);
  }

  function drillToMonth(month) {
    navigate(`/transactions?month=${month}`);
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;

  return (
    <div className="space-y-4">
      {/* ── Header + month selector ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Personal Finance</p>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[130px] text-center">
            <p className="text-sm font-semibold text-slate-200">{MONTH_NAMES[viewMonth - 1]} {viewYear}</p>
            {!isCurrentMonth && (
              <button onClick={() => { setViewMonth(today.getMonth() + 1); setViewYear(today.getFullYear()); }}
                className="text-xs text-blue-500 hover:underline">Today</button>
            )}
          </div>
          <button onClick={nextMonth} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── 6 stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {dl ? (
          Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Total Assets"         value={formatCurrency(dash?.total_assets ?? 0)}      icon={Landmark}          accent="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" sub="checking + savings" small />
            <StatCard label="Total Liabilities"    value={formatCurrency(dash?.total_liabilities ?? 0)} icon={CreditCard}        accent="bg-rose-500/15 text-rose-400 border border-rose-500/20"          sub="credit card balances" small />
            <StatCard label="Investments"          value={formatCurrency(dash?.investment_total ?? 0)}  icon={BriefcaseBusiness} accent="bg-blue-600/15 text-blue-500 border border-blue-600/20"          sub="total portfolio" small />
            <StatCard label="Monthly Income"       value={formatCurrency(dash?.income ?? 0)}            icon={TrendingUp}        accent="bg-green-500/15 text-green-400 border border-green-500/20"       sub="deposits this month" small />
            <StatCard label="Monthly Expenses"     value={formatCurrency(dash?.expenses ?? 0)}          icon={TrendingDown}      accent="bg-orange-500/15 text-orange-400 border border-orange-500/20"    sub="excl. transfers" small />
            <StatCard label="Net Income"           value={formatCurrency(dash?.net ?? 0)}               icon={PiggyBank}         accent={(dash?.net ?? 0) >= 0 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/15 text-rose-400 border border-rose-500/20"} sub="income − expenses" small />
          </>
        )}
      </div>

      {/* ── Row 1: Area chart + Donut ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Income vs Expenses"
          description="Click a month to view transactions · hover for surplus/deficit · transfers excluded"
          action={<PeriodPicker value={chartMonths} onChange={setChartMonths} />}
        >
          {monthlyData.length
            ? <IncomeExpensesArea data={monthlyData} onMonthClick={drillToMonth} />
            : <div className="flex h-[220px] items-center justify-center text-slate-600 text-sm">No data yet</div>
          }
        </ChartCard>
        <ChartCard title="Spending by Category" description="Click a slice to view transactions">
          <SpendingPieChart
            data={(byCategory ?? []).slice(0, 8)}
            onSliceClick={(e) => e?.category_id && drillToCategory(e.category_id)}
          />
        </ChartCard>
      </div>

      {/* ── Row 2: Budget KPI chart + KPI panel ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-sm font-semibold text-slate-300">Spend vs Budget</p>
            {hasBudgets && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2.5 rounded-sm bg-emerald-400" />&lt;80%</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2.5 rounded-sm bg-amber-400" />80–100%</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2.5 rounded-sm bg-rose-400" />Over</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-600 mb-2">Click a bar to view transactions</p>
          {!hasBudgets ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No budgets set. <a href="/budgets" className="text-blue-500 hover:underline">Create one →</a>
            </p>
          ) : (
            <>
              <BudgetKpiChart budgets={budgets} onCategoryClick={drillToCategory} />
              <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-xs font-mono">
                <span className="text-slate-500">Total</span>
                <span className="text-slate-200">
                  {formatCurrency(budgets.reduce((s, b) => s + b.spent, 0))}
                  <span className="text-slate-500 font-normal ml-1">/ {formatCurrency(budgetTarget)}</span>
                </span>
              </div>
            </>
          )}
        </div>
        <KpiPanel income={dash?.income ?? 0} expenses={dash?.expenses ?? 0} net={dash?.net ?? 0} budgets={budgets} />
      </div>

      {/* ── Row 3: Cumulative savings + Budget vs Actual ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Cumulative Savings"
          description="Running total of net savings over the period"
          action={<PeriodPicker value={chartMonths} onChange={setChartMonths} />}
        >
          {monthlyData.length
            ? <CumulativeSavingsChart data={monthlyData} />
            : <div className="flex h-[180px] items-center justify-center text-slate-600 text-sm">No data yet</div>
          }
        </ChartCard>
        <ChartCard title="Budget vs Actual" description="Monthly spend vs total budget target">
          {monthlyData.length && budgetTarget > 0
            ? <BudgetVsActualLine data={monthlyData} budgetTarget={budgetTarget} />
            : <div className="flex h-[180px] items-center justify-center text-slate-600 text-sm">
                {budgetTarget === 0 ? "Set budgets to enable this chart" : "No data yet"}
              </div>
          }
        </ChartCard>
      </div>
    </div>
  );
}
