import * as Icons from "lucide-react";

export function CategoryBadge({ category, size = "sm" }) {
  if (!category) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
        Uncategorized
      </span>
    );
  }

  const Icon = Icons[category.icon] ?? Icons.CircleHelp;
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${pad} font-medium`}
      style={{
        backgroundColor: `${category.color}18`,
        color: category.color,
        border: `1px solid ${category.color}30`,
      }}
    >
      <Icon className="h-3 w-3" />
      {category.name}
    </span>
  );
}
