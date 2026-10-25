/* الإجمالي: كل مشروع محسوب وحده، وهنا مجموعها في صفحة مستقلة.
   لا تدخل بيانات مشروع في حسابات مشروع آخر. هذه الصفحة تقرأ المشاريع كما هي وتجمع الناتج فقط. */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const C = MT.Catalog;
  const K = MT.Compare;
  const App = MT.App;
  const esc = U.esc;

  const SEL_KEY = 'mt:totals-sel';
  let loaded = [];
  let sel = new Set();
  let rootEl = null;
  let cache = null;

  const readSel = () => {
    try {
      return JSON.parse(g.localStorage.getItem(SEL_KEY) || 'null');
    } catch (e) {
      return null;
    }
  };
  const saveSel = () => {
    try {
      g.localStorage.setItem(SEL_KEY, JSON.stringify([...sel]));
    } catch (e) {
      /* اختياري */
    }
  };

  /** حساب كل مشروع على حدة ثم الجمع. */
  function compute() {
    const items = loaded.filter((x) => sel.has(x.project.id)).map((x) => ({ project: x.project, R: K.build(x.data, App.window()) }));
    const units = K.emptyUnits();
    const counts = { total: 0, ok: 0, short: 0, excess: 0, none: 0 };
    let docs = 0;
    let clItems = 0;
    let udsItems = 0;
    const mats = new Map();
    for (const it of items) {
      K.addUnits(units, it.R.unitTotals);
      Object.keys(counts).forEach((k) => (counts[k] += it.R.counts[k] || 0));
      docs += it.R.gatePasses.length;
      const d = loaded.find((x) => x.project.id === it.project.id).data;
      clItems += d.checklist.length;
      udsItems += d.uds.length;
      for (const r of it.R.rows) {
        let m = mats.get(r.code);
        if (!m) {
          m = { code: r.code, desc: C.describe(r.code) || r.docDesc || '', unit: r.unit || '', cl: 0, uds: 0, gp: 0, hasCl: false, hasUds: false, projects: new Set() };
          mats.set(r.code, m);
        }
        m.cl = K.r3(m.cl + r.cl);
        m.uds = K.r3(m.uds + r.uds);
        m.gp = K.r3(m.gp + r.gp);
        m.hasCl = m.hasCl || r.hasCl;
        m.hasUds = m.hasUds || r.hasUds;
        m.projects.add(it.project.id);
      }
    }
    const materials = [...mats.values()].map((m) => {
      const base = m.hasCl ? m.cl : m.hasUds ? m.uds : null;
      return { ...m, base, status: K.relate(base, m.gp), diff: base == null ? null : K.r3(m.gp - base), nProjects: m.projects.size };
    });
    materials.sort((a, b) => a.code.localeCompare(b.code));
    return { items, units, counts, docs, clItems, udsItems, materials };
  }

  const qtyCell = (units, field) => {
    const parts = K.unitSplit(units, field);
    const main = `<span class="mono" dir="ltr">${U.fmt(parts[0].value)}</span>`;
    const extra = parts
      .slice(1)
      .map((p) => `<small class="muted tt-extra">و ${U.fmt(p.value)} ${esc(p.label)}</small>`)
      .join('');
    return main + extra;
  };
  const extraText = (units, field) =>
    K.unitSplit(units, field)
      .slice(1)
      .map((p) => `${U.fmt(p.value)} ${p.label}`)
      .join(' و ');

  const pcsGap = (units, a, b) => K.r3(units.PCS[a] - units.PCS[b]);

  function counters(c) {
    const parts = [];
    if (c.short) parts.push(`<span class="badge badge-short"><span class="badge-glyph" aria-hidden="true">▼</span>${c.short} ناقص</span>`);
    if (c.excess) parts.push(`<span class="badge badge-excess"><span class="badge-glyph" aria-hidden="true">▲</span>${c.excess} زائد</span>`);
    if (c.none) parts.push(`<span class="badge badge-none"><span class="badge-glyph" aria-hidden="true">●</span>${c.none} لم يُصرف</span>`);
    if (!parts.length) parts.push(c.total ? '<span class="badge badge-ok"><span class="badge-glyph" aria-hidden="true">✓</span>كله مطابق</span>' : '<span class="muted">لا أصناف</span>');
    return `<span class="tt-badges">${parts.join('')}</span>`;
  }

  function flow(T) {
    const needs = T.counts.short + T.counts.excess + T.counts.none;
    const cl = T.units.PCS.cl;
    const uds = T.units.PCS.uds;
    const gp = T.units.PCS.gp;
    const pipe = (v, n, label) => `<div class="pipe pipe-${n}"><span class="pipe-pill ${v < 0 ? 'pipe-neg' : v > 0 ? 'pipe-pos' : 'pipe-zero'}"><span class="sr-only">${label}: </span>${v === 0 ? 'متطابقة' : `<span dir="ltr">${U.signed(v)}</span>`}</span></div>`;
    const node = (cls, name, units, field, what, n, unit2) => {
      const ex = extraText(units, field);
      return `<div class="node node-static ${cls}"><span class="node-k">${name}</span><strong class="node-n figure" dir="ltr">${U.fmt(units.PCS[field])}</strong><small>${what} في ${U.fmt(n, 0)} ${unit2}${ex ? `، و ${esc(ex)}` : ''}</small></div>`;
    };
    return `<section class="flow" aria-labelledby="tt-flow-h">
        <div class="flow-head"><div>
          <h2 id="tt-flow-h" class="flow-title">${T.items.length ? `${U.fmt(T.items.length, 0)} ${T.items.length === 1 ? 'مشروع' : 'مشاريع'}، ${T.counts.total ? (needs ? `${needs} من ${T.counts.total} أصناف تحتاج متابعة` : 'كل الأصناف مطابقة') : 'لا أصناف بعد'}` : 'اختر مشروعًا واحدًا على الأقل'}</h2>
          <p class="flow-sub">مجموع المشاريع المختارة. تُجمع القطع معًا، والأمتار والكيلومترات تظهر منفصلة.</p>
        </div></div>
        <div class="flow-track">
          ${node('node-cl', 'Checklist', T.units, 'cl', 'قطعة مطلوبة', T.clItems, 'بندًا')}
          ${pipe(K.r3(uds - cl), 1, 'فرق UDS عن Checklist')}
          ${node('node-uds', 'UDS', T.units, 'uds', 'قطعة مسجلة', T.udsItems, 'بندًا')}
          ${pipe(K.r3(gp - uds), 2, 'فرق Gate Pass عن UDS')}
          ${node('node-gp', 'Gate Pass', T.units, 'gp', 'قطعة مصروفة', T.docs, 'مستندًا')}
        </div>
      </section>`;
  }

  function projectsTable(T) {
    const rows = T.items
      .map((it) => {
        const u = it.R.unitTotals;
        const gap = pcsGap(u, 'gp', 'cl');
        const d = it.R.hasCl ? UI.diff(gap) : '<span class="muted">—</span>';
        return `<tr>
          <th scope="row" data-label="المشروع" class="tt-name"><strong>${esc(it.project.name)}</strong><small class="muted">${esc([it.project.region, it.project.contractor].filter(Boolean).join('، '))}</small></th>
          <td data-label="Checklist" class="num">${qtyCell(u, 'cl')}</td>
          <td data-label="UDS" class="num">${qtyCell(u, 'uds')}</td>
          <td data-label="Gate Pass" class="num">${qtyCell(u, 'gp')}<small class="muted tt-extra">${U.fmt(it.R.gatePasses.length, 0)} مستندًا</small></td>
          <td data-label="الفرق عن المطلوب" class="num">${d}</td>
          <td data-label="الأصناف">${counters(it.R.counts)}</td>
          <td data-label="فتح" class="no-print"><button type="button" class="btn btn-sm" data-open="${esc(it.project.id)}">افتح المشروع</button></td>
        </tr>`;
      })
      .join('');
    const foot = `<tr class="tt-total">
        <th scope="row" data-label="المشروع">الإجمالي</th>
        <td data-label="Checklist" class="num">${qtyCell(T.units, 'cl')}</td>
        <td data-label="UDS" class="num">${qtyCell(T.units, 'uds')}</td>
        <td data-label="Gate Pass" class="num">${qtyCell(T.units, 'gp')}<small class="muted tt-extra">${U.fmt(T.docs, 0)} مستندًا</small></td>
        <td data-label="الفرق عن المطلوب" class="num">${T.clItems ? UI.diff(pcsGap(T.units, 'gp', 'cl')) : '<span class="muted">—</span>'}</td>
        <td data-label="الأصناف">${counters(T.counts)}</td>
        <td class="no-print"></td>
      </tr>`;
    return `<div class="table-wrap"><table class="table tt-table"><caption class="sr-only">كل مشروع وحده ثم الإجمالي</caption>
      <thead><tr><th scope="col">المشروع</th><th scope="col">Checklist</th><th scope="col">UDS</th><th scope="col">Gate Pass</th><th scope="col">الفرق عن المطلوب</th><th scope="col">الأصناف</th><th scope="col" class="no-print"><span class="sr-only">فتح</span></th></tr></thead>
      <tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>`;
  }

  function materialsTable(host, T) {
    UI.dataTable(host, {
      caption: 'إجمالي كل مادة في المشاريع المختارة',
      rows: T.materials,
      pageSize: 12,
      sortKey: 'code',
      sortDir: 'asc',
      search: true,
      searchPlaceholder: 'ابحث بالكود أو الوصف',
      searchText: (r) => [r.code, r.desc].join(' '),
      filters: [{ key: 'st', label: 'الحالة', get: (r) => r.status, options: ['short', 'excess', 'none', 'ok'].map((k) => ({ value: k, label: K.STATUS[k].label })) }],
      empty: UI.empty({ title: 'لا توجد أصناف في المشاريع المختارة' }),
      columns: [
        { key: 'code', label: 'كود SEC', sort: (r) => r.code, render: (r) => UI.code(r.code) },
        { key: 'desc', label: 'الوصف', sort: (r) => r.desc, cls: 'col-desc', render: (r) => `<span class="desc" dir="ltr">${UI.descHtml(r.desc || '—')}</span>${r.unit ? `<small class="muted mono">${esc(r.unit)}</small>` : ''}` },
        { key: 'cl', label: 'Checklist', sort: (r) => r.cl, cls: 'num', render: (r) => (r.hasCl ? UI.num(r.cl) : UI.num(null)) },
        { key: 'uds', label: 'UDS', sort: (r) => r.uds, cls: 'num', render: (r) => (r.hasUds ? UI.num(r.uds) : UI.num(null)) },
        { key: 'gp', label: 'Gate Pass', sort: (r) => r.gp, cls: 'num', render: (r) => UI.num(r.gp) },
        { key: 'diff', label: 'الفرق', sort: (r) => (r.diff == null ? -1e9 : r.diff), cls: 'num', render: (r) => UI.diff(r.diff) },
        { key: 'status', label: 'الحالة', sort: (r) => r.status, render: (r) => UI.badge(r.status, r.base == null && r.status === 'excess' ? 'غير مطلوب' : null) },
        { key: 'np', label: 'المشاريع', sort: (r) => r.nProjects, cls: 'num', render: (r) => `<span class="mono">${r.nProjects}</span>` },
      ],
    });
  }

  function excelDefs(T) {
    const projRows = T.items.map((it) => ({ name: it.project.name, region: it.project.region, u: it.R.unitTotals, docs: it.R.gatePasses.length, c: it.R.counts, hasCl: it.R.hasCl }));
    projRows.push({ name: 'الإجمالي', region: '', u: T.units, docs: T.docs, c: T.counts, hasCl: T.clItems > 0 });
    return [
      {
        name: 'المشاريع',
        title: 'كل مشروع وحده ثم الإجمالي',
        rows: projRows,
        columns: [
          { h: 'المشروع', w: 30, kind: 'text', get: (r) => r.name },
          { h: 'المنطقة', w: 14, kind: 'text', get: (r) => r.region },
          { h: 'Checklist (قطعة)', w: 16, kind: 'num', get: (r) => r.u.PCS.cl },
          { h: 'UDS (قطعة)', w: 14, kind: 'num', get: (r) => r.u.PCS.uds },
          { h: 'Gate Pass (قطعة)', w: 16, kind: 'num', get: (r) => r.u.PCS.gp },
          { h: 'الفرق عن المطلوب', w: 16, kind: 'diff', get: (r) => (r.hasCl ? pcsGap(r.u, 'gp', 'cl') : null) },
          { h: 'مستندات Gate Pass', w: 14, kind: 'num', get: (r) => r.docs },
          { h: 'ناقص', w: 9, kind: 'num', get: (r) => r.c.short },
          { h: 'زائد', w: 9, kind: 'num', get: (r) => r.c.excess },
          { h: 'لم يُصرف', w: 10, kind: 'num', get: (r) => r.c.none },
          { h: 'مطابق', w: 9, kind: 'num', get: (r) => r.c.ok },
          { h: 'أطوال مطلوبة', w: 18, kind: 'text', get: (r) => extraText(r.u, 'cl') },
          { h: 'أطوال مصروفة', w: 18, kind: 'text', get: (r) => extraText(r.u, 'gp') },
        ],
      },
      {
        name: 'حسب المادة',
        title: 'إجمالي كل مادة في المشاريع المختارة',
        rows: T.materials,
        columns: [
          { h: 'كود SEC', w: 16, kind: 'code', get: (r) => r.code },
          { h: 'الوصف', w: 60, kind: 'text', get: (r) => r.desc },
          { h: 'الوحدة', w: 9, kind: 'text', get: (r) => r.unit },
          { h: 'Checklist', w: 12, kind: 'num', get: (r) => (r.hasCl ? r.cl : null) },
          { h: 'UDS', w: 12, kind: 'num', get: (r) => (r.hasUds ? r.uds : null) },
          { h: 'Gate Pass', w: 12, kind: 'num', get: (r) => r.gp },
          { h: 'الفرق', w: 11, kind: 'diff', get: (r) => r.diff },
          { h: 'الحالة', w: 16, kind: 'status', get: (r) => (r.base == null && r.status === 'excess' ? 'غير مطلوب' : K.STATUS[r.status].label), status: (r) => r.status },
          { h: 'عدد المشاريع', w: 12, kind: 'num', get: (r) => r.nProjects },
        ],
      },
    ];
  }

  function drawBody() {
    const body = rootEl.querySelector('#tt-body');
    cache = compute();
    const T = cache;
    const exp = rootEl.querySelector('#tt-export');
    if (exp) exp.disabled = !T.items.length;
    if (!T.items.length) {
      body.innerHTML = `<section class="card panel">${UI.empty({ title: 'لا يوجد مشروع مختار', text: 'اضغط على اسم مشروع من الأعلى ليدخل في الإجمالي.' })}</section>`;
      return;
    }
    body.innerHTML = `${flow(T)}
      <section class="card panel" aria-labelledby="tt-proj-h">
        <div class="panel-head"><div><h2 class="h3" id="tt-proj-h">كل مشروع وحده</h2><p class="muted">أرقام كل مشروع من قوائمه فقط. صف الإجمالي في الأسفل هو مجموع الصفوف.</p></div></div>
        ${projectsTable(T)}
      </section>
      <section class="card panel panel-flush" aria-labelledby="tt-mat-h">
        <div class="panel-head pad"><div><h2 class="h3" id="tt-mat-h">الإجمالي حسب المادة</h2><p class="muted">مجموع كل مادة في المشاريع المختارة. الحالة هنا على مستوى المجموع، فقد يخفي النقصُ في مشروعٍ زيادةً في آخر. راجع كل مشروع وحده من الجدول الأعلى.</p></div></div>
        <div id="tt-mat"></div>
      </section>`;
    materialsTable(body.querySelector('#tt-mat'), T);
  }

  function drawChips() {
    const host = rootEl.querySelector('#tt-chips');
    host.innerHTML = loaded
      .map((x) => `<button type="button" class="chip chip-proj" data-proj="${esc(x.project.id)}" aria-pressed="${sel.has(x.project.id)}">${esc(x.project.name)}</button>`)
      .join('');
  }

  const view = {
    title: 'الإجمالي',
    async render(root) {
      rootEl = root;
      loaded = await Store.loadAllProjects();
      if (!loaded.length) {
        root.innerHTML = `<div class="page"><header class="page-head"><div><h1 class="h1">الإجمالي لكل المشاريع</h1></div></header>
          <section class="card panel">${UI.empty({ title: 'لا توجد مشاريع بعد', text: 'أنشئ مشروعًا واستورد قوائمه، ثم عد إلى هنا لترى مجموع المشاريع.', action: '<a class="btn btn-primary" href="#/projects">اذهب إلى المشاريع</a>' })}</section></div>`;
        return;
      }
      const saved = readSel();
      const ids = new Set(loaded.map((x) => x.project.id));
      sel = new Set((saved || [...ids]).filter((id) => ids.has(id)));
      if (!sel.size && !saved) sel = new Set(ids);
      root.innerHTML = `<div class="page">
        <header class="page-head">
          <div><h1 class="h1">الإجمالي لكل المشاريع</h1>
          <p class="lead">كل مشروع محسوب وحده، وهنا مجموعها. ما تستورده يُحفظ في المشروع المفتوح فقط ولا يدخل في حسابات غيره.</p></div>
          <div class="page-actions no-print"><button class="btn btn-accent2" type="button" id="tt-export">${UI.icon('sheet', 20)}<span>نزّل الإجمالي Excel</span></button></div>
        </header>
        <p class="meta-line">الفترة: ${esc(App.periodLabel())}. تُطبَّق الفترة على تواريخ مستندات Gate Pass.</p>
        <section class="card panel" aria-labelledby="tt-sel-h">
          <div class="panel-head"><div><h2 class="h3" id="tt-sel-h">المشاريع داخل الإجمالي</h2><p class="muted">اضغط على مشروع لإضافته أو استبعاده.</p></div></div>
          <div class="chips" id="tt-chips" role="group" aria-labelledby="tt-sel-h"></div>
        </section>
        <div id="tt-body" class="tt-body"></div>
      </div>`;
      drawChips();
      drawBody();

      root.querySelector('#tt-chips').addEventListener('click', (e) => {
        const b = e.target.closest('[data-proj]');
        if (!b) return;
        const id = b.dataset.proj;
        if (sel.has(id)) sel.delete(id);
        else sel.add(id);
        saveSel();
        b.setAttribute('aria-pressed', String(sel.has(id)));
        drawBody();
      });
      root.querySelector('#tt-body').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-open]');
        if (!b) return;
        await Store.openProject(b.dataset.open);
        App.go('#/dashboard');
      });
      root.querySelector('#tt-export').onclick = async () => {
        try {
          await MT.Excel.save(excelDefs(cache), `Totals_${U.today()}`, { project: 'كل المشاريع' });
          UI.toast('تم تنزيل ملف Excel.');
        } catch (err) {
          UI.toast(err.message || String(err), { type: 'error' });
        }
      };
    },
    onChange() {
      if (rootEl && rootEl.isConnected && rootEl.querySelector('#tt-body')) drawBody();
    },
  };

  App.views.totals = view;
})(window);
