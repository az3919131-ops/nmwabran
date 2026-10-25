/* كل مشروع وحده، ثم صفحة الإجمالي: عزل البيانات، فصل القطع عن الأمتار، اختيار المشاريع، تصدير Excel، وإتاحة الوصول */
const { launch, fileUrl, DEPS } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const axeSrc = fs.readFileSync(path.join(DEPS, 'axe-core', 'axe.min.js'), 'utf8');
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'mt-totals');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { browser, page, errors, missing } = await launch({ width: 1440, height: 900 });
  let fail = 0;
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fail++; };
  const paste = (text) => page.evaluate((t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, text);
  const nodes = () => page.$$eval('.node', (n) => n.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));

  await page.goto(fileUrl());
  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.click('#add-demo');
  await page.waitForSelector('.kpis');
  console.log('== المشروع الأول (التجريبي)');
  const a = await nodes();
  ok(/40 قطعة مطلوبة/.test(a[0]) && /18 قطعة مصروفة/.test(a[2]), 'أرقام المشروع الأول: ' + a.join(' | '));

  console.log('== مشروع ثانٍ يُستورد إليه وحده');
  await page.goto(fileUrl('#/projects'));
  await page.waitForSelector('#new-project');
  await page.click('#new-project');
  await page.fill('#np-name', 'مشروع الشرقية');
  await page.click('dialog .dlg-foot button:has-text("أنشئ المشروع")');
  await page.waitForSelector('.dropzone');
  ok(/مشروع الشرقية/.test(await page.textContent('.meta-line')) && /وحده/.test(await page.textContent('.meta-line')), 'شاشة الاستيراد تذكر المشروع الهدف');
  await paste(['Material\tMaterial Desc.\tUoM\tReservation\tItem No\tQuantity', '908121008\tTERMINATION KIT\tKIT\t0030312223\t0002\t3', '908111001\tCABLE 35MM2\tM\t0030312223\t0003\t377'].join('\n'));
  await page.waitForSelector('#to-review');
  await page.click('#to-review');
  await page.waitForSelector('.review');
  await page.click('#save');
  await page.waitForSelector('.toast-msg:has-text("تم حفظ")');
  await page.goto(fileUrl('#/import/gatepass'));
  await page.reload();
  await page.waitForSelector('.dropzone');
  await paste(['Material\tQuantity\tGate Pass\tDate\tItem No\tReservation\tUoM', '908121008\t2\t2000000099\t14.10.2026\t10\t0030312223\tKIT', '908111001\t590\t2000000099\t14.10.2026\t20\t0030312223\tM'].join('\n'));
  await page.waitForSelector('#to-review');
  await page.click('#to-review');
  await page.waitForSelector('.review');
  await page.click('#save');
  await page.waitForSelector('.toast-msg:has-text("تم حفظ Gate Pass")');

  await page.goto(fileUrl('#/dashboard'));
  await page.waitForSelector('.node');
  const b = await nodes();
  ok(/^Checklist 3 /.test(b[0]) && /377 متر/.test(b[0]), 'لوحة المشروع الثاني: 3 قطع و377 متر مطلوبة: ' + b[0]);
  ok(/^Gate Pass 2 /.test(b[2]) && /590 متر/.test(b[2]) && /1 مستندًا/.test(b[2]), 'المصروف: 2 قطعة و590 متر في مستند واحد: ' + b[2]);
  ok(!/40/.test(b[0]) && !/18/.test(b[2]), 'لا تتسرب أرقام المشروع الأول إلى الثاني');
  ok(/مشروع الشرقية/.test(await page.textContent('.flow-sub')) && (await page.$('.flow-sub a[href="#/totals"]')) !== null, 'اللوحة تذكر أنها لمشروع واحد وفيها رابط الإجمالي');
  await page.screenshot({ path: OUT + '/dashboard-b.png' });

  console.log('== صفحة الإجمالي');
  ok((await page.$('[data-nav=totals]')) !== null, 'عنصر «الإجمالي» في القائمة');
  await page.click('.sidebar [data-nav=totals]');
  await page.waitForSelector('.tt-table');
  const T = await nodes();
  ok(/^Checklist 43 /.test(T[0]) && /377 متر/.test(T[0]), 'مطلوب الإجمالي: 43 قطعة (40+3) و377 متر: ' + T[0]);
  ok(/^UDS 38 /.test(T[1]), 'UDS الإجمالي 38: ' + T[1]);
  ok(/^Gate Pass 20 /.test(T[2]) && /590 متر/.test(T[2]), 'مصروف الإجمالي: 20 قطعة (18+2) و590 متر: ' + T[2]);
  const projRows = await page.$$eval('.tt-table tbody tr', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  ok(projRows.length === 2 && projRows.some((x) => /مشروع الشرقية/.test(x) && /^مشروع الشرقية.* 3 /.test(x)), 'صف لكل مشروع: ' + projRows.length);
  const foot = await page.$eval('.tt-table tfoot', (f) => f.innerText.replace(/\s+/g, ' ').trim());
  ok(/^الإجمالي 43 /.test(foot) || /الإجمالي.*43/.test(foot), 'صف الإجمالي: ' + foot.slice(0, 80));
  ok((await page.$$eval('#tt-chips .chip', (c) => c.map((x) => x.getAttribute('aria-pressed')))).join() === 'true,true', 'المشروعان داخل الإجمالي');
  const mats = await page.$$eval('#tt-mat tbody tr', (r) => r.length);
  ok(mats >= 3, 'جدول الإجمالي حسب المادة فيه أصناف: ' + mats);
  const kit = await page.$eval('#tt-mat tr:has(.code:text("908121008"))', (r) => r.innerText.replace(/\s+/g, ' ')).catch(() => '');
  ok(/908121008/.test(kit), 'صنف مشترك بين مشروعين مجموع: ' + kit.slice(0, 90));
  await page.screenshot({ path: OUT + '/totals.png', fullPage: true });

  console.log('== استبعاد مشروع من الإجمالي');
  await page.click('#tt-chips .chip:has-text("مشروع الشرقية")');
  const T2 = await nodes();
  ok(/^Checklist 40 /.test(T2[0]) && !/متر/.test(T2[0]), 'بعد استبعاد الشرقية: 40 فقط: ' + T2[0]);
  await page.click('#tt-chips .chip:has-text("مشروع الشرقية")');
  ok(/^Checklist 43 /.test((await nodes())[0]), 'إعادته ترجع 43');
  await page.reload();
  await page.waitForSelector('.tt-table');
  ok(/^Checklist 43 /.test((await nodes())[0]), 'الاختيار يبقى بعد إعادة التحميل');

  console.log('== تصدير Excel');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#tt-export')]);
  ok(/^Totals_\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()), 'اسم الملف: ' + dl.suggestedFilename());
  const f = OUT + '/' + dl.suggestedFilename();
  await dl.saveAs(f);
  const ExcelJS = require(path.join(DEPS, 'exceljs'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(f);
  ok(wb.worksheets.map((w) => w.name).join() === 'المشاريع,حسب المادة', 'ورقتان: ' + wb.worksheets.map((w) => w.name).join());
  const ws = wb.getWorksheet('المشاريع');
  const flat = [];
  ws.eachRow((r) => flat.push(r.values.filter((x) => x != null).join(' | ')));
  ok(flat.some((x) => /الإجمالي.*43/.test(x)), 'صف الإجمالي في Excel');
  ok(flat.some((x) => /Project Manager \| Eng\. Ahmed Zahran/.test(x)), 'توقيع مدير المشروع في Excel');

  console.log('== فتح مشروع من الإجمالي');
  await page.click('[data-open]:near(:text("مشروع الشرقية"))').catch(() => {});
  const openBtns = await page.$$('[data-open]');
  await openBtns[0].click();
  await page.waitForSelector('.node');
  ok((await page.textContent('#project-name')).length > 0 && /dashboard/.test(page.url()), 'يفتح لوحة المشروع المختار: ' + (await page.textContent('#project-name')));

  console.log('== إتاحة الوصول والتجاوب');
  for (const W of [1440, 360]) {
    await page.setViewportSize({ width: W, height: W < 700 ? 780 : 900 });
    await page.goto(fileUrl('#/totals'));
    await page.reload();
    await page.waitForSelector('.tt-table');
    await page.waitForTimeout(500);
    await page.evaluate(axeSrc);
    const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    ok(r.violations.length === 0, `axe عند ${W}: ${r.violations.map((v) => v.id + ':' + v.nodes.map((n) => n.target.join(' ')).join('|')).join('; ') || 'نظيفة'}`);
    ok(!over, `لا تمرير أفقي عند ${W}`);
    await page.screenshot({ path: OUT + `/totals-${W}.png`, fullPage: true });
  }

  console.log('ERRORS', errors.filter((e) => !/CORS policy|preload assets|ERR_FAILED/.test(e)), 'MISSING', missing);
  ok(errors.filter((e) => !/CORS policy|preload assets|ERR_FAILED/.test(e)).length === 0, 'لا أخطاء في الـ console');
  await browser.close();
  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('TOTALS OK');
})().catch((e) => { console.error(e); process.exit(1); });
