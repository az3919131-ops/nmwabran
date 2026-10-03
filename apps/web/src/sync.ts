/**
 * مزامنة المشاريع مع الخادم. الواجهة تعدّل نسخة محلية فورًا (كما في المنصة القديمة) ثم
 * تُرسل التغييرات إلى PUT /projects/:id بعد مهلة قصيرة. الخادم هو المرجع: يتحقق من الصلاحية
 * وقفل التعديل وعزل المقاول، ويعيد الاستنباط إن لزم.
 */
import { ALL_PAGES, AUTH, CONTRACTOR_IDS, LS, PAGES, S, T, setCatalog, setContractors, toast, visiblePages } from "./runtime";
import { defaultInvoice } from "@iltizam/core";
import { ApiError, api, get } from "./api";

const GROUPS = ["name", "wo", "site", "admin", "sector", "approvedDate", "estCost", "sheets", "factors", "boq", "mat", "rmus", "notes", "inv", "accept"] as const;
type Group = (typeof GROUPS)[number];

interface Snap { json: Partial<Record<Group, string>>; derived: boolean }
const snaps = new Map<string, Snap>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const chains = new Map<string, Promise<void>>();

let renderHook: () => void = () => {};
export const setRenderHook = (fn: () => void): void => { renderHook = fn; };

/* ───────── تخزين تفضيلات الواجهة المحلية (لغة/صفحة/مشروع نشط) ───────── */
export function saveUi(): void {
  try {
    const p = S.projects[S.active];
    localStorage.setItem(LS + "-ui", JSON.stringify({ lang: S.lang, page: S.page, activeId: p?.id ?? null, woGuard: S.woGuard, updOpen: S.updOpen }));
  } catch { /* تخزين غير متاح */ }
}
export function loadUi(): { lang?: "ar" | "en"; page?: string; activeId?: string | null; woGuard?: boolean; updOpen?: boolean } {
  try { return JSON.parse(localStorage.getItem(LS + "-ui") || "{}"); } catch { return {}; }
}

/* ───────── تحويل DTO الخادم إلى مشروع الواجهة ───────── */
export function adopt(dto: any): any {
  const p = { ...dto };
  p.contractor = Math.max(0, CONTRACTOR_IDS.indexOf(dto.contractorId));
  p.files = (dto.files ?? []).map((f: any) => ({ ...f }));
  p.derived = dto.derived ?? null;
  p.boq ??= {}; p.mat ??= {}; p.rmus ??= []; p.accept ??= {}; p.notes ??= "";
  p.inv ??= defaultInvoice();      // نفس القيم الافتراضية التي ينشئها قالب الفاتورة، فلا تُحسب تعديلًا
  snaps.set(p.id, takeSnap(p));
  return p;
}
function takeSnap(p: any): Snap {
  const json: Snap["json"] = {};
  for (const g of GROUPS) json[g] = JSON.stringify(p[g] ?? null);
  return { json, derived: !!p.derived };
}

/** يضع/يستبدل مشروعًا في المخزن بحسب المعرّف ويعيده */
export function replaceProject(dto: any): any {
  const p = adopt(dto);
  const i = S.projects.findIndex((x: any) => x.id === p.id);
  if (i >= 0) S.projects[i] = p; else S.projects.push(p);
  return p;
}
export function removeProject(id: string): void {
  const i = S.projects.findIndex((x: any) => x.id === id);
  if (i >= 0) S.projects.splice(i, 1);
  snaps.delete(id);
}

/* ───────── البدء: مقاولون + مكتبة + مشاريع + صلاحيات ───────── */
export function applyBootstrap(b: any): void {
  AUTH.me = b.user; AUTH.perms = b.perms; AUTH.unlocked = !!b.unlocked; AUTH.adminEmail = b.adminEmail; AUTH.features = b.features ?? AUTH.features;
  setContractors(b.contractors);
  setCatalog(b.catalog);
  S.projects = (b.projects as any[]).map(adopt);
  PAGES.length = 0; PAGES.push(...visiblePages());
  if (!PAGES.length) PAGES.push(ALL_PAGES[0]);
}
export async function reloadCatalog(): Promise<void> { setCatalog(await get("/catalog")); }
export async function reloadProject(id: string): Promise<any | null> {
  try { return replaceProject(await get(`/projects/${id}`)); } catch { return null; }
}

/* ───────── المزامنة ───────── */
function diff(p: any): { body: Record<string, unknown>; snap: Snap } | null {
  const prev = snaps.get(p.id); if (!prev) return null;
  const body: Record<string, unknown> = {};
  const snap: Snap = { json: {}, derived: !!p.derived };
  let changed = false;
  for (const g of GROUPS) {
    const j = JSON.stringify(p[g] ?? null);
    snap.json[g] = j;
    if (j !== prev.json[g]) { body[g] = p[g]; changed = true; }
  }
  if (!!p.derived !== prev.derived) { body.derived = !!p.derived; changed = true; }
  return changed ? { body, snap } : null;
}

/** تُستدعى بعد كل تعديل محلي: تحفظ التفضيلات وتجدول المزامنة للمشروع النشط */
export function save(): void {
  saveUi();
  const p = S.projects[S.active]; if (!p) return;
  schedule(p.id);
}
export function schedule(id: string, delay = 600): void {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => { void flush(id); }, delay));
}

export function flush(id: string, keepalive = false): Promise<void> {
  clearTimeout(timers.get(id)); timers.delete(id);
  const run = async (): Promise<void> => {
    const p = S.projects.find((x: any) => x.id === id); if (!p) return;
    const d = diff(p); if (!d) return;
    try {
      const res: any = await api("PUT", `/projects/${id}`, { ...d.body, expectedVersion: p.version }, { keepalive });
      snaps.set(id, d.snap);
      p.version = res.version;
      // لا نكتب فوق تعديلات جديدة أُجريت أثناء الطلب
      if (!diff(p)) { p.derived = res.derived ?? null; snaps.set(id, takeSnap(p)); }
      p.canUndo = res.canUndo;
    } catch (e) {
      await onSyncError(e, id);
    }
  };
  const next = (chains.get(id) ?? Promise.resolve()).then(run, run);
  chains.set(id, next);
  return next;
}
export const flushAll = (): Promise<void[]> => Promise.all(S.projects.map((p: any) => flush(p.id)));

async function onSyncError(e: unknown, id: string): Promise<void> {
  if (e instanceof ApiError) {
    if (e.code === "edit_locked") AUTH.unlocked = false;
    if ([400, 403, 404, 409, 423].includes(e.status)) {
      toast(e.message);
      await reloadProject(id);           // نتراجع عن التعديل المرفوض ونعرض ما عند الخادم
      renderHook();
      return;
    }
  }
  toast(T("تعذّر حفظ التعديل على الخادم — سيُعاد المحاولة", "Could not save to the server — will retry"));
  schedule(id, 5000);
}

/** حفظ ما تبقّى عند إغلاق التبويب أو إخفائه */
export function installUnloadFlush(): void {
  const go = () => { if (!AUTH.unlocked) return; for (const p of S.projects) if (diff(p)) void flush(p.id, true); };
  window.addEventListener("pagehide", go);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") go(); });
}

/** يعيد جلب قائمة المقاولين ويعيد ربط فهارس المشاريع بها */
export async function refreshContractors(): Promise<void> {
  const rows: any[] = await get("/contractors");
  setContractors(rows.map((c) => ({ id: c.id, name: c.name })));
  for (const p of S.projects) p.contractor = Math.max(0, CONTRACTOR_IDS.indexOf(p.contractorId));
}
/** يعيد جلب كل مشاريع المستخدم (بعد حذف مقاول ونقل مشاريعه مثلًا) */
export async function reloadAllProjects(): Promise<void> {
  const keep = S.projects[S.active]?.id;
  S.projects = (await get("/projects") as any[]).map(adopt);
  const i = S.projects.findIndex((p: any) => p.id === keep);
  S.active = i >= 0 ? i : 0;
}
