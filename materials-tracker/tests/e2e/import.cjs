/* مسار الاستيراد الكامل بالصورتين الفعليتين: Checklist ثم Gate Pass، ثم المقارنة والتصدير */
const { launch, fileUrl } = require('./harness.cjs');
const fs = require('fs');
const IMG = process.env.IMG || '/tmp/claude-0/-home-user-nmwabran/bcbad044-f9e9-50f8-94b4-ce0e32325ad5/images';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-nmwabran/bcbad044-f9e9-50f8-94b4-ce0e32325ad5/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { browser, page, errors, missing } = await launch({ width: 1440, height: 900 });
  const t0 = Date.now();
  await page.goto(fileUrl());
  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.click('#new-project');
  await page.fill('#np-name', 'مشروع اختبار الصور');
  await page.click('dialog .dlg-foot button:has-text("أنشئ المشروع")');
  await page.waitForSelector('.dropzone');

  console.log('== Checklist من الصورة');
  await page.setInputFiles('#f-img', IMG + '/2.webp');
  await page.waitForSelector('#read');
  await page.screenshot({ path: OUT + '/20-prepare.png' });
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 240000 });
  console.log('زمن القراءة', ((Date.now() - t0) / 1000).toFixed(0), 'ث');
  await page.screenshot({ path: OUT + '/21-review-checklist.png', fullPage: true });
  const rows = await page.$$eval('#rv-body tr', (trs) => trs.map((tr) => ({
    code: tr.querySelector('[data-f=code]').value, qty: tr.querySelector('[data-f=qty]').value,
    res: (tr.querySelector('[data-f=reservation]') || {}).value, wo: (tr.querySelector('[data-f=work_order]') || {}).value,
    item: (tr.querySelector('[data-f=item_no]') || {}).value, cls: tr.className, flags: tr.querySelector('.rv-flags').innerText.replace(/\n/g, ' | '),
    sugg: [...tr.querySelectorAll('[data-apply]')].map((b) => b.dataset.code),
  })));
  rows.forEach((r) => console.log(JSON.stringify(r)));
  // أكمل الصف الناقص بالاقتراح
  const sug = await page.$('[data-apply]');
  if (sug) { await sug.click(); console.log('طُبّق اقتراح'); }
  await page.fill('#note', 'صفحة 3 من 12');
  await page.click('#save');
  await page.waitForSelector('.toast');
  console.log('TOAST', await page.$eval('.toast-msg', (e) => e.textContent));
  await page.waitForSelector('#sv-table .table');
  const saved = await page.$$eval('#sv-table tbody tr', (t) => t.length);
  console.log('محفوظ في الصفحة الأولى:', saved);

  console.log('== Gate Pass من الصورة');
  await page.goto(fileUrl('#/import/gatepass'));
  await page.waitForSelector('.dropzone');
  await page.setInputFiles('#f-img', IMG + '/1.webp');
  await page.waitForSelector('#read');
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 240000 });
  await page.screenshot({ path: OUT + '/22-review-gatepass.png', fullPage: true });
  const hdr = await page.$$eval('[data-h]', (els) => Object.fromEntries(els.map((e) => [e.dataset.h, e.value])));
  console.log('HEADER', JSON.stringify(hdr));
  const g = await page.$$eval('#rv-body tr', (trs) => trs.map((tr) => ({ code: tr.querySelector('[data-f=code]').value, qty: tr.querySelector('[data-f=qty]').value, res: tr.querySelector('[data-f=reservation]').value, line: tr.querySelector('[data-f=line_no]').value, hint: (tr.querySelector('.hint') || {}).textContent })));
  g.forEach((r) => console.log(JSON.stringify(r)));
  console.log('ERRORS', errors, 'MISSING', missing);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
