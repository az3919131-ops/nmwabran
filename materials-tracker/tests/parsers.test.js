const MT = require('./load');
const fx = require('./fixtures/ocr-samples.json');
const P = MT.Parsers;

// الحقيقة المرجعية من الصورتين المرسلتين
const CHECKLIST = [
  ['908121008', '0030312223', '0002', 1, '264057918', '802'],
  ['908121008', '0030351251', '0002', 1, '264066250', '802'],
  ['908121009', '0030315989', '0005', 2, '264056939', '802'],
  ['908121009', '0030320664', '0005', 2, '264065705', '804'],
  ['908121009', '0030325101', '0002', 1, '264056688', '402'],
  ['908121010', '0030315989', '0006', 1, '264056939', '802'],
  ['908121010', '0030320664', '0006', 2, '264065705', '804'],
  ['908121040', '0030320664', '0012', 2, '264065705', '804'],
  ['908121144', '0030320664', '0021', 3, '264065705', '804'],
  ['908121150', '0030320664', '0020', 1, '264065705', '804'],
  ['908122008', '0030315989', '0011', 4, '264056939', '802'],
  ['908122008', '0030324171', '0002', 4, '264067057', '805'],
  ['908122008', '0030324171', '0056', 16, '264067057', '805'],
];
const GATEPASS = [
  ['310', '0030312223', '908121008', 1], ['300', '0030351251', '908121008', 1], ['290', '0030364667', '908121008', 1],
  ['280', '0030315989', '908121009', 2], ['270', '0030320664', '908121009', 2], ['260', '0030325101', '908121009', 1],
  ['250', '0030315989', '908121010', 1], ['240', '0030320664', '908121010', 2], ['230', '0030364667', '908121010', 2],
  ['220', '0030320664', '908121040', 2], ['50', '0030320664', '908121144', 3],
];

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  ✗', m); } };

console.log('== Checklist (الصورة 2)');
const cl = P.parseChecklist(fx['2.webp_r270_p6']);
console.log('rows', cl.rows.length, 'groups', cl.groups, 'warnings', cl.warnings);
let hit = { code: 0, res: 0, item: 0, qty: 0, wo: 0, all: 0 };
CHECKLIST.forEach((e) => {
  const r = cl.rows.find((x) => x.item_no === e[2] && x.reservation === e[1] && (x.code === e[0] || !x.code));
  if (!r) { console.log('  لم يُعثر على', e.join(' ')); return; }
  const c = r.code === e[0], rs = r.reservation === e[1], q = r.qty === e[3], w = r.work_order === e[4] && r.wo_type === e[5];
  hit.code += c; hit.res += rs; hit.qty += q; hit.wo += w; hit.all += c && rs && q && w;
  if (!(c && rs && q && w)) console.log('  فرق', e.join(' '), '=>', r.code, r.reservation, r.qty, r.work_order, r.wo_type, r.flags.join(','));
});
console.log('صحيح:', hit, 'من', CHECKLIST.length);

console.log('== Gate Pass (الصورة 1)');
const a = P.parseGatePass(fx['1.webp_r270_p6']);
const b = P.parseGatePass(fx['1.webp_r270_p4']);
const resCodes = {};
CHECKLIST.forEach(([c, r]) => { (resCodes[r] = resCodes[r] || []); if (!resCodes[r].includes(c)) resCodes[r].push(c); });
const m = P.mergeGatePass(a, b, { resCodes });
console.log('header', JSON.stringify(m.header));
let gh = { res: 0, code: 0, qty: 0, all: 0 };
GATEPASS.forEach((e) => {
  const r = m.rows.find((x) => x.reservation === e[1] && (x.code === e[2] || !x.code) && (x.line_no === e[0] || !x.line_no || x.code === e[2]));
  if (!r) { console.log('  لم يُعثر على', e.join(' ')); return; }
  const c = r.code === e[2], q = r.qty === e[3];
  gh.res++; gh.code += c; gh.qty += q; gh.all += c && q;
  if (!(c && q)) console.log('  فرق', e.join(' '), '=>', r.code, r.qty, r.line_no, r.flags.join(','));
});
console.log('Gate Pass:', gh, 'من', GATEPASS.length, '| صفوف مقروءة', m.rows.length);
ok(m.header.no === '2000538783', 'رقم الـ Gate Pass');
ok(m.header.date === '2026-10-14', 'تاريخ الـ Gate Pass');
ok(m.header.erp_delivery === '80537958', 'ERP Delivery');
ok(m.header.material_doc === '4905599287', 'Material Doc');
ok(hit.all >= 10, 'Checklist: 10 صفوف صحيحة على الأقل');
if (fail) { console.log('FAILED', fail); process.exit(1); }
console.log('OK');
