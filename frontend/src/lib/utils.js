export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

export function formatMonth(yyyy_mm) {
  const [y, m] = yyyy_mm.split("-");
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
    new Date(Number(y), Number(m) - 1)
  );
}

/** positive amount = expense (red), negative = income (green) */
export function amountColor(amount) {
  return amount < 0 ? "text-emerald-400" : "text-rose-400";
}

export function amountSign(amount) {
  return amount < 0 ? "+" : "-";
}

export function absAmount(amount) {
  return Math.abs(amount);
}
