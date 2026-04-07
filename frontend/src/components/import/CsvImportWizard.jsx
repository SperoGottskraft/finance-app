import { useState } from "react";
import { Upload, ChevronRight, Check, Info } from "lucide-react";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { api } from "../../lib/api";
import { formatCurrency, cx } from "../../lib/utils";

const REQUIRED_FIELDS = ["date", "description", "amount"];
const ALL_FIELDS = ["date", "description", "amount", "debit", "credit", "merchant", "category"];
const STEPS = ["Upload", "Map Columns", "Preview & Import"];

export function CsvImportWizard({ accounts, onDone, preselectedAccountId }) {
  const [step, setStep]         = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const [mapping, setMapping]   = useState({});
  const [negateAmount, setNegateAmount] = useState(false);
  const [headerRow, setHeaderRow] = useState(0);
  const [accountId, setAccountId] = useState(preselectedAccountId ?? accounts?.[0]?.id ?? "");
  const [preview, setPreview]   = useState(null);
  const [result, setResult]     = useState(null);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");

  // ── Step 0: upload ────────────────────────────────────────────────────────
  async function handleUpload(file) {
    setBusy(true);
    setError("");
    try {
      const info = await api.import.upload(file);
      setFileInfo(info);
      setMapping(info.auto_map ?? {});
      setNegateAmount(info.suggest_negate ?? false);
      setHeaderRow(info.header_row ?? 0);
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Step 1 → 2: preview ───────────────────────────────────────────────────
  async function handlePreview() {
    if (!accountId) { setError("Select an account first."); return; }
    setBusy(true);
    setError("");
    try {
      const p = await api.import.preview(
        fileInfo.file_id, mapping, Number(accountId), negateAmount, headerRow
      );
      setPreview(p);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: confirm import ────────────────────────────────────────────────
  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      const r = await api.import.confirm(
        fileInfo.file_id, mapping, Number(accountId), negateAmount, headerRow
      );
      setResult(r);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <Check className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-slate-200 font-semibold">Import complete</p>
        <p className="text-sm text-slate-400">
          {result.imported} imported · {result.skipped} duplicates skipped
        </p>
        <Button variant="secondary" onClick={() => { setStep(0); setFileInfo(null); setResult(null); }}>
          Import another file
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Step indicator ── */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cx(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
              i < step  ? "bg-emerald-500 text-white"
                        : i === step ? "bg-blue-600 text-slate-950"
                        : "bg-slate-800 text-slate-500"
            )}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cx("text-xs", i === step ? "text-slate-200" : "text-slate-500")}>{s}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-700" />}
          </div>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{error}</p>}

      {/* ── Step 0: Upload ── */}
      {step === 0 && (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-700 p-10 cursor-pointer hover:border-slate-600 transition"
          onClick={() => document.getElementById("csv-input").click()}
        >
          <Upload className="h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">{busy ? "Uploading…" : "Click to upload CSV file"}</p>
          <p className="text-xs text-slate-600">Supports USAA, Chase, Capital One, and most bank CSV exports</p>
          <input
            id="csv-input"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
          />
        </div>
      )}

      {/* ── Step 1: Map Columns ── */}
      {step === 1 && fileInfo && (
        <div className="space-y-4">
          {/* Account selector */}
          <Select
            label="Import to account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>

          {/* Sign convention toggle */}
          <div className={cx(
            "flex items-start gap-3 rounded-xl border p-3",
            negateAmount
              ? "border-blue-600/30 bg-blue-600/5"
              : "border-slate-700 bg-slate-800/40"
          )}>
            <input
              id="negate-toggle"
              type="checkbox"
              checked={negateAmount}
              onChange={(e) => setNegateAmount(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-blue-600 cursor-pointer"
            />
            <label htmlFor="negate-toggle" className="cursor-pointer flex-1">
              <p className="text-sm text-slate-200 font-medium">Flip sign (credits-positive format)</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Check this for USAA, Chase, and most US bank CSV exports where positive
                amounts are deposits/income. Leave unchecked if positive = charges.
                {negateAmount && <span className="ml-1 text-blue-500">✓ Auto-detected for this file.</span>}
              </p>
            </label>
          </div>

          {/* Header row override */}
          {headerRow > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <Info className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-200 font-medium">
                  Header detected at row {headerRow + 1} &mdash; {headerRow} row{headerRow !== 1 ? "s" : ""} skipped
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  This file has metadata above the column headers. Adjust if the detection is wrong.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-xs text-slate-400">Header row</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={headerRow + 1}
                  onChange={(e) => setHeaderRow(Math.max(0, Number(e.target.value) - 1))}
                  className="w-14 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 text-center focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Column mapping grid */}
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Map your CSV columns to the fields below. Required fields are marked *.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {ALL_FIELDS.map((field) => (
                <Select
                  key={field}
                  label={field.charAt(0).toUpperCase() + field.slice(1).replace("_", " ") + (REQUIRED_FIELDS.includes(field) ? " *" : "")}
                  value={mapping[field] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))}
                >
                  <option value="">— skip —</option>
                  {fileInfo.columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </Select>
              ))}
            </div>
          </div>

          {/* Missing fields hint */}
          {(() => {
            const missing = [];
            if (!mapping.date) missing.push("Date");
            if (!mapping.description) missing.push("Description");
            if (!mapping.amount && !mapping.debit && !mapping.credit) missing.push("Amount (or Debit + Credit)");
            return missing.length > 0 ? (
              <p className="text-xs text-amber-400 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                Map required fields before previewing: <strong>{missing.join(", ")}</strong>
              </p>
            ) : null;
          })()}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button
              variant="primary"
              onClick={handlePreview}
              disabled={busy || !mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit)}
            >
              {busy ? "Loading…" : "Preview →"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview & Import ── */}
      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              <span className="text-slate-200 font-medium">{preview.total_rows}</span> rows detected
              {preview.conflicts > 0 && (
                <span className="ml-2 text-amber-400">· {preview.conflicts} likely duplicates</span>
              )}
            </p>
            <p className="text-xs text-slate-500">Showing first 20</p>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-800 max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Date</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Description</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Category</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                    <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                      {String(row.date).slice(0, 10)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300 truncate max-w-[180px]">
                      {row.description}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={cx(
                        "rounded-md px-1.5 py-0.5 text-xs",
                        row.category_name === "Transfer"
                          ? "bg-slate-700 text-slate-400"
                          : row.category_name === "Uncategorized"
                          ? "bg-slate-800 text-slate-500"
                          : "bg-slate-800 text-slate-300"
                      )}>
                        {row.category_name}
                      </span>
                    </td>
                    <td className={cx(
                      "px-3 py-1.5 text-right font-mono whitespace-nowrap",
                      row.amount < 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {row.amount < 0 ? "+" : "−"}${Math.abs(row.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button variant="primary" onClick={handleConfirm} disabled={busy}>
              {busy ? "Importing…" : `Import ${preview.total_rows} rows`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
