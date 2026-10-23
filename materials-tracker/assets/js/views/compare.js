/* شاشة المقارنة: ثلاثة مصادر لكل مادة، مع الفروقات بالألوان، وعرض حسب أمر العمل. */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const K = MT.Compare;
  const App = MT.App;
  const esc = U.esc;

  const st = { view: 'materials', status: 'all', q: '' };
  let table = null;
  let rootEl = null;

  const CHIPS = [
    { key: 'all', label: 'الكل', cls: '' },
    { key: 'ok', label: 'مطابق', cls: 'chip-ok' },
    { key: 'short', label: 'ناقص', cls: 'chip-short' },
    { key: 'excess', label: 'زائد', cls: 'chip-excess' },
    { key: 'none', label: 'لم يُصرف', cls: 'chip-none' },
    { key: 'uds', label: 'فرق UDS', cls: 'chip-uds', mat: true },
    { key: 'unknown', label: 'خارج الكتالوج', cls: 'chip-unknown', mat: true },
  ];

  const matchMat = (r, s) => s === 'all' || r.status === s || (s === 'uds' && r.udsDiff) || (s === 'unknown' && !r.inCatalog);
  const matchWo = (w, s) => s === 'all' || w.status === s;

  function descCell(r) {
    const docDiff = r.docDesc && r.desc && U.sim(r.docDesc, r.desc) < 0.75;
    return `<span class="desc" dir="ltr">${UI.descHtml(r.desc || r.docDesc || '—')}</span>${docDiff ? `<small class="doc-desc" dir="ltr" title="الوصف المكتوب في المستند يختلف عن الكتالوج">في المستند: ${UI.descHtml(r.docDesc)}</small>` : ''}${r.inCatalog ? '' : '<small class="doc-desc">خارج الكتالوج</small>'}`;
  }

  const view = {
    title: 'مقارنة المواد',

    async render(root, ctx) {
      rootEl = root;
      st.view = ctx.query.view === 'orders' ? 'orders' : 'materials';
      st.status = ctx.query.status || 'all';
      st.q = ctx.query.q || '';
      if (st.view === 'orders' && (st.status === 'uds' || st.status === 'unknown')) st.status = 'all';
      draw();
    },
    onChange() {
      draw();
    },
  };

  function draw() {
    const root = rootEl;
    const R = App.result();
    const orders = st.view === 'orders';
    const counts = orders
      ? { all: R.workOrders.length, ok: 0, short: 0, excess: 0, none: 0 }
      : { all: R.rows.length, ok: R.counts.ok, short: R.counts.short, excess: R.counts.excess, none: R.counts.none, uds: R.counts.udsDiff, unknown: R.counts.unknown };
    if (orders) R.workOrders.forEach((w) => counts[w.status]++);
    const chips = CHIPS.filter((c) => !orders || !c.mat)
      .map((c) => `<button type="button" class="chip ${c.cls}" data-status="${c.key}" aria-pressed="${st.status === c.key}">${esc(c.label)}<span class="chip-n mono" dir="ltr">${U.fmt(counts[c.key] || 0, 0)}</span></button>`)
      .join('');

    root.innerHTML = `<div class="page">
      <header class="page-head">
        <div><p class="eyebrow mono">03 · COMPARE</p><h1 class="h1">مقارنة المواد</h1>
        <p class="lead">${orders ? 'كل أمر عمل وما صُرف من بنوده، مربوطًا برقم الحجز.' : 'لكل مادة: المطلوب في Checklist، المسجّل في UDS، والمصروف في Gate Pass.'}</p></div>
        <div class="page-actions"><button class="btn btn-accent2" type="button" id="export-all">${UI.icon('sheet', 20)}<span>نزّل المقارنة Excel</span></button></div>
      </header>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="طريقة العرض">
          <button type="button" class="seg-btn" data-view="materials" aria-pressed="${!orders}">حسب المادة</button>
          <button type="button" class="seg-btn" data-view="orders" aria-pressed="${orders}">حسب أمر العمل</button>
        </div>
        <div class="chips" role="group" aria-label="تصفية حسب الحالة">${chips}</div>
      </div>
      <div class="card panel panel-flush" id="cmp-body"></div>
    </div>`;

    if (!R.rows.length) {
      root.querySelector('#cmp-body').innerHTML = UI.empty({
        title: 'لا توجد بيانات للمقارنة',
        text: 'استورد قائمة واحدة على الأقل. تظهر المقارنة بمجرد وجود مادة في أي قائمة.',
        action: '<a class="btn btn-primary" href="#/import/checklist">استورد الـ Checklist</a>',
      });
    } else if (orders) drawOrders(root.querySelector('#cmp-body'), R);
    else drawMaterials(root.querySelector('#cmp-body'), R);

    root.querySelector('.toolbar').addEventListener('click', (e) => {
      const v = e.target.closest('[data-view]');
      const s = e.target.closest('[data-status]');
      if (v) {
        st.view = v.dataset.view;
        if (st.view === 'orders' && (st.status === 'uds' || st.status === 'unknown')) st.status = 'all';
        draw();
        root.querySelector(`[data-view="${st.view}"]`).focus();
      } else if (s) {
        st.status = st.status === s.dataset.status && s.dataset.status !== 'all' ? 'all' : s.dataset.status;
        draw();
        const again = root.querySelector(`[data-status="${st.status}"]`);
        if (again) again.focus();
      }
    });
    root.querySelector('#export-all').onclick = () => MT.Reports.exportAll(R, 'Comparison');
  }

  function drawMaterials(host, R) {
    const rows = R.rows.filter((r) => matchMat(r, st.status));
    table = UI.dataTable(host, {
      caption: 'مقارنة المواد بين Checklist وUDS وGate Pass',
      rows,
      pageSize: 12,
      sortKey: 'code',
      sortDir: 'asc',
      search: true,
      searchPlaceholder: 'ابحث بالكود أو الوصف أو رقم الحجز أو أمر العمل',
      searchText: (r) => [r.code, r.desc, r.docDesc, r.reservations.join(' '), r.workOrders.join(' ')].join(' '),
      empty: UI.empty({ title: 'لا توجد أصناف في هذه التصفية', text: 'اختر «الكل» لرؤية كل الأصناف.' }),
      rowClass: (r) => `row-${r.status}`,
      rowAttrs: (r) => `data-code="${r.code}"`,
      columns: [
        { key: 'code', label: 'كود المادة', sort: (r) => r.code, render: (r) => UI.code(r.code) },
        { key: 'desc', label: 'الوصف', sort: (r) => r.desc, cls: 'col-desc', render: descCell },
        { key: 'unit', label: 'الوحدة', sort: (r) => r.unit, render: (r) => `<span class="mono">${esc(r.unit || '—')}</span>` },
        { key: 'cl', label: 'Checklist', sort: (r) => r.cl, cls: 'num', render: (r) => UI.num(r.hasCl ? r.cl : null) },
        { key: 'uds', label: 'UDS', sort: (r) => r.uds, cls: 'num', render: (r) => UI.num(r.hasUds ? r.uds : null) },
        { key: 'gp', label: 'Gate Pass', sort: (r) => r.gp, cls: 'num', render: (r) => UI.num(r.gp) },
        { key: 'd1', label: 'فرق الصرف', sort: (r) => (r.diffGpCl == null ? -1e9 : r.diffGpCl), cls: 'num', render: (r) => UI.diff(r.diffGpCl) },
        { key: 'd2', label: 'فرق UDS', sort: (r) => (r.diffGpUds == null ? -1e9 : r.diffGpUds), cls: 'num', render: (r) => UI.diff(r.diffGpUds == null ? null : -r.diffGpUds) },
        { key: 'status', label: 'الحالة', sort: (r) => r.status, render: (r) => UI.badge(r.status, r.unrequested ? 'غير مطلوب' : null) },
        { key: 'act', label: 'التفاصيل', render: (r) => `<button type="button" class="btn btn-sm" data-detail="${r.code}">${UI.icon('eye', 16)}<span>اعرض</span></button>` },
      ],
    });
    if (st.q) table.setQuery(st.q);
    UI.on(host, 'click', '[data-detail]', (e, el) => showDetail(R, el.dataset.detail));
    UI.on(host, 'click', 'tr[data-code]', (e, tr) => {
      if (!e.target.closest('button,a,input')) showDetail(R, tr.dataset.code);
    });
  }

  function showDetail(R, code) {
    const r = R.rows.find((x) => x.code === code);
    if (!r) return;
    const tbl = (title, head, rows, empty) =>
      `<section class="dlg-sec"><h3 class="h4">${title}</h3>${rows.length ? `<div class="table-wrap"><table class="table table-sm"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((x) => `<tr>${x.map((c, i) => `<td data-label="${esc(head[i])}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="muted">${empty}</p>`}</section>`;
    const m = (v) => `<span class="mono" dir="ltr">${esc(v || '—')}</span>`;
    const body = `<div class="detail-top">
        <div class="detail-num"><span class="k">Checklist</span>${UI.num(r.hasCl ? r.cl : null)}</div>
        <div class="detail-num"><span class="k">UDS</span>${UI.num(r.hasUds ? r.uds : null)}</div>
        <div class="detail-num"><span class="k">Gate Pass</span>${UI.num(r.gp)}</div>
        <div class="detail-num"><span class="k">الحالة</span>${UI.badge(r.status, r.unrequested ? 'غير مطلوب' : null)}</div>
      </div>
      <p class="detail-desc" dir="ltr">${UI.descHtml(r.desc || r.docDesc)}</p>
      ${r.docDesc && r.desc && U.sim(r.docDesc, r.desc) < 0.75 ? `<p class="muted" dir="ltr">الوصف في المستند: ${esc(r.docDesc)}</p>` : ''}
      <div class="detail-pairs">
        <span>Checklist ↔ UDS: ${UI.badge(r.clUds)}</span>
        <span>Checklist ↔ Gate Pass: ${UI.badge(r.status)}</span>
        <span>UDS ↔ Gate Pass: ${UI.badge(r.udsGp)}</span>
      </div>
      ${tbl('بنود Checklist', ['أمر العمل', 'الحجز', 'البند', 'الكمية'], r.clLines.map((l) => [m(l.work_order ? l.work_order + (l.wo_type ? '·' + l.wo_type : '') : ''), m(l.reservation), m(l.item_no), UI.num(l.qty)]), 'لا توجد بنود لهذه المادة في الـ Checklist.')}
      ${tbl('سجلات UDS', ['المرجع', 'الحجز', 'الكمية'], r.udsLines.map((l) => [m(l.reference), m(l.reservation), UI.num(l.qty)]), 'لا توجد سجلات لهذه المادة في UDS.')}
      ${tbl('بنود Gate Pass', ['Gate Pass', 'التاريخ', 'الحجز', 'أمر العمل', 'الكمية'], r.gpLines.map((l) => [m(l.gpNo), m(U.fmtDate(l.date)), m(l.reservation), m((R.resWo.get(l.reservation) || {}).wo), UI.num(l.qty)]), 'لم تُصرف هذه المادة في أي Gate Pass ضمن الفترة.')}`;
    UI.dialog({ title: `${r.code}`, body, size: 'lg', actions: [{ label: 'إغلاق', value: null }] });
  }

  function drawOrders(host, R) {
    const list = R.workOrders.filter((w) => matchWo(w, st.status)).filter((w) => {
      if (!st.q) return true;
      const hay = [w.wo, w.type, w.reservations.join(' '), w.lines.map((l) => l.code + ' ' + l.desc).join(' ')].join(' ').toLowerCase();
      return U.digits(st.q).toLowerCase().split(/\s+/).every((p) => hay.includes(p));
    });
    const q = `<div class="dt-tools"><label class="field field-search"><span class="sr-only">بحث في أوامر العمل</span>${UI.icon('search', 18)}<input type="search" class="input" id="wo-q" value="${esc(st.q)}" placeholder="ابحث برقم أمر العمل أو الحجز أو كود المادة" autocomplete="off"></label></div>`;
    if (!R.workOrders.length) {
      host.innerHTML = UI.empty({ title: 'لا توجد أوامر عمل', text: 'تُستخرج أوامر العمل من عمود Unloading Point في الـ Checklist. استورد صورة الـ Checklist أولًا.', action: '<a class="btn btn-primary" href="#/import/checklist">استورد الـ Checklist</a>' });
      return;
    }
    host.innerHTML = `${q}<div class="wo-grid">${
      list.length
        ? list
            .map(
              (w) => `<details class="wo-card wo-${w.status}" ${list.length <= 3 ? 'open' : ''}>
        <summary><span class="wo-main"><span class="wo-id mono" dir="ltr">${esc(w.wo || 'بدون أمر عمل')}</span>${w.type ? `<small class="mono">رمز ${esc(w.type)}</small>` : ''}<small class="mono" dir="ltr">حجز ${esc(w.reservations.join(' / ') || '—')}</small></span>
        ${UI.badge(w.status)}<span class="progress" role="img" aria-label="${w.pct}% مصروف"><span style="width:${w.pct}%"></span></span><span class="wo-qty mono" dir="ltr">${U.fmt(w.issued)} / ${U.fmt(w.required)}</span></summary>
        <div class="table-wrap"><table class="table table-sm"><thead><tr><th scope="col">كود المادة</th><th scope="col">الوصف</th><th scope="col">المطلوب</th><th scope="col">المصروف</th><th scope="col">الفرق</th><th scope="col">الحالة</th></tr></thead>
        <tbody>${w.lines.map((l) => `<tr class="row-${l.status}"><td data-label="كود المادة">${UI.code(l.code)}</td><td data-label="الوصف" class="col-desc"><span class="desc" dir="ltr">${UI.descHtml(l.desc || '—')}</span>${l.item_no ? `<small class="doc-desc mono">بند ${esc(l.item_no)}</small>` : ''}</td><td data-label="المطلوب" class="num">${UI.num(l.required)}</td><td data-label="المصروف" class="num">${UI.num(l.issued)}</td><td data-label="الفرق" class="num">${UI.diff(K.r3(l.issued - l.required))}</td><td data-label="الحالة">${UI.badge(l.status, l.extra ? 'غير مطلوب' : null)}</td></tr>`).join('')}</tbody></table></div></details>`
            )
            .join('')
        : UI.empty({ title: 'لا توجد أوامر عمل في هذه التصفية' })
    }</div>`;
    const inp = host.querySelector('#wo-q');
    inp.addEventListener('input', U.debounce(() => {
      st.q = inp.value;
      const pos = inp.selectionStart;
      drawOrders(host, R);
      const again = host.querySelector('#wo-q');
      again.focus();
      again.setSelectionRange(pos, pos);
    }, 250));
  }

  App.views.compare = view;
})(window);
