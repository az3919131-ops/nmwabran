/* هيكل التطبيق: التوجيه، الشريط الجانبي والعلوي، الفترة الزمنية، التنبيهات، الحساب، الإعدادات. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const K = MT.Compare;
  const esc = U.esc;
  const $ = UI.$;

  const NAV = [
    { id: 'dashboard', label: 'لوحة المتابعة', icon: 'grid', href: '#/dashboard' },
    { id: 'import', label: 'استيراد القوائم', icon: 'upload', href: '#/import/checklist' },
    { id: 'compare', label: 'مقارنة المواد', icon: 'compare', href: '#/compare' },
    { id: 'reports', label: 'التقارير', icon: 'report', href: '#/reports' },
    { id: 'totals', label: 'الإجمالي', icon: 'layers', href: '#/totals' },
    { id: 'catalog', label: 'كتالوج المواد', icon: 'book', href: '#/catalog' },
  ];
  const SITE = 'متابعة صرف المواد من الكهرباء';
  const NEEDS_PROJECT = new Set(['dashboard', 'import', 'compare', 'reports']);

  const App = (MT.App = {
    views: {},
    period: { preset: 'all', from: null, to: null },
    version: 0,
    _cache: null,
    current: null,
    shell: null,
  });

  /* ---------- النتيجة المحسوبة ---------- */
  App.window = () => {
    const p = App.period;
    const t = U.today();
    if (p.preset === 'today') return { from: t, to: t };
    if (p.preset === '7') return { from: U.addDays(t, -6), to: t };
    if (p.preset === '30') return { from: U.addDays(t, -29), to: t };
    if (p.preset === 'custom') return { from: p.from || null, to: p.to || null };
    return { from: null, to: null };
  };
  App.periodLabel = () => {
    const p = App.period;
    if (p.preset === 'today') return 'اليوم';
    if (p.preset === '7') return 'آخر 7 أيام';
    if (p.preset === '30') return 'آخر 30 يومًا';
    if (p.preset === 'custom') return `${p.from ? U.fmtDate(p.from) : '…'} إلى ${p.to ? U.fmtDate(p.to) : '…'}`;
    return 'كل الفترات';
  };
  App.result = () => {
    if (!Store.data) return null;
    const key = App.version + '|' + JSON.stringify(App.window());
    if (!App._cache || App._cache.key !== key) App._cache = { key, value: K.build(Store.data, App.window()) };
    return App._cache.value;
  };

  /* ---------- التوجيه ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => (query[k] = v));
    return { name: parts[0] || '', params: parts.slice(1), query };
  }
  App.go = (hash) => {
    if (location.hash === hash) App.route();
    else location.hash = hash;
  };

  App.route = async () => {
    const r = parseHash();
    let name = r.name;
    if (!Store.user) name = 'login';
    else if (!name || name === 'login') name = Store.project ? 'dashboard' : 'projects';
    if (NEEDS_PROJECT.has(name) && !Store.project) {
      const last = Store.lastProjectId();
      if (last && Store.projects.some((p) => p.id === last)) {
        try {
          await Store.openProject(last);
        } catch (e) {
          name = 'projects';
        }
      } else name = 'projects';
    }
    const view = App.views[name];
    if (!view) {
      App.go(Store.user ? '#/dashboard' : '#/login');
      return;
    }
    App.current = { name, view, ctx: { params: r.params, query: r.query } };
    document.title = `${view.title} | ${SITE}`;
    if (name === 'login') {
      App.shell = null;
      document.body.classList.add('is-login');
      document.getElementById('root').innerHTML = '<div class="login-root" id="main" tabindex="-1"></div>';
      await mount(view, $('#main'));
      return;
    }
    document.body.classList.remove('is-login');
    if (!App.shell) buildShell();
    updateChrome(name);
    const main = $('#main');
    window.scrollTo(0, 0);
    await mount(view, main);
    main.focus({ preventScroll: true });
  };

  async function mount(view, root) {
    root.innerHTML = `<div class="page">${UI.skeleton(4)}</div>`;
    try {
      await view.render(root, App.current.ctx);
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="page">${UI.errorBox(e.message || String(e))}</div>`;
      const btn = root.querySelector('[data-action="retry"]');
      if (btn) btn.onclick = () => mount(view, root);
    }
  }

  App.chrome = () => App.shell && App.current && updateChrome(App.current.name);

  App.refresh = () => {
    App.version++;
    App._cache = null;
    if (!App.current || !App.shell) return;
    updateChrome(App.current.name);
    const v = App.current.view;
    if (v.onChange) v.onChange();
    else mount(v, $('#main'));
  };

  /* ---------- الهيكل ---------- */
  function buildShell() {
    const initial = esc((Store.user.name || Store.user.email || '؟').trim().charAt(0).toUpperCase());
    const navItem = (n, cls) => `<a class="${cls}" href="${n.href}" data-nav="${n.id}">${UI.icon(n.icon, 22)}<span>${n.label}</span></a>`;
    document.getElementById('root').innerHTML = `
      <a class="skip" href="#main">انتقل إلى المحتوى</a>
      <div class="app">
        <aside class="sidebar" aria-label="القائمة الرئيسية">
          <a class="brand" href="#/dashboard">
            <span class="brand-mark">${UI.icon('bolt', 26)}</span>
            <span class="brand-text"><strong>صرف المواد</strong><small>كهرباء نجران</small></span>
          </a>
          <nav class="nav" aria-label="الأقسام">${NAV.map((n) => navItem(n, 'nav-item')).join('')}</nav>
          <div class="side-foot">
            <div class="account">
              <span class="avatar" aria-hidden="true">${initial}</span>
              <span class="account-text"><strong>${esc(Store.user.name || Store.user.email)}</strong><small>${Store.mode === 'supabase' ? 'متصل بقاعدة البيانات' : 'وضع محلي'}</small></span>
            </div>
          </div>
        </aside>
        <div class="main-col">
          <header class="topbar">
            <button class="project-chip" type="button" data-action="switch-project">
              ${UI.icon('folder', 20)}<span class="project-chip-text"><small>المشروع</small><strong id="project-name"></strong></span><span class="sr-only">. اضغط لتبديل المشروع</span>${UI.icon('down', 16)}
            </button>
            <form class="top-search" role="search" id="top-search">
              <label class="sr-only" for="top-q">ابحث عن مادة</label>
              ${UI.icon('search', 20)}
              <input id="top-q" class="input" type="search" placeholder="ابحث بكود المادة أو الوصف أو رقم الحجز" autocomplete="off">
            </form>
            <button class="btn top-period" type="button" data-action="period" aria-haspopup="dialog">${UI.icon('calendar', 20)}<span id="period-label"></span></button>
            <div class="pop-wrap">
              <button class="icon-btn" type="button" id="bell" aria-haspopup="true" aria-expanded="false" aria-controls="pop-bell" aria-label="التنبيهات">${UI.icon('bell', 22)}<span class="bell-n" id="bell-n" hidden></span></button>
              <div class="pop" id="pop-bell" hidden></div>
            </div>
            <div class="pop-wrap">
              <button class="icon-btn avatar-btn" type="button" id="acct" aria-haspopup="true" aria-expanded="false" aria-controls="pop-acct" aria-label="الحساب"><span class="avatar">${initial}</span></button>
              <div class="pop pop-acct" id="pop-acct" hidden>
                <p class="pop-user"><strong>${esc(Store.user.name || Store.user.email)}</strong><small class="mono">${esc(Store.user.email || '')}</small></p>
                <button class="pop-item" type="button" data-action="projects">${UI.icon('folder', 18)}<span>المشاريع</span></button>
                <button class="pop-item" type="button" data-action="settings">${UI.icon('sliders', 18)}<span>الإعدادات</span></button>
                <button class="pop-item" type="button" data-action="logout">${UI.icon('logout', 18)}<span>تسجيل الخروج</span></button>
              </div>
            </div>
          </header>
          <main id="main" tabindex="-1"></main>
          ${UI.pmFooter()}
        </div>
        <nav class="bottom-nav" aria-label="الأقسام">${NAV.map((n) => navItem(n, 'bn-item')).join('')}</nav>
      </div>`;
    App.shell = true;
    bindShell();
  }

  function bindShell() {
    const root = document.getElementById('root');
    $('#top-search').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#top-q').value.trim();
      App.go('#/compare' + (q ? '?q=' + encodeURIComponent(q) : ''));
    });
    UI.on(root, 'click', '[data-action]', (e, el) => {
      const a = el.dataset.action;
      if (a === 'switch-project' || a === 'projects') (closePops(), App.go('#/projects'));
      else if (a === 'period') openPeriod();
      else if (a === 'settings') (closePops(), openSettings());
      else if (a === 'logout') logout();
    });
    // النوافذ المنبثقة الصغيرة
    const pops = [
      ['bell', 'pop-bell'],
      ['acct', 'pop-acct'],
    ];
    pops.forEach(([btn, panel]) => {
      $('#' + btn).addEventListener('click', (e) => {
        e.stopPropagation();
        const open = $('#' + panel).hidden;
        closePops();
        if (open) {
          if (panel === 'pop-bell') drawBell();
          $('#' + panel).hidden = false;
          $('#' + btn).setAttribute('aria-expanded', 'true');
        }
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.pop-wrap')) closePops();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = $('.pop:not([hidden])');
        if (open) {
          closePops();
          const b = open.parentElement.querySelector('button');
          if (b) b.focus();
        }
      }
    });
  }

  function closePops() {
    UI.$$('.pop').forEach((p) => (p.hidden = true));
    UI.$$('.pop-wrap > button').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  function updateChrome(name) {
    const nav = name === 'catalog' ? 'catalog' : name;
    UI.$$('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === nav;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const pn = $('#project-name');
    if (pn) pn.textContent = Store.project ? Store.project.name : 'اختر مشروعًا';
    const pl = $('#period-label');
    if (pl) pl.textContent = App.periodLabel();
    const r = App.result();
    const n = $('#bell-n');
    if (n) {
      const count = r ? K.alerts(r).length : 0;
      n.hidden = !count;
      n.textContent = count;
      $('#bell').setAttribute('aria-label', count ? `التنبيهات: ${count}` : 'التنبيهات');
    }
  }

  function drawBell() {
    const r = App.result();
    const list = r ? K.alerts(r) : [];
    $('#pop-bell').innerHTML = `<p class="pop-title">التنبيهات</p>${
      list.length
        ? `<ul class="alerts">${list.map((a) => `<li><a class="alert alert-${a.level}" href="#/compare?status=${a.filter}">${a.text}</a></li>`).join('')}</ul>`
        : '<p class="pop-empty">لا توجد تنبيهات. كل شيء مطابق.</p>'
    }`;
  }

  async function logout() {
    closePops();
    await Store.signOut();
    App.shell = null;
    App.go('#/login');
  }

  /* ---------- الفترة الزمنية ---------- */
  async function openPeriod() {
    const p = App.period;
    const opt = (v, label) => `<label class="radio"><input type="radio" name="preset" value="${v}" ${p.preset === v ? 'checked' : ''}><span>${label}</span></label>`;
    let picked = null;
    const res = await UI.dialog({
      title: 'الفترة الزمنية',
      size: 'sm',
      body: `<p class="dlg-text">تُطبّق الفترة على تواريخ الـ Gate Pass فقط. الـ Checklist و UDS لا تتأثر بها.</p>
        <fieldset class="radios"><legend class="sr-only">اختر الفترة</legend>${opt('all', 'كل الفترات')}${opt('today', 'اليوم')}${opt('7', 'آخر 7 أيام')}${opt('30', 'آخر 30 يومًا')}${opt('custom', 'نطاق مخصص')}</fieldset>
        <div class="range-row"><label class="field"><span class="field-label">من</span><input class="input" type="date" id="p-from" value="${p.from || ''}"></label><label class="field"><span class="field-label">إلى</span><input class="input" type="date" id="p-to" value="${p.to || ''}"></label></div>`,
      actions: [
        { label: 'إلغاء', value: false },
        {
          label: 'طبّق الفترة',
          kind: 'primary',
          value: true,
          noClose: true,
          onClick: (d) => {
            const preset = (d.querySelector('input[name="preset"]:checked') || {}).value || 'all';
            const from = d.querySelector('#p-from').value || null;
            const to = d.querySelector('#p-to').value || null;
            if (preset === 'custom' && from && to && from > to) {
              UI.toast('تاريخ البداية بعد تاريخ النهاية.', { type: 'error' });
              return;
            }
            picked = { preset, from, to };
            d.close('0');
          },
        },
      ],
      onOpen: (d) => {
        d.addEventListener('input', (e) => {
          if (e.target.id === 'p-from' || e.target.id === 'p-to') d.querySelector('input[value="custom"]').checked = true;
        });
      },
    });
    if (picked) {
      App.period = picked;
      App.refresh();
    }
    return res;
  };

  /* ---------- الإعدادات ---------- */
  App.openSettings = openSettings;
  async function openSettings() {
    const AI = MT.AI;
    const key = AI.getKey();
    const model = AI.getModel();
    const modelOpts = AI.MODELS.map((m) => `<option value="${m.id}" ${m.id === model ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
    const local = Store.mode === 'local';
    await UI.dialog({
      title: 'الإعدادات',
      size: 'md',
      body: `<section class="set-block"><h3>القراءة الدقيقة بالذكاء الاصطناعي</h3>
          <p class="dlg-text">بمفتاح Anthropic API يقرأ Claude الصور وملفات PDF وPowerPoint والنص الملصوق، ثم يراجع الصفوف المشكوك فيها مرة ثانية. هذا أدق من القراءة المحلية المجانية، خصوصًا مع الصور المائلة وخط اليد. المفتاح يُحفظ في هذا المتصفح فقط، ويُرسل المحتوى إلى Anthropic مباشرة دون أي خادم وسيط. تظهر لك التكلفة التقريبية بعد كل قراءة. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">احصل على مفتاح من console.anthropic.com</a></p>
          <label class="field"><span class="field-label">مفتاح API</span><input class="input mono" dir="ltr" type="password" id="set-key" placeholder="sk-ant-..." value="${esc(key)}" autocomplete="off"></label>
          <label class="field"><span class="field-label">النموذج</span><select class="input" id="set-model">${modelOpts}</select></label>
          <label class="check"><input type="checkbox" id="set-on" ${AI.isEnabled() || !key ? 'checked' : ''}><span>استخدم القراءة الدقيقة تلقائيًا عند الاستيراد</span></label>
          <div class="row-actions"><button class="btn btn-sm" type="button" id="set-test">اختبر المفتاح</button></div>
          <p class="note note-soft" id="set-test-out" role="status" hidden></p>
        </section>
        ${local ? `<section class="set-block"><h3>نسخة احتياطية (الوضع المحلي)</h3><p class="dlg-text">بيانات الوضع المحلي تُحفظ في هذا المتصفح فقط. نزّل نسخة قبل تغيير الجهاز أو مسح بيانات المتصفح. الصور لا تدخل في النسخة.</p><div class="row-actions"><button class="btn" type="button" id="bk-down">${UI.icon('download', 18)}<span>نزّل نسخة JSON</span></button><label class="btn" for="bk-up">${UI.icon('upload', 18)}<span>استعد من ملف</span></label><input type="file" id="bk-up" accept="application/json,.json" hidden></div></section>` : ''}`,
      actions: [
        { label: 'إغلاق', value: false },
        {
          label: 'احفظ الإعدادات',
          kind: 'primary',
          value: true,
          noClose: true,
          onClick: (d) => {
            AI.setKey(d.querySelector('#set-key').value);
            AI.setModel(d.querySelector('#set-model').value);
            AI.setEnabled(d.querySelector('#set-on').checked);
            UI.toast('تم حفظ الإعدادات.');
            d.close('0');
          },
        },
      ],
      onOpen: (d) => {
        const test = d.querySelector('#set-test');
        test.onclick = async () => {
          const out = d.querySelector('#set-test-out');
          out.hidden = false;
          out.textContent = 'جارٍ الفحص...';
          try {
            await AI.test(d.querySelector('#set-key').value.trim(), d.querySelector('#set-model').value);
            out.textContent = 'المفتاح صالح والنموذج متاح. لا تنسَ الضغط على «احفظ الإعدادات».';
          } catch (e) {
            out.textContent = e.message;
          }
        };
        const down = d.querySelector('#bk-down');
        if (down)
          down.onclick = () => {
            const blob = new Blob([JSON.stringify(Store.backup())], { type: 'application/json' });
            UI.download(blob, `materials-backup-${U.today()}.json`);
          };
        const up = d.querySelector('#bk-up');
        if (up)
          up.onchange = async () => {
            try {
              const obj = JSON.parse(await up.files[0].text());
              if (!(await UI.confirm('ستُستبدل كل بيانات هذا المتصفح بمحتوى الملف. هل تتابع؟', { ok: 'استعد البيانات', danger: true }))) return;
              Store.restore(obj);
              d.close('0');
              await Store.refreshProjects();
              Store.project = null;
              Store.data = null;
              UI.toast('تمت استعادة البيانات.');
              App.go('#/projects');
            } catch (e) {
              UI.toast(e.message || 'ملف غير صالح', { type: 'error' });
            }
          };
      },
    });
  }

  /* ---------- الإقلاع ---------- */
  App.boot = async () => {
    const root = document.getElementById('root');
    root.innerHTML = `<div class="boot">${UI.skeleton(3)}</div>`;
    try {
      await Store.init();
      if (Store.user) await Store.refreshProjects();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="boot"><div class="page">${UI.errorBox(Store.translateError ? Store.translateError(e) : e.message)}</div>${UI.pmFooter()}</div>`;
      const b = root.querySelector('[data-action="retry"]');
      if (b) b.onclick = () => location.reload();
      return;
    }
    Store.on('change', () => App.refresh());
    Store.on('project', () => {
      App.version++;
      App._cache = null;
    });
    Store.on('warn', (m) => UI.toast(m, { type: 'error', ms: 8000 }));
    window.addEventListener('hashchange', App.route);
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => App.current && App.current.view.onResize && App.current.view.onResize(), 200);
    });
    App.route();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
