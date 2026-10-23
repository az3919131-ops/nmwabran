/* مشروع تجريبي مبني على الصورتين المرسلتين (Checklist صفحة 3 من 12، وGate Pass صفحة 1 من 4).
   بيانات UDS تجريبية لعرض الفروقات لأن نموذج UDS لم يُرسل بعد. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;

  // [كود المادة، الحجز، البند، الكمية، أمر العمل، رمز النوع]
  const CL = [
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
  // [رقم البند في Gate Pass، الحجز، الكود، الكمية، الوحدة]
  const GP = [
    ['310', '0030312223', '908121008', 1, 'KIT'],
    ['300', '0030351251', '908121008', 1, 'KIT'],
    ['290', '0030364667', '908121008', 1, 'KIT'],
    ['280', '0030315989', '908121009', 2, 'KIT'],
    ['270', '0030320664', '908121009', 2, 'KIT'],
    ['260', '0030325101', '908121009', 1, 'KIT'],
    ['250', '0030315989', '908121010', 1, 'KIT'],
    ['240', '0030320664', '908121010', 2, 'KIT'],
    ['230', '0030364667', '908121010', 2, 'KIT'],
    ['220', '0030320664', '908121040', 2, 'EA'],
    ['50', '0030320664', '908121144', 3, 'KIT'],
  ];
  // [الكود، المسجل في UDS، المرجع]
  const UDS = [
    ['908121008', 2, 'UDS-2610-0412'],
    ['908121009', 5, 'UDS-2610-0412'],
    ['908121010', 5, 'UDS-2610-0413'],
    ['908121040', 2, 'UDS-2610-0413'],
    ['908121144', 3, 'UDS-2610-0413'],
    ['908121150', 1, 'UDS-2610-0414'],
    ['908122008', 20, 'UDS-2610-0414'],
  ];

  function demo(userEmail) {
    const now = (d, t) => `2026-10-${d}T${t}:00.000Z`;
    const project = {
      id: U.uid(),
      name: 'كهرباء نجران: مستودع الوبران (تجريبي)',
      region: 'نجران',
      contractor: 'شركة ناصر مانع وبران',
      demo: true,
      created_at: now('13', '08:00'),
    };
    const checklist = CL.map(([code, reservation, item, qty, wo, type], i) => ({
      id: U.uid(),
      code,
      qty,
      reservation,
      item_no: item,
      work_order: wo,
      wo_type: type,
      unloading_point: `W${wo}${type}/${item}`,
      doc_desc: '',
      uom: '',
      created_at: now('13', '09:' + String(10 + i)),
    }));
    const uds = UDS.map(([code, qty, reference], i) => ({
      id: U.uid(),
      code,
      qty,
      reference,
      reservation: '',
      doc_desc: '',
      created_at: now('15', '10:' + String(10 + i)),
    }));
    const gp = {
      id: U.uid(),
      no: '2000538783',
      date: '2026-10-14',
      erp_delivery: '80537958',
      material_doc: '4905599287',
      plant: '6540',
      storage: '461',
      contractor: 'NASSIR MANEA WABRAN CO.',
      notes: 'صفحة 1 من 4',
      images: [],
      created_at: now('14', '08:30'),
      items: GP.map(([line, reservation, code, qty, uom]) => ({ id: U.uid(), line_no: line, reservation, code, qty, uom, doc_desc: '' })),
    };
    const who = userEmail || 'مدير المشروع';
    const activity = [
      { id: U.uid(), at: now('13', '09:30'), kind: 'checklist', ref: 'صفحة 3 من 12', count: CL.length, user: who, note: 'استيراد من صورة' },
      { id: U.uid(), at: now('14', '08:35'), kind: 'gatepass', ref: gp.no, count: GP.length, user: who, note: 'صفحة 1 من 4' },
      { id: U.uid(), at: now('15', '10:20'), kind: 'uds', ref: 'UDS-2610-0412..0414', count: UDS.length, user: who, note: 'بيانات تجريبية' },
    ];
    return { project, data: { checklist, uds, gatePasses: [gp], activity } };
  }

  MT.Seed = { demo, CL, GP, UDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.Seed;
})(typeof window !== 'undefined' ? window : globalThis);
