/* أدوات اختبار المتصفح. التثبيت (خارج المشروع): npm i playwright-core exceljs@4.4.0 xlsx@0.18.5 tesseract.js@5.1.1 @tesseract.js-data/eng
   ثم: E2E_DEPS=/مسار/node_modules node tests/e2e/smoke.cjs
   المكتبات تُقدَّم من النسخ المحلية بدل الـ CDN لأن بيئة الاختبار قد لا تصل إلى الإنترنت. */
const path = require('path');
const fs = require('fs');
const DEPS = process.env.E2E_DEPS || path.join(process.cwd(), 'node_modules');
const req = (m) => require(path.join(DEPS, m));
const { chromium } = req('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MAP = [
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/xlsx\.full\.min\.js/, 'xlsx/dist/xlsx.full.min.js'],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs\/4\.4\.0\/exceljs\.min\.js/, 'exceljs/dist/exceljs.min.js'],
  [/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\.1\.1\/dist\/tesseract\.min\.js/, 'tesseract.js/dist/tesseract.min.js'],
  [/cdn\.jsdelivr\.net\/npm\/tesseract\.js@v5\.1\.1\/dist\/worker\.min\.js/, 'tesseract.js/dist/worker.min.js'],
  [/cdn\.jsdelivr\.net\/npm\/tesseract\.js-core@v5\.1\.\d+\/(.+)$/, (m) => 'tesseract.js-core/' + m[1]],
  [/cdn\.jsdelivr\.net\/npm\/@tesseract\.js-data\/eng@1\.0\.0\/4\.0\.0_best_int\/(.+)$/, (m) => '@tesseract.js-data/eng/4.0.0_best_int/' + m[1]],
];

async function launch({ width = 1440, height = 900, mobile = false } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const missing = [];
  await context.route(/^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//, async (route) => {
    const url = route.request().url();
    for (const [re, to] of MAP) {
      const m = url.match(re);
      if (m) {
        const file = path.join(DEPS, typeof to === 'function' ? to(m) : to);
        if (fs.existsSync(file)) {
          const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream';
          return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
        }
      }
    }
    missing.push(url);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      const t = m.text();
      if (/Failed to load resource.*(fonts|gstatic)/i.test(t)) return;
      errors.push(`[${m.type()}] ${t}`);
    }
  });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  return { browser, context, page, errors, missing, ROOT, DEPS };
}

const fileUrl = (p = '') => 'file://' + path.join(ROOT, 'index.html') + p;
module.exports = { launch, fileUrl, ROOT, DEPS };
