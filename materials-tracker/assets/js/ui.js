/* أدوات الواجهة: أيقونات، إشعارات، نوافذ، حالات الفراغ والتحميل والخطأ، وجدول عام. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const esc = U.esc;

  const UI = (MT.UI = {});

  /* ---------- الأيقونات ---------- */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    compare: '<path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>',
    report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/>',
    book: '<path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3z"/><path d="M4 17a3 3 0 013-3h12"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16"/><circle cx="9" cy="10" r="2"/><path d="M3 18l6-5 4 3 3-2 5 4"/>',
    sheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7M12 10v8"/>',
    bell: '<path d="M6 17v-6a6 6 0 0112 0v6l2 2H4z"/><path d="M10 21h4"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    rotl: '<path d="M4 4v6h6"/><path d="M4.6 10A8 8 0 1 1 6 17"/>',
    rotr: '<path d="M20 4v6h-6"/><path d="M19.4 10A8 8 0 1 0 18 17"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    download: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    x: '<path d="M5 5l14 14M19 5L5 19"/>',
    folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>',
    logout: '<path d="M14 4h6v16h-6"/><path d="M3 12h12"/><path d="M7 8l-4 4 4 4"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8"/><path d="M7 14h10v7H7z"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
    paste: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 12h6M9 16h4"/>',
    zoom: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  };
  UI.icon = (name, size = 20) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  /* ---------- أدوات DOM ---------- */
  UI.$ = (sel, root = document) => root.querySelector(sel);
  UI.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  UI.on = (root, evt, sel, fn) =>
    root.addEventListener(evt, (e) => {
      const t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  UI.html = (el, str) => {
    el.innerHTML = str;
    return el;
  };
  /** أسماء الملفات لاتينية فقط: بعض المتصفحات تحذف الامتداد من الأسماء العربية */
  UI.safeName = (name) => {
    const m = String(name).match(/^(.*?)(\.[A-Za-z0-9]+)?$/);
    const base = m[1].replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^[-_.]+|[-_.]+$/g, '');
    return (base || 'download') + (m[2] || '');
  };
  UI.download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = UI.safeName(name);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
  };
  UI.pmFooter = () => `<footer class="pm-footer" role="contentinfo"><span class="pm-line">${esc(U.PM_LINE)}</span></footer>`;

  /* ---------- حالات الفراغ والتحميل والخطأ ---------- */
  UI.skeleton = (rows = 3) =>
    `<div class="skeleton" role="status" aria-label="جارٍ التحميل">${Array.from({ length: rows }, (_, i) => `<span class="sk-line" style="--w:${90 - i * 14}%"></span>`).join('')}<span class="sr-only">جارٍ التحميل</span></div>`;
  UI.empty = ({ title, text = '', action = '' }) => `<div class="state state-empty"><p class="state-title">${esc(title)}</p>${text ? `<p class="state-text">${esc(text)}</p>` : ''}${action}</div>`;
  UI.errorBox = (msg, retry = true) =>
    `<div class="state state-error" role="alert"><p class="state-title">تعذّر تحميل البيانات</p><p class="state-text">${esc(msg)}</p>${retry ? `<button class="btn btn-sm" type="button" data-action="retry">${UI.icon('rotr', 18)}<span>حاول مرة أخرى</span></button>` : ''}</div>`;

  /* ---------- الإشعارات ---------- */
  UI.toast = (msg, { type = 'ok', ms = 4500, action } = {}) => {
    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-msg">${esc(msg)}</span>${action ? `<button type="button" class="toast-act">${esc(action.label)}</button>` : ''}<button type="button" class="toast-x" aria-label="إغلاق">${UI.icon('x', 16)}</button>`;
    const close = () => el.remove();
    el.querySelector('.toast-x').onclick = close;
    if (action) el.querySelector('.toast-act').onclick = () => (action.fn(), close());
    host.appendChild(el);
    if (ms) setTimeout(close, ms);
    return close;
  };

  /* ---------- النوافذ ---------- */
  UI.dialog = ({ title, body = '', actions = [{ label: 'إغلاق', value: null }], size = 'md', onOpen, className = '' }) =>
    new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = `dlg dlg-${size} ${className}`;
      d.setAttribute('aria-labelledby', 'dlg-title');
      d.innerHTML = `<form method="dialog" class="dlg-head"><h2 id="dlg-title" class="dlg-title">${esc(title)}</h2><button class="icon-btn" value="__x" aria-label="إغلاق النافذة">${UI.icon('x', 20)}</button></form><div class="dlg-body" tabindex="0">${body}</div>${actions.length ? `<form method="dialog" class="dlg-foot">${actions.map((a, i) => `<button class="btn ${a.kind ? 'btn-' + a.kind : ''}" value="${i}" ${a.noClose ? 'type="button" data-keep' : ''}>${esc(a.label)}</button>`).join('')}</form>` : ''}`;
      document.body.appendChild(d);
      d.addEventListener('close', () => {
        const rv = d.returnValue;
        const a = rv === '__x' || rv === '' ? null : actions[Number(rv)];
        d.remove();
        resolve(a ? a.value : null);
      });
      d.addEventListener('click', (e) => {
        if (e.target === d) d.close('__x');
      });
      actions.forEach((a, i) => {
        if (a.noClose && a.onClick) d.querySelectorAll('.dlg-foot button')[i].addEventListener('click', () => a.onClick(d));
      });
      d.showModal();
      if (onOpen) onOpen(d);
    });

  UI.confirm = async (message, { ok = 'تأكيد', danger = false, title = 'تأكيد الإجراء' } = {}) => {
    const v = await UI.dialog({ title, body: `<p class="dlg-text">${esc(message)}</p>`, actions: [{ label: 'تراجع', value: false }, { label: ok, kind: danger ? 'danger' : 'primary', value: true }], size: 'sm' });
    return v === true;
  };

  /* ---------- شارات ومؤشرات ---------- */
  UI.badge = (status, label) => {
    const s = MT.Compare.STATUS[status] || MT.Compare.STATUS.na;
    return `<span class="badge badge-${s.key}"><span class="badge-glyph" aria-hidden="true">${s.glyph}</span>${esc(label || s.label)}</span>`;
  };
  UI.diff = (v, { none } = {}) => {
    if (v == null) return '<span class="diff diff-na">—</span>';
    const cls = v === 0 ? 'diff-0' : v < 0 ? 'diff-neg' : 'diff-pos';
    return `<span class="diff ${cls} mono" dir="ltr">${U.signed(v)}</span>`;
  };
  UI.num = (v) => (v == null ? '<span class="muted">—</span>' : `<span class="mono" dir="ltr">${U.fmt(v)}</span>`);
  /** وصف إنجليزي يسمح بالكسر بعد الفواصل بدل كسر الكلمات */
  UI.descHtml = (s) => esc(s).replace(/([,/])/g, '$1<wbr>');
  UI.code = (c) => `<span class="code mono" dir="ltr">${esc(c)}</span>`;

  UI.kindLabel = (k) => ({ checklist: 'Checklist', uds: 'UDS', gatepass: 'Gate Pass' }[k] || k);
  UI.kindClass = (k) => ({ checklist: 'src-cl', uds: 'src-uds', gatepass: 'src-gp' }[k] || '');
  UI.srcBadge = (k) => `<span class="src ${UI.kindClass(k)}">${esc(UI.kindLabel(k))}</span>`;

  /* ---------- الجدول العام (ترتيب + تصفية + صفحات) ---------- */
  let tableSeq = 0;
  UI.dataTable = (container, opts) => {
    const id = 'dt' + ++tableSeq;
    const st = { key: opts.sortKey || null, dir: opts.sortDir || 'desc', q: '', filters: {}, page: 1 };
    const cols = opts.columns;
    const size = opts.pageSize || 10;
    let rows = opts.rows || [];

    const toolbar = () => {
      const search = opts.search
        ? `<label class="field field-search"><span class="sr-only">بحث في الجدول</span>${UI.icon('search', 18)}<input type="search" class="input" placeholder="${esc(opts.searchPlaceholder || 'ابحث')}" data-role="q" autocomplete="off"></label>`
        : '';
      const filters = (opts.filters || [])
        .map((f) => `<label class="field field-select"><span class="field-label">${esc(f.label)}</span><select class="input" data-role="filter" data-key="${f.key}"><option value="">الكل</option>${f.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>`)
        .join('');
      return search || filters ? `<div class="dt-tools">${search}${filters}</div>` : '';
    };

    container.innerHTML = `${toolbar()}<div class="dt-body" id="${id}-body"></div>`;
    const body = container.querySelector('.dt-body');

    const filtered = () => {
      let r = rows;
      if (st.q) {
        const q = U.digits(st.q).toLowerCase().trim().split(/\s+/);
        r = r.filter((x) => {
          const hay = (opts.searchText ? opts.searchText(x) : JSON.stringify(x)).toLowerCase();
          return q.every((p) => hay.includes(p));
        });
      }
      for (const f of opts.filters || []) if (st.filters[f.key]) r = r.filter((x) => String(f.get(x)) === st.filters[f.key]);
      if (st.key) {
        const col = cols.find((c) => c.key === st.key);
        if (col && col.sort) {
          const dir = st.dir === 'asc' ? 1 : -1;
          r = r.slice().sort((a, b) => {
            const va = col.sort(a);
            const vb = col.sort(b);
            return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
          });
        }
      }
      return r;
    };

    const draw = () => {
      const all = filtered();
      const pages = Math.max(1, Math.ceil(all.length / size));
      if (st.page > pages) st.page = pages;
      const slice = all.slice((st.page - 1) * size, st.page * size);
      if (!rows.length) {
        body.innerHTML = opts.empty ? opts.empty : UI.empty({ title: 'لا توجد بيانات بعد' });
        return;
      }
      if (!all.length) {
        body.innerHTML = UI.empty({ title: 'لا توجد نتائج مطابقة', text: 'غيّر كلمات البحث أو أزل التصفية.' });
        return;
      }
      const head = cols
        .map((c) => {
          const active = st.key === c.key;
          const aria = active ? (st.dir === 'asc' ? 'ascending' : 'descending') : 'none';
          return `<th scope="col" class="${c.cls || ''}" ${c.sort ? `aria-sort="${aria}"` : ''}>${c.sort ? `<button type="button" class="th-sort ${active ? 'is-active' : ''}" data-sort="${c.key}">${esc(c.label)}<span class="th-arrow" aria-hidden="true">${active ? (st.dir === 'asc' ? '▲' : '▼') : '↕'}</span></button>` : esc(c.label)}</th>`;
        })
        .join('');
      const trs = slice
        .map(
          (r, i) =>
            `<tr ${opts.rowAttrs ? opts.rowAttrs(r) : ''} class="${opts.rowClass ? opts.rowClass(r) : ''}">${cols.map((c) => `<td class="${c.cls || ''}" data-label="${esc(c.label)}">${c.render(r, i)}</td>`).join('')}</tr>`
        )
        .join('');
      body.innerHTML = `<div class="table-wrap"><table class="table ${opts.className || ''}"><caption class="sr-only">${esc(opts.caption || '')}</caption><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table></div>
        <div class="dt-foot"><span class="dt-count mono">${U.fmt(all.length, 0)} / ${U.fmt(rows.length, 0)}</span>
        <nav class="pager" aria-label="تقسيم الصفحات"><button class="btn btn-sm" type="button" data-page="prev" ${st.page <= 1 ? 'disabled' : ''}>${UI.icon('next', 16)}<span>السابق</span></button><span class="pager-pos">صفحة ${st.page} من ${pages}</span><button class="btn btn-sm" type="button" data-page="next" ${st.page >= pages ? 'disabled' : ''}><span>التالي</span>${UI.icon('prev', 16)}</button></nav></div>`;
      if (opts.onDraw) opts.onDraw(body);
    };

    container.addEventListener('input', (e) => {
      if (e.target.matches('[data-role="q"]')) {
        st.q = e.target.value;
        st.page = 1;
        draw();
      }
    });
    container.addEventListener('change', (e) => {
      if (e.target.matches('[data-role="filter"]')) {
        st.filters[e.target.dataset.key] = e.target.value;
        st.page = 1;
        draw();
      }
    });
    container.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sort]');
      if (s) {
        const k = s.dataset.sort;
        if (st.key === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
        else {
          st.key = k;
          st.dir = 'asc';
        }
        draw();
        const again = container.querySelector(`[data-sort="${k}"]`);
        if (again) again.focus();
        return;
      }
      const p = e.target.closest('[data-page]');
      if (p && !p.disabled) {
        st.page += p.dataset.page === 'next' ? 1 : -1;
        draw();
        const again = container.querySelector(`[data-page="${p.dataset.page}"]`);
        if (again && !again.disabled) again.focus();
      }
    });

    draw();
    return {
      setRows(r) {
        rows = r;
        draw();
      },
      setFilter(key, value) {
        st.filters[key] = value;
        const sel = container.querySelector(`[data-key="${key}"]`);
        if (sel) sel.value = value;
        st.page = 1;
        draw();
      },
      setQuery(q) {
        st.q = q;
        const inp = container.querySelector('[data-role="q"]');
        if (inp) inp.value = q;
        st.page = 1;
        draw();
      },
      get state() {
        return st;
      },
    };
  };

  /* ---------- صور ---------- */
  /** يصغّر صورة إلى أقصى ضلع معين ويعيد Blob بصيغة JPEG، مع تدوير اختياري بالدرجات */
  UI.imageToBlob = async (fileOrBlob, { maxSide = 2000, quality = 0.85, rotate = 0 } = {}) => {
    const bmp = await UI.loadBitmap(fileOrBlob);
    const rot = ((rotate % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const w0 = bmp.width;
    const h0 = bmp.height;
    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const cw = Math.round((swap ? h0 : w0) * scale);
    const ch = Math.round((swap ? w0 : h0) * scale);
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(bmp, (-w0 * scale) / 2, (-h0 * scale) / 2, w0 * scale, h0 * scale);
    if (bmp.close) bmp.close();
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('تعذّر معالجة الصورة'))), 'image/jpeg', quality));
  };
  UI.loadBitmap = async (blob) => {
    if (g.createImageBitmap) {
      try {
        return await createImageBitmap(blob, { imageOrientation: 'from-image' });
      } catch (e) {
        /* نكمل بالطريقة التقليدية */
      }
    }
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('تعذّر فتح الصورة'));
      img.src = URL.createObjectURL(blob);
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})(typeof window !== 'undefined' ? window : globalThis);
