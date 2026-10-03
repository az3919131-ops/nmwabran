/** حراسة الصلاحيات في الواجهة (للتجربة فقط — الخادم هو الذي يفرضها فعليًا) + معالجة الأخطاء */
import { ACTS, AUTH, MODULES, S, T, can, toast } from "../runtime";
import { ApiError } from "../api";
import { render } from "../render";
import { setBusy } from "../ui";
import { post } from "../api";

export function denyToast(mod: string, act: string): void {
  const m = MODULES.find((x) => x.id === mod) || { ar: mod, en: mod };
  const a = ACTS.find((x) => x[0] === act) || [act, act, act];
  toast(T("لا تملك صلاحية ", "You do not have permission to ") + T(a[1], a[2]) + T(" في ‹", " in ‹") + T(m.ar, m.en) + "›");
}
export function lockToast(): void {
  toast(T("التعديل مقفل — اضغط «قفل التعديل» أعلى الصفحة لفتحه بكلمة مرور مدير النظام", "Editing is locked — use the lock button in the top bar and the administrator password"));
}
/** true إن كان الإجراء مسموحًا؛ وإلا يعرض السبب */
export function guardAct(mod: string, act: "view" | "edit" | "del" | "exp"): boolean {
  if (!can(mod, act)) { denyToast(mod, act); return false; }
  if ((act === "edit" || act === "del") && !AUTH.unlocked) { lockToast(); return false; }
  return true;
}

/** ينفّذ إجراءً غير متزامن ويعرض أي خطأ من الخادم برسالته العربية */
export async function safe<T>(fn: () => Promise<T>, opts: { busy?: string } = {}): Promise<T | undefined> {
  try {
    if (opts.busy) setBusy(true, opts.busy);
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === "edit_locked") { AUTH.unlocked = false; render(); }
      toast(e.message);
    } else {
      toast(T("تعذّر الاتصال بالخادم", "Could not reach the server"));
    }
    return undefined;
  } finally {
    if (opts.busy) setBusy(false);
  }
}

export const lang = (): "ar" | "en" => S.lang;
export { post };
