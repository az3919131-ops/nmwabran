/* اختبار الواجهة الموحّدة مع المحوّل المحلي (بدون IndexedDB) */
const MT = require('./load');
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
require('../assets/js/store.js');
const { Store } = MT;
let fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log('  ✗', m, JSON.stringify(a), '≠', JSON.stringify(b)); } else console.log('  ✓', m); };

(async () => {
  await Store.init();
  await Store.signIn({ name: 'أحمد' });
  const p = await Store.addDemo();
  await Store.openProject(p.id);
  eq([Store.data.checklist.length, Store.data.uds.length, Store.data.gatePasses[0].items.length], [13, 7, 11], 'تحميل المشروع التجريبي');

  console.log('== منع التكرار');
  const rows = MT.Seed.CL.map(([code, reservation, item_no, qty, work_order, wo_type]) => ({ code, reservation, item_no, qty, work_order, wo_type, unloading_point: '' }));
  let r = await Store.importList('checklist', rows, { ref: 'p3' });
  eq([r.added, r.updated, Store.data.checklist.length], [0, 13, 13], 'إعادة استيراد نفس الصفحة لا تضاعف الكميات');
  rows[0].qty = 5;
  r = await Store.importList('checklist', rows);
  eq([r.updated, Store.data.checklist.find((x) => x.code === '908121008' && x.reservation === '0030312223').qty], [13, 5], 'تحديث كمية موجودة');
  r = await Store.importList('checklist', [{ code: '908121040', reservation: '0030399999', item_no: '0001', qty: 7 }]);
  eq([r.added, Store.data.checklist.length], [1, 14], 'بند جديد يُضاف');
  r = await Store.importList('checklist', rows, { mode: 'replace' });
  eq([r.removed, Store.data.checklist.length], [1, 13], 'وضع الاستبدال يحذف ما ليس في القائمة الجديدة');

  console.log('== Gate Pass');
  r = await Store.importGatePass({ no: '2000538783', date: '2026-10-14' }, [{ line_no: '50', reservation: '0030320664', code: '908121144', qty: 3 }]);
  eq([r.merged, r.added, r.updated, Store.data.gatePasses.length, Store.data.gatePasses[0].items.length], [true, 0, 1, 1, 11], 'نفس الصفحة مرتين لا تُكرّر البند');
  r = await Store.importGatePass({ no: '2000538783' }, [{ line_no: '10', reservation: '0030312223', code: '908121150', qty: 1 }], { pageNote: 'صفحة 2 من 4' });
  eq([r.merged, r.added, Store.data.gatePasses[0].items.length], [true, 1, 12], 'صفحة ثانية تُضاف إلى نفس الـ Gate Pass');
  r = await Store.importGatePass({ no: '2000999999', date: '2026-10-20' }, [{ line_no: '10', reservation: '0030312223', code: '908121150', qty: 1 }]);
  eq([r.merged, Store.data.gatePasses.length], [false, 2], 'Gate Pass جديد');
  let threw = false; try { await Store.importGatePass({ no: '' }, []); } catch (e) { threw = true; }
  eq(threw, true, 'رقم Gate Pass مطلوب');

  console.log('== مواد خارج الكتالوج');
  await Store.importList('uds', [{ code: '908199999', qty: 2, reference: 'X' }]);
  eq(MT.Catalog.get('908199999').source, 'document', 'كود غير معروف يُسجَّل كمستند');

  console.log('== حذف وتعديل');
  const gp2 = Store.data.gatePasses[1];
  await Store.deleteGatePass(gp2.id);
  eq(Store.data.gatePasses.length, 1, 'حذف Gate Pass');
  const it = Store.data.gatePasses[0].items[0];
  await Store.updateGpItem(Store.data.gatePasses[0].id, it.id, { qty: 9 });
  await Store.openProject(p.id);
  eq(Store.data.gatePasses[0].items.find((x) => x.id === it.id).qty, 9, 'التعديل يُحفظ ويُقرأ بعد إعادة فتح المشروع');
  eq(Store.data.activity.length > 5, true, 'سجل العمليات');
  await Store.updateGatePass(Store.data.gatePasses[0].id, { no: '2000538999', date: '2026-10-15' });
  await Store.openProject(p.id);
  eq([Store.data.gatePasses[0].no, Store.data.gatePasses[0].date, Store.data.gatePasses[0].items.length], ['2000538999', '2026-10-15', 12], 'تعديل رقم وتاريخ Gate Pass');
  const bk = Store.backup();
  eq(bk.projects.length, 1, 'نسخة احتياطية');

  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
