import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { emptyOverrides, isHttpUrl, resolveN8n, resetOverrides, saveOverrides, type N8nOverrides } from "../lib/n8n";

const PAYLOAD = `{
  "landingPageUrl": "https://…",
  "name": "…",
  "comments": "…",
  "lang": "ar",
  "source": "ahmed-zahran-portfolio",
  "submittedAt": "2026-…",
  "requestId": "uuid"
}`;

export function N8nSettingsModal({
  open,
  onClose,
  overrides,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  overrides: N8nOverrides;
  onChange: (o: N8nOverrides) => void;
}) {
  const { t } = useLang();
  const toast = useToast();
  const [draft, setDraft] = useState(overrides);
  const [bad, setBad] = useState<Partial<Record<keyof N8nOverrides, boolean>>>({});

  useEffect(() => {
    if (open) {
      setDraft(overrides);
      setBad({});
    }
  }, [open, overrides]);

  const derived = resolveN8n({ ...draft, webhookUrl: "", formUrl: "" });

  const save = () => {
    const invalid = {
      baseUrl: !!draft.baseUrl.trim() && !isHttpUrl(draft.baseUrl.trim()),
      webhookUrl: !!draft.webhookUrl.trim() && !isHttpUrl(draft.webhookUrl.trim()),
      formUrl: !!draft.formUrl.trim() && !isHttpUrl(draft.formUrl.trim()),
    };
    setBad(invalid);
    if (invalid.baseUrl || invalid.webhookUrl || invalid.formUrl) return;
    saveOverrides(draft);
    onChange(draft);
    toast.show("success", t(S.settings.saved));
    onClose();
  };

  const reset = () => {
    resetOverrides();
    const empty = emptyOverrides();
    setDraft(empty);
    onChange(empty);
  };

  const row = (key: keyof N8nOverrides, label: string, placeholder: string) => (
    <div>
      <label htmlFor={`n8n-${key}`} className="label">
        {label}
      </label>
      <input
        id={`n8n-${key}`}
        className="field"
        dir="ltr"
        inputMode="url"
        value={draft[key]}
        placeholder={placeholder}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        aria-invalid={bad[key] || undefined}
      />
      {bad[key] && (
        <p role="alert" className="mt-1 text-sm text-red-400">
          {t(S.n8n.badUrl)}
        </p>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t(S.settings.title)}>
      <p className="mb-4 text-sm text-slate-400">{t(S.settings.intro)}</p>
      <div className="space-y-4">
        {row("baseUrl", t(S.settings.base), "https://n8n.example.com")}
        {row("webhookUrl", t(S.settings.webhook), derived.webhookUrl || t(S.settings.leaveEmpty))}
        {row("formUrl", t(S.settings.form), derived.formUrl || t(S.settings.leaveEmpty))}
      </div>
      <p className="mt-4 text-xs text-slate-500">{t(S.settings.cors)}</p>
      <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-300">{t(S.settings.payload)}</summary>
        <pre dir="ltr" className="mt-2 overflow-x-auto text-xs text-mint-400">
          {PAYLOAD}
        </pre>
      </details>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={reset}>
          {t(S.settings.reset)}
        </button>
        <button type="button" className="btn btn-primary" onClick={save}>
          {t(S.settings.save)}
        </button>
      </div>
    </Modal>
  );
}
