import { chromium, type Browser } from "playwright-core";
import type { Config } from "../../config";

export interface PdfRenderer {
  render(url: string, o: { lang: "ar" | "en" }): Promise<Buffer>;
  close(): Promise<void>;
}

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
    const ctx = await browser.newContext({ locale: o.lang === "ar" ? "ar-SA" : "en-GB", viewport: { width: 1280, height: 900 } });
    try {
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.waitForFunction("window.__REPORT_READY__ === true || window.__REPORT_ERROR__", undefined, { timeout: 60000 });
      const err = await page.evaluate("window.__REPORT_ERROR__ || null");
      if (err) throw new Error("render: " + String(err).slice(0, 200));
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({
        format: "A4", printBackground: true, margin: { top: "12mm", bottom: "16mm", left: "9mm", right: "9mm" }, displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;direction:ltr;color:#333;font-family:Arial,sans-serif">Project manager · Eng. Ahmed Zahran &nbsp;—&nbsp; <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      });
      return Buffer.from(pdf);
    } finally { await ctx.close().catch(() => {}); }
  }
  async close() { await this.browser?.close().catch(() => {}); this.browser = null; }
}
