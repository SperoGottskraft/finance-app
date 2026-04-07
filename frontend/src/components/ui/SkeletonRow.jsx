export function SkeletonRow({ cols = 4 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-slate-800" style={{ width: `${60 + (i * 15) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 h-4 w-1/3 rounded bg-slate-800" />
      <div className="h-8 w-1/2 rounded bg-slate-800" />
    </div>
  );
}
