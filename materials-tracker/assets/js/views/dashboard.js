/* شاشة 3: لوحة المتابعة. الحالة في نظرة واحدة والتفاصيل بنقرتين. */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const K = MT.Compare;
  const App = MT.App;
  const esc = U.esc;

  const KPIS = [
    { key: 'ok', label: 'مطابق', note: 'المصروف يساوي المطلوب', goodUp: true },
    { key: 'short', label: 'ناقص', note: 'مصروف أقل من المطلوب', goodUp: false },
    { key: 'excess', label: 'زائد', note: 'مصروف أكثر من المطلوب أو غير مطلوب', goodUp: false },
    { key: 'none', label: 'لم يُصرف', note: 'مطلوب ولم يُصرف شيء', goodUp: false },
  ];

  function delta(cur, prev, goodUp, label, hasPrev) {
    if (!hasPrev) return '<span class="delta delta-na">لا توجد فترة سابقة للمقارنة</span>';
    const d = cur - prev;
    const tone = d === 0 ? 'flat' : d > 0 === goodUp ? 'good' : 'bad';
    return `<span class="delta delta-${tone}"><span aria-hidden="true">${d > 0 ? '▲' : d < 0 ? '▼' : '='}</span><span class="mono" dir="ltr">${U.signed(d)}</span><small>${esc(label)}</small></span>`;
  }

  let table = null;
  let lastR = null;

  const view = {
    title: 'لوحة المتابعة',

    async render(root) {
      const R = App.result();
      lastR = R;
      const P = K.build(Store.data, K.previousWindow(App.window()));
      const prevInfo = K.previousWindow(App.window());
      const c = R.counts;
      const d = Store.data;
      // القطع تُجمع معًا، والأمتار والكيلومترات منفصلة حتى لا يتضخم رقم القطع
      const clQty = R.unitTotals.PCS.cl;
      const udsQty = R.unitTotals.PCS.uds;
      const gpCount = R.gatePasses.length;
      const gpQty = R.unitTotals.PCS.gp;
      const more = (field) => {
        const ex = K.unitSplit(R.unitTotals, field).slice(1).map((p) => `${U.fmt(p.value)} ${p.label}`).join(' و ');
        return ex ? `، و ${esc(ex)}` : '';
      };
      const empty = !d.checklist.length && !d.uds.length && !d.gatePasses.length;
      const pct = c.total ? Math.round((c.ok / c.total) * 100) : 0;
      const hasPrev = P.counts.total > 0;
      const href = (s) => `#/compare?status=${s}`;

      const needs = c.short + c.excess + c.none;
      const gap1 = K.r3(udsQty - clQty);
      const gap2 = K.r3(gpQty - udsQty);
      const pipe = (g, n, label) =>
        `<div class="pipe pipe-${n}"><span class="pipe-pill ${g < 0 ? 'pipe-neg' : g > 0 ? 'pipe-pos' : 'pipe-zero'}"><span class="sr-only">${label}: </span>${g === 0 ? 'متطابقة' : `<span dir="ltr">${U.signed(g)}</span>`}</span></div>`;

      const heroEmpty = `<section class="hero-empty" aria-label="ابدأ من هنا">
          <div><h2 class="h2">ابدأ بصورة الـ Checklist.</h2>
          <p class="lead">ارفع القوائم الثلاث بالترتيب. بعد كل رفع تظهر الأرقام هنا.</p></div>
          <div class="hero-cta">
            <a class="btn btn-primary" href="#/import/checklist">${UI.icon('camera', 20)}<span>صوّر الـ Checklist</span></a>
            <a class="btn" href="#/import/uds">${UI.icon('upload', 20)}<span>استورد UDS</span></a>
            <a class="btn" href="#/import/gatepass">${UI.icon('upload', 20)}<span>استورد Gate Pass</span></a>
          </div></section>`;

      const hero = `<section class="flow" aria-labelledby="flow-h">
          <div class="flow-head">
            <div>
              <h2 id="flow-h" class="flow-title">${c.total ? (needs ? `${needs} من ${c.total} أصناف تحتاج متابعة` : 'كل الأصناف مطابقة للمطلوب') : 'لا توجد أصناف ضمن هذه الفترة'}</h2>
              <p class="flow-sub">أرقام مشروع «${esc(Store.project.name)}» وحده. المطلوب ثم المسجّل ثم المصروف فعليًا، والأنبوب بين كل مرحلتين يبيّن الفرق في القطع. <a class="chip-link" href="#/totals">الإجمالي لكل المشاريع</a></p>
            </div>
          </div>
          <div class="flow-track">
            <a class="node node-cl" href="#/import/checklist"><span class="node-k">Checklist</span><strong class="node-n figure" dir="ltr">${U.fmt(clQty)}</strong><small>قطعة مطلوبة في ${U.fmt(d.checklist.length, 0)} بندًا${more('cl')}</small></a>
            ${pipe(gap1, 1, 'فرق UDS عن Checklist')}
            <a class="node node-uds" href="#/import/uds"><span class="node-k">UDS</span><strong class="node-n figure" dir="ltr">${U.fmt(udsQty)}</strong><small>قطعة مسجلة في ${U.fmt(d.uds.length, 0)} بندًا${more('uds')}</small></a>
            ${pipe(gap2, 2, 'فرق Gate Pass عن UDS')}
            <a class="node node-gp" href="#/import/gatepass"><span class="node-k">Gate Pass</span><strong class="node-n figure" dir="ltr">${U.fmt(gpQty)}</strong><small>قطعة مصروفة في ${U.fmt(gpCount, 0)} مستندًا${more('gp')}</small></a>
          </div>
          <div class="flow-foot">
            ${MT.Charts.stack(KPIS.map((k) => ({ key: k.key, value: c[k.key], label: k.label })))}
            <p class="flow-foot-line"><span>${c.total ? `${pct}% من ${U.fmt(c.total, 0)} صنفًا مطابقة للمطلوب` : 'لا توجد أصناف'}</span>${R.hasUds ? (c.udsDiff ? `<a class="chip-link" href="${href('uds')}">${c.udsDiff} أصناف يختلف فيها UDS عن Gate Pass</a>` : '<span>UDS يطابق Gate Pass في كل الأصناف</span>') : '<span>لم تُستورد قائمة UDS بعد</span>'}</p>
          </div>
        </section>`;

      const kpis = `<section class="kpis" aria-label="مؤشرات الحالة">${KPIS.map(
        (k) => `<a class="card kpi kpi-${k.key}" href="${href(k.key)}">
            <span class="kpi-bar" aria-hidden="true"></span>
            <span class="kpi-label">${UI.badge(k.key)}</span>
            <span class="kpi-n figure" dir="ltr">${U.fmt(c[k.key], 0)}</span>
            ${delta(c[k.key], P.counts[k.key], k.goodUp, prevInfo.label, hasPrev)}
            <span class="kpi-note">${k.note}</span>
            <span class="kpi-go">اعرض الأصناف ${UI.icon('prev', 16)}</span>
          </a>`
      ).join('')}</section>`;

      const wos = R.workOrders.filter((w) => w.status !== 'ok').slice(0, 5);
      const woPanel = `<section class="card panel" aria-labelledby="wo-h">
          <div class="panel-head"><h2 id="wo-h" class="h3">أوامر العمل غير المكتملة</h2><a class="link" href="#/compare?view=orders">كل أوامر العمل</a></div>
          ${R.workOrders.length
            ? wos.length
              ? `<ul class="wo-list">${wos.map((w) => `<li class="wo-item"><a href="#/compare?view=orders&q=${encodeURIComponent(w.wo || w.reservations[0] || '')}"><span class="wo-id mono" dir="ltr">${esc(w.wo || 'حجز ' + (w.reservations[0] || '؟'))}</span>${UI.badge(w.status)}<span class="progress" role="img" aria-label="${w.pct}% مصروف"><span style="width:${w.pct}%"></span></span><span class="wo-qty mono" dir="ltr">${U.fmt(w.issued)}/${U.fmt(w.required)}</span></a></li>`).join('')}</ul>`
              : UI.empty({ title: 'كل أوامر العمل مكتملة', text: 'كل بنود الـ Checklist صُرفت كاملة.' })
            : UI.empty({ title: 'لا توجد أوامر عمل بعد', text: 'تظهر أوامر العمل من عمود Unloading Point في صورة الـ Checklist.' })}
        </section>`;

      root.innerHTML = `<div class="page">
        <header class="page-head">
          <div>
            <p class="context-chip">${esc(Store.project.region || 'نجران')}${Store.project.contractor ? '، ' + esc(Store.project.contractor) : ''}${App.period.preset !== 'all' ? '، ' + esc(App.periodLabel()) : ''}</p>
            <h1 class="h1">${esc(Store.project.name)}</h1>
            <p class="lead">${empty ? 'المشروع فارغ. ابدأ برفع الـ Checklist.' : 'اضغط أي بطاقة لترى أصنافها وتفاصيلها.'}</p>
          </div>
          <div class="page-actions">
            <a class="btn btn-primary" href="#/import/checklist">${UI.icon('upload', 20)}<span>استورد قائمة</span></a>
            <a class="btn btn-accent2" href="#/reports">${UI.icon('report', 20)}<span>افتح التقارير</span></a>
          </div>
        </header>

        <div class="section">${empty ? heroEmpty : hero}</div>
        <div class="section">${kpis}</div>

        <div class="section charts">
          <section class="card panel" aria-labelledby="tr-h"><div class="panel-head"><h2 id="tr-h" class="h3">اتجاه الصرف</h2><span class="muted mono">${esc(App.periodLabel())}</span></div><div id="trend" class="chart-host"></div></section>
          <section class="card panel" aria-labelledby="dn-h"><div class="panel-head"><h2 id="dn-h" class="h3">توزيع الأصناف</h2></div><div id="donut" class="chart-host donut-host"></div></section>
        </div>

        <div class="section">${woPanel}</div>

        <div class="section">
          <section class="card panel" aria-labelledby="ops-h">
            <div class="panel-head"><h2 id="ops-h" class="h3">أحدث العمليات</h2></div>
            <div id="ops"></div>
          </section>
        </div>
      </div>`;

      drawCharts(R);
      drawOps(root);
    },

    onResize() {
      if (lastR) drawTrend(lastR);
    },
    onChange() {
      view.render(document.getElementById('main'));
    },
  };

  function drawTrend(R) {
    const host = document.getElementById('trend');
    if (!host) return;
    const t = K.trend(Store.data, App.window());
    if (!t.days.length) {
      host.innerHTML = UI.empty({ title: 'لا توجد عمليات صرف في هذه الفترة', text: 'استورد صورة Gate Pass لتظهر هنا الكميات المصروفة يومًا بيوم.', action: '<a class="btn btn-sm" href="#/import/gatepass">استورد Gate Pass</a>' });
      return;
    }
    MT.Charts.trend(host, t);
  }

  function drawCharts(R) {
    drawTrend(R);
    const c = R.counts;
    MT.Charts.donut(
      document.getElementById('donut'),
      KPIS.map((k) => ({ key: k.key, label: k.label, value: c[k.key], href: `#/compare?status=${k.key}` })),
      { total: c.total }
    );
  }

  function drawOps(root) {
    const host = root.querySelector('#ops');
    const rows = Store.data.activity.map((a) => ({ ...a }));
    table = UI.dataTable(host, {
      caption: 'أحدث العمليات على المشروع',
      rows,
      pageSize: 6,
      sortKey: 'at',
      sortDir: 'desc',
      search: true,
      searchPlaceholder: 'ابحث في العمليات',
      searchText: (r) => [UI.kindLabel(r.kind), r.ref, r.note, r.user].join(' '),
      filters: [{ key: 'kind', label: 'المصدر', get: (r) => r.kind, options: [{ value: 'checklist', label: 'Checklist' }, { value: 'uds', label: 'UDS' }, { value: 'gatepass', label: 'Gate Pass' }] }],
      empty: UI.empty({ title: 'لا توجد عمليات بعد', text: 'كل استيراد أو حذف يظهر هنا مع اسم من نفّذه.' }),
      columns: [
        { key: 'at', label: 'التاريخ', sort: (r) => r.at, render: (r) => `<span class="mono" dir="ltr">${U.fmtDateTime(r.at)}</span>` },
        { key: 'kind', label: 'المصدر', sort: (r) => r.kind, render: (r) => UI.srcBadge(r.kind) },
        { key: 'ref', label: 'المرجع', sort: (r) => r.ref, render: (r) => `<span class="mono" dir="ltr">${esc(r.ref || '—')}</span>` },
        { key: 'count', label: 'البنود', sort: (r) => r.count, cls: 'num', render: (r) => `<span class="mono" dir="ltr">${U.fmt(r.count, 0)}</span>` },
        { key: 'note', label: 'التفاصيل', render: (r) => esc(r.note || '—') },
        { key: 'user', label: 'المستخدم', sort: (r) => r.user, render: (r) => esc(r.user || '—') },
        { key: 'image', label: 'المستند', render: (r) => (r.image ? `<button type="button" class="btn btn-sm" data-img="${esc(r.image)}">${UI.icon('image', 16)}<span>اعرض</span></button>` : '<span class="muted">—</span>') },
      ],
    });
    UI.on(host, 'click', '[data-img]', (e, el) => MT.Views.showImage(el.dataset.img));
  }

  /** نافذة عرض صورة مستند محفوظة */
  MT.Views = MT.Views || {};
  MT.Views.showImage = async (ref) => {
    let url = null;
    try {
      url = await Store.imageUrl(ref);
    } catch (e) {
      /* نعرض رسالة */
    }
    await UI.dialog({
      title: 'صورة المستند',
      size: 'lg',
      body: url ? `<img class="doc-img" loading="lazy" decoding="async" src="${url}" alt="صورة المستند الأصلي">` : UI.empty({ title: 'الصورة غير متاحة', text: 'قد تكون حُذفت أو لم تُحفظ على هذا الجهاز.' }),
      actions: [{ label: 'إغلاق', value: null }],
    });
  };

  App.views.dashboard = view;
})(window);
