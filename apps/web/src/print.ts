/**
 * وضع الطباعة لتوليد PDF على الخادم: /?print=1&report=<key>&wo=<projectId>&lang=ar|en&token=<print JWT>
 * يعرض الصفحة نفسها (نفس الأرقام والتنسيق) ثم يرفع window.__REPORT_READY__ ليلتقطها Chromium.
 */
import { ADMIN_ONLY_REPORTS, isReportKey } from "@iltizam/core";
import { AUTH, S } from "./runtime";
import { api, setAccessToken } from "./api";
import { applyBootstrap } from "./sync";
import { render } from "./render";
import { buildDeck, renderDeck } from "./views/deck";
import { loadEmails } from "./views/emails";
import { loadUsersData } from "./views/users";
import { applyLang } from "./wiring/chrome";

declare global { interface Window { __REPORT_READY__?: boolean; __REPORT_ERROR__?: string } }

export async function bootPrint(q: URLSearchParams): Promise<void> {
  try {
    const key = q.get("report") ?? "dash", token = q.get("token") ?? "";
    if (!isReportKey(key)) throw new Error("bad report");
    setAccessToken(token);
    // رمز الطباعة يُزال من العنوان فور قراءته
    history.replaceState(null, "", location.pathname + `?print=1&report=${encodeURIComponent(key)}`);
    S.lang = q.get("lang") === "en" ? "en" : "ar";
    document.documentElement.setAttribute("data-theme", "light");
    document.body.classList.add("authed", "print-mode");
    applyBootstrap(await api("GET", "/bootstrap"));
    const wo = q.get("wo");
    if (wo) { const i = S.projects.findIndex((p: any) => p.id === wo); if (i >= 0) S.active = i; }
    S.page = key === "deck" ? "dash" : key;
    if (ADMIN_ONLY_REPORTS.includes(key)) AUTH.perms[key] = { view: 1, edit: 0, del: 0, exp: 1 };
    if (key === "emails") await loadEmails();
    if (key === "users") await loadUsersData();
    render();
    if (key === "deck") {
      document.body.classList.add("print-deck");
      applyLang(); buildDeck(); renderDeck();
      (document.getElementById("deck") as HTMLElement).hidden = false;
    }
    // انتظر الخطوط والرسم النهائي
    await (document as any).fonts?.ready?.catch?.(() => {});
    await new Promise((r) => setTimeout(r, 400));
    window.__REPORT_READY__ = true;
  } catch (e: any) {
    window.__REPORT_ERROR__ = String(e?.message ?? e);
  }
}
