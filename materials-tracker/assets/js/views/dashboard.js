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
    return `<span class="delta delta-${tone}"><span aria-hidden="true">${d > 0 ? '▲' : d < 0 ? '▼' : '■'}</span><span class="mono" dir="ltr">${U.signed(d)}</span><small>${esc(label)}</small></span>`;
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
      const clQty = U.sum(d.checklist, (x) => x.qty);
      const udsQty = U.sum(d.uds, (x) => x.qty);
      const gpCount = R.gatePasses.length;
      const gpQty = U.sum(R.gatePasses, (p) => U.sum(p.items, (i) => i.qty));
      const empty = !d.checklist.length && !d.uds.length && !d.gatePasses.length;
      const pct = c.total ? Math.round((c.ok / c.total) * 100) : 0;
      const hasPrev = P.counts.total > 0;
      const href = (s) => `#/compare?status=${s}`;

      const heroEmpty = `<section class="card hero hero-empty">
          <div><p class="eyebrow mono">START</p><h2 class="h2">ابدأ بصورة الـ Checklist.</h2>
          <p class="lead">ارفع القوائم الثلاث بالترتيب. بعد كل رفع تظهر الأرقام هنا.</p></div>
          <div class="hero-cta">
            <a class="btn btn-primary" href="#/import/checklist">${UI.icon('camera', 20)}<span>صوّر الـ Checklist</span></a>
            <a class="btn" href="#/import/uds">${UI.icon('upload', 20)}<span>استورد UDS</span></a>
            <a class="btn" href="#/import/gatepass">${UI.icon('upload', 20)}<span>استورد Gate Pass</span></a>
          </div></section>`;

      const hero = `<section class="hero" aria-label="ملخص المشروع">
          <div class="card hero-total">
            <p class="eyebrow mono">TOTAL ITEMS</p>
            <p class="big mono" dir="ltr">${U.fmt(c.total, 0)}</p>
            <p class="hero-label">إجمالي الأصناف</p>
            ${MT.Charts.stack(KPIS.map((k) => ({ key: k.key, value: c[k.key], label: k.label })))}
            <p class="hero-note">${c.total ? `<strong class="mono" dir="ltr">${pct}%</strong> من الأصناف مطابقة للمطلوب.` : 'لا توجد أصناف ضمن هذه الفترة.'}</p>
          </div>
          <div class="hero-sources">
            <a class="card src-card src-cl" href="#/import/checklist"><span class="src-k">Checklist</span><strong class="mono" dir="ltr">${U.fmt(d.checklist.length, 0)}</strong><small>بند · ${U.fmt(clQty)} قطعة مطلوبة</small></a>
            <a class="card src-card src-uds" href="#/import/uds"><span class="src-k">UDS</span><strong class="mono" dir="ltr">${U.fmt(d.uds.length, 0)}</strong><small>بند · ${U.fmt(udsQty)} قطعة مسجلة</small></a>
            <a class="card src-card src-gp" href="#/import/gatepass"><span class="src-k">Gate Pass</span><strong class="mono" dir="ltr">${U.fmt(gpCount, 0)}</strong><small>مستند · ${U.fmt(gpQty)} قطعة مصروفة</small></a>
          </div>
        </section>`;

      const kpis = `<section class="kpis" aria-label="مؤشرات الحالة">${KPIS.map(
        (k) => `<a class="card kpi kpi-${k.key}" href="${href(k.key)}">
            <span class="kpi-bar" aria-hidden="true"></span>
            <span class="kpi-label">${UI.badge(k.key)}</span>
            <span class="kpi-n mono" dir="ltr">${U.fmt(c[k.key], 0)}</span>
            ${delta(c[k.key], P.counts[k.key], k.goodUp, prevInfo.label, hasPrev)}
            <span class="kpi-note">${k.note}</span>
            <span class="kpi-go">اعرض الأصناف ${UI.icon('prev', 16)}</span>
          </a>`
      ).join('')}</section>`;

      const udsLine = R.hasUds
        ? `<a class="chip-link" href="${href('uds')}"><strong class="mono" dir="ltr">${c.udsDiff}</strong> صنف يختلف فيه UDS عن الـ Gate Pass</a>`
        : `<span class="muted">لم تُستورد قائمة UDS بعد.</span>`;

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
            <p class="eyebrow mono">02 · DASHBOARD${App.period.preset !== 'all' ? ' · ' + esc(App.periodLabel()) : ''}</p>
            <h1 class="h1">${esc(Store.project.name)}</h1>
            <p class="lead">${empty ? 'المشروع فارغ. ابدأ برفع الـ Checklist.' : 'قارن المطلوب بالمسجل بالمصروف، وانتقل إلى أي صنف بنقرة.'}</p>
          </div>
          <div class="page-actions">
            <a class="btn btn-primary" href="#/import/checklist">${UI.icon('upload', 20)}<span>استورد قائمة</span></a>
            <a class="btn btn-accent2" href="#/reports">${UI.icon('report', 20)}<span>افتح التقارير</span></a>
          </div>
        </header>

        <div class="section">${empty ? heroEmpty : hero}</div>
        <div class="section">${kpis}<p class="kpis-foot">${udsLine}</p></div>

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
