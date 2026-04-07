import { useRef, useState } from "react";
import { Upload, Image } from "lucide-react";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { cx } from "../../lib/utils";

export function ReceiptUploader({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const receipt = await api.receipts.upload(file);
      onUploaded(receipt);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cx(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors",
          dragging
            ? "border-blue-600 bg-blue-600/5"
            : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/30"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700">
          {uploading ? (
            <span className="text-xs text-blue-500 animate-pulse">OCR…</span>
          ) : (
            <Image className="h-5 w-5 text-slate-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">
            {uploading ? "Uploading & running OCR…" : "Drop receipt photo here"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">or tap to browse · JPG, PNG, WEBP</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
