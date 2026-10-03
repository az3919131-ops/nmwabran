import { describe, it, expect } from "vitest";
import { defaultPerms, MODULES, REPORT_KEYS } from "../src";
describe("الصلاحيات الافتراضية", () => {
  it("مدير النظام: كل شيء", () => { for (const m of MODULES) expect(defaultPerms("admin")[m.id]).toEqual({ view: 1, edit: 1, del: 1, exp: 1 }); });
  it("قوائم البريد: dept عرض وإضافة وتعديل، pm عرض فقط", () => {
    expect(defaultPerms("dept").emails).toEqual({ view: 1, edit: 1, del: 0, exp: 0 });
    expect(defaultPerms("pm").emails).toEqual({ view: 1, edit: 0, del: 0, exp: 0 });
  });
  it("المستخدمون لمدير النظام فقط، والاستيراد لا يخص pm", () => {
    expect(defaultPerms("dept").users.view).toBe(0); expect(defaultPerms("pm").users.view).toBe(0);
    expect(defaultPerms("pm").import.view).toBe(0);
  });
  it("كل صفحة وحدة صلاحيات", () => { for (const k of REPORT_KEYS) expect(MODULES.some((m) => m.id === k)).toBe(true); });
});
