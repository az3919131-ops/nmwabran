/* استيراد ملفات PDF: نصي متعدد الصفحات (Checklist) و UDS و Gate Pass، وملف ممسوح ضوئيًا يمر على القراءة الضوئية.
   الملفات تُنشأ داخل الاختبار نفسه من HTML بواسطة المتصفح. */
const { launch, fileUrl } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'mt-pdf-test');
fs.mkdirSync(OUT, { recursive: true });

const CSS = `body{font:15px Arial,sans-serif;margin:24px;color:#000}table{border-collapse:collapse;width:100%}td{padding:6px 8px;border-bottom:1px solid #ccc;white-space:nowrap}.h td{font-weight:700;background:#eee}.pg{page-break-after:always}h2{margin:0 0 10px}`;
const clRow = (code, desc, wo, res, item, qty) => `<tr><td>${code}</td><td>${desc}</td><td>KIT</td><td>01</td><td>${wo}</td><td>${res}</td><td>${item}</td><td>${qty}</td></tr>`;
const clHead = '<tr class="h"><td>Material</td><td>Material Desc.</td><td>UoM</td><td>Batch</td><td>Unloading Point</td><td>Reservation</td><td>Item No</td><td>Quantity</td></tr>';
const sub = (n) => `<tr><td colspan="8"><b>Sub Total ${n}</b></td></tr>`;
const CHECKLIST_HTML = `<style>${CSS}</style>
<div class="pg"><h2>Checklist</h2><table>${clHead}
${clRow('908121008', 'TERMINATION KIT,CABLE,HEAT/COLD SHRINK', 'W264057918802/0002', '0030312223', '0002', 1)}
${clRow('908121008', 'TERMINATION KIT,CABLE,HEAT/COLD SHRINK', 'W264066250802/0002', '0030351251', '0002', 1)}${sub(2)}
${clRow('908121009', 'TERM KIT,STR,1KV,4X185MM2,AL', 'W264056939802/0005', '0030315989', '0005', 2)}
${clRow('908121009', 'TERM KIT,STR,1KV,4X185MM2,AL', 'W264065705804/0005', '0030320664', '0005', 2)}
${clRow('908121009', 'TERM KIT,STR,1KV,4X185MM2,AL', 'W264056688402/0002', '0030325101', '0002', 1)}${sub(5)}
</table></div>
<div><h2>Checklist 2</h2><table>${clHead}
${clRow('908121010', 'TERM KIT,STR,1KV,4X300MM2,AL', 'W264056939802/0006', '0030315989', '0006', 1)}
${clRow('908121010', 'TERM KIT,STR,1KV,4X300MM2,AL', 'W264065705804/0006', '0030320664', '0006', 2)}${sub(3)}
</table></div>`;
const EXPECT_CL = [
  ['908121008', '0030312223', 1], ['908121008', '0030351251', 1], ['908121009', '0030315989', 2], ['908121009', '0030320664', 2],
  ['908121009', '0030325101', 1], ['908121010', '0030315989', 1], ['908121010', '0030320664', 2],
];

const UDS_HTML = `<style>${CSS}</style><h2>UDS</h2><table>
<tr><td>908121008</td><td>TERMINATION KIT,CABLE</td><td>0030312223</td><td>UDS-2610-0412</td><td>2</td></tr>
<tr><td>908121009</td><td>TERM KIT,STR,1KV,4X185MM2,AL</td><td>0030315989</td><td>UDS-2610-0413</td><td>5</td></tr></table>`;

const GP_HTML = `<style>${CSS}</style><h2>SEC Gate Pass</h2>
<p>Date &amp; Time 14.10.2026 07:59:36 AM Original Created By 104812</p><p>2000538783</p>
<p>ERP Delivery 80537958 Material Doc 4905599287 (221)</p><table>
<tr><td>310</td><td>2</td><td>0030312223</td><td>908121008</td><td>TERMINATION KIT,CABLE,HEAT/COLD SHRINK</td><td>01</td><td>1</td><td>KIT</td></tr>
<tr><td>300</td><td>2</td><td>0030351251</td><td>908121008</td><td>TERMINATION KIT,CABLE,HEAT/COLD SHRINK</td><td>01</td><td>1</td><td>KIT</td></tr>
<tr><td>280</td><td>5</td><td>0030315989</td><td>908121009</td><td>TERM KIT,STR,1KV,4X185MM2,AL</td><td>01</td><td>2</td><td>KIT</td></tr></table>`;

async function makePdf(browser, html, file) {
  const p = await browser.newPage();
  await p.setContent(html);
  await p.pdf({ path: file, format: 'A4', landscape: true, printBackground: true });
  await p.close();
}

(async () => {
  const { browser, page, errors, missing } = await launch({ width: 1440, height: 900 });
  const files = { cl: path.join(OUT, 'checklist.pdf'), uds: path.join(OUT, 'uds.pdf'), gp: path.join(OUT, 'gatepass.pdf'), scan: path.join(OUT, 'scanned.pdf'), bad: path.join(OUT, 'bad.pdf') };
  await makePdf(browser, CHECKLIST_HTML, files.cl);
  await makePdf(browser, UDS_HTML, files.uds);
  await makePdf(browser, GP_HTML, files.gp);
  // ملف ممسوح: صورة فقط بلا نص مضمّن
  const shot = await browser.newPage({ viewport: { width: 1700, height: 520 } });
  await shot.setContent(`<style>${CSS}body{font-size:24px}td{padding:10px 12px}</style><table>${clHead}
${clRow('908121008', 'TERMINATION KIT,CABLE,HEAT/COLD SHRINK', 'W264057918802/0002', '0030312223', '0002', 1)}${sub(1)}
${clRow('908121009', 'TERM KIT,STR,1KV,4X185MM2,AL', 'W264056939802/0005', '0030315989', '0005', 2)}${sub(2)}</table>`);
  const png = await shot.screenshot();
  await shot.close();
  await makePdf(browser, `<style>@page{margin:0}body{margin:0}img{width:100%;display:block}</style><img src="data:image/png;base64,${png.toString('base64')}">`, files.scan);
  fs.writeFileSync(files.bad, 'هذا ليس ملف PDF');

  let fail = 0;
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fail++; };
  const rowsOf = () => page.$$eval('#rv-body tr', (trs) => trs.map((tr) => ({ code: tr.querySelector('[data-f=code]').value, qty: Number(tr.querySelector('[data-f=qty]').value), res: (tr.querySelector('[data-f=reservation]') || {}).value, line: (tr.querySelector('[data-f=line_no]') || {}).value, cls: tr.className })));

  await page.goto(fileUrl());
  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.click('#new-project');
  await page.fill('#np-name', 'مشروع اختبار PDF');
  await page.click('dialog .dlg-foot button:has-text("أنشئ المشروع")');
  await page.waitForSelector('.dropzone');

  console.log('== الزر يعرض Excel أو PDF');
  const label = await page.textContent('[data-pick=xls]');
  ok(/Excel/.test(label) && /PDF/.test(label), 'نص الزر: ' + label.replace(/\s+/g, ' ').trim());
  ok((await page.getAttribute('#f-xls', 'accept')).includes('.pdf'), 'حقل الملف يقبل pdf');

  console.log('== Checklist PDF نصي (صفحتان)');
  await page.setInputFiles('#f-xls', files.cl);
  await page.waitForSelector('#read', { timeout: 60000 });
  const prep = await page.textContent('.prep-side');
  ok(/2 صفحات/.test(prep), 'عدد الصفحات ظاهر: ' + prep.replace(/\s+/g, ' ').slice(0, 120));
  ok(/نصًا مضمّنًا/.test(prep), 'الملف معروف كنصي');
  ok(await page.$eval('#prev', (i) => i.complete && i.naturalWidth > 200).catch(() => false), 'معاينة الصفحة الأولى تظهر');
  await page.screenshot({ path: OUT + '/pdf-prepare.png' });
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 60000 });
  const info = await page.textContent('.rv-head');
  ok(/النص المضمّن/.test(info), 'قراءة مباشرة بدون OCR');
  const cl = await rowsOf();
  console.log('   ', JSON.stringify(cl));
  ok(cl.length === 7, 'سبعة صفوف من الصفحتين: ' + cl.length);
  EXPECT_CL.forEach((e, i) => ok(cl[i] && cl[i].code === e[0] && cl[i].res === e[1] && cl[i].qty === e[2], `صف ${i + 1}: ${e.join(' / ')}`));
  ok(cl.every((r) => !/bad|warn/.test(r.cls)), 'لا صف مُعلَّم بمشكلة');
  await page.screenshot({ path: OUT + '/pdf-review.png', fullPage: true });
  await page.click('#save');
  await page.waitForSelector('.toast-msg:has-text("تم حفظ")');
  const saveMsg = await page.textContent('.toast-msg:has-text("تم حفظ")');
  ok(/7 بند جديد/.test(saveMsg), 'الحفظ: ' + saveMsg);
  await page.waitForSelector('#sv-table .table');
  ok((await page.$$eval('#sv-table tbody tr', (t) => t.length)) === 7, 'سبعة بنود محفوظة');
  ok(/PDF/.test(await page.evaluate(() => JSON.stringify(Object.assign({}, window.localStorage)))), 'ملاحظة المصدر من ملف PDF');

  console.log('== UDS PDF');
  await page.goto(fileUrl('#/import/uds'));
  await page.waitForSelector('.dropzone');
  await page.setInputFiles('#f-xls', files.uds);
  await page.waitForSelector('#read');
  await page.click('#read');
  await page.waitForSelector('.review');
  const uds = await rowsOf();
  console.log('   ', JSON.stringify(uds));
  ok(uds.length === 2 && uds[0].code === '908121008' && uds[0].qty === 2 && uds[1].code === '908121009' && uds[1].qty === 5, 'صفا UDS');

  console.log('== Gate Pass PDF');
  await page.goto(fileUrl('#/import/gatepass'));
  await page.waitForSelector('.dropzone');
  await page.setInputFiles('#f-xls', files.gp);
  await page.waitForSelector('#read');
  await page.click('#read');
  await page.waitForSelector('.review');
  const hdr = await page.$$eval('[data-h]', (els) => Object.fromEntries(els.map((e) => [e.dataset.h, e.value])));
  const gp = await rowsOf();
  console.log('   ', JSON.stringify(hdr), JSON.stringify(gp));
  ok(hdr.no === '2000538783' && hdr.erp_delivery === '80537958' && hdr.material_doc === '4905599287', 'رأس Gate Pass');
  ok(gp.length === 3 && gp[0].code === '908121008' && gp[0].qty === 1 && gp[2].code === '908121009' && gp[2].qty === 2 && gp[0].line === '310', 'صفوف Gate Pass');

  console.log('== PDF ممسوح ضوئيًا (OCR)');
  await page.goto(fileUrl('#/import/checklist'));
  await page.waitForSelector('.dropzone');
  await page.setInputFiles('#f-xls', files.scan);
  await page.waitForSelector('#read', { timeout: 60000 });
  ok(/بلا نص مضمّن/.test(await page.textContent('.prep-side')), 'الملف معروف كصورة ممسوحة');
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 240000 });
  const sc = await rowsOf();
  console.log('   ', JSON.stringify(sc));
  ok(/قراءة محلية/.test(await page.textContent('.rv-head')), 'مرّ على القراءة الضوئية');
  ok(sc.length >= 2 && sc.some((r) => r.code === '908121008' && r.res === '0030312223') && sc.some((r) => r.code === '908121009' && r.res === '0030315989'), 'قرأ صفّي الملف الممسوح');
  await page.screenshot({ path: OUT + '/pdf-scan-review.png', fullPage: true });

  console.log('== ملف تالف باسم PDF');
  await page.goto(fileUrl('#/import/checklist'));
  await page.reload();
  await page.waitForSelector('.dropzone');
  await page.setInputFiles('#f-xls', files.bad);
  await page.waitForSelector('.toast-msg:has-text("تعذّر")');
  const badMsg = await page.textContent('.toast-msg:has-text("تعذّر")');
  ok(/تعذّر فتح/.test(badMsg), 'رسالة خطأ واضحة: ' + badMsg);
  ok((await page.textContent('.dz-hint')).includes('اسحب'), 'عاد الإرشاد بعد الفشل');

  console.log('ERRORS', errors, 'MISSING', missing);
  ok(errors.length === 0, 'لا أخطاء في الـ console');
  await browser.close();
  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('PDF OK');
})().catch((e) => { console.error(e); process.exit(1); });
