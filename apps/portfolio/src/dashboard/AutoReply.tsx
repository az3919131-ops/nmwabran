import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, Loader2, RotateCcw, Save } from "lucide-react";
import { signature } from "../config";
import { useLang } from "../i18n/lang";
import type { DailyMessage } from "../lib/dashboardApi";
import { fillTemplate } from "../lib/format";
import { riyadhDate } from "../lib/stats";
import { D } from "./strings";

const MAX = 1000;

// قوالب جاهزة؛ كلها تنتهي بتوقيت صاحب التطبيق
const TEMPLATES: Array<{ id: string; label: (typeof D.reply)["tplWelcome"]; text: { ar: string; en: string } }> = [
  {
    id: "welcome",
    label: D.reply.tplWelcome,
    text: {
      ar: `السلام عليكم {name}،\nشكرًا لتواصلك. وصلتني رسالتك وسأرد عليك في أقرب وقت خلال ساعات العمل.\n\n${signature.plain}`,
      en: `Hello {name},\nThank you for reaching out. I received your message and will reply as soon as possible during working hours.\n\n${signature.plain}`,
    },
  },
  {
    id: "site",
    label: D.reply.tplSite,
    text: {
      ar: `السلام عليكم {name}،\nأنا الآن في الموقع ولا أستطيع الرد فورًا. سأتواصل معك فور انتهاء العمل بإذن الله.\nللأمور العاجلة اكتب كلمة «عاجل».\n\n${signature.plain}`,
      en: `Hello {name},\nI'm on site right now and can't reply immediately. I'll get back to you as soon as I'm done.\nFor urgent matters, please write "urgent".\n\n${signature.plain}`,
    },
  },
  {
    id: "hours",
    label: D.reply.tplHours,
    text: {
      ar: `السلام عليكم {name}،\nنحن خارج أوقات الدوام حاليًا، وسيتم الرد عليك صباح يوم العمل التالي. شكرًا لتفهمك.\n\n${signature.plain}`,
      en: `Hello {name},\nI'm outside working hours at the moment and will reply the next working morning. Thank you for understanding.\n\n${signature.plain}`,
    },
  },
];

export function AutoReply({
  message,
  demo,
  onSave,
}: {
  message: DailyMessage | null;
  demo: boolean;
  onSave: (input: { message: string; enabled: boolean }) => Promise<void>;
}) {
  const { t, lang } = useLang();
  const [text, setText] = useState(message?.message ?? "");
  const [enabled, setEnabled] = useState(message?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [empty, setEmpty] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // عند وصول رسالة جديدة من الخادم (بعد حفظ أو تحديث) نزامن الحقول
  useEffect(() => {
    setText(message?.message ?? "");
    setEnabled(message?.enabled ?? true);
  }, [message]);

  const dirty = text !== (message?.message ?? "") || enabled !== (message?.enabled ?? true);
  const preview = useMemo(() => fillTemplate(text, { name: t(D.reply.previewName), date: riyadhDate() }), [text, t]);

  const insert = (token: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next.slice(0, MAX));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const submit = async () => {
    if (!text.trim()) {
      setEmpty(true);
      ref.current?.focus();
      return;
    }
    setEmpty(false);
    setSaving(true);
    try {
      await onSave({ message: text, enabled });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="glass rounded-2xl p-4 sm:p-6 lg:col-span-3">
        <h2 className="text-xl font-bold text-white">{t(D.reply.title)}</h2>
        <p className="mt-1 text-sm text-slate-400">{t(D.reply.lead)}</p>
        {!message && <p className="mt-3 rounded-xl border border-gold-400/30 bg-gold-400/10 p-3 text-sm text-gold-300">{t(D.reply.noMessage)}</p>}

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <label htmlFor="ar-enabled" className="font-semibold text-slate-100">
            {t(D.reply.enable)}
          </label>
          <button
            id="ar-enabled"
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-mint-500" : "bg-slate-600"}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${enabled ? "start-[1.4rem]" : "start-0.5"}`} />
            <span className="sr-only">{enabled ? t(D.kpi.on) : t(D.kpi.off)}</span>
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="ar-text" className="label !mb-0">
              {t(D.reply.message)}
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">{t(D.reply.insert)}</span>
              <button type="button" className="pill hover:bg-white/10" onClick={() => insert("{name}")} dir="ltr">
                {"{name}"}
              </button>
              <button type="button" className="pill hover:bg-white/10" onClick={() => insert("{date}")} dir="ltr">
                {"{date}"}
              </button>
            </div>
          </div>
          <textarea
            ref={ref}
            id="ar-text"
            rows={9}
            maxLength={MAX}
            className="field resize-y leading-relaxed"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) setEmpty(false);
            }}
            aria-invalid={empty || undefined}
            aria-describedby="ar-hint"
          />
          <div id="ar-hint" className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
            <span className={empty ? "text-red-400" : ""} role={empty ? "alert" : undefined}>
              {empty ? t(D.reply.empty) : `${t(D.reply.nameVar)} · ${t(D.reply.dateVar)}`}
            </span>
            <span className="tabular">
              {text.length}/{MAX} {t(D.reply.chars)}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-slate-300">{t(D.reply.templates)}</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" className="btn btn-ghost btn-sm" onClick={() => setText(tpl.text[lang])}>
                {t(tpl.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving || (!dirty && !!message)}>
            {saving ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Save className="size-5" aria-hidden />}
            {saving ? t(D.reply.saving) : t(D.reply.save)}
          </button>
          {dirty && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setText(message?.message ?? "");
                  setEnabled(message?.enabled ?? true);
                  setEmpty(false);
                }}
              >
                <RotateCcw className="size-4" aria-hidden />
                {t(D.reply.revert)}
              </button>
              <span className="text-sm text-gold-300">{t(D.reply.unsaved)}</span>
            </>
          )}
          {demo && <span className="text-xs text-slate-500">{t(D.reply.savedDemo)}</span>}
        </div>
      </div>

      {/* معاينة بشكل محادثة واتساب */}
      <div className="lg:col-span-2">
        <p className="mb-2 text-sm font-semibold text-slate-300">{t(D.reply.preview)}</p>
        <div className="rounded-2xl border border-white/10 bg-[#0b141a] p-4">
          <div className={`ms-auto w-fit max-w-[90%] rounded-2xl rounded-ee-md px-3.5 py-2.5 text-[0.95rem] text-[#e9edef] shadow ${enabled ? "bg-[#005c4b]" : "bg-slate-700/70"}`}>
            <p className="whitespace-pre-wrap break-words leading-relaxed">{preview || "…"}</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[0.7rem] text-[#8696a0]" dir="ltr">
              10:24
              {enabled ? <CheckCheck className="size-3.5 text-[#53bdeb]" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            </p>
          </div>
          {!enabled && <p className="mt-3 text-center text-xs text-gold-300">{t(D.kpi.off)}</p>}
        </div>
      </div>
    </div>
  );
}
