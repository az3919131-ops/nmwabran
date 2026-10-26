/* كتالوج المواد: رقم SEC والوصف والوحدة من ملف الإكسل، مع استيراد كتالوج محدَّث. */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const C = MT.Catalog;
  const P = MT.Parsers;
  const App = MT.App;
  const esc = U.esc;

  const view = {
    title: 'كتالوج المواد',
    async render(root) {
      const items = C.list.filter((i) => i.source === 'catalog');
      const cats = [...new Set(items.map((i) => i.categoryAr).filter(Boolean))];
      root.innerHTML = `<div class="page">
        <header class="page-head">
          <div><h1 class="h1">كتالوج المواد</h1>
          <p class="lead">الوصف والوحدة لكل رقم مادة. تُعرض هذه الأوصاف في كل الشاشات بدل ما يُقرأ من الصورة.</p></div>
          <div class="page-actions">
            ${Store.can('write') ? `<label class="btn btn-primary" for="cat-file">${UI.icon('upload', 20)}<span>استورد كتالوج Excel</span></label>
            <input id="cat-file" type="file" accept=".xlsx,.xls,.csv" hidden>` : ''}
            <button class="btn" type="button" id="cat-export">${UI.icon('download', 20)}<span>نزّل الكتالوج</span></button>
          </div>
        </header>
        <p class="meta-line">${U.fmt(items.length, 0)} صنف في ${U.fmt(cats.length, 0)} قسمًا. المصدر: ${esc(C.source || 'الكتالوج المدمج')}.</p>
        <section class="card panel panel-flush" id="cat-table"></section>
      </div>`;

      UI.dataTable(root.querySelector('#cat-table'), {
        caption: 'كتالوج المواد',
        rows: items,
        pageSize: 15,
        sortKey: 'code',
        sortDir: 'asc',
        search: true,
        searchPlaceholder: 'ابحث بالكود أو الوصف',
        searchText: (r) => [r.code, r.desc, r.categoryAr, r.category].join(' '),
        filters: [{ key: 'cat', label: 'القسم', get: (r) => r.categoryAr, options: cats.map((c) => ({ value: c, label: c })) }],
        columns: [
          { key: 'code', label: 'كود SEC', sort: (r) => r.code, render: (r) => UI.code(r.code) },
          { key: 'desc', label: 'الوصف', sort: (r) => r.desc, cls: 'col-desc', render: (r) => `<span class="desc" dir="ltr">${UI.descHtml(r.desc)}</span>` },
          { key: 'unit', label: 'الوحدة', sort: (r) => r.unit, render: (r) => `<span class="mono">${esc(r.unit)}</span>` },
          { key: 'cat', label: 'القسم', sort: (r) => r.categoryAr, render: (r) => esc(r.categoryAr || '—') },
        ],
      });

      root.querySelector('#cat-export').onclick = async () => {
        try {
          await MT.Excel.save(
            [{ name: 'الكتالوج', title: 'كتالوج المواد', rows: items, columns: [
              { h: 'كود SEC', w: 16, kind: 'code', get: (r) => r.code },
              { h: 'الوصف', w: 70, kind: 'text', get: (r) => r.desc },
              { h: 'الوحدة', w: 10, kind: 'text', get: (r) => r.unit },
              { h: 'القسم', w: 36, kind: 'text', get: (r) => r.categoryAr },
            ] }],
            `Materials-Catalog_${U.today()}`,
            { project: '' }
          );
        } catch (e) {
          UI.toast(e.message, { type: 'error' });
        }
      };

      const catFile = root.querySelector('#cat-file');
      if (catFile) catFile.onchange = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          const { matrix } = await MT.Excel.readMatrix(file);
          const t = P.detectTable(matrix);
          if (t.headerIndex < 0 || t.mapping.code == null) throw new Error('لم أجد عمود رقم المادة (SEC #). تأكد أن الصف الأول فيه العناوين.');
          const found = [];
          let section = '';
          for (let i = t.headerIndex + 1; i < matrix.length; i++) {
            const r = matrix[i] || [];
            const code = String(U.digits(r[t.mapping.code] == null ? '' : r[t.mapping.code])).replace(/\D/g, '');
            if (!code) {
              const txt = r.find((x) => typeof x === 'string' && x.trim());
              if (txt && r.filter((x) => x != null && x !== '').length === 1) section = txt.trim();
              continue;
            }
            if (!C.isCode(code)) continue;
            const desc = t.mapping.desc != null ? String(r[t.mapping.desc] || '').replace(/`/g, '').replace(/\s{2,}/g, ' ').trim() : '';
            const unit = t.mapping.unit != null ? String(r[t.mapping.unit] || '').trim() : '';
            found.push([code, desc, unit || 'EA', -1, section]);
          }
          if (!found.length) throw new Error('لا توجد أرقام مواد صالحة (9 أرقام) في الملف.');
          const isNew = found.filter((f) => !C.get(f[0]) || C.get(f[0]).source !== 'catalog').length;
          if (!(await UI.confirm(`وُجد ${U.fmt(found.length, 0)} صنف، منها ${U.fmt(isNew, 0)} جديد. تُحدَّث أوصاف الموجود وتُضاف الأصناف الجديدة. هل تتابع؟`, { ok: 'ادمج الكتالوج' }))) return;
          await Store.saveCatalog(found);
          UI.toast(`تم دمج ${U.fmt(found.length, 0)} صنف في الكتالوج.`);
          App.refresh();
        } catch (ex) {
          UI.toast(ex.message || String(ex), { type: 'error', ms: 8000 });
        }
      };
    },
    onChange() {},
  };
  App.views.catalog = view;
})(window);
