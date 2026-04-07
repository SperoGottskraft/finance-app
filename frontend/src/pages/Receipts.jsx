import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { ReceiptUploader } from "../components/receipts/ReceiptUploader";
import { ReceiptCard } from "../components/receipts/ReceiptCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Receipt, LinkIcon, Unlink } from "lucide-react";
import { cx } from "../lib/utils";

function ReconciliationBanner({ summary }) {
  if (!summary) return null;
  const { unlinked_receipts, transactions_without_receipt } = summary;
  if (unlinked_receipts === 0 && transactions_without_receipt === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-800/40 bg-emerald-900/15 px-4 py-3 text-sm text-emerald-300">
        <LinkIcon className="h-4 w-4 shrink-0" />
        All receipts are reconciled.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {unlinked_receipts > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-800/40 bg-amber-900/12 px-4 py-2.5 text-sm text-amber-300">
          <Unlink className="h-4 w-4 shrink-0" />
          <span>
            <strong>{unlinked_receipts}</strong> receipt{unlinked_receipts !== 1 ? "s" : ""} not yet linked to a transaction
          </span>
        </div>
      )}
      {transactions_without_receipt > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-400">
          <Receipt className="h-4 w-4 shrink-0" />
          <span>
            <strong>{transactions_without_receipt}</strong> transaction{transactions_without_receipt !== 1 ? "s" : ""} have no receipt
          </span>
        </div>
      )}
    </div>
  );
}

export default function Receipts() {
  const { data: receipts, loading, refetch } = useApi(() => api.receipts.list(), []);
  const { data: summary, refetch: refetchSummary } = useApi(
    () => api.receipts.reconciliationSummary(), []
  );

  function handleRefresh() {
    refetch();
    refetchSummary();
  }

  async function handleDelete(receipt) {
    if (!confirm("Delete this receipt?")) return;
    await api.receipts.delete(receipt.id);
    handleRefresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-100">Receipts</h1>

      <ReconciliationBanner summary={summary} />

      <ReceiptUploader onUploaded={handleRefresh} />

      {!loading && !receipts?.length && (
        <EmptyState
          icon={Receipt}
          title="No receipts yet"
          description="Upload a photo — OCR will extract the amount, date, and merchant, then suggest a matching transaction automatically."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(receipts ?? []).map((r) => (
          <ReceiptCard
            key={r.id}
            receipt={r}
            onDelete={handleDelete}
            onRefresh={handleRefresh}
          />
        ))}
      </div>
    </div>
  );
}
