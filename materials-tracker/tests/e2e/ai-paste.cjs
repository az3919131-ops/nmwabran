/* اللصق (Ctrl+V وزر اللصق)، وPowerPoint وWord، والقراءة الدقيقة بالذكاء الاصطناعي (مع محاكاة واجهة Anthropic) */
const { launch, fileUrl, DEPS } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'mt-ai-paste');
fs.mkdirSync(OUT, { recursive: true });
const JSZip = require(path.join(DEPS, 'jszip'));

const CSS = `body{font:15px Arial,sans-serif;margin:24px;color:#000}table{border-collapse:collapse;width:100%}td{padding:6px 8px;border-bottom:1px solid #ccc;white-space:nowrap}.h td{font-weight:700;background:#eee}`;
const clHead = '<tr class="h"><td>Material</td><td>Material Desc.</td><td>UoM</td><td>Batch</td><td>Unloading Point</td><td>Reservation</td><td>Item No</td><td>Quantity</td></tr>';
const clRow = (code, desc, wo, res, item, qty) => `<tr><td>${code}</td><td>${desc}</td><td>KIT</td><td>01</td><td>${wo}</td><td>${res}</td><td>${item}</td><td>${qty}</td></tr>`;
const sub = (n) => `<tr><td colspan="8"><b>Sub Total ${n}</b></td></tr>`;
const TABLE = `<style>${CSS}body{font-size:24px}td{padding:10px 12px}</style><table>${clHead}
${clRow('908121008', 'TERMINATION KIT,CABLE,HEAT/COLD SHRINK', 'W264057918802/0002', '0030312223', '0002', 1)}${sub(1)}
${clRow('908121009', 'TERM KIT,STR,1KV,4X185MM2,AL', 'W264056939802/0005', '0030315989', '0005', 2)}${sub(2)}</table>`;

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const cell = (t) => `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;
const pptx = async (slides, media = {}) => {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  z.file('ppt/presentation.xml', `<p:presentation ${NS}><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst></p:presentation>`);
  z.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="x" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`);
  slides.forEach((s, i) => {
    z.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld ${NS}><p:cSld><p:spTree>${s.xml}</p:spTree></p:cSld></p:sld>`);
    if (s.rels) z.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${s.rels}</Relationships>`);
  });
  Object.entries(media).forEach(([n, buf]) => z.file('ppt/media/' + n, buf));
  return z.generateAsync({ type: 'nodebuffer' });
};
const docx = async (bodyXml) => {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  z.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`);
  return z.generateAsync({ type: 'nodebuffer' });
};
const wRow = (cells) => `<w:tr>${cells.map((c) => `<w:tc><w:p><w:r><w:t>${c}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`;

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const sse = (json, stop = 'end_turn') => {
  const txt = JSON.stringify(json);
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', content: [], usage: { input_tokens: 3000, output_tokens: 1 } } }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: txt } }) +
    ev('content_block_stop', { index: 0 }) + ev('message_delta', { delta: { stop_reason: stop }, usage: { output_tokens: 800 } }) + ev('message_stop', {});
};
const R = (code, res, wo, qty) => ({ material: code, description: 'X', uom: 'KIT', unloading_point: wo, reservation: res, item_no: wo.slice(-4), quantity: qty });

(async () => {
  const { browser, page, errors, missing } = await launch({ width: 1440, height: 900 });
  let fail = 0;
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fail++; };

  // ملفات الاختبار
  const shot = await browser.newPage({ viewport: { width: 1700, height: 420 } });
  await shot.setContent(TABLE);
  const png = await shot.screenshot();
  await shot.close();
  const pdfPage = await browser.newPage();
  await pdfPage.setContent(`<style>${CSS}</style><h2>Checklist</h2><table>${clHead}${clRow('908121008', 'TERMINATION KIT', 'W264057918802/0002', '0030312223', '0002', 1)}${sub(1)}</table>`);
  const pdfFile = path.join(OUT, 'cl.pdf');
  await pdfPage.pdf({ path: pdfFile, format: 'A4', landscape: true });
  await pdfPage.close();
  const imgFile = path.join(OUT, 'table.png');
  fs.writeFileSync(imgFile, png);

  const udsXml = `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>
    <a:tr>${['908121008', 'TERMINATION KIT', '0030312223', 'UDS-2610-0412', '2'].map(cell).join('')}</a:tr>
    <a:tr>${['908121009', 'TERM KIT STR', '0030315989', 'UDS-2610-0413', '5'].map(cell).join('')}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  const pptxText = path.join(OUT, 'uds.pptx');
  fs.writeFileSync(pptxText, await pptx([{ xml: udsXml }]));
  const pptxImg = path.join(OUT, 'shot.pptx');
  fs.writeFileSync(pptxImg, await pptx([{ xml: `<p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic>`, rels: '<Relationship Id="rId2" Type="image" Target="../media/image1.png"/>' }], { 'image1.png': png }));
  const oldPpt = path.join(OUT, 'old.ppt');
  fs.writeFileSync(oldPpt, 'binary');
  const docxFile = path.join(OUT, 'cl.docx');
  fs.writeFileSync(docxFile, await docx(`<w:p><w:r><w:t>Checklist</w:t></w:r></w:p><w:tbl>${wRow(['908121008', 'TERMINATION KIT', 'KIT', '01', 'W264057918802/0002', '0030312223', '0002', '1'])}${wRow(['Sub Total 1'])}${wRow(['908121009', 'TERM KIT STR', 'KIT', '01', 'W264056939802/0005', '0030315989', '0005', '2'])}${wRow(['Sub Total 2'])}</w:tbl>`));

  const rowsOf = () => page.$$eval('#rv-body tr', (trs) => trs.map((tr) => ({ code: tr.querySelector('[data-f=code]').value, qty: Number(tr.querySelector('[data-f=qty]').value), res: (tr.querySelector('[data-f=reservation]') || {}).value })));
  const paste = (data) => page.evaluate(({ text, files }) => {
    const dt = new DataTransfer();
    if (text) dt.setData('text/plain', text);
    (files || []).forEach((f) => dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.name, { type: f.type })));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, data);
  const fresh = async (hash = '#/import/checklist') => { await page.goto(fileUrl(hash)); await page.reload(); await page.waitForSelector('.dropzone'); };

  await page.goto(fileUrl());
  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.click('#new-project');
  await page.fill('#np-name', 'مشروع اللصق والذكاء');
  await page.click('dialog .dlg-foot button:has-text("أنشئ المشروع")');
  await page.waitForSelector('.dropzone');

  console.log('== أزرار المصدر');
  const btns = await page.$$eval('.src-btn', (b) => b.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  ok(btns.length === 4, 'أربعة أزرار: ' + btns.join(' | '));
  ok(/كاميرا/.test(btns[0]) && /صورة أو PPT/.test(btns[1]) && /Excel أو PDF/.test(btns[2]) && /الصق/.test(btns[3]), 'الترتيب: كاميرا، صورة أو PPT، Excel أو PDF، الصق');
  ok((await page.getAttribute('#f-img', 'accept')).includes('.pptx') && (await page.getAttribute('#f-xls', 'accept')).includes('.pdf'), 'الحقول تقبل pptx وpdf');
  ok(/محلية ومجانية/.test(await page.textContent('.ai-strip')), 'بدون مفتاح: القراءة محلية ومجانية');
  await page.screenshot({ path: OUT + '/source.png' });

  console.log('== لصق جدول Excel (Tab) بـ Ctrl+V');
  const tsv = ['Material\tMaterial Desc.\tUoM\tUnloading Point\tReservation\tItem No\tQuantity', '908121008\tTERMINATION KIT\tKIT\tW264057918802/0002\t0030312223\t0002\t1', '908121009\tTERM KIT STR\tKIT\tW264056939802/0005\t0030315989\t0005\t2'].join('\n');
  await paste({ text: tsv });
  await page.waitForSelector('#to-review');
  ok(/الحافظة/.test(await page.textContent('#wz-h + p')), 'شاشة ربط الأعمدة لجدول الحافظة');
  await page.click('#to-review');
  await page.waitForSelector('.review');
  let rows = await rowsOf();
  ok(rows.length === 2 && rows[0].code === '908121008' && rows[1].qty === 2 && rows[1].res === '0030315989', 'صفّان من الجدول الملصوق: ' + JSON.stringify(rows));
  ok(/الجدول الملصوق/.test(await page.textContent('.rv-head')), 'مصدر القراءة: الجدول الملصوق');

  console.log('== لصق نص أسطر');
  await fresh();
  const lines = '908121008 TERMINATION KIT KIT 01 W264057918802/0002 0030312223 0002 1\nSub Total 1\n908121009 TERM KIT STR KIT 01 W264056939802/0005 0030315989 0005 2\nSub Total 2';
  await paste({ text: lines });
  await page.waitForSelector('#read');
  ok(/نص ملصوق/.test(await page.textContent('.prep-side')) && /4 سطرًا/.test(await page.textContent('.prep-side')), 'شاشة تجهيز النص الملصوق');
  ok(/908121008/.test(await page.textContent('.prep-text pre')), 'معاينة النص ظاهرة');
  await page.click('#read');
  await page.waitForSelector('.review');
  rows = await rowsOf();
  ok(rows.length === 2 && rows[0].code === '908121008' && rows[0].qty === 1 && rows[1].qty === 2, 'صفّان من النص: ' + JSON.stringify(rows));

  console.log('== لصق صورة (لقطة شاشة)');
  await fresh();
  await paste({ files: [{ name: 'image.png', type: 'image/png', b64: png.toString('base64') }] });
  await page.waitForSelector('#read');
  ok(await page.$('#rot-l') !== null && /جهّز الصورة/.test(await page.textContent('#wz-h')), 'الصورة الملصوقة تدخل مسار الصور');

  console.log('== لصق ملف PDF منسوخ');
  await fresh();
  await paste({ files: [{ name: 'cl.pdf', type: 'application/pdf', b64: fs.readFileSync(pdfFile).toString('base64') }] });
  await page.waitForSelector('#read', { timeout: 60000 });
  ok(/ملف PDF/.test(await page.textContent('.prep-side')) && /1 صفحة/.test(await page.textContent('.prep-side')), 'الملف الملصوق يدخل مسار PDF');

  console.log('== زر الصق (واجهة الحافظة)');
  await fresh();
  await page.evaluate((t) => { navigator.clipboard.read = async () => [{ types: ['text/plain'], getType: async () => new Blob([t], { type: 'text/plain' }) }]; }, lines);
  await page.click('[data-pick=paste]');
  await page.waitForSelector('.prep-text pre');
  ok(true, 'الزر قرأ النص من الحافظة مباشرة');
  await fresh();
  await page.evaluate(() => { navigator.clipboard.read = async () => { throw new DOMException('denied', 'NotAllowedError'); }; });
  await page.click('[data-pick=paste]');
  await page.waitForSelector('dialog[open] #paste-box');
  ok(true, 'عند رفض الإذن يفتح مربع اللصق');
  await page.evaluate((t) => {
    const box = document.querySelector('#paste-box');
    const dt = new DataTransfer(); dt.setData('text/plain', t);
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, tsv);
  await page.waitForSelector('#to-review');
  ok(true, 'اللصق داخل المربع أوصل الجدول إلى ربط الأعمدة');
  await fresh();
  await page.evaluate(() => { navigator.clipboard.read = async () => { throw new DOMException('denied', 'NotAllowedError'); }; });
  await page.click('[data-pick=paste]');
  await page.waitForSelector('dialog[open] #paste-box');
  await page.fill('#paste-box', lines);
  await page.click('dialog .dlg-foot button:has-text("اقرأ النص")');
  await page.waitForSelector('.prep-text pre');
  ok(true, 'زر «اقرأ النص» يعمل بالكتابة اليدوية');

  console.log('== PowerPoint وWord');
  await fresh('#/import/uds');
  await page.setInputFiles('#f-img', pptxText);
  await page.waitForSelector('#read');
  ok(/عرض PowerPoint/.test(await page.textContent('.prep-side')) && /1 شريحة/.test(await page.textContent('.prep-side')), 'عرض pptx فيه جدول نصي');
  await page.click('#read');
  await page.waitForSelector('.review');
  rows = await rowsOf();
  ok(rows.length === 2 && rows[0].code === '908121008' && rows[0].qty === 2 && rows[1].qty === 5, 'جدول الشريحة قُرئ مباشرة: ' + JSON.stringify(rows));
  await fresh();
  await page.setInputFiles('#f-img', pptxImg);
  await page.waitForSelector('#read');
  ok(/1 صورة/.test(await page.textContent('.prep-side')) && (await page.$('#prev')) !== null, 'عرض pptx فيه لقطة شاشة، ومعاينتها ظاهرة');
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 240000 });
  rows = await rowsOf();
  ok(rows.length >= 2 && rows.some((r) => r.code === '908121008' && r.res === '0030312223') && rows.some((r) => r.code === '908121009'), 'لقطة الشريحة قُرئت بالتعرّف الضوئي: ' + JSON.stringify(rows));
  await fresh();
  await page.setInputFiles('#f-img', oldPpt);
  await page.waitForSelector('.toast-msg:has-text("ppt")');
  ok(/pptx أو PDF/.test(await page.textContent('.toast-msg:has-text("ppt")')), 'ملف ppt القديم: رسالة واضحة');
  await fresh();
  await page.setInputFiles('#f-xls', docxFile);
  await page.waitForSelector('#read');
  ok(/مستند Word/.test(await page.textContent('.prep-side')), 'مستند Word');
  await page.click('#read');
  await page.waitForSelector('.review');
  rows = await rowsOf();
  ok(rows.length === 2 && rows[0].code === '908121008' && rows[1].qty === 2, 'جدول Word قُرئ مباشرة: ' + JSON.stringify(rows));

  console.log('== القراءة الدقيقة بالذكاء الاصطناعي (واجهة مُحاكاة)');
  const calls = [];
  let handler = () => ({ status: 500, body: '{}' });
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    calls.push({ url: req.url(), method: req.method(), headers: req.headers(), body: req.postData() ? JSON.parse(req.postData()) : null });
    const r = handler(calls.length, calls[calls.length - 1]);
    return route.fulfill({ status: r.status || 200, headers: { ...cors, 'content-type': r.type || 'text/event-stream' }, body: r.body });
  });
  await page.evaluate(() => localStorage.setItem('mt:ai-key', 'sk-ant-test-123'));
  await fresh();
  ok(/مفعّلة/.test(await page.textContent('.ai-strip')) && /Claude Opus 5.5/.test(await page.textContent('.ai-strip')), 'شريط الحالة: مفعّلة بـ Opus 5.5');

  // 1) صورة + استخراج + مراجعة ثانية
  handler = (n) => n === 1
    ? { body: sse({ page: '1 of 1', rows: [R('908121008', '0030312223', 'W264057918802/0002', 1), R('908121009', '0030315989', 'W264056939802/0005', 2)], subtotals: [{ material: '908121008', subtotal: 1 }, { material: '908121009', subtotal: 3 }] }) }
    : { body: sse({ rows: [{ index: 1, material: null, description: null, uom: null, unloading_point: null, reservation: null, item_no: null, quantity: 3 }] }) };
  await page.setInputFiles('#f-img', imgFile);
  await page.waitForSelector('#use-ai');
  ok(await page.isChecked('#use-ai'), 'خيار القراءة الدقيقة مفعّل افتراضيًا');
  await page.screenshot({ path: OUT + '/prepare-ai.png' });
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 60000 });
  rows = await rowsOf();
  ok(calls.length === 2, 'طلبان: استخراج ثم مراجعة ثانية (' + calls.length + ')');
  const c1 = calls[0];
  ok(c1.method === 'POST' && c1.url === 'https://api.anthropic.com/v1/messages' && c1.headers['x-api-key'] === 'sk-ant-test-123' && c1.headers['anthropic-dangerous-direct-browser-access'] === 'true' && c1.headers['anthropic-version'] === '2026-10-21', 'ترويسات الطلب');
  ok(c1.body.model === 'claude-opus-5-5' && c1.body.stream === true && c1.body.output_config.format.type === 'json_schema', 'النموذج والبث ومخطط JSON');
  ok(c1.body.messages[0].content[0].type === 'image' && c1.body.messages[0].content[0].source.media_type === 'image/jpeg', 'الصورة أُرسلت JPEG base64');
  ok(rows.length === 2 && rows[1].qty === 3, 'الكمية صُحّحت بعد المراجعة الثانية: ' + JSON.stringify(rows));
  const info = await page.textContent('.rv-head');
  ok(/Claude Opus 5.5/.test(info) && /مراجعة ثانية/.test(info) && /التكلفة التقريبية/.test(info), 'سطر المصدر يذكر النموذج والمراجعة والتكلفة: ' + info.replace(/\s+/g, ' ').trim());
  await page.screenshot({ path: OUT + '/review-ai.png', fullPage: true });

  // 2) ملف PDF يُرسل كمستند
  calls.length = 0;
  handler = () => ({ body: sse({ page: null, rows: [R('908121008', '0030312223', 'W264057918802/0002', 1)], subtotals: [{ material: '908121008', subtotal: 1 }] }) });
  await fresh();
  await page.setInputFiles('#f-xls', pdfFile);
  await page.waitForSelector('#use-ai', { timeout: 60000 });
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 60000 });
  ok(calls.length === 1 && calls[0].body.messages[0].content[0].type === 'document' && calls[0].body.messages[0].content[0].source.media_type === 'application/pdf', 'ملف PDF أُرسل كمستند أصلي');
  ok((await rowsOf()).length === 1, 'صف واحد من رد الذكاء الاصطناعي');

  // 3) نص ملصوق يُرسل للذكاء الاصطناعي
  calls.length = 0;
  await fresh();
  await paste({ text: lines });
  await page.waitForSelector('#read');
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 60000 });
  ok(calls.length === 1 && calls[0].body.messages[0].content[0].type === 'text' && /908121008/.test(calls[0].body.messages[0].content[0].text), 'النص الملصوق أُرسل كنص');

  // 4) خطأ مفتاح: قراءة محلية احتياطية مع تنبيه
  calls.length = 0;
  handler = () => ({ status: 401, type: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
  await fresh();
  await paste({ text: lines });
  await page.waitForSelector('#read');
  await page.click('#read');
  await page.waitForSelector('.review', { timeout: 60000 });
  rows = await rowsOf();
  const warn = await page.textContent('.note-warn');
  ok(/تعذّرت القراءة الدقيقة/.test(warn) && /مفتاح API غير صالح/.test(warn), 'تنبيه التحويل للقراءة المحلية: ' + warn.replace(/\s+/g, ' ').slice(0, 140));
  ok(rows.length === 2 && rows[0].code === '908121008', 'القراءة المحلية الاحتياطية أخرجت الصفوف');

  // 5) إيقاف القراءة الذكية يُحفظ ولا يُرسل شيئًا
  calls.length = 0;
  await fresh();
  await paste({ text: lines });
  await page.waitForSelector('#use-ai');
  await page.uncheck('#use-ai');
  ok((await page.evaluate(() => localStorage.getItem('mt:ai-on'))) === '0', 'تفضيل الإيقاف محفوظ');
  await page.click('#read');
  await page.waitForSelector('.review');
  ok(calls.length === 0, 'لا طلبات إلى Anthropic عند الإيقاف');
  await fresh();
  ok(/موقوفة/.test(await page.textContent('.ai-strip')), 'شريط الحالة: موقوفة');
  await page.click('[data-ai-on]');
  ok(/مفعّلة/.test(await page.textContent('.ai-strip')), 'زر «فعّلها» يعيد التفعيل');

  // 6) اختبار المفتاح من الإعدادات
  handler = () => ({ status: 200, type: 'application/json', body: '{"id":"claude-opus-5-5","type":"model"}' });
  await page.click('[data-ai-setup]');
  await page.waitForSelector('dialog[open] #set-test');
  await page.click('#set-test');
  await page.waitForFunction(() => /المفتاح صالح/.test(document.querySelector('#set-test-out').textContent));
  ok(calls.some((c) => c.method === 'GET' && /\/v1\/models\/claude-opus-5-5$/.test(c.url)), 'اختبار المفتاح بقراءة بيانات النموذج فقط');
  handler = () => ({ status: 401, type: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'x' } }) });
  await page.click('#set-test');
  await page.waitForFunction(() => /غير صالح/.test(document.querySelector('#set-test-out').textContent));
  ok(true, 'رسالة واضحة عند مفتاح خاطئ');
  await page.screenshot({ path: OUT + '/settings.png' });
  await page.keyboard.press('Escape');

  console.log('ERRORS', errors, 'MISSING', missing);
  const real = errors.filter((e) => !/status of 401/.test(e)); // رد 401 المُحاكى عمدًا يسجله المتصفح
  ok(real.length === 0, 'لا أخطاء في الـ console سوى 401 المقصود');
  await browser.close();
  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('AI-PASTE OK');
})().catch((e) => { console.error(e); process.exit(1); });
