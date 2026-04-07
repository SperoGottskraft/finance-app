import { mockApi } from "./mockApi.js";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // FastAPI validation errors return detail as an array of {loc, msg, type} objects
    const detail = body.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map((e) => (typeof e === "object" ? e.msg : String(e))).join("; "));
    }
    throw new Error(detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const get  = (path, params) => {
  if (params) {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );
    const qs = new URLSearchParams(clean).toString();
    return request(qs ? `${path}?${qs}` : path);
  }
  return request(path);
};
const post   = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
const put    = (path, body) => request(path, { method: "PUT",  body: JSON.stringify(body) });
const patch  = (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) });
const del    = (path)       => request(path, { method: "DELETE" });

const realApi = {
  // Accounts
  accounts: {
    list:   ()     => get("/api/accounts"),
    create: (body) => post("/api/accounts", body),
    update: (id, body) => put(`/api/accounts/${id}`, body),
    delete: (id)   => del(`/api/accounts/${id}`),
    balanceHistory:      (id)        => get(`/api/accounts/${id}/balance-history`),
    addBalanceSnapshot:  (id, body)  => post(`/api/accounts/${id}/balance-history`, body),
    deleteBalanceSnapshot: (id, sid) => del(`/api/accounts/${id}/balance-history/${sid}`),
  },

  // Transactions
  transactions: {
    list:   (params) => get("/api/transactions", params),
    create: (body)   => post("/api/transactions", body),
    update: (id, body) => put(`/api/transactions/${id}`, body),
    delete: (id)     => del(`/api/transactions/${id}`),
    recategorize: (id, category_id) =>
      patch(`/api/transactions/${id}/category`, null, { category_id }),
    autoCategorize: () => post("/api/transactions/auto-categorize"),
    categorizeMatching: (description, account_id, category_id) =>
      post("/api/transactions/categorize-matching", { description, account_id, category_id }),
    setSplits: (id, splits) => put(`/api/transactions/${id}/splits`, splits),
    clearSplits: (id) => del(`/api/transactions/${id}/splits`),
  },

  // Categories
  categories: {
    list:   ()     => get("/api/categories"),
    create: (body) => post("/api/categories", body),
    update: (id, body) => put(`/api/categories/${id}`, body),
    delete: (id)   => del(`/api/categories/${id}`),
  },

  // Budgets
  budgets: {
    list:   ()     => get("/api/budgets"),
    create: (body) => post("/api/budgets", body),
    update: (id, body) => put(`/api/budgets/${id}`, body),
    delete: (id)   => del(`/api/budgets/${id}`),
  },

  // Receipts
  receipts: {
    list:            (params) => get("/api/receipts", params),
    delete:          (id)     => del(`/api/receipts/${id}`),
    link:            (id, transaction_id) =>
      request(`/api/receipts/${id}/link?transaction_id=${transaction_id}`, { method: "PATCH" }),
    unlink:          (id)     => del(`/api/receipts/${id}/unlink`),
    reprocess:       (id)     => post(`/api/receipts/${id}/reprocess-ocr`),
    matchSuggestions:(id)     => get(`/api/receipts/${id}/match-suggestions`),
    reconciliationSummary: () => get("/api/receipts/reconciliation/summary"),
    imageUrl:        (id)     => `${BASE}/api/receipts/${id}/image`,
    upload: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/api/receipts/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
      return res.json();
    },
  },

  // Plaid
  plaid: {
    createLinkToken: ()    => post("/api/plaid/link-token/create"),
    listItems:       ()    => get("/api/plaid/items"),
    syncItem:        (id)  => post(`/api/plaid/items/${id}/sync`),
    deleteItem:      (id)  => del(`/api/plaid/items/${id}`),
    exchangeToken:   (body) => post("/api/plaid/exchange-token", body),
  },

  // CSV Import
  import: {
    templates: ()  => get("/api/import/templates"),
    upload: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/api/import/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Upload failed: HTTP ${res.status}`);
      }
      return res.json();
    },
    preview: (file_id, column_mapping, account_id, negate_amount = false, header_row = 0) =>
      post("/api/import/preview", { file_id, column_mapping, account_id, negate_amount, header_row }),
    confirm: (file_id, column_mapping, account_id, negate_amount = false, header_row = 0, skip_duplicates = true) =>
      post("/api/import/confirm", { file_id, column_mapping, account_id, negate_amount, header_row, skip_duplicates }),
  },

  // Analytics
  analytics: {
    summary:      (params) => get("/api/analytics/summary", params),
    byCategory:   (params) => get("/api/analytics/by-category", params),
    monthly:      (params) => get("/api/analytics/monthly", params),
    budgetStatus: (params) => get("/api/analytics/budget-status", params),
    topMerchants: (params) => get("/api/analytics/top-merchants", params),
    dashboard:    (params) => get("/api/analytics/dashboard", params),
    income:       (params) => get("/api/analytics/income", params),
  },

  // Investments
  investments: {
    list:    ()           => get("/api/investments/"),
    summary: ()           => get("/api/investments/summary"),
    get:     (id)         => get(`/api/investments/${id}`),
    create:  (body)       => post("/api/investments/", body),
    update:  (id, body)   => put(`/api/investments/${id}`, body),
    delete:  (id)         => del(`/api/investments/${id}`),
    addHolding:    (accountId, body)             => post(`/api/investments/${accountId}/holdings`, body),
    updateHolding: (accountId, holdingId, body)  => put(`/api/investments/${accountId}/holdings/${holdingId}`, body),
    deleteHolding: (accountId, holdingId)        => del(`/api/investments/${accountId}/holdings/${holdingId}`),
  },
};

// Use mock data when no backend URL is configured (static demo deployment)
export const api = BASE ? realApi : mockApi;
