import { chromium, type Browser } from "playwright-core";
import type { Config } from "../../config";

export interface PdfRenderer {
  render(url: string, o: { lang: "ar" | "en" }): Promise<Buffer>;
  close(): Promise<void>;
}

/** عرض الورقة A4 أفقيًا بهوامش 9مم بوحدة CSS (96dpi) — به نضبط نافذة العرض ليطابق تخطيط الطباعة */
const PRINT_W = 1054;

/** يطبع صفحة الواجهة نفسها (route الطباعة) إلى PDF عبر Chromium بلا رأس */
export class PlaywrightPdf implements PdfRenderer {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  constructor(private cfg: Config) {}
  private async b(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    this.launching ??= chromium.launch({ executablePath: this.cfg.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] })
      .then((b) => { this.browser = b; b.on("disconnected", () => { this.browser = null; }); return b; }).finally(() => { this.launching = null; });
    return this.launching;
  }
  async render(url: string, o: { lang: "ar" | "en" }): Promise<Buffer> {
    const browser = await this.b();
    const ctx = await browser.newContext({ locale: o.lang === "ar" ? "ar-SA" : "en-GB", viewport: { width: PRINT_W, height: 900 } });
    try {
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.waitForFunction("window.__REPORT_READY__ === true || window.__REPORT_ERROR__", undefined, { timeout: 60000 });
      const err = await page.evaluate("window.__REPORT_ERROR__ || null");
      if (err) throw new Error("render: " + String(err).slice(0, 200));
      await page.emulateMedia({ media: "print" });
      // الجداول العريضة لا تُقص: نُظهر ما داخل حاويات التمرير ثم نصغّر الصفحة لتتسع بعرض الورقة
      const fit: number = await page.evaluate(`(() => {
        document.querySelectorAll(".scroll").forEach((e) => { e.style.overflow = "visible"; e.style.maxHeight = "none"; });
        const w = document.documentElement.clientWidth; let lo = 0, hi = w;
        for (const el of document.body.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.left < lo) lo = r.left; if (r.right > hi) hi = r.right; }
        return Math.min(1, (w / (hi - lo)) * 0.985);
      })()`);
      if (fit < 1) await page.evaluate(`document.body.style.zoom = "${fit.toFixed(4)}"`);
      const pdf = await page.pdf({
        format: "A4", landscape: true, printBackground: true, margin: { top: "10mm", bottom: "14mm", left: "9mm", right: "9mm" }, displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;direction:ltr;color:#333;font-family:Arial,sans-serif">Project manager · Eng. Ahmed Zahran &nbsp;—&nbsp; <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      });
      return Buffer.from(pdf);
    } finally { await ctx.close().catch(() => {}); }
  }
  async close() { await this.browser?.close().catch(() => {}); this.browser = null; }
}
