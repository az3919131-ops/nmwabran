import "./styles/legacy.css";
import "./styles/app.css";
import { AUTH, S, toast, T } from "./runtime";
import { onAuthLost, setAccessToken } from "./api";
import { loadUi, installUnloadFlush, setRenderHook } from "./sync";
import { bootAuth, gateRender } from "./auth";
import { render } from "./render";
import { ensureChrome, applyLang } from "./wiring/chrome";
import { ensureGaWrap } from "./overlays/ga";
import { ensureDocWrap } from "./overlays/doc";
import { ensureAiUi } from "./overlays/ai";
import { installDeckKeys } from "./views/deck";
import { secCopyPt } from "./views/map";
import { bootPrint } from "./print";

// نسخ إحداثي نقطة من بالون الخريطة (تفويض أحداث بدل onclick مضمّن، ليبقى CSP صارمًا)
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement | null)?.closest?.("[data-copypt]") as HTMLElement | null;
  if (!b) return;
  const [lat, lon, id] = (b.dataset.copypt ?? "").split("|");
  secCopyPt(lat, lon, id);
});

async function boot(): Promise<void> {
  const q = new URLSearchParams(location.search);
  if (q.get("print") === "1") { await bootPrint(q); return; }

  const ui = loadUi();
  if (ui.lang) S.lang = ui.lang;
  setRenderHook(render);
  onAuthLost(() => { AUTH.me = null; setAccessToken(null); gateRender(); toast(T("انتهت الجلسة — سجّل الدخول من جديد", "Session ended — please sign in again")); });
  ensureChrome(); ensureGaWrap(); ensureDocWrap(); ensureAiUi(); installDeckKeys(); installUnloadFlush();
  applyLang();
  if (await bootAuth()) render();
}
void boot();
