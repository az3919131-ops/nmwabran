/**
 * وقت التشغيل المشترك للواجهة: الحالة، الترجمة، أدوات العرض، المكتبة، الصلاحيات.
 * الأسماء (S, P, T, esc, nf, money, MATERIALS, WORKS, can, editable …) مطابقة للمنصة القديمة
 * حتى تعمل قوالب العرض المنقولة منها كما هي وتنتج نفس الـHTML.
 */
import * as core from "@iltizam/core";
import type { Catalog, Lang, Material, Work } from "@iltizam/core";

export type { Lang };
export const LS = "iltizam-web";

/* ───────── المكتبة (مصفوفات حيّة تُعدَّل في مكانها) ───────── */
export const MATERIALS: Material[] = [];
export const WORKS: Work[] = [];
export const CAT: Catalog = { materials: MATERIALS, works: WORKS };
export function setCatalog(c: Catalog): void {
  MATERIALS.length = 0; MATERIALS.push(...c.materials);
  WORKS.length = 0; WORKS.push(...c.works);
}

/* ───────── الصفحات (ترتيب المنصة القديمة النهائي + قوائم البريد) ───────── */
export interface PageDef { id: string; ar: string; en: string }
export const ALL_PAGES: PageDef[] = [
  { id: "dash", ar: "لوحة التحكم", en: "Control centre" },
  { id: "firms", ar: "المقاولون والمشاريع", en: "Contractors & projects" },
  { id: "master", ar: "الماستر والكروكي", en: "Master & layout" },
  { id: "qty", ar: "الحصر الشامل", en: "Full takeoff" },
  { id: "boq", ar: "المقايسة والمقارنة", en: "BOQ & variance" },
  { id: "wages", ar: "فاتورة الأجور والتعديل", en: "Wages & revision" },
  { id: "inv", ar: "الفاتورة (أجور ومواد)", en: "Invoice (works & materials)" },
  { id: "forms", ar: "النماذج والاستلام", en: "Forms & acceptance" },
  { id: "map", ar: "الخريطة والإحداثيات", en: "Map & coordinates" },
  { id: "recs", ar: "المقترحات والمستندات", en: "Recommendations" },
  { id: "emails", ar: "قوائم البريد", en: "Mailing lists" },
  { id: "users", ar: "المستخدمون والصلاحيات", en: "Users & permissions" },
];
/** مصفوفة حيّة: تُرشَّح حسب الصلاحيات عند الدخول */
export const PAGES: PageDef[] = ALL_PAGES.slice();

/* ───────── الحالة ───────── */
export interface AuthUser { id: string; username: string; name: string; role: "admin" | "dept" | "pm"; active: boolean; allContractors?: boolean }
export interface AuthState {
  me: AuthUser | null; perms: Record<string, Record<string, number>>; unlocked: boolean; adminEmail: string;
  features: { ai: boolean; mailProvider: string; pdf: boolean };
}
export const AUTH: AuthState = { me: null, perms: {}, unlocked: false, adminEmail: "", features: { ai: false, mailProvider: "smtp", pdf: false } };

export const S: any = {
  lang: "ar" as Lang, page: "dash", projects: [] as any[], active: 0,
  updOpen: false, woGuard: true, secKind: null as string | null, invTab: "works", lastRep: null as null | { file: string; rep: [string, string][] },
  busy: false, busyMsg: "",
};
/** أسماء المقاولين بالترتيب (فهرس المقاول في المشروع = موضعه هنا) + معرّفاتهم */
export const CONTRACTORS: string[] = [];
export const CONTRACTOR_IDS: string[] = [];

export const P = (): any => S.projects[S.active] || S.projects[0];

/* ───────── ترجمة وأدوات عرض ───────── */
export const AR = (): boolean => S.lang === "ar";
export const T = (ar: string, en: string): string => (AR() ? ar : en);
export const $ = (id: string): any => document.getElementById(id);
export const esc = core.escHtml;
export const nf = core.nfWith;
export const money = core.moneyOf;

let toastTimer: any;
export function toast(m: string): void {
  const t = $("toast"); if (!t) return;
  t.textContent = m; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2600);
}

export function copyTable(sel: string): void {
  const tb = document.querySelector(sel); if (!tb) return;
  const rows = [...tb.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((c: any) => {
    const i = c.querySelector("input,select"); return (i ? i.value : c.textContent).trim().replace(/\s+/g, " ");
  }).join("\t")).join("\n");
  navigator.clipboard.writeText("﻿" + rows).then(
    () => toast(T("تم نسخ الجدول — الصقه مباشرة في إكسل", "Table copied — paste into Excel")),
    () => toast(T("تعذّر النسخ", "Copy failed")));
}

/* ───────── دوال الحساب (من packages/core مع مكتبة الجلسة) ───────── */
export const totals = (p: any) => core.totals(p);
export const derive = (p: any) => core.derive(p, CAT);
export const authorityFor = (pct: number) => core.authorityFor(pct, S.lang);
export const geoPoints = (p: any) => core.geoPoints(p);
export const feeders = core.feeders;
export const toUTM = core.toUTM;
export const utmToLL = core.utmToLL;
export const hav = core.hav;
export const projStats = (p: any) => core.projStats(p, CAT);
export const libMat = (c: string) => core.libMat(CAT, c);
export const libWork = (c: string) => core.libWork(CAT, c);
export const dig = core.dig;
export const near = core.near;
export const woState = core.woState;
export const blankSheet = core.blankSheet;
export const newProject = core.newProject;
export const pmLine = () => core.pmLine(S.lang);
export const { PM_ROLE_AR, PM_ROLE_EN, PM_NAME, PM_NAME_AR, ORG_AR, ORG_EN } = core;
export const SHEET_FIELDS = core.SHEET_FIELDS;
export const DEFAULT_FACTORS = core.DEFAULT_FACTORS;
export const ACCEPT_COLS = core.ACCEPT_COLS;
export const ROLES = core.ROLES;
export const MODULES = core.MODULES;
export const ACTS = core.ACTS;

export const initials2 = (n: string) => (String(n || "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "??");

/* ───────── الصلاحيات (الفرض الحقيقي على الخادم — هنا للعرض فقط) ───────── */
export const ME = () => AUTH.me;
export const isAdmin = (): boolean => !!AUTH.me && AUTH.me.role === "admin";
export function can(mod: string, act: string): boolean {
  const m = AUTH.me; if (!m || !m.active) return false;
  if (m.role === "admin") return true;
  const p = AUTH.perms[mod]; return !!(p && p[act]);
}
export const editable = (mod: string): boolean => can(mod, "edit") && AUTH.unlocked;
export const visiblePages = (): PageDef[] => ALL_PAGES.filter((pg) => can(pg.id, "view"));

/* ───────── ربط المقاولين بالفهارس ───────── */
export function setContractors(list: { id: string; name: string }[]): void {
  CONTRACTORS.length = 0; CONTRACTOR_IDS.length = 0;
  for (const c of list) { CONTRACTORS.push(c.name); CONTRACTOR_IDS.push(c.id); }
}
export const contractorIdOf = (p: any): string => CONTRACTOR_IDS[Math.min(Math.max(+p.contractor || 0, 0), CONTRACTOR_IDS.length - 1)] ?? "";

/* ───────── دفتر المقاولين (فهرسة المشاريع حسب المقاول) ───────── */
export const FIRM_HEX = ["49b9a4", "e0ab55", "8fb3ff", "e58076", "b08ee8", "5fc27e", "d99ac0", "9fb7c9", "cbb26a", "7fd0c4"];
export const fHex = (i: number): string => "#" + FIRM_HEX[i % FIRM_HEX.length];
export function fInitials(name: string): string {
  const w = String(name || "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "??";
  if (/[A-Za-z]/.test(w[0])) return (w[0][0] + (w[1] ? w[1][0] : "")).toUpperCase();
  return (w[0].slice(0, 2) + (w[1] ? " " + w[1].slice(0, 1) : "")).trim();
}
/** تصحيح أي فهرس مقاول خارج النطاق */
export function firmGuard(): void {
  const max = CONTRACTORS.length - 1;
  S.projects.forEach((p: any) => { const c = +p.contractor; p.contractor = (isFinite(c) && c >= 0 && c <= max) ? c : 0; });
}
export const CF = (): number => Math.min(+((P() || {}).contractor) || 0, CONTRACTORS.length - 1);
export const firmProjects = (i: number): { p: any; ix: number }[] => S.projects.map((p: any, ix: number) => ({ p, ix })).filter((o: any) => (+o.p.contractor || 0) === i);
export const firmStats = (i: number) => core.firmStats(firmProjects(i).map((o) => o.p), CAT);
export const STANDALONE = true;
