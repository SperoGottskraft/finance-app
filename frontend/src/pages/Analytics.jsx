import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/utils";
import { SpendingPieChart } from "../components/charts/SpendingPieChart";
import { MonthlyBarChart } from "../components/charts/MonthlyBarChart";

export default function Analytics() {
  const [months, setMonths] = useState(6);

  const { data: byCategory } = useApi(() => api.analytics.byCategory(), []);
  const { data: monthly } = useApi(() => api.analytics.monthly({ months }), [months]);
  const { data: merchants } = useApi(() => api.analytics.topMerchants({ limit: 10 }), []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Spending by Category (this month)</h2>
          <SpendingPieChart data={byCategory ?? []} />
        </div>

        {/* Monthly trend */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Monthly Trend</h2>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 outline-none"
            >
              {[3, 6, 12].map((m) => <option key={m} value={m}>{m} months</option>)}
            </select>
          </div>
          <MonthlyBarChart data={monthly ?? []} />
        </div>
      </div>

      {/* Top merchants */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Top Merchants (this month)</h2>
        <div className="space-y-2">
          {(merchants ?? []).map((m, i) => {
            const max = merchants[0]?.total ?? 1;
            const pct = (m.total / max) * 100;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-slate-300 truncate">{m.merchant}</span>
                    <span className="text-sm font-mono text-rose-400 ml-2 shrink-0">{formatCurrency(m.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-600/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {!merchants?.length && (
            <p className="text-sm text-slate-500 text-center py-4">No merchant data yet</p>
          )}
        </div>
      </div>

      {/* Category table */}
      {byCategory?.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 overflow-hidden">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Category Breakdown</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="pb-2 text-left text-xs text-slate-500">Category</th>
                  <th className="pb-2 text-right text-xs text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => (
                  <tr key={c.category_id ?? "uncategorized"} className="border-b border-slate-800/50">
                    <td className="py-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-slate-300">{c.category_name}</span>
                    </td>
                    <td className="py-2 text-right font-mono text-rose-400">{formatCurrency(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
