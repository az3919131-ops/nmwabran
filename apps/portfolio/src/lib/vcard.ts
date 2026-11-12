import { config, signature } from "../config";
import { person } from "../data/profile";
import type { Lang } from "../i18n/lang";

/** يهرّب الحقول وفق RFC 6350: \ ; , وسطر جديد */
export const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** طي الأسطر الطويلة (سطر يبدأ بمسافة = تكملة للسابق) على حدود الأحرف */
export function fold(line: string, max = 72): string {
  const chars = Array.from(line);
  if (chars.length <= max) return line;
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i += max) parts.push(chars.slice(i, i + max).join(""));
  return parts.join("\r\n ");
}

export function buildVCard(lang: Lang): string {
  const full = person.name[lang];
  const [given = "", ...rest] = person.name.en.split(" ");
  const family = rest.pop() ?? "";
  const middle = rest.join(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(family)};${esc(given)};${esc(middle)};;`,
    `FN:${esc(full)}`,
    `NICKNAME:${esc(person.name[lang === "ar" ? "en" : "ar"])}`,
    `TITLE:${esc(person.title[lang])}`,
    `ORG:${esc(person.org[lang])}`,
    `TEL;TYPE=CELL,VOICE,WORK:+${config.whatsappNumber}`,
    `EMAIL;TYPE=INTERNET,WORK:${config.email}`,
    `URL;TYPE=LinkedIn:${config.linkedin}`,
    `ADR;TYPE=WORK:;;;${esc(lang === "ar" ? "نجران" : "Najran")};;;${esc(lang === "ar" ? "المملكة العربية السعودية" : "Saudi Arabia")}`,
    `NOTE:${esc(signature.plain)}`,
    "END:VCARD",
  ];
  return lines.map((l) => fold(l)).join("\r\n") + "\r\n";
}

/** ينزّل نصًا كملف عبر رابط مؤقت */
export function downloadText(filename: string, mime: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadVCard(lang: Lang): void {
  downloadText("Ahmed-Zahran.vcf", "text/vcard", buildVCard(lang));
}
