import type { Lang } from "./types";
export const makeT = (lang: Lang) => (ar: string, en: string): string => (lang === "ar" ? ar : en);
export const nfWith = (n: number, d = 0): string =>
  (isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const moneyOf = (n: number): string => nfWith(Math.round(n || 0));
export const escHtml = (s: unknown): string =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
