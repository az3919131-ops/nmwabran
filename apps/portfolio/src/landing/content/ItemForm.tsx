import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "../../components/Modal";
import { ICON_KEYS, type IconKey } from "../../data/content-types";
import { C } from "../../i18n/content-strings";
import { useLang, type Bi } from "../../i18n/lang";
import { newId, safeUrl } from "../../lib/content";
import type { Field } from "./fields";
import { Icon } from "./icons";

type Values = Record<string, unknown>;
type Errors = Record<string, Bi>;
type Video = { id: string; title: string; url: string };

const asBi = (v: unknown): { ar: string; en: string } => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { ar: typeof o.ar === "string" ? o.ar : "", en: typeof o.en === "string" ? o.en : "" };
};
const asStr = (v: unknown) => (typeof v === "string" ? v : "");
const asVideos = (v: unknown): Video[] => (Array.isArray(v) ? (v as Video[]) : []);

/** يتحقق من القيم ويرجع الأخطاء بحسب المفتاح (فارغ = صالح). نقية وقابلة للاختبار. */
export function validate(fields: Field[], values: Values): Errors {
  const errors: Errors = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.kind === "bi") {
      const b = asBi(v);
      if (f.required && !b.ar.trim() && !b.en.trim()) errors[f.key] = C.form.needOneLang;
    } else if (f.kind === "url") {
      const s = asStr(v).trim();
      if (!s) {
        if (f.required) errors[f.key] = C.form.required;
      } else if (!safeUrl(s, f.allowRelative)) errors[f.key] = f.allowRelative ? C.form.badFileUrl : C.form.badUrl;
    } else if (f.kind === "text") {
      const s = asStr(v).trim();
      if (f.required && !s) errors[f.key] = C.form.required;
      else if (f.date && s && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s)) errors[f.key] = C.form.badDate;
    } else if (f.kind === "videos") {
      const bad = asVideos(v).some((x) => (x.title.trim() || x.url.trim()) && (!x.title.trim() || !safeUrl(x.url)));
      if (bad) errors[f.key] = C.form.badUrl;
    }
  }
  return errors;
}

/** يحوّل قيم النموذج إلى حقول نظيفة: يقصّ النصوص ويحذف الاختياري الفارغ */
export function collect(fields: Field[], values: Values): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = values[f.key];
    switch (f.kind) {
      case "bi": {
        const b = asBi(v);
        out[f.key] = { ar: b.ar.trim(), en: b.en.trim() };
        break;
      }
      case "url":
      case "text": {
        const s = asStr(v).trim();
        out[f.key] = s ? (f.kind === "url" ? safeUrl(s, f.kind === "url" && f.allowRelative) : s) : undefined;
        break;
      }
      case "checkbox":
        out[f.key] = v === true ? true : undefined;
        break;
      case "videos":
        out[f.key] = asVideos(v)
          .filter((x) => x.title.trim() && x.url.trim())
          .map((x) => ({ id: x.id, title: x.title.trim(), url: safeUrl(x.url) }));
        break;
      default:
        out[f.key] = v;
    }
  }
  return out;
}

export function ItemForm({ title, fields, initial, onSubmit, onClose, extra }: { title: string; fields: Field[]; initial: Values; onSubmit: (v: Values) => void; onClose: () => void; extra?: React.ReactNode }) {
  const { t } = useLang();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = (key: string, v: unknown) => setValues((s) => ({ ...s, [key]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = fields.find((f) => errs[f.key]);
      if (first) document.getElementById(`f-${first.key}${first.kind === "bi" ? "-ar" : ""}`)?.focus();
      return;
    }
    onSubmit(collect(fields, values));
  };

  const err = (f: Field) => (errors[f.key] ? <p id={`e-${f.key}`} role="alert" className="mt-1 text-sm text-red-400">{t(errors[f.key]!)}</p> : null);
  const inv = (f: Field) => (errors[f.key] ? true : undefined);

  return (
    <Modal open onClose={onClose} title={title} wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        {fields.map((f, i) => {
          const label = t(f.label) + (f.required ? " *" : "");
          switch (f.kind) {
            case "bi": {
              const b = asBi(values[f.key]);
              const Tag = f.multiline ? "textarea" : "input";
              const common = { className: "field", maxLength: f.max, "aria-invalid": inv(f), "aria-describedby": errors[f.key] ? `e-${f.key}` : undefined } as const;
              return (
                <fieldset key={f.key} className="space-y-2">
                  <legend className="label">{label}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`f-${f.key}-ar`} className="sr-only">{`${t(f.label)} — ${t(C.form.arSuffix)}`}</label>
                      <Tag id={`f-${f.key}-ar`} dir="rtl" lang="ar" rows={f.multiline ? 3 : undefined} placeholder={t(C.form.arSuffix)} value={b.ar} onChange={(e) => set(f.key, { ...b, ar: e.target.value })} autoFocus={i === 0} {...common} />
                    </div>
                    <div>
                      <label htmlFor={`f-${f.key}-en`} className="sr-only">{`${t(f.label)} — ${t(C.form.enSuffix)}`}</label>
                      <Tag id={`f-${f.key}-en`} dir="ltr" lang="en" rows={f.multiline ? 3 : undefined} placeholder={t(C.form.enSuffix)} value={b.en} onChange={(e) => set(f.key, { ...b, en: e.target.value })} {...common} />
                    </div>
                  </div>
                  {err(f)}
                </fieldset>
              );
            }
            case "url":
            case "text":
              return (
                <div key={f.key}>
                  <label htmlFor={`f-${f.key}`} className="label">{label}</label>
                  <input id={`f-${f.key}`} className="field" dir={f.kind === "url" || f.key === "launchedAt" ? "ltr" : undefined} inputMode={f.kind === "url" ? "url" : undefined} maxLength={f.kind === "text" ? f.max : 2048} placeholder={f.kind === "text" ? f.placeholder : "https://"} value={asStr(values[f.key])} onChange={(e) => set(f.key, e.target.value)} aria-invalid={inv(f)} aria-describedby={errors[f.key] ? `e-${f.key}` : undefined} autoFocus={i === 0} />
                  {err(f)}
                </div>
              );
            case "select":
              return (
                <div key={f.key}>
                  <label htmlFor={`f-${f.key}`} className="label">{label}</label>
                  <select id={`f-${f.key}`} className="field" value={asStr(values[f.key])} onChange={(e) => set(f.key, e.target.value)}>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>{t(o.label)}</option>
                    ))}
                  </select>
                </div>
              );
            case "icon":
              return (
                <fieldset key={f.key}>
                  <legend className="label">{label}</legend>
                  <div role="radiogroup" aria-label={t(f.label)} className="grid grid-cols-7 gap-1.5">
                    {ICON_KEYS.map((k: IconKey) => (
                      <button key={k} type="button" role="radio" aria-checked={values[f.key] === k} aria-label={k} onClick={() => set(f.key, k)} className={`grid h-10 place-items-center rounded-lg border transition-colors ${values[f.key] === k ? "border-gold-400 bg-gold-400/15 text-gold-300" : "border-white/12 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                        <Icon name={k} className="size-5" />
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            case "checkbox":
              return (
                <label key={f.key} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-300">
                  <input type="checkbox" className="mt-1 size-4 accent-emerald-500" checked={values[f.key] === true} onChange={(e) => set(f.key, e.target.checked)} />
                  {t(f.label)}
                </label>
              );
            case "videos": {
              const rows = asVideos(values[f.key]);
              return (
                <fieldset key={f.key} className="space-y-2">
                  <legend className="label">{label}</legend>
                  {rows.map((r, idx) => (
                    <div key={r.id} className="grid gap-2 rounded-xl border border-white/10 p-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input className="field" aria-label={t(C.form.videoTitle)} placeholder={t(C.form.videoTitle)} value={r.title} onChange={(e) => set(f.key, rows.map((x, j) => (j === idx ? { ...x, title: e.target.value } : x)))} />
                      <input className="field" dir="ltr" inputMode="url" aria-label={t(C.form.videoUrl)} placeholder="https://youtu.be/…" value={r.url} onChange={(e) => set(f.key, rows.map((x, j) => (j === idx ? { ...x, url: e.target.value } : x)))} />
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={t(C.form.removeVideo)} onClick={() => set(f.key, rows.filter((_, j) => j !== idx))}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(f.key, [...rows, { id: newId("vid"), title: "", url: "" }])}>
                    <Plus className="size-4" aria-hidden />
                    {t(C.form.addVideo)}
                  </button>
                  {err(f)}
                </fieldset>
              );
            }
          }
        })}
        {extra}
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t(C.form.cancel)}</button>
          <button type="submit" className="btn btn-primary">{t(C.form.save)}</button>
        </div>
      </form>
    </Modal>
  );
}
