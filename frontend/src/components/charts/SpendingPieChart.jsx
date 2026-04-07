import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "../../lib/utils";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="font-medium text-slate-200">{item.name}</p>
      <p className="text-slate-400">{formatCurrency(item.value)}</p>
    </div>
  );
};

export function SpendingPieChart({ data = [], onSliceClick }) {
  if (!data.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-slate-600 text-sm">
        No spending data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="category_name"
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={105}
          paddingAngle={2}
          onClick={onSliceClick ? (entry) => onSliceClick(entry) : undefined}
          style={onSliceClick ? { cursor: "pointer" } : undefined}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(val) => <span className="text-xs text-slate-400">{val}</span>}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
