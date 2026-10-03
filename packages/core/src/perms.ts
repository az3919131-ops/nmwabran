import type { Lang } from "./types";

export interface ModuleDef { id: string; ar: string; en: string; page: boolean }
/** وحدات الصلاحيات: كل صفحة وحدة، إضافة إلى الاستيراد ومحفظة Ai */
export const MODULES: ModuleDef[] = [
  { id: "dash", ar: "لوحة التحكم", en: "Control centre", page: true },
  { id: "firms", ar: "المقاولون والمشاريع", en: "Contractors & projects", page: true },
  { id: "master", ar: "الماستر والكروكي", en: "Master & layout", page: true },
  { id: "qty", ar: "الحصر الشامل", en: "Full takeoff", page: true },
  { id: "boq", ar: "المقايسة والمقارنة", en: "BOQ & variance", page: true },
  { id: "wages", ar: "فاتورة الأجور", en: "Wages invoice", page: true },
  { id: "inv", ar: "الفاتورة (أجور ومواد)", en: "Invoice", page: true },
  { id: "forms", ar: "النماذج والاستلام", en: "Forms & acceptance", page: true },
  { id: "map", ar: "الخريطة والإحداثيات", en: "Map & coordinates", page: true },
  { id: "recs", ar: "المقترحات والمستندات", en: "Recommendations", page: true },
  { id: "deck", ar: "العرض التقديمي التحليلي", en: "Analytical presentation", page: true },
  { id: "emails", ar: "قوائم البريد", en: "Mailing lists", page: true },
  { id: "import", ar: "الاستيراد والمعالجة", en: "Import & processing", page: false },
  { id: "ai", ar: "محفظة Ai", en: "Portfolio Ai", page: false },
  { id: "users", ar: "المستخدمون والصلاحيات", en: "Users & permissions", page: true },
];
export const MODULE_IDS = MODULES.map((m) => m.id);
export type Act = "view" | "edit" | "del" | "exp";
export const ACTS: [Act, string, string][] = [["view", "عرض", "View"], ["edit", "إضافة/تعديل", "Add / Edit"], ["del", "حذف", "Delete"], ["exp", "تصدير", "Export"]];
export type Role = "admin" | "dept" | "pm";
export const ROLES: Record<Role, { ar: string; en: string }> = {
  admin: { ar: "مدير النظام", en: "System administrator" },
  dept: { ar: "مدير قسم", en: "Department manager" },
  pm: { ar: "مدير مشاريع", en: "Projects manager" },
};
export type PermMap = Record<string, Record<Act, 0 | 1>>;

export function defaultPerms(role: Role): PermMap {
  const P: PermMap = {};
  MODULES.forEach((m) => {
    if (role === "admin") { P[m.id] = { view: 1, edit: 1, del: 1, exp: 1 }; return; }
    if (m.id === "users") { P[m.id] = { view: 0, edit: 0, del: 0, exp: 0 }; return; }
    if (m.id === "emails") {
      // الافتراضي: dept عرض وإضافة وتعديل، pm عرض فقط
      P[m.id] = role === "dept" ? { view: 1, edit: 1, del: 0, exp: 0 } : { view: 1, edit: 0, del: 0, exp: 0 };
      return;
    }
    if (role === "dept") { P[m.id] = { view: 1, edit: 1, del: 1, exp: 1 }; return; }
    // pm: كل الصفحات عدا المستخدمين والاستيراد — عرض/إضافة/تصدير
    if (m.id === "import") { P[m.id] = { view: 0, edit: 0, del: 0, exp: 0 }; return; }
    P[m.id] = { view: 1, edit: 1, del: 0, exp: 1 };
  });
  return P;
}

/** مفاتيح التقارير = الصفحات. users وemails لمدير النظام فقط ولا تُرسل لغيره. */
export const REPORT_KEYS = ["dash", "firms", "master", "qty", "boq", "wages", "inv", "forms", "map", "recs", "deck", "emails", "users"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];
export const ADMIN_ONLY_REPORTS: ReportKey[] = ["users", "emails"];
export const REPORT_TITLES: Record<ReportKey, { ar: string; en: string }> = {
  dash: { ar: "لوحة التحكم", en: "Control centre" },
  firms: { ar: "المقاولون والمشاريع", en: "Contractors & projects" },
  master: { ar: "الماستر والكروكي", en: "Master & layout" },
  qty: { ar: "الحصر الشامل", en: "Full takeoff" },
  boq: { ar: "المقايسة والمقارنة", en: "BOQ & variance" },
  wages: { ar: "فاتورة الأجور ونموذج تعديل المقايسة", en: "Wages invoice & BOQ revision" },
  inv: { ar: "الفاتورة (أجور ومواد)", en: "Invoice (works & materials)" },
  forms: { ar: "النماذج والاستلام", en: "Forms & acceptance" },
  map: { ar: "الخريطة والإحداثيات", en: "Map & coordinates" },
  recs: { ar: "المقترحات والمستندات", en: "Recommendations" },
  deck: { ar: "العرض التقديمي التحليلي", en: "Analytical presentation" },
  emails: { ar: "قوائم البريد", en: "Mailing lists" },
  users: { ar: "المستخدمون والصلاحيات", en: "Users & permissions" },
};
export const reportTitle = (k: ReportKey, lang: Lang) => REPORT_TITLES[k][lang];
export const isReportKey = (k: string): k is ReportKey => (REPORT_KEYS as readonly string[]).includes(k);
