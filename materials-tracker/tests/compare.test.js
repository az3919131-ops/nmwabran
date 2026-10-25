const MT = require('./load');
const { Compare: K, Seed } = MT;
let fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log('  ✗', m, '\n     المتوقع', JSON.stringify(b), '\n     الفعلي ', JSON.stringify(a)); } else console.log('  ✓', m); };

const { data } = Seed.demo('t');
const R = K.build(data);
const by = (c) => R.rows.find((r) => r.code === c);

console.log('== حالات المواد');
eq(R.counts, { total: 7, ok: 3, short: 0, excess: 2, none: 2, udsDiff: 3, unknown: 0 }, 'عدّادات اللوحة');
eq([by('908121008').cl, by('908121008').gp, by('908121008').status], [2, 3, 'excess'], '908121008 زائد');
eq([by('908121009').cl, by('908121009').gp, by('908121009').status], [5, 5, 'ok'], '908121009 مطابق');
eq([by('908121010').cl, by('908121010').gp, by('908121010').status], [3, 5, 'excess'], '908121010 زائد');
eq(by('908121150').status, 'none', '908121150 لم يُصرف');
eq(by('908122008').status, 'none', '908122008 لم يُصرف');
eq([by('908122008').uds, by('908122008').shortVsCl, by('908122008').shortVsUds], [20, 24, 20], 'نقص 908122008');
eq(by('908121010').udsDiff, false, '908121010: UDS = Gate Pass');
eq(by('908121008').udsDiff, true, '908121008: UDS يختلف عن Gate Pass');

console.log('== أوامر العمل');
const wo = (n) => R.workOrders.find((w) => w.wo === n);
eq(wo('264057918').status, 'ok', 'أمر 264057918 مكتمل');
eq(wo('264056939').status, 'short', 'أمر 264056939 ناقص (908122008)');
eq(wo('264067057').status, 'none', 'أمر 264067057 لم يُصرف');
eq(wo('264067057').pct, 0, 'نسبة 264067057');
const orphan = R.workOrders.find((w) => w.key === 'RES:0030364667');
eq([orphan && orphan.status, orphan && orphan.lines.length, orphan && orphan.issued], ['excess', 2, 3], 'حجز بلا أمر عمل في Checklist');
eq(R.resWo.get('0030320664'), { wo: '264065705', type: '804' }, 'ربط الحجز بأمر العمل');
eq(wo('264065705').lines.filter((l) => l.status === 'none').map((l) => l.code), ['908121150'], 'بند ناقص في 264065705');

console.log('== الناقص والتقارير');
eq(K.shortage(R).map((r) => r.code), ['908121150', '908122008'], 'تقرير الناقص');
eq(K.pairwise(R, 'cl-gp').length, 7, 'مقارنة Checklist/Gate Pass');
eq(K.pairwise(R, 'cl-uds').find((r) => r.code === '908122008').pairStatus, 'short', 'UDS ناقص عن Checklist');
eq(K.pairwise(R, 'uds-gp').find((r) => r.code === '908122008').pairStatus, 'none', 'UDS مسجل ولم يُصرف');

console.log('== الفترة الزمنية');
eq(K.build(data, { from: '2026-10-15' }).counts.none, 7, 'بعد تاريخ الـ Gate Pass: كل شيء لم يُصرف');
eq(K.build(data, { from: '2026-10-14', to: '2026-10-14' }).counts.ok, 3, 'ضمن الفترة');
eq(K.previousWindow({ from: '2026-10-10', to: '2026-10-14' }, '2026-10-23'), { from: '2026-10-05', to: '2026-10-09', label: 'عن الفترة السابقة' }, 'الفترة السابقة');
eq(K.previousWindow(null, '2026-10-23').to, '2026-10-16', 'قبل 7 أيام');

console.log('== حدود');
eq(K.relate(null, 0), 'na', 'لا مصدر ولا صرف');
eq(K.relate(2.5, 2.5), 'ok', 'كسور');
eq(K.relate(0.3 + 0.6, 0.9), 'ok', 'دقة الفاصلة العائمة');
const empty = K.build({ checklist: [], uds: [], gatePasses: [] });
eq(empty.counts.total, 0, 'مشروع فارغ');
eq(K.trend(data).days.map((d) => [d.date, d.qty]), [['2026-10-14', 18]], 'اتجاه الصرف');
eq(K.alerts(R).map((a) => a.filter), ['none', 'excess', 'uds'], 'التنبيهات');

console.log('== الوحدات: القطع منفصلة عن الأمتار والكيلومترات');
const mixed = {
  checklist: [
    { id: 'a', code: '908121008', qty: 3, reservation: '0030312223', uom: 'KIT' },
    { id: 'b', code: '908111001', qty: 377, reservation: '0030312223', uom: 'M' }, // كابل: الكتالوج KM والمستند بالمتر
    { id: 'c', code: '908111002', qty: 2, reservation: '0030312223', uom: 'KM' },
  ],
  uds: [],
  gatePasses: [{ id: 'g', no: '2000000001', date: '2026-10-14', items: [{ id: 'i1', code: '908121008', qty: 2, uom: 'KIT' }, { id: 'i2', code: '908111001', qty: 590, uom: 'M' }] }],
};
const RM = K.build(mixed);
eq(RM.unitTotals.PCS, { cl: 3, uds: 0, gp: 2 }, 'القطع وحدها');
eq(RM.unitTotals.M, { cl: 377, uds: 0, gp: 590 }, 'الأمتار حسب وحدة المستند لا الكتالوج');
eq(RM.unitTotals.KM.cl, 2, 'الكيلومترات وحدها');
eq(K.unitSplit(RM.unitTotals, 'gp').map((x) => [x.label, x.value]), [['قطعة', 2], ['متر', 590]], 'عرض الكميات المصروفة');
eq(K.unitSplit(K.build({ checklist: [], uds: [], gatePasses: [] }).unitTotals, 'cl').map((x) => x.label), ['قطعة'], 'القطع تظهر دائمًا حتى لو صفر');
const sum2 = K.addUnits(K.emptyUnits(), RM.unitTotals);
K.addUnits(sum2, RM.unitTotals);
eq(sum2.PCS.cl, 6, 'جمع مشروعين');
eq(K.unitGroup('mtr'), 'M', 'تطبيع الوحدات');

if (fail) { console.log('FAILED', fail); process.exit(1); }
console.log('OK');
