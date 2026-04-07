import { useState } from "react";
import { Trash2, Link2, LinkIcon, Unlink, ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { formatCurrency, formatDate, cx } from "../../lib/utils";

const STATUS_COLORS = {
  done:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  pending: "text-amber-400   bg-amber-500/10   border-amber-500/20",
  failed:  "text-rose-400    bg-rose-500/10    border-rose-500/20",
};

function ScoreBar({ score, label }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#fb7185";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>{pct}%</span>
    </div>
  );
}

function MatchSuggestions({ receiptId, onLinked }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(null);
  const [open, setOpen] = useState(false);

  async function load() {
    if (suggestions !== null) { setOpen(v => !v); return; }
    setLoading(true);
    try {
      const data = await api.receipts.matchSuggestions(receiptId);
      setSuggestions(data);
      setOpen(true);
    } catch {
      setSuggestions([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function confirmLink(txnId) {
    setLinking(txnId);
    try {
      await api.receipts.link(receiptId, txnId);
      onLinked();
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <button
        onClick={load}
        className="flex w-full items-center justify-between text-xs text-slate-400 hover:text-blue-500 transition"
      >
        <span className="flex items-center gap-1.5">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
          Find matching transaction
        </span>
        {suggestions !== null && (open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>

      {open && suggestions !== null && (
        <div className="mt-2 space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-2">No close matches found</p>
          ) : (
            suggestions.map((s) => (
              <div
                key={s.transaction.id}
                className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {s.transaction.merchant_name || s.transaction.description || "—"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatDate(s.transaction.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-bold text-rose-400">
                      {formatCurrency(s.transaction.amount)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <ScoreBar score={s.amount_score} label="Amount" />
                  <ScoreBar score={s.date_score}   label="Date"   />
                </div>

                <button
                  onClick={() => confirmLink(s.transaction.id)}
                  disabled={linking === s.transaction.id}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                >
                  {linking === s.transaction.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Check className="h-3 w-3" />}
                  Link to this transaction
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ReceiptCard({ receipt, onDelete, onRefresh }) {
  const isLinked = receipt.transaction_id != null;

  async function handleUnlink() {
    await api.receipts.unlink(receipt.id);
    onRefresh();
  }

  return (
    <div className={cx(
      "group rounded-2xl border bg-slate-900 overflow-hidden transition-colors",
      isLinked
        ? "border-emerald-800/40 shadow-[0_0_0_1px_rgba(52,211,153,0.06)]"
        : "border-slate-800 hover:border-slate-700"
    )}>
      {/* Linked banner */}
      {isLinked && (
        <div className="flex items-center justify-between border-b border-emerald-800/25 bg-emerald-900/15 px-4 py-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-300/80">
            <LinkIcon className="h-3 w-3" /> Linked to transaction #{receipt.transaction_id}
          </span>
          <button onClick={handleUnlink} className="text-[10px] text-slate-500 hover:text-rose-400 transition">
            <Unlink className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/3] bg-slate-800 overflow-hidden">
        <img
          src={api.receipts.imageUrl(receipt.id)}
          alt={receipt.original_filename}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.parentElement.innerHTML =
              `<div class="flex items-center justify-center h-full text-slate-600 text-xs">No preview</div>`;
          }}
        />
      </div>

      <div className="p-4">
        {/* Status + date */}
        <div className="flex items-center justify-between mb-2">
          <span className={cx(
            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium",
            STATUS_COLORS[receipt.ocr_status] ?? STATUS_COLORS.pending
          )}>
            OCR {receipt.ocr_status}
          </span>
          <span className="text-xs text-slate-500">{formatDate(receipt.uploaded_at)}</span>
        </div>

        {/* OCR extracted data */}
        {receipt.ocr_extracted_merchant && (
          <p className="text-sm font-medium text-slate-200 truncate">{receipt.ocr_extracted_merchant}</p>
        )}
        {receipt.ocr_extracted_amount != null && (
          <p className="text-lg font-bold font-mono text-emerald-400">
            {formatCurrency(receipt.ocr_extracted_amount)}
          </p>
        )}
        {receipt.ocr_extracted_date && (
          <p className="text-xs text-slate-500 mt-0.5">{receipt.ocr_extracted_date}</p>
        )}

        {/* Delete */}
        <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete(receipt)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>

        {/* Match suggestions — only show if OCR has an amount and not yet linked */}
        {!isLinked && receipt.ocr_status === "done" && receipt.ocr_extracted_amount != null && (
          <MatchSuggestions receiptId={receipt.id} onLinked={onRefresh} />
        )}
      </div>
    </div>
  );
}
