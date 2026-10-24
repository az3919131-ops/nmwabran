/* تفاعلات الشريط العلوي + قياس الأداء */
const { launch, fileUrl } = require('./harness.cjs');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  ✗', m); } else console.log('  ✓', m); };

(async () => {
  const { browser, page, errors } = await launch({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(fileUrl());
  await page.waitForSelector('.login-card');
  await page.waitForTimeout(1500);
  const p1 = await page.evaluate(() => window.__perf);
  console.log('  أداء صفحة الدخول:', JSON.stringify(p1));
  ok(p1.lcp < 2500 && p1.cls < 0.1, 'LCP < 2.5s و CLS < 0.1 (الدخول)');

  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.click('#add-demo');
  await page.waitForSelector('.kpis');
  await page.waitForTimeout(1200);
  const p2 = await page.evaluate(() => window.__perf);
  console.log('  أداء اللوحة:', JSON.stringify(p2));
  ok(p2.cls < 0.1, 'CLS < 0.1 (اللوحة)');

  console.log('== الفترة الزمنية');
  await page.click('.top-period');
  await page.waitForSelector('dialog[open]');
  await page.check('input[value="7"]');
  await page.click('dialog button:has-text("طبّق الفترة")');
  await page.waitForTimeout(400);
  ok((await page.textContent('#period-label')).includes('7'), 'تسمية الفترة تتغير');
  const none = await page.$eval('.kpi-none .kpi-n', (e) => e.textContent.trim());
  ok(none === '7', 'آخر 7 أيام: كل الأصناف «لم يُصرف» لأن الـ Gate Pass أقدم (' + none + ')');
  ok((await page.textContent('#trend')).includes('لا توجد عمليات صرف'), 'حالة فراغ الرسم الزمني');
  await page.click('.top-period');
  await page.check('input[value="custom"]');
  await page.fill('#p-from', '2026-10-01');
  await page.fill('#p-to', '2026-10-31');
  await page.click('dialog button:has-text("طبّق الفترة")');
  await page.waitForTimeout(400);
  ok((await page.$eval('.kpi-ok .kpi-n', (e) => e.textContent.trim())) === '3', 'نطاق مخصص يعيد الأرقام');
  await page.click('.top-period');
  await page.check('input[value="custom"]');
  await page.fill('#p-from', '2026-10-31');
  await page.fill('#p-to', '2026-10-01');
  await page.click('dialog button:has-text("طبّق الفترة")');
  ok(await page.isVisible('dialog[open]'), 'نطاق معكوس لا يُقبل');
  await page.keyboard.press('Escape');

  console.log('== التنبيهات والبحث');
  await page.click('#bell');
  ok((await page.$$('#pop-bell .alert')).length >= 3, 'التنبيهات تظهر');
  await page.click('#pop-bell .alert-danger');
  await page.waitForSelector('.chip[aria-pressed="true"].chip-none');
  ok(true, 'التنبيه ينقل إلى المقارنة مصفّاة على «لم يُصرف»');
  await page.fill('#top-q', '908121144');
  await page.press('#top-q', 'Enter');
  await page.waitForTimeout(500);
  const rows = await page.$$eval('tr[data-code]', (r) => r.map((x) => x.dataset.code));
  ok(rows.length === 1 && rows[0] === '908121144', 'البحث العلوي يصفّي بالكود: ' + rows);
  await page.fill('#top-q', 'ELBOW');
  await page.press('#top-q', 'Enter');
  await page.waitForTimeout(500);
  ok((await page.$$eval('tr[data-code]', (r) => r.map((x) => x.dataset.code))).join() === '908121040,908121144', 'البحث بالوصف من الكتالوج (ELBOW) يجد الصنفين');

  console.log('== الحساب والإعدادات');
  await page.click('#acct');
  await page.click('#pop-acct [data-action="settings"]');
  await page.waitForSelector('dialog[open]');
  await page.fill('#set-key', 'sk-ant-test');
  await page.click('dialog button:has-text("احفظ الإعدادات")');
  const key = await page.evaluate(() => localStorage.getItem('mt:ai-key'));
  ok(key === 'sk-ant-test', 'مفتاح API يُحفظ محليًا');
  await page.goto(fileUrl('#/import/checklist'));
  await page.waitForSelector('[data-pick]');
  await page.setInputFiles('#f-img', '/tmp/claude-0/-home-user-nmwabran/bcbad044-f9e9-50f8-94b4-ce0e32325ad5/images/2.webp');
  await page.waitForSelector('#use-ai');
  ok(true, 'خيار «قراءة ذكية» يظهر بعد إضافة المفتاح');
  // محاكاة طلب Claude
  let nCalls = 0;
  const sse = (json) => {
    const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    return ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', content: [], usage: { input_tokens: 2000, output_tokens: 1 } } }) + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: JSON.stringify(json) } }) + ev('content_block_stop', { index: 0 }) + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 500 } }) + ev('message_stop', {});
  };
  await page.route('https://api.anthropic.com/v1/messages', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST,OPTIONS' } });
    nCalls++;
    const body = JSON.parse(route.request().postData());
    const h = route.request().headers();
    const img = body.messages[0].content[0];
    if (nCalls === 1) window_calls = { model: body.model, key: h['x-api-key'], browser: h['anthropic-dangerous-direct-browser-access'], mt: img.source.media_type, hasImg: img.source.data.length > 1000 };
    // الطلب الأول: قراءة فيها مجموع لا يطابق. الثاني (مراجعة): لا تصحيح
    const json = nCalls === 1
      ? { page: '3 of 12', rows: [{ material: '908121150', description: 'JOINT KIT', uom: 'KIT', unloading_point: 'W264065705804/0020', reservation: '0030320664', item_no: '0020', quantity: 1 }, { material: '908121009', description: 'TERM KIT', uom: 'KIT', unloading_point: 'W264056939802/0005', reservation: '0030315989', item_no: '0005', quantity: 2 }], subtotals: [{ material: '908121009', subtotal: 5 }] }
      : { rows: [] };
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/event-stream' }, body: sse(json) });
  });
  await page.check('#use-ai');
  await page.click('#read');
  await page.waitForSelector('.review');
  const aiRows = await page.$$eval('#rv-body tr', (t) => t.map((r) => [r.querySelector('[data-f=code]').value, r.querySelector('[data-f=qty]').value, r.className, r.querySelector('.rv-flags').innerText.replace(/\n/g, ' ')]));
  console.log('  صفوف القراءة الذكية:', JSON.stringify(aiRows));
  ok(window_calls && window_calls.model === 'claude-opus-5-5' && window_calls.key === 'sk-ant-test' && window_calls.browser === 'true' && window_calls.mt === 'image/jpeg' && window_calls.hasImg, 'طلب Claude مضبوط: ' + JSON.stringify(window_calls));
  ok(aiRows.length === 2 && aiRows[1][3].includes('مجموع'), 'مقارنة المجموع الفرعي المطبوع تكشف الفرق (5 مقابل 2)');
  await page.click('#cancel');
  await page.click('dialog button:has-text("ألغِ المسودة")');

  console.log('== الخروج');
  await page.click('#acct');
  await page.click('#pop-acct [data-action="logout"]');
  await page.waitForSelector('.login-card');
  ok(true, 'تسجيل الخروج يعيد إلى شاشة الدخول');
  await page.goto(fileUrl('#/dashboard'));
  await page.waitForSelector('.login-card');
  ok(true, 'الصفحات المحمية تعيد إلى الدخول بلا جلسة');

  console.log('ERRORS', errors);
  await browser.close();
  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
let window_calls = null;
