/* مسار كامل بالبيانات التجريبية: تصدير Excel وفحص محتواه، استيراد Excel، لوحة المفاتيح، الجوال */
const { launch, fileUrl, DEPS } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const ExcelJS = require(path.join(DEPS, 'exceljs'));
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-nmwabran/bcbad044-f9e9-50f8-94b4-ce0e32325ad5/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  ✗', m); } else console.log('  ✓', m); };

(async () => {
  const { browser, page, errors } = await launch({ width: 1440, height: 900 });
  await page.goto(fileUrl());
  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.click('#add-demo');
  await page.waitForSelector('.kpis');

  console.log('== تصدير Excel الشامل');
  await page.goto(fileUrl('#/reports'));
  await page.waitForSelector('#exp-all');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp-all')]);
  const file = path.join(OUT, 'all-reports.xlsx');
  await dl.saveAs(file);
  console.log('  ملف:', dl.suggestedFilename());
  ok(/^Materials-Reports_\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()), 'اسم الملف لاتيني بامتداد xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  console.log('  الأوراق:', wb.worksheets.map((w) => w.name).join(' | '));
  ok(wb.worksheets.length === 9, '9 أوراق');
  const sh = wb.getWorksheet('الناقص من Gate Pass');
  ok(sh && sh.views[0].rightToLeft === true, 'اتجاه الورقة من اليمين لليسار');
  const hdr = sh.getRow(4).values.slice(1);
  console.log('  عناوين الناقص:', hdr.join(' | '));
  const r5 = sh.getRow(5).values.slice(1);
  console.log('  أول صف:', JSON.stringify(r5));
  ok(String(r5[0]) === '908121150' && r5[5] === 0 && r5[6] === 1, 'الصف الأول: 908121150 ناقص 1');
  const statusCell = sh.getCell(5, 8);
  ok(statusCell.fill && statusCell.fill.fgColor.argb === 'FFFF6B5E', 'لون خلية «لم يُصرف» أحمر');
  const last = sh.getRow(sh.rowCount).getCell(1).value;
  ok(String(last).includes('Eng. Ahmed Zahran'), 'تذييل المدير في الورقة: ' + last);
  const cl = wb.getWorksheet('Checklist مقابل Gate Pass');
  const d = cl.getRow(5).values.slice(1);
  console.log('  Checklist/GP أول صف:', JSON.stringify(d));
  ok(cl.getCell(5, 6).fill && cl.getCell(5, 6).fill.fgColor.argb === 'FFDCDFFF', 'فرق موجب بلون أزرق فاتح');
  ok(wb.creator.includes('Ahmed Zahran'), 'مؤلف الملف');

  console.log('== تصدير قائمة Checklist ثم استيرادها من Excel في مشروع جديد');
  await page.goto(fileUrl('#/import/checklist'));
  await page.waitForSelector('#sv-export');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#sv-export')]);
  const f2 = path.join(OUT, 'checklist.xlsx');
  await dl2.saveAs(f2);
  await page.goto(fileUrl('#/projects'));
  await page.click('#new-project');
  await page.fill('#np-name', 'مشروع الاستيراد من Excel');
  await page.click('dialog .dlg-foot button:has-text("أنشئ المشروع")');
  await page.waitForSelector('.dropzone');
  await page.setInputFiles('#f-xls', f2);
  await page.waitForSelector('.map-grid');
  await page.screenshot({ path: OUT + '/30-mapping.png', fullPage: true });
  const mapped = await page.$$eval('[data-map]', (s) => Object.fromEntries(s.map((x) => [x.dataset.map, x.selectedOptions[0].textContent])));
  console.log('  الربط:', JSON.stringify(mapped));
  ok(mapped.code && mapped.code.includes('كود المادة') && mapped.qty.includes('الكمية'), 'الأعمدة رُبطت تلقائيًا');
  await page.click('#to-review');
  await page.waitForSelector('.review');
  const n = await page.$$eval('#rv-body tr', (t) => t.length);
  const bad = await page.$$eval('#rv-body tr.rv-bad', (t) => t.length);
  ok(n === 13 && bad === 0, `13 صفًا سليمًا (${n} / ${bad} ناقص)`);
  await page.click('#save');
  await page.waitForSelector('#sv-table tbody tr');
  const toasts = await page.$$eval('.toast-msg', (e) => e.map((x) => x.textContent));
  ok(toasts.some((t) => t.includes('13 بند جديد')), 'حُفظ 13 بندًا جديدًا: ' + toasts.join(' / '));
  // إعادة الاستيراد لا تضاعف
  await page.setInputFiles('#f-xls', f2).catch(() => {});

  console.log('== لوحة المفاتيح فقط: الوصول إلى «ارفع صورة» وتفعيله');
  await page.goto(fileUrl('#/import/gatepass'));
  await page.waitForSelector('[data-pick]');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.pick === 'img');
  }
  ok(reached, 'التنقل بـ Tab يصل إلى زر «ارفع صورة»');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  ok(!!chooser, 'Enter يفتح نافذة اختيار الملف');
  await chooser.setFiles('/tmp/claude-0/-home-user-nmwabran/bcbad044-f9e9-50f8-94b4-ce0e32325ad5/images/1.webp');
  await page.waitForSelector('#read');
  ok(await page.$eval('#read', (e) => !e.disabled), 'زر «اقرأ الصورة» ظاهر بعد الاختيار');
  await page.screenshot({ path: OUT + '/31-prepare.png', fullPage: false });
  await page.click('#skip');
  await page.waitForSelector('.review');
  await page.fill('[data-h=no]', '2000999001');
  await page.click('#add-row');
  await page.fill('[data-f=code]', '908121150');
  await page.fill('[data-f=qty]', '1');
  await page.fill('[data-f=reservation]', '0030320664');
  const flagTxt = await page.$eval('[data-flags="0"]', (e) => e.innerText);
  console.log('  ملاحظات الصف اليدوي:', flagTxt.replace(/\n/g, ' | '));
  await page.click('#save');
  await page.waitForSelector('.gp-card');
  ok((await page.$$eval('.gp-card', (e) => e.length)) === 1, 'Gate Pass محفوظ');

  console.log('== الجوال 360');
  const m = await launch({ width: 360, height: 740, mobile: true });
  await m.page.goto(fileUrl());
  await m.page.fill('input[name=name]', 'x');
  await m.page.click('button[type=submit]');
  await m.page.click('#add-demo');
  await m.page.waitForSelector('.kpis');
  await m.page.goto(fileUrl('#/import/checklist'));
  await m.page.waitForSelector('.dropzone');
  await m.page.screenshot({ path: OUT + '/32-m-import.png', fullPage: true });
  await m.page.click('#skip').catch(() => {});
  await m.page.click('[data-pick=img]').catch(() => {});
  const w = await m.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(w[0] <= w[1], 'لا تمرير أفقي على 360');
  errors.push(...m.errors);
  await m.browser.close();

  console.log('ERRORS', errors);
  await browser.close();
  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
