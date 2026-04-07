/**
 * Mock API — returns realistic fake data so the app runs without a backend.
 * All transaction dates are computed relative to today so the demo always
 * shows "this month" and "last month" no matter when it is visited.
 */

// ── Date helpers ──────────────────────────────────────────────────────────────
function getMonths() {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1; // 1-indexed
  const py = cm === 1 ? cy - 1 : cy;
  const pm = cm === 1 ? 12 : cm - 1;
  return { cy, cm, py, pm };
}

function isoDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, Math.min(day, daysInMonth(year, month))));
  return d.toISOString();
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ── Static reference data ─────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 1,  name: "Paycheck",          color: "#22c55e", icon: "Banknote",        is_income: true,  is_system: true },
  { id: 2,  name: "Freelance",         color: "#16a34a", icon: "Laptop",          is_income: true,  is_system: true },
  { id: 3,  name: "Investment Return", color: "#15803d", icon: "TrendingUp",      is_income: true,  is_system: true },
  { id: 4,  name: "Reimbursement",     color: "#4ade80", icon: "RotateCcw",       is_income: true,  is_system: true },
  { id: 5,  name: "Rent/Mortgage",     color: "#6366f1", icon: "House",           is_income: false, is_system: true },
  { id: 6,  name: "Utilities",         color: "#818cf8", icon: "Zap",             is_income: false, is_system: true },
  { id: 7,  name: "Internet/Phone",    color: "#a5b4fc", icon: "Wifi",            is_income: false, is_system: true },
  { id: 8,  name: "Groceries",         color: "#f97316", icon: "ShoppingCart",    is_income: false, is_system: true },
  { id: 9,  name: "Restaurants",       color: "#fb923c", icon: "UtensilsCrossed", is_income: false, is_system: true },
  { id: 10, name: "Coffee",            color: "#c2410c", icon: "Coffee",          is_income: false, is_system: true },
  { id: 11, name: "Gas",               color: "#eab308", icon: "Fuel",            is_income: false, is_system: true },
  { id: 14, name: "Medical",           color: "#ef4444", icon: "HeartPulse",      is_income: false, is_system: true },
  { id: 15, name: "Pharmacy",          color: "#f87171", icon: "Pill",            is_income: false, is_system: true },
  { id: 16, name: "Fitness",           color: "#dc2626", icon: "Dumbbell",        is_income: false, is_system: true },
  { id: 17, name: "Clothing",          color: "#ec4899", icon: "ShoppingBag",     is_income: false, is_system: true },
  { id: 19, name: "Online Shopping",   color: "#be185d", icon: "Package",         is_income: false, is_system: true },
  { id: 20, name: "Streaming",         color: "#8b5cf6", icon: "Play",            is_income: false, is_system: true },
  { id: 22, name: "Subscriptions",     color: "#0ea5e9", icon: "RefreshCw",       is_income: false, is_system: true },
  { id: 26, name: "Transfer",          color: "#64748b", icon: "ArrowLeftRight",  is_income: false, is_system: true },
  { id: 30, name: "Uncategorized",     color: "#6b7280", icon: "CircleHelp",      is_income: false, is_system: true },
];

const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const ACCOUNTS = [
  {
    id: 1, name: "Chase Total Checking", institution: "Chase",
    account_type: "checking", account_subtype: null, currency: "USD",
    balance_current: 4218.53, balance_available: 4218.53, is_active: true,
    plaid_account_id: null, created_at: "2024-01-01T00:00:00+00:00",
    updated_at: "2024-01-01T00:00:00+00:00",
  },
  {
    id: 2, name: "Marcus High-Yield Savings", institution: "Goldman Sachs",
    account_type: "savings", account_subtype: null, currency: "USD",
    balance_current: 13075.00, balance_available: 13075.00, is_active: true,
    plaid_account_id: null, created_at: "2024-01-01T00:00:00+00:00",
    updated_at: "2024-01-01T00:00:00+00:00",
  },
  {
    id: 3, name: "Chase Sapphire Preferred", institution: "Chase",
    account_type: "credit", account_subtype: "credit card", currency: "USD",
    balance_current: -1024.37, balance_available: 23975.63, is_active: true,
    plaid_account_id: null, created_at: "2024-01-01T00:00:00+00:00",
    updated_at: "2024-01-01T00:00:00+00:00",
  },
];

const acctById = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]));

// ── Transaction generator ─────────────────────────────────────────────────────
function makeTxn(id, accountId, catId, description, amount, year, month, day, merchant) {
  return {
    id,
    account_id: accountId,
    category_id: catId,
    receipt_id: null,
    amount,
    description,
    merchant_name: merchant ?? description,
    date: isoDate(year, month, day),
    pending: false,
    plaid_transaction_id: null,
    notes: null,
    source: "demo",
    created_at: isoDate(year, month, day),
    account: acctById[accountId] ?? null,
    category: catById[catId] ?? null,
    splits: [],
  };
}

function buildTransactions() {
  const { cy, cm, py, pm } = getMonths();
  const txns = [];
  let id = 1;

  for (const [yr, mo] of [[py, pm], [cy, cm]]) {
    txns.push(makeTxn(id++, 1, 1,  "Direct Deposit — Employer",   -3850.00, yr, mo, 1,  "Employer Payroll"));
    txns.push(makeTxn(id++, 1, 1,  "Direct Deposit — Employer",   -3850.00, yr, mo, 15, "Employer Payroll"));
    txns.push(makeTxn(id++, 1, 5,  "Rent Payment",                 1650.00, yr, mo, 1,  "Property Mgmt Co"));
    txns.push(makeTxn(id++, 1, 6,  "City Power & Water",             95.42, yr, mo, 5,  "City Utilities"));
    txns.push(makeTxn(id++, 1, 7,  "AT&T Internet + Phone",         119.99, yr, mo, 6,  "AT&T"));
    txns.push(makeTxn(id++, 3, 8,  "Whole Foods Market",            112.38, yr, mo, 3,  "Whole Foods"));
    txns.push(makeTxn(id++, 3, 8,  "Trader Joe's",                   68.91, yr, mo, 11, "Trader Joe's"));
    txns.push(makeTxn(id++, 3, 8,  "Kroger",                         84.55, yr, mo, 21, "Kroger"));
    txns.push(makeTxn(id++, 3, 9,  "Chipotle Mexican Grill",         14.75, yr, mo, 7,  "Chipotle"));
    txns.push(makeTxn(id++, 3, 9,  "Local Italian Restaurant",       62.40, yr, mo, 13, "Osteria Marco"));
    txns.push(makeTxn(id++, 3, 9,  "Shake Shack",                    23.18, yr, mo, 19, "Shake Shack"));
    txns.push(makeTxn(id++, 3, 10, "Starbucks",                       6.85, yr, mo, 4,  "Starbucks"));
    txns.push(makeTxn(id++, 3, 10, "Starbucks",                       7.40, yr, mo, 16, "Starbucks"));
    txns.push(makeTxn(id++, 1, 11, "Shell Gas Station",              54.20, yr, mo, 8,  "Shell"));
    txns.push(makeTxn(id++, 1, 11, "BP Gas Station",                 49.85, yr, mo, 22, "BP"));
    txns.push(makeTxn(id++, 3, 20, "Netflix",                        17.99, yr, mo, 2,  "Netflix"));
    txns.push(makeTxn(id++, 3, 20, "Spotify Premium",                11.99, yr, mo, 2,  "Spotify"));
    txns.push(makeTxn(id++, 3, 22, "Amazon Prime",                   14.99, yr, mo, 3,  "Amazon"));
    txns.push(makeTxn(id++, 3, 14, "Doctor Copay",                   30.00, yr, mo, 10, "Primary Care Clinic"));
    txns.push(makeTxn(id++, 3, 15, "CVS Pharmacy",                   18.47, yr, mo, 12, "CVS"));
    txns.push(makeTxn(id++, 3, 19, "Amazon.com",                     43.99, yr, mo, 9,  "Amazon"));
    txns.push(makeTxn(id++, 3, 17, "Target",                         67.22, yr, mo, 17, "Target"));
    txns.push(makeTxn(id++, 1, 16, "Planet Fitness Membership",      24.99, yr, mo, 1,  "Planet Fitness"));
    txns.push(makeTxn(id++, 1, 26, "Transfer to Savings",           500.00, yr, mo, 15, "Chase Transfer"));
    txns.push(makeTxn(id++, 2, 26, "Transfer from Checking",       -500.00, yr, mo, 15, "Chase Transfer"));
    txns.push(makeTxn(id++, 1, 26, "Chase Sapphire Payment",        900.00, yr, mo, 28, "Chase"));
    txns.push(makeTxn(id++, 3, 26, "Payment — Thank You",          -900.00, yr, mo, 28, "Chase"));
  }

  return txns.sort((a, b) => new Date(b.date) - new Date(a.date));
}

const ALL_TRANSACTIONS = buildTransactions();

const BUDGETS_RAW = [
  { id: 1,  category_id: 8,  amount_limit: 400,  period: "monthly" },
  { id: 2,  category_id: 9,  amount_limit: 200,  period: "monthly" },
  { id: 3,  category_id: 10, amount_limit: 40,   period: "monthly" },
  { id: 4,  category_id: 11, amount_limit: 150,  period: "monthly" },
  { id: 5,  category_id: 6,  amount_limit: 120,  period: "monthly" },
  { id: 6,  category_id: 7,  amount_limit: 130,  period: "monthly" },
  { id: 7,  category_id: 20, amount_limit: 50,   period: "monthly" },
  { id: 8,  category_id: 22, amount_limit: 30,   period: "monthly" },
  { id: 9,  category_id: 14, amount_limit: 60,   period: "monthly" },
  { id: 10, category_id: 16, amount_limit: 30,   period: "monthly" },
  { id: 11, category_id: 19, amount_limit: 100,  period: "monthly" },
  { id: 12, category_id: 17, amount_limit: 100,  period: "monthly" },
];

const INVESTMENT_ACCOUNTS = [
  {
    id: 1, name: "Roth IRA", institution: "Fidelity",
    account_type: "retirement", account_number_last4: "4821",
    total_value: 42850.00, as_of_date: new Date(Date.UTC(getMonths().cy, getMonths().cm - 1, 1)).toISOString(),
    source_file: null, is_active: true,
    holdings: [
      { id: 1, investment_account_id: 1, symbol: "FXAIX", description: "Fidelity 500 Index Fund",   holding_type: "mutual_fund", shares: 120.5,  price_per_share: 205.80, market_value: 24799.00, cost_basis: 18000.00, unrealized_gain_loss: 6799.00,  realized_gain_loss: null, annualized_return_pct: 12.4, return_dollars: 6799.00,  as_of_date: null, extra_json: null },
      { id: 2, investment_account_id: 1, symbol: "FZILX", description: "Fidelity ZERO Intl Index",  holding_type: "mutual_fund", shares: 310.0,  price_per_share: 13.02,  market_value: 4036.00,  cost_basis: 3500.00,  unrealized_gain_loss: 536.00,   realized_gain_loss: null, annualized_return_pct: 5.2,  return_dollars: 536.00,   as_of_date: null, extra_json: null },
      { id: 3, investment_account_id: 1, symbol: "FXNAX", description: "Fidelity US Bond Index",    holding_type: "mutual_fund", shares: 145.0,  price_per_share: 9.77,   market_value: 1417.00,  cost_basis: 1500.00,  unrealized_gain_loss: -83.00,   realized_gain_loss: null, annualized_return_pct: -1.8, return_dollars: -83.00,   as_of_date: null, extra_json: null },
    ],
  },
  {
    id: 2, name: "Individual Brokerage", institution: "Charles Schwab",
    account_type: "brokerage", account_number_last4: "7293",
    total_value: 18320.00, as_of_date: new Date(Date.UTC(getMonths().cy, getMonths().cm - 1, 1)).toISOString(),
    source_file: null, is_active: true,
    holdings: [
      { id: 4, investment_account_id: 2, symbol: "VOO",  description: "Vanguard S&P 500 ETF",  holding_type: "etf",   shares: 28.0,  price_per_share: 495.20, market_value: 13865.00, cost_basis: 10200.00, unrealized_gain_loss: 3665.00, realized_gain_loss: null, annualized_return_pct: 11.2, return_dollars: 3665.00, as_of_date: null, extra_json: null },
      { id: 5, investment_account_id: 2, symbol: "AAPL", description: "Apple Inc.",             holding_type: "stock", shares: 12.0,  price_per_share: 221.50, market_value: 2658.00,  cost_basis: 1980.00,  unrealized_gain_loss: 678.00,  realized_gain_loss: null, annualized_return_pct: 9.6,  return_dollars: 678.00,  as_of_date: null, extra_json: null },
      { id: 6, investment_account_id: 2, symbol: "MSFT", description: "Microsoft Corporation", holding_type: "stock", shares: 4.0,   price_per_share: 449.25, market_value: 1797.00,  cost_basis: 1400.00,  unrealized_gain_loss: 397.00,  realized_gain_loss: null, annualized_return_pct: 8.1,  return_dollars: 397.00,  as_of_date: null, extra_json: null },
    ],
  },
];

// ── Analytics helpers ─────────────────────────────────────────────────────────
const TRANSFER_IDS = new Set([26]);

function inRange(txn, start, end) {
  if (!start && !end) return true;
  const d = new Date(txn.date);
  if (start && d < new Date(start)) return false;
  if (end   && d > new Date(end))   return false;
  return true;
}

function isTransfer(txn) {
  return TRANSFER_IDS.has(txn.category_id);
}

function computeDashboard(start, end) {
  const BANKING = new Set([1, 2]);
  const income = ALL_TRANSACTIONS
    .filter(t => inRange(t, start, end) && t.amount < 0 && BANKING.has(t.account_id) && !isTransfer(t))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const expenses = ALL_TRANSACTIONS
    .filter(t => inRange(t, start, end) && t.amount > 0 && !isTransfer(t))
    .reduce((s, t) => s + t.amount, 0);

  const totalAssets = ACCOUNTS.filter(a => ["checking","savings"].includes(a.account_type))
    .reduce((s, a) => s + (a.balance_current ?? 0), 0);
  const totalLiabilities = ACCOUNTS.filter(a => a.account_type === "credit")
    .reduce((s, a) => s + (a.balance_current ?? 0), 0);
  const investmentTotal = INVESTMENT_ACCOUNTS.reduce((s, a) => s + (a.total_value ?? 0), 0);

  const budgets = computeBudgetStatus(start, end);

  return {
    income: round2(income),
    expenses: round2(expenses),
    net: round2(income - expenses),
    investment_total: round2(investmentTotal),
    total_assets: round2(totalAssets),
    total_liabilities: round2(totalLiabilities),
    budgets,
  };
}

function computeBudgetStatus(start, end) {
  return BUDGETS_RAW.map(b => {
    const spent = ALL_TRANSACTIONS
      .filter(t => inRange(t, start, end) && t.amount > 0 && t.category_id === b.category_id)
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.amount_limit > 0 ? Math.min(round2((spent / b.amount_limit) * 100), 999) : 0;
    const cat = catById[b.category_id];
    return {
      budget_id: b.id,
      category_id: b.category_id,
      category_name: cat?.name ?? "—",
      color: cat?.color ?? "#6b7280",
      limit: b.amount_limit,
      spent: round2(spent),
      remaining: round2(b.amount_limit - spent),
      pct,
      on_track: pct <= 100,
    };
  });
}

function computeMonthly(months = 6) {
  const { cy, cm, py, pm } = getMonths();
  const allMonths = [[py, pm], [cy, cm]].map(([y, m]) => monthKey(y, m));
  const BANKING = new Set([1, 2]);
  const buckets = {};
  for (const key of allMonths) buckets[key] = { month: key, income: 0, expenses: 0 };

  for (const t of ALL_TRANSACTIONS) {
    if (isTransfer(t)) continue;
    const key = t.date.slice(0, 7);
    if (!buckets[key]) continue;
    if (t.amount < 0 && BANKING.has(t.account_id)) buckets[key].income += Math.abs(t.amount);
    else if (t.amount > 0) buckets[key].expenses += t.amount;
  }

  return allMonths.slice(-months).map(m => ({
    month: m,
    income: round2(buckets[m]?.income ?? 0),
    expenses: round2(buckets[m]?.expenses ?? 0),
  }));
}

function computeByCategory(start, end) {
  const totals = {};
  for (const t of ALL_TRANSACTIONS) {
    if (!inRange(t, start, end) || t.amount <= 0 || isTransfer(t)) continue;
    totals[t.category_id] = (totals[t.category_id] ?? 0) + t.amount;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, total]) => {
      const cat = catById[Number(catId)];
      return { category_id: Number(catId), category_name: cat?.name ?? "Uncategorized", color: cat?.color ?? "#6b7280", total: round2(total) };
    });
}

function computeTopMerchants(start, end, limit = 10) {
  const totals = {};
  for (const t of ALL_TRANSACTIONS) {
    if (!inRange(t, start, end) || t.amount <= 0 || isTransfer(t)) continue;
    const key = t.merchant_name || t.description.slice(0, 40);
    totals[key] = (totals[key] ?? 0) + t.amount;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([merchant, total]) => ({ merchant, total: round2(total) }));
}

function computeIncomeStats(params = {}) {
  const { months = 6, start_date, end_date } = params;
  const BANKING = new Set([1, 2]);
  const incomeTxns = ALL_TRANSACTIONS.filter(t => t.amount < 0 && !isTransfer(t));

  const period = start_date && end_date
    ? incomeTxns.filter(t => inRange(t, start_date, end_date))
    : incomeTxns;

  const monthlyTotals = {}, monthlyCats = {}, catColors = {};
  for (const t of period) {
    const key = t.date.slice(0, 7);
    const amt = Math.abs(t.amount);
    monthlyTotals[key] = (monthlyTotals[key] ?? 0) + amt;
    const catName  = t.category?.name  ?? "Uncategorized";
    const catColor = t.category?.color ?? "#6b7280";
    catColors[catName] = catColor;
    if (!monthlyCats[key]) monthlyCats[key] = {};
    monthlyCats[key][catName] = (monthlyCats[key][catName] ?? 0) + amt;
  }

  const sortedKeys = Object.keys(monthlyTotals).sort().slice(-months);
  const monthly = sortedKeys.map(m => {
    const entry = { month: m, total: round2(monthlyTotals[m]) };
    for (const [cat, amt] of Object.entries(monthlyCats[m] ?? {})) entry[cat] = round2(amt);
    return entry;
  });

  const sourceTotals = {};
  for (const t of period) {
    if (!sortedKeys.includes(t.date.slice(0, 7))) continue;
    sourceTotals[t.category_id] = (sourceTotals[t.category_id] ?? 0) + Math.abs(t.amount);
  }
  const by_source = Object.entries(sourceTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, total]) => {
      const cat = catById[Number(catId)];
      return { category_name: cat?.name ?? "Uncategorized", color: cat?.color ?? "#6b7280", total: round2(total) };
    });

  const currentYear = String(new Date().getFullYear());
  const ytd = round2(incomeTxns.filter(t => t.date.startsWith(currentYear)).reduce((s, t) => s + Math.abs(t.amount), 0));
  const total_period = round2(monthly.reduce((s, m) => s + m.total, 0));
  const avg_monthly  = monthly.length ? round2(total_period / monthly.length) : 0;

  return { monthly, by_source, cat_colors: catColors, ytd, total_period, avg_monthly };
}

function round2(n) { return Math.round(n * 100) / 100; }

function currentMonthRange() {
  const { cy, cm } = getMonths();
  const start = new Date(Date.UTC(cy, cm - 1, 1)).toISOString();
  const end   = new Date(Date.UTC(cy, cm, 0, 23, 59, 59)).toISOString();
  return { start, end };
}

// ── Mock API object ───────────────────────────────────────────────────────────
const noop = () => Promise.resolve({ ok: true });

export const mockApi = {
  accounts: {
    list: () => Promise.resolve([...ACCOUNTS]),
    create: noop,
    update: noop,
    delete: noop,
    balanceHistory: () => Promise.resolve([]),
    addBalanceSnapshot: noop,
    deleteBalanceSnapshot: noop,
  },

  transactions: {
    list: (params = {}) => {
      let txns = [...ALL_TRANSACTIONS];
      if (params.account_id)  txns = txns.filter(t => t.account_id  === Number(params.account_id));
      if (params.category_id) txns = txns.filter(t => t.category_id === Number(params.category_id));
      if (params.income_only) txns = txns.filter(t => t.amount < 0);
      if (params.start_date)  txns = txns.filter(t => new Date(t.date) >= new Date(params.start_date));
      if (params.end_date)    txns = txns.filter(t => new Date(t.date) <= new Date(params.end_date));
      if (params.search) {
        const q = params.search.toLowerCase();
        txns = txns.filter(t =>
          t.description?.toLowerCase().includes(q) ||
          t.merchant_name?.toLowerCase().includes(q)
        );
      }
      const page = Number(params.page ?? 1);
      const size = Number(params.page_size ?? 50);
      return Promise.resolve(txns.slice((page - 1) * size, page * size));
    },
    create: noop,
    update: noop,
    delete: noop,
    recategorize: noop,
    autoCategorize: () => Promise.resolve({ updated: 0 }),
    categorizeMatching: noop,
    setSplits: noop,
    clearSplits: noop,
  },

  categories: {
    list: () => Promise.resolve([...CATEGORIES]),
    create: noop,
    update: noop,
    delete: noop,
  },

  budgets: {
    list: () => Promise.resolve(BUDGETS_RAW.map(b => ({ ...b, category: catById[b.category_id] ?? null }))),
    create: noop,
    update: noop,
    delete: noop,
  },

  analytics: {
    summary:      (p = {}) => { const { start, end } = p.start_date ? { start: p.start_date, end: p.end_date } : currentMonthRange(); return Promise.resolve(computeDashboard(start, end)); },
    byCategory:   (p = {}) => { const { start, end } = p.start_date ? { start: p.start_date, end: p.end_date } : currentMonthRange(); return Promise.resolve(computeByCategory(start, end)); },
    monthly:      (p = {}) => Promise.resolve(computeMonthly(p.months ?? 6)),
    budgetStatus: (p = {}) => { const { start, end } = p.start_date ? { start: p.start_date, end: p.end_date } : currentMonthRange(); return Promise.resolve(computeBudgetStatus(start, end)); },
    dashboard:    (p = {}) => { const { start, end } = p.start_date ? { start: p.start_date, end: p.end_date } : currentMonthRange(); return Promise.resolve(computeDashboard(start, end)); },
    topMerchants: (p = {}) => { const { start, end } = p.start_date ? { start: p.start_date, end: p.end_date } : currentMonthRange(); return Promise.resolve(computeTopMerchants(start, end, p.limit ?? 10)); },
    income:       (p = {}) => Promise.resolve(computeIncomeStats(p)),
  },

  investments: {
    list:          () => Promise.resolve(INVESTMENT_ACCOUNTS.map(({ holdings: _, ...a }) => a)),
    summary:       () => Promise.resolve({ total_value: INVESTMENT_ACCOUNTS.reduce((s, a) => s + (a.total_value ?? 0), 0) }),
    get:           (id) => Promise.resolve(INVESTMENT_ACCOUNTS.find(a => a.id === Number(id)) ?? null),
    create:        noop,
    update:        noop,
    delete:        noop,
    addHolding:    noop,
    updateHolding: noop,
    deleteHolding: noop,
  },

  receipts: {
    list:                 () => Promise.resolve([]),
    delete:               noop,
    link:                 noop,
    unlink:               noop,
    reprocess:            noop,
    matchSuggestions:     () => Promise.resolve([]),
    reconciliationSummary:() => Promise.resolve({ total: 0, linked: 0, unlinked: 0 }),
    imageUrl:             () => "",
    upload:               noop,
  },

  plaid: {
    createLinkToken: noop,
    listItems:       () => Promise.resolve([]),
    syncItem:        noop,
    deleteItem:      noop,
    exchangeToken:   noop,
  },

  import: {
    templates: () => Promise.resolve([]),
    upload:    noop,
    preview:   noop,
    confirm:   noop,
  },
};
