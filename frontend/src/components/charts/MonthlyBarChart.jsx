import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { formatCurrency, formatMonth } from "../../lib/utils";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="font-medium text-slate-300 mb-1">{formatMonth(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export function MonthlyBarChart({ data = [] }) {
  const formatted = data.map((d) => ({ ...d, label: d.month }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={formatted} barCategoryGap="30%" barGap={4}>
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
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1e293b" }} />
        <Legend
          formatter={(val) => <span className="text-xs text-slate-400 capitalize">{val}</span>}
        />
        <Bar dataKey="income"   name="Income"   fill="#34d399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
