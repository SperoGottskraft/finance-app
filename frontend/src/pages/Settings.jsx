import { useState } from "react";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { PlaidLinkButton } from "../components/plaid/PlaidLinkButton";
import { CsvImportWizard } from "../components/import/CsvImportWizard";
import { formatDate } from "../lib/utils";

function PlaidSection() {
  const { data: items, loading, refetch } = useApi(() => api.plaid.listItems(), []);
  const [syncing, setSyncing] = useState({});

  async function handleSync(item) {
    setSyncing((s) => ({ ...s, [item.id]: true }));
    try {
      const result = await api.plaid.syncItem(item.id);
      alert(`Synced: +${result.added} new, ${result.modified} updated, ${result.removed} removed`);
      refetch();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing((s) => ({ ...s, [item.id]: false }));
    }
  }

  async function handleUnlink(item) {
    if (!confirm(`Disconnect ${item.institution_name}?`)) return;
    await api.plaid.deleteItem(item.id);
    refetch();
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-100">Connected Banks</h2>
          <p className="text-xs text-slate-500 mt-0.5">Via Plaid — connects to 12,000+ institutions</p>
        </div>
        <PlaidLinkButton onSuccess={refetch} />
      </div>

      {!loading && !items?.length && (
        <p className="text-sm text-slate-500">No banks connected yet. Click "Connect Bank Account" to get started.</p>
      )}

      <div className="space-y-2">
        {(items ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-200">{item.institution_name ?? "Unknown"}</p>
              <p className="text-xs text-slate-500">
                {item.last_synced_at ? `Last synced ${formatDate(item.last_synced_at)}` : "Never synced"}
                {item.error_code && ` · ⚠ ${item.error_code}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSync(item)}
                disabled={syncing[item.id]}
              >
                {syncing[item.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sync
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleUnlink(item)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CsvSection() {
  const { data: accounts } = useApi(() => api.accounts.list(), []);
  const [imported, setImported] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="font-semibold text-slate-100 mb-1">Import CSV</h2>
      <p className="text-xs text-slate-500 mb-5">
        Supports Chase, Bank of America, Capital One, Wells Fargo, and any CSV with date/description/amount columns.
      </p>
      <CsvImportWizard accounts={accounts ?? []} onDone={() => setImported(true)} />
      {imported && <p className="mt-3 text-sm text-emerald-400">✓ Transactions imported successfully.</p>}
    </div>
  );
}

export default function Settings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
      <PlaidSection />
      <CsvSection />

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="font-semibold text-slate-100 mb-1">OCR Setup</h2>
        <p className="text-xs text-slate-500 mb-3">Tesseract must be installed for receipt OCR to work.</p>
        <div className="rounded-xl bg-slate-800 px-4 py-3 font-mono text-xs text-slate-300 space-y-1">
          <p># Windows</p>
          <p>Download from: github.com/UB-Mannheim/tesseract/wiki</p>
          <p>Install to: C:\Program Files\Tesseract-OCR\</p>
          <p className="mt-2"># Then set in backend/.env:</p>
          <p>TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe</p>
        </div>
      </div>
    </div>
  );
}
