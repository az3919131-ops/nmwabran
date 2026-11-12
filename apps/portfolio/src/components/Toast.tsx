import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";

type Toast = { id: number; kind: "success" | "error"; text: string };
type Ctx = { show: (kind: Toast["kind"], text: string) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const { t } = useLang();

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (kind: Toast["kind"], text: string) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-2), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
        {items.map((it) => (
          <div
            key={it.id}
            role={it.kind === "error" ? "alert" : "status"}
            className="glass-solid pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm"
          >
            {it.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint-400" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold-400" aria-hidden />
            )}
            <p className="flex-1 text-slate-100">{it.text}</p>
            <button
              type="button"
              onClick={() => dismiss(it.id)}
              className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label={t(S.n8n.dismiss)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
