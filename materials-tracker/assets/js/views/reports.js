/* التقارير: مقارنة ثنائية بين كل مصدرين، الناقص من Gate Pass، أوامر العمل، مع تصدير Excel وطباعة. */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const K = MT.Compare;
  const App = MT.App;
  const esc = U.esc;

  const PAIRS = {
    'cl-uds': {
      name: 'Checklist مقابل UDS',
      title: 'مقارنة Checklist (المطلوب) مع UDS (المسجل)',
      desc: 'يكشف الأصناف المطلوبة التي لم تُسجَّل على UDS أو سُجّلت بكمية مختلفة.',
      ref: 'Checklist (المطلوب)',
      act: 'UDS (المسجل)',
      labels: { none: 'غير مسجل على UDS', short: 'مسجل أقل من المطلوب', excess: 'مسجل أكثر من المطلوب', ok: 'مطابق', na: '—' },
    },
    'cl-gp': {
      name: 'Checklist مقابل Gate Pass',
      title: 'مقارنة Checklist (المطلوب) مع Gate Pass (المصروف)',
      desc: 'يبيّن ما وصل فعليًا إلى المستودع مقارنة بالمطلوب صرفه.',
      ref: 'Checklist (المطلوب)',
      act: 'Gate Pass (المصروف)',
      labels: { none: 'لم يُصرف', short: 'ناقص', excess: 'زائد', ok: 'مطابق', na: '—' },
    },
    'uds-gp': {
      name: 'UDS مقابل Gate Pass',
      title: 'مقارنة UDS (المسجل) مع Gate Pass (المصروف)',
      desc: 'يكشف ما سُجّل على النظام ولم يُصرف، أو صُرف ولم يُسجَّل.',
      ref: 'UDS (المسجل)',
      act: 'Gate Pass (المصروف)',
      labels: { none: 'مسجل ولم يُصرف', short: 'صُرف أقل من المسجل', excess: 'صُرف أكثر من المسجل', ok: 'مطابق', na: '—' },
    },
  };

  const descOf = (r) => r.desc || r.docDesc || '';

  function pairDef(R, id) {
    const p = PAIRS[id];
    return {
      id,
      name: p.name,
      title: p.title,
      desc: p.desc,
      rows: K.pairwise(R, id),
      columns: [
        { h: 'كود المادة', w: 16, kind: 'code', get: (r) => r.code },
        { h: 'الوصف', w: 54, kind: 'text', get: descOf },
        { h: 'الوحدة', w: 9, kind: 'text', get: (r) => r.unit },
        { h: p.ref, w: 18, kind: 'num', get: (r) => r.ref },
        { h: p.act, w: 18, kind: 'num', get: (r) => r.act },
        { h: 'الفرق', w: 11, kind: 'diff', get: (r) => r.diff },
        { h: 'الحالة', w: 22, kind: 'status', get: (r) => (r.ref == null && r.pairStatus === 'excess' ? 'غير مطلوب' : p.labels[r.pairStatus]), status: (r) => r.pairStatus },
      ],
    };
  }

  function shortageDef(R) {
    return {
      id: 'shortage',
      name: 'الناقص من Gate Pass',
      title: 'الأصناف الموجودة في Checklist أو UDS وغير مكتملة في Gate Pass',
      desc: 'كل صنف مطلوب أو مسجّل ولم يُصرف كاملًا. هذا هو تقرير المتابعة مع المستودع.',
      rows: K.shortage(R),
      columns: [
        { h: 'كود المادة', w: 16, kind: 'code', get: (r) => r.code },
        { h: 'الوصف', w: 54, kind: 'text', get: descOf },
        { h: 'الوحدة', w: 9, kind: 'text', get: (r) => r.unit },
        { h: 'Checklist', w: 12, kind: 'num', get: (r) => (r.hasCl ? r.cl : null) },
        { h: 'UDS', w: 12, kind: 'num', get: (r) => (r.hasUds ? r.uds : null) },
        { h: 'Gate Pass', w: 12, kind: 'num', get: (r) => r.gp },
        { h: 'الناقص', w: 12, kind: 'num', get: (r) => r.missingQty },
        { h: 'السبب', w: 26, kind: 'status', get: (r) => r.missingFrom, status: (r) => (r.gp <= 0 ? 'none' : 'short') },
        { h: 'أوامر العمل', w: 30, kind: 'text', get: (r) => r.workOrders.join('، ') },
      ],
    };
  }

  function ordersDef(R) {
    const rows = [];
    R.workOrders.forEach((w) => w.lines.forEach((l) => rows.push({ w, l })));
    return {
      id: 'orders',
      name: 'أوامر العمل',
      title: 'حالة صرف المواد لكل أمر عمل',
      desc: 'يربط بنود الـ Gate Pass بأمر العمل عبر رقم الحجز والمادة.',
      rows,
      columns: [
        { h: 'أمر العمل', w: 16, kind: 'code', get: (r) => r.w.wo || '' },
        { h: 'رمز النوع', w: 10, kind: 'code', get: (r) => r.w.type },
        { h: 'رقم الحجز', w: 16, kind: 'code', get: (r) => r.l.reservation },
        { h: 'كود المادة', w: 16, kind: 'code', get: (r) => r.l.code },
        { h: 'الوصف', w: 50, kind: 'text', get: (r) => r.l.desc },
        { h: 'المطلوب', w: 11, kind: 'num', get: (r) => r.l.required },
        { h: 'المصروف', w: 11, kind: 'num', get: (r) => r.l.issued },
        { h: 'الفرق', w: 10, kind: 'diff', get: (r) => K.r3(r.l.issued - r.l.required) },
        { h: 'حالة البند', w: 14, kind: 'status', get: (r) => MT.Compare.STATUS[r.l.status].label, status: (r) => r.l.status },
        { h: 'حالة الأمر', w: 14, kind: 'status', get: (r) => MT.Compare.STATUS[r.w.status].label, status: (r) => r.w.status },
      ],
    };
  }

  function summaryDef(R) {
    const d = Store.data;
    const c = R.counts;
    const done = R.workOrders.filter((w) => w.status === 'ok').length;
    const rows = [
      ['إجمالي الأصناف', c.total],
      ['مطابق', c.ok],
      ['ناقص', c.short],
      ['زائد', c.excess],
      ['لم يُصرف', c.none],
      ['أصناف يختلف فيها UDS عن Gate Pass', R.hasUds ? c.udsDiff : null],
      ['إجمالي الكميات المطلوبة (Checklist)', R.totals.cl],
      ['إجمالي الكميات المسجلة (UDS)', R.totals.uds],
      ['إجمالي الكميات المصروفة (Gate Pass)', R.totals.gp],
      ['عدد مستندات Gate Pass', R.gatePasses.length],
      ['عدد أوامر العمل', R.workOrders.filter((w) => w.wo).length],
      ['أوامر العمل المكتملة', done],
    ].map(([k, v]) => ({ k, v }));
    return {
      id: 'summary',
      name: 'ملخص',
      title: `ملخص مقارنة المواد، ${App.periodLabel()}`,
      desc: 'الأرقام الرئيسية للمشروع حسب الفترة المختارة في الشريط العلوي.',
      rows,
      columns: [
        { h: 'البند', w: 44, kind: 'text', get: (r) => r.k },
        { h: 'القيمة', w: 18, kind: 'num', get: (r) => r.v },
      ],
    };
  }

  /** قوائم المصادر الثلاثة كما حُفظت */
  function sourceDefs(data, R) {
    const resWo = R ? R.resWo : K.reservationMap(data.checklist);
    const info = (code, fb) => {
      const it = MT.Catalog.get(code);
      return { desc: (it && it.desc) || fb || '', unit: (it && it.unit) || '' };
    };
    const cl = {
      id: 'src-cl',
      name: 'قائمة Checklist',
      title: 'قائمة Checklist: المطلوب صرفه من شركة الكهرباء',
      rows: data.checklist.slice().sort((a, b) => a.code.localeCompare(b.code) || String(a.item_no).localeCompare(String(b.item_no))),
      columns: [
        { h: 'كود المادة', w: 16, kind: 'code', get: (r) => r.code },
        { h: 'الوصف (الكتالوج)', w: 50, kind: 'text', get: (r) => info(r.code, r.doc_desc).desc },
        { h: 'الوصف في المستند', w: 40, kind: 'text', get: (r) => r.doc_desc },
        { h: 'الوحدة', w: 9, kind: 'text', get: (r) => info(r.code).unit || r.uom },
        { h: 'الكمية المطلوبة', w: 16, kind: 'num', get: (r) => r.qty },
        { h: 'رقم الحجز', w: 16, kind: 'code', get: (r) => r.reservation },
        { h: 'البند', w: 9, kind: 'code', get: (r) => r.item_no },
        { h: 'رقم أمر العمل', w: 16, kind: 'code', get: (r) => r.work_order },
        { h: 'رمز النوع', w: 10, kind: 'code', get: (r) => r.wo_type },
        { h: 'نقطة التفريغ', w: 24, kind: 'code', get: (r) => r.unloading_point },
      ],
    };
    const uds = {
      id: 'src-uds',
      name: 'قائمة UDS',
      title: 'قائمة UDS: المسجّل على النظام',
      rows: data.uds.slice().sort((a, b) => a.code.localeCompare(b.code)),
      columns: [
        { h: 'كود المادة', w: 16, kind: 'code', get: (r) => r.code },
        { h: 'الوصف', w: 54, kind: 'text', get: (r) => info(r.code, r.doc_desc).desc },
        { h: 'الوحدة', w: 9, kind: 'text', get: (r) => info(r.code).unit },
        { h: 'الكمية المسجلة', w: 16, kind: 'num', get: (r) => r.qty },
        { h: 'رقم المرجع', w: 22, kind: 'code', get: (r) => r.reference },
        { h: 'رقم الحجز', w: 16, kind: 'code', get: (r) => r.reservation },
      ],
    };
    const gp = {
      id: 'src-gp',
      name: 'قائمة Gate Pass',
      title: 'قائمة Gate Pass: المصروف فعليًا من المستودع',
      rows: data.gatePasses.flatMap((p) => p.items.map((i) => ({ p, i }))).sort((a, b) => a.p.no.localeCompare(b.p.no) || a.i.code.localeCompare(b.i.code)),
      columns: [
        { h: 'رقم Gate Pass', w: 16, kind: 'code', get: (r) => r.p.no },
        { h: 'التاريخ', w: 13, kind: 'text', get: (r) => U.fmtDate(r.p.date) },
        { h: 'ERP Delivery', w: 14, kind: 'code', get: (r) => r.p.erp_delivery },
        { h: 'Material Doc', w: 14, kind: 'code', get: (r) => r.p.material_doc },
        { h: 'رقم السطر', w: 10, kind: 'code', get: (r) => r.i.line_no },
        { h: 'رقم الحجز', w: 16, kind: 'code', get: (r) => r.i.reservation },
        { h: 'أمر العمل', w: 14, kind: 'code', get: (r) => (resWo.get(r.i.reservation) || {}).wo || '' },
        { h: 'كود المادة', w: 16, kind: 'code', get: (r) => r.i.code },
        { h: 'الوصف', w: 50, kind: 'text', get: (r) => info(r.i.code, r.i.doc_desc).desc },
        { h: 'الوحدة', w: 9, kind: 'text', get: (r) => info(r.i.code).unit || r.i.uom },
        { h: 'الكمية المصروفة', w: 16, kind: 'num', get: (r) => r.i.qty },
      ],
    };
    return { checklist: cl, uds, gatepass: gp };
  }

  function defs(R) {
    return [summaryDef(R), pairDef(R, 'cl-uds'), pairDef(R, 'cl-gp'), pairDef(R, 'uds-gp'), shortageDef(R), ordersDef(R)];
  }

  const fileBase = () => 'Materials';

  async function exportAll(R, label) {
    try {
      UI.toast('جارٍ تجهيز ملف Excel...', { ms: 1800, type: 'info' });
      const s = sourceDefs(Store.data, R);
      const all = [...defs(R), s.checklist, s.uds, s.gatepass];
      await MT.Excel.save(all, `${fileBase()}-${label || 'Reports'}_${U.today()}`, { project: Store.project.name });
      UI.toast('تم تنزيل ملف Excel.');
    } catch (e) {
      UI.toast(e.message, { type: 'error', ms: 8000 });
    }
  }
  async function exportOne(def) {
    try {
      await MT.Excel.save([def], `${fileBase()}-${def.id}_${U.today()}`, { project: Store.project.name });
      UI.toast('تم تنزيل ملف Excel.');
    } catch (e) {
      UI.toast(e.message, { type: 'error', ms: 8000 });
    }
  }

  function renderCell(c, r) {
    const v = c.get(r);
    if (c.kind === 'code') return v ? UI.code(v) : '<span class="muted">—</span>';
    if (c.kind === 'num') return UI.num(v);
    if (c.kind === 'diff') return UI.diff(v);
    if (c.kind === 'status') return UI.badge(c.status(r), v);
    return `<span ${/^[\x00-\x7F]*$/.test(String(v || '')) && v ? 'dir="ltr"' : ''}>${esc(v == null || v === '' ? '—' : v)}</span>`;
  }

  let tab = 'summary';
  let tableCtl = null;

  const view = {
    title: 'التقارير',
    async render(root, ctx) {
      if (ctx.query.tab) tab = ctx.query.tab;
      draw(root);
    },
    onChange() {
      draw(document.getElementById('main'));
    },
  };

  function draw(root) {
    const R = App.result();
    const list = defs(R);
    const def = list.find((d) => d.id === tab) || list[0];
    tab = def.id;
    root.innerHTML = `<div class="page">
      <header class="page-head">
        <div><h1 class="h1">التقارير</h1><p class="lead">قارن المصادر الثلاثة، وصدّر الناقص إلى Excel لإرساله للمستودع.</p></div>
        <div class="page-actions no-print"><button class="btn btn-accent2" type="button" id="exp-all">${UI.icon('sheet', 20)}<span>نزّل كل التقارير Excel</span></button></div>
      </header>
      <div class="tabs no-print" role="tablist" aria-label="أنواع التقارير">${list.map((d) => `<button type="button" role="tab" class="tab" id="tab-${d.id}" aria-selected="${d.id === tab}" aria-controls="rep-panel" tabindex="${d.id === tab ? 0 : -1}" data-tab="${d.id}">${esc(d.name)}${d.id === 'shortage' ? `<span class="chip-n mono">${d.rows.length}</span>` : ''}</button>`).join('')}</div>
      <section class="card panel" id="rep-panel" role="tabpanel" aria-labelledby="tab-${def.id}">
        <div class="print-only print-head"><strong>${esc(Store.project.name)}</strong><span>${U.fmtDate(U.today())}، ${esc(App.periodLabel())}</span></div>
        <div class="panel-head"><div><h2 class="h3">${esc(def.title)}</h2><p class="muted">${esc(def.desc)}</p></div>
          <div class="panel-actions no-print"><button class="btn btn-sm" type="button" id="exp-one">${UI.icon('download', 16)}<span>Excel لهذا التقرير</span></button><button class="btn btn-sm" type="button" id="print">${UI.icon('printer', 16)}<span>اطبع أو احفظ PDF</span></button></div></div>
        <div id="rep-table"></div>
      </section>
    </div>`;

    tableCtl = UI.dataTable(root.querySelector('#rep-table'), {
      caption: def.title,
      rows: def.rows,
      pageSize: def.id === 'orders' || def.id === 'summary' ? 20 : 12,
      search: def.id !== 'summary',
      searchPlaceholder: 'ابحث في التقرير',
      searchText: (r) => def.columns.map((c) => c.get(r)).join(' '),
      empty: UI.empty({
        title: def.id === 'shortage' ? 'لا يوجد ناقص' : 'لا توجد بيانات لهذا التقرير',
        text: def.id === 'shortage' ? 'كل ما هو مطلوب أو مسجّل صُرف كاملًا في الـ Gate Pass.' : 'استورد القوائم المطلوبة أولًا ثم عد إلى هنا.',
      }),
      rowClass: (r) => (r.pairStatus ? `row-${r.pairStatus}` : r.l ? `row-${r.l.status}` : ''),
      columns: def.columns.map((c, i) => ({ key: 'c' + i, label: c.h, cls: c.kind === 'num' || c.kind === 'diff' ? 'num' : c.kind === 'text' && i === 1 ? 'col-desc' : '', sort: (r) => { const v = c.get(r); return v == null ? '' : v; }, render: (r) => renderCell(c, r) })),
    });

    root.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) {
        tab = b.dataset.tab;
        draw(root);
        root.querySelector(`#tab-${tab}`).focus();
      }
    });
    root.querySelector('.tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const ids = list.map((d) => d.id);
      let i = ids.indexOf(tab) + (e.key === 'ArrowLeft' ? 1 : -1);
      i = (i + ids.length) % ids.length;
      tab = ids[i];
      draw(root);
      root.querySelector(`#tab-${tab}`).focus();
    });
    root.querySelector('#exp-all').onclick = () => exportAll(R);
    root.querySelector('#exp-one').onclick = () => exportOne(def);
    root.querySelector('#print').onclick = () => window.print();
  }

  MT.Reports = { defs, sourceDefs, exportAll, exportOne, PAIRS };
  App.views.reports = view;
})(window);
