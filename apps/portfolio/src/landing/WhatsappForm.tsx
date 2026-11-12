import { useRef, useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { buildContactMessage, waLink } from "../lib/whatsapp";

export function WhatsappForm() {
  const { t, lang } = useLang();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: boolean; message?: boolean }>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = { name: !name.trim(), message: !message.trim() };
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.message) return msgRef.current?.focus();
    window.open(waLink(buildContactMessage({ name, message, lang })), "_blank", "noopener,noreferrer");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="wa-name" className="label">
          {t(S.contact.name)}
        </label>
        <input
          ref={nameRef}
          id="wa-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(S.contact.namePh)}
          autoComplete="name"
          aria-invalid={errors.name || undefined}
          aria-describedby={errors.name ? "wa-name-err" : undefined}
        />
        {errors.name && (
          <p id="wa-name-err" role="alert" className="mt-1 text-sm text-red-400">
            {t(S.contact.required)}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="wa-msg" className="label">
          {t(S.contact.message)}
        </label>
        <textarea
          ref={msgRef}
          id="wa-msg"
          rows={5}
          className="field resize-y"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t(S.contact.messagePh)}
          aria-invalid={errors.message || undefined}
          aria-describedby={errors.message ? "wa-msg-err" : undefined}
        />
        {errors.message && (
          <p id="wa-msg-err" role="alert" className="mt-1 text-sm text-red-400">
            {t(S.contact.required)}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary w-full sm:w-auto">
        <MessageCircle className="size-5" aria-hidden />
        {t(S.contact.sendWhatsapp)}
      </button>
      <p className="text-sm text-slate-500">{t(S.contact.waHint)}</p>
    </form>
  );
}
