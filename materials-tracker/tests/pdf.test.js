/* تجميع قطع نص PDF في أسطر (بدون متصفح) */
const MT = require('./load');
require('../assets/js/pdf.js');
const G = MT.PDF.groupItems;

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  ✗', m); } else console.log('  ✓', m); };

// صفّان: قطع الصف الأول مبعثرة بالترتيب، وفارق بسيط في خط الأساس
const items = [
  { str: 'W264057918802/0002', x: 900, y: 200, w: 300, h: 20 },
  { str: 'TERMINATION KIT', x: 100, y: 201, w: 220, h: 20 },
  { str: '0030312223', x: 1250, y: 199, w: 150, h: 20 },
  { str: '1', x: 1600, y: 200, w: 12, h: 20 },
  { str: 'Sub Total', x: 100, y: 260, w: 120, h: 20 },
  { str: '2', x: 240, y: 260, w: 12, h: 20 },
];
const lines = G(items);
ok(lines.length === 2, 'القطع تتجمع في سطرين');
ok(lines[0].text === 'TERMINATION KIT W264057918802/0002 0030312223 1', 'ترتيب القطع داخل السطر من اليسار إلى اليمين: ' + lines[0].text);
ok(lines[1].text === 'Sub Total 2', 'السطر الثاني: ' + lines[1].text);
ok(lines[0].bbox.y0 < lines[1].bbox.y0, 'السطر الأول فوق الثاني');
ok(lines[0].bbox.x0 === 100 && lines[0].bbox.x1 === 1612, 'حدود السطر الأفقية');

// قطع متلاصقة بلا فراغ لا تُفصل بمسافة، وكلمة بعد فجوة تُفصل
const glued = G([{ str: '9081', x: 100, y: 50, w: 40, h: 20 }, { str: '21008', x: 140, y: 50, w: 50, h: 20 }, { str: 'KIT', x: 300, y: 50, w: 40, h: 20 }]);
ok(glued[0].text === '908121008 KIT', 'لصق المتجاورة وفصل البعيدة: ' + glued[0].text);

// قطع فارغة تُهمل، والنص العمودي يصير سطرًا مستقلًا
const mixed = G([{ str: '  ', x: 5, y: 5, w: 5, h: 10 }, { str: '908121009', x: 20, y: 400, w: 160, h: 20, vertical: true }, { str: 'Row', x: 100, y: 100, w: 40, h: 20 }]);
ok(mixed.length === 2 && mixed.some((l) => l.text === '908121009') && mixed.some((l) => l.text === 'Row'), 'تجاهل الفراغ وفصل النص العمودي');

// التحليل ينجح على أسطر PDF: Checklist
const cl = MT.Parsers.parseChecklist({ lines: G([
  { str: '908121008 TERMINATION KIT,CABLE KIT 01 W264057918802/0002 0030312223 0002 1', x: 100, y: 200, w: 1500, h: 20 },
  { str: 'Sub Total 1', x: 100, y: 260, w: 120, h: 20 },
]) });
ok(cl.rows.length === 1 && cl.rows[0].code === '908121008' && cl.rows[0].qty === 1 && cl.rows[0].reservation === '0030312223', 'محلل Checklist يقرأ أسطر PDF');

if (fail) { console.log('FAILED', fail); process.exit(1); }
console.log('OK');
