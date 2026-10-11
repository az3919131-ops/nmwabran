import type { Lang } from "../i18n/lang";

const loc = (lang: Lang) => (lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB");

/** تاريخ ووقت بتوقيت الرياض بأرقام لاتينية في اللغتين */
export function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(loc(lang), { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** yyyy-MM-dd → تاريخ قصير مقروء */
export function formatDay(day: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat(loc(lang), { timeZone: "UTC", ...opts }).format(d);
}

/** يقرّب سقف المحور لرقم نظيف وزوجي كي تكون علامات 0 / نصف / سقف أعدادًا صحيحة */
export function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 3, 4, 6, 8, 10]) if (m * pow >= n) return m * pow;
  return 10 * pow;
}

/** yyyy-MM-dd → d/M بلا اعتماد على اللغة (تفادي اضطراب اتجاه النص في العربية) */
export function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** يملأ {name} و{date} كما يفعل workflow الرد في n8n */
export function fillTemplate(text: string, vars: { name: string; date: string }): string {
  return text.replaceAll("{name}", vars.name).replaceAll("{date}", vars.date);
}
