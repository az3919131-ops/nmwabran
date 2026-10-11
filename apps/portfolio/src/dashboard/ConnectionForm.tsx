import { useState, type FormEvent } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, PlugZap } from "lucide-react";
import { useLang } from "../i18n/lang";
import { DashboardError, type DashSession } from "../lib/dashboardApi";
import { isHttpUrl } from "../lib/n8n";
import { D } from "./strings";

/** نموذج رابط الواجهة + المفتاح، يُستعمل في شاشة البداية وفي تبويب الربط */
export function ConnectionForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  extra,
}: {
  initial: DashSession;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (s: DashSession) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const { t } = useLang();
  const [url, setUrl] = useState(initial.url);
  const [key, setKey] = useState(initial.key);
  const [remember, setRemember] = useState(initial.remember);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim() || !isHttpUrl(url.trim())) {
      setError(t(D.err["not-configured"]));
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ url: url.trim(), key: key.trim(), remember });
    } catch (err) {
      const code = err instanceof DashboardError ? err.code : "network";
      setError(t(D.err[code]));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="d-url" className="label">
          {t(D.gate.url)}
        </label>
        <input id="d-url" className="field" dir="ltr" inputMode="url" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://n8n.example.com/webhook/ahmed-dashboard" />
      </div>
      <div>
        <label htmlFor="d-key" className="label">
          {t(D.gate.key)}
        </label>
        <div className="relative">
          <input
            id="d-key"
            className="field pe-11"
            dir="ltr"
            type={show ? "text" : "password"}
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label={show ? t(D.gate.hideKey) : t(D.gate.showKey)}
            aria-pressed={show}
          >
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
        <input type="checkbox" className="size-4 accent-emerald-500" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t(D.gate.remember)}
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <PlugZap className="size-5" aria-hidden />}
          {busy ? busyLabel : submitLabel}
        </button>
        {extra}
      </div>
    </form>
  );
}
