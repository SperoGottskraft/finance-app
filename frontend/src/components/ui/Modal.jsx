import { useEffect } from "react";
import { X } from "lucide-react";
import { cx } from "../../lib/utils";

export function Modal({ open, onClose, title, children, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={cx(
          "relative z-10 w-full rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl",
          widths[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <h2 className="font-semibold text-slate-100">{title}</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
