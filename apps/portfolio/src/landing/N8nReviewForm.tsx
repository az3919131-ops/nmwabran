import { useRef, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, Loader2, Send, Settings } from "lucide-react";
import { config } from "../config";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { isHttpUrl, N8nError, sendReview, type N8nOverrides } from "../lib/n8n";
import { resolveN8n } from "../lib/n8n";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; confirmed: boolean }
  | { kind: "error"; text: string; needsSettings?: boolean };

const currentUrl = () => config.siteUrl || window.location.href.split("#")[0] || "";

export function N8nReviewForm({ overrides, onOpenSettings }: { overrides: N8nOverrides; onOpenSettings: () => void }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const resolved = resolveN8n(overrides);
  const [url, setUrl] = useState(currentUrl);
  const [name, setName] = useState("");
  const [comments, setComments] = useState("");
  const [bad, setBad] = useState<{ url?: boolean; name?: boolean }>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const urlRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const sending = status.kind === "sending";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { url: !isHttpUrl(url.trim()), name: !name.trim() };
    setBad(next);
    if (next.url) return urlRef.current?.focus();
    if (next.name) return nameRef.current?.focus();

    setStatus({ kind: "sending" });
    try {
      const result = await sendReview(resolved.webhookUrl, { landingPageUrl: url.trim(), name: name.trim(), comments: comments.trim(), lang });
      setStatus({ kind: "ok", confirmed: result === "delivered" });
      toast.show("success", t(result === "delivered" ? S.n8n.success : S.n8n.successUnconfirmed));
    } catch (err) {
      const e2 = err instanceof N8nError ? err : new N8nError("network");
      const text =
        e2.code === "not-configured"
          ? t(S.n8n.notConfigured)
          : e2.code === "invalid-url"
            ? t(S.n8n.badUrl)
            : e2.code === "status"
              ? t(S.n8n.errorStatus).replace("{status}", String(e2.status))
              : t(S.n8n.errorGeneric);
      setStatus({ kind: "error", text, needsSettings: e2.code === "not-configured" || e2.code === "invalid-url" });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-slate-400">{t(S.n8n.lead)}</p>

      <div>
        <div className="mb-1.5 flex items-end justify-between gap-3">
          <label htmlFor="n8n-url" className="label !mb-0">
            {t(S.n8n.url)}
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUrl(currentUrl())}>
            <Link2 className="size-4" aria-hidden />
            {t(S.n8n.useCurrent)}
          </button>
        </div>
        <input
          ref={urlRef}
          id="n8n-url"
          className="field"
          dir="ltr"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={bad.url || undefined}
          aria-describedby={bad.url ? "n8n-url-err" : undefined}
        />
        {bad.url && (
          <p id="n8n-url-err" role="alert" className="mt-1 text-sm text-red-400">
            {t(S.n8n.badUrl)}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="n8n-name" className="label">
          {t(S.contact.fullName)}
        </label>
        <input
          ref={nameRef}
          id="n8n-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          aria-invalid={bad.name || undefined}
          aria-describedby={bad.name ? "n8n-name-err" : undefined}
        />
        {bad.name && (
          <p id="n8n-name-err" role="alert" className="mt-1 text-sm text-red-400">
            {t(S.contact.required)}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="n8n-comments" className="label">
          {t(S.n8n.comments)}
        </label>
        <textarea id="n8n-comments" rows={4} className="field resize-y" value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t(S.n8n.commentsPh)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5 rtl:-scale-x-100" aria-hidden />}
          {sending ? t(S.n8n.sending) : t(S.n8n.send)}
        </button>
        {resolved.formUrl && isHttpUrl(resolved.formUrl) ? (
          <a className="btn btn-ghost" href={resolved.formUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-5" aria-hidden />
            {t(S.n8n.openForm)}
          </a>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
            <ExternalLink className="size-5" aria-hidden />
            {t(S.n8n.openForm)}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm ms-auto" onClick={onOpenSettings} aria-label={t(S.n8n.settings)} title={t(S.n8n.settings)}>
          <Settings className="size-5" aria-hidden />
        </button>
      </div>

      <div aria-live="polite">
        {status.kind === "ok" && (
          <p className="flex items-start gap-2 rounded-xl border border-mint-500/30 bg-mint-500/10 p-3 text-sm text-mint-400">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
            {t(status.confirmed ? S.n8n.success : S.n8n.successUnconfirmed)}
          </p>
        )}
        {status.kind === "error" && (
          <div role="alert" className="flex flex-wrap items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="flex-1">{status.text}</p>
            {status.needsSettings && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
                <Settings className="size-4" aria-hidden />
                {t(S.n8n.settings)}
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
