/* إدارة المستخدمين (لمدير النظام فقط): مدير النظام، مستخدم رئيسي، مشاهد. */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const App = MT.App;
  const esc = U.esc;

  const POWERS = {
    admin: 'كل شيء، وإدارة المستخدمين',
    editor: 'إنشاء المشاريع واستيراد القوائم وتعديلها وحذفها',
    viewer: 'المشاهدة والمقارنة والتقارير والإجمالي وتنزيل Excel فقط',
  };
  const roleOpts = (sel) => Object.entries(Store.ROLES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

  const view = {
    title: 'إدارة المستخدمين',
    async render(root) {
      const sb = Store.mode === 'supabase';
      const list = await Store.users.list();
      const me = (Store.user.email || '').toLowerCase();
      const owner = (e) => e.toLowerCase() === Store.ADMIN_EMAIL;
      const rows = list
        .map((u) => {
          const lock = owner(u.email);
          const self = u.email.toLowerCase() === me;
          return `<tr>
            <th scope="row" data-label="المستخدم" class="tt-name"><strong class="mono" dir="ltr">${esc(u.email)}</strong><small class="muted">${esc(u.name || '')}${lock ? ' مالك النظام' : self ? ' أنت' : ''}</small></th>
            <td data-label="الدور"><label class="sr-only" for="r-${esc(u.email)}">دور ${esc(u.email)}</label><select class="input" id="r-${esc(u.email)}" data-role="${esc(u.email)}" ${lock ? 'disabled' : ''}>${roleOpts(u.role)}</select></td>
            <td data-label="الحالة"><label class="check"><input type="checkbox" data-active="${esc(u.email)}" ${u.active !== false ? 'checked' : ''} ${lock || self ? 'disabled' : ''}><span>${u.active !== false ? 'فعّال' : 'موقوف'}</span></label></td>
            <td data-label="حذف">${lock || self ? '' : `<button type="button" class="icon-btn icon-btn-danger" data-rm="${esc(u.email)}" aria-label="احذف ${esc(u.email)}">${UI.icon('trash', 18)}</button>`}</td>
          </tr>`;
        })
        .join('');
      root.innerHTML = `<div class="page">
        <header class="page-head"><div><h1 class="h1">إدارة المستخدمين</h1>
          <p class="lead">أنت مدير النظام. حدّد من يستطيع تعديل البيانات ومن يشاهدها فقط.</p></div></header>
        ${sb ? '' : '<p class="note note-warn">الوضع المحلي لا يحمي البيانات: الأدوار هنا تعمل على هذا الجهاز فقط، ويمكن لأي شخص يكتب بريدك عند الدخول أن يصير مديرًا. للحماية الحقيقية اربط قاعدة Supabase (README-AR.md).</p>'}
        <section class="card panel" aria-labelledby="u-roles-h">
          <div class="panel-head"><div><h2 class="h3" id="u-roles-h">الأدوار</h2></div></div>
          <dl class="role-list">${Object.entries(Store.ROLES).map(([k, v]) => `<div><dt>${esc(v)}</dt><dd>${esc(POWERS[k])}</dd></div>`).join('')}</dl>
        </section>
        <section class="card panel" aria-labelledby="u-add-h">
          <div class="panel-head"><div><h2 class="h3" id="u-add-h">أضف مستخدمًا</h2>
            <p class="muted">${sb ? 'اكتب بريده ودوره. عندما ينشئ حسابًا بهذا البريد من شاشة الدخول يأخذ الدور المحدد. من يسجّل دون إضافة يكون «مشاهد».' : 'اكتب بريده ودوره. عند دخوله بهذا البريد يأخذ الدور المحدد، وغير المضافين يكونون «مشاهد».'}</p></div></div>
          <form id="u-form" class="u-form" novalidate>
            <label class="field"><span class="field-label">البريد الإلكتروني</span><input class="input" dir="ltr" type="email" name="email" required autocomplete="off"></label>
            <label class="field"><span class="field-label">الاسم (اختياري)</span><input class="input" name="name" autocomplete="off"></label>
            <label class="field"><span class="field-label">الدور</span><select class="input" name="role">${roleOpts('editor')}</select></label>
            <button class="btn btn-primary" type="submit">${UI.icon('plus', 20)}<span>أضف المستخدم</span></button>
          </form>
          <p class="form-error" role="alert" id="u-err"></p>
        </section>
        <section class="card panel" aria-labelledby="u-list-h">
          <div class="panel-head"><div><h2 class="h3" id="u-list-h">المستخدمون (${U.fmt(list.length, 0)})</h2></div></div>
          <div class="table-wrap"><table class="table"><caption class="sr-only">المستخدمون وأدوارهم</caption>
            <thead><tr><th scope="col">المستخدم</th><th scope="col">الدور</th><th scope="col">الحالة</th><th scope="col"><span class="sr-only">حذف</span></th></tr></thead>
            <tbody>${rows}</tbody></table></div>
        </section>
      </div>`;

      const redraw = () => view.render(root);
      const run = async (fn, okMsg) => {
        try {
          await fn();
          if (okMsg) UI.toast(okMsg);
        } catch (e) {
          UI.toast(e.message || String(e), { type: 'error' });
        }
        redraw();
      };
      root.querySelector('#u-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const email = (f.get('email') || '').trim();
        const err = root.querySelector('#u-err');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return (err.textContent = 'اكتب بريدًا إلكترونيًا صحيحًا.');
        if (list.some((u) => u.email.toLowerCase() === email.toLowerCase())) return (err.textContent = 'هذا البريد مضاف من قبل. غيّر دوره من الجدول.');
        run(() => Store.users.upsert({ email, name: (f.get('name') || '').trim(), role: f.get('role') }), 'تمت إضافة المستخدم.');
      });
      root.addEventListener('change', (e) => {
        const r = e.target.closest('[data-role]');
        const a = e.target.closest('[data-active]');
        if (r) run(() => Store.users.upsert({ ...list.find((u) => u.email === r.dataset.role), role: r.value }), 'تم تغيير الدور.');
        if (a) run(() => Store.users.upsert({ ...list.find((u) => u.email === a.dataset.active), active: a.checked }), a.checked ? 'فُعّل الحساب.' : 'أُوقف الحساب.');
      });
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-rm]');
        if (!b) return;
        if (!(await UI.confirm(`سيُحذف ${b.dataset.rm} من القائمة ويعود دوره «مشاهد» إن سجّل الدخول. هل تتابع؟`, { ok: 'احذف المستخدم', danger: true }))) return;
        run(() => Store.users.remove(b.dataset.rm), 'تم حذف المستخدم.');
      });
    },
  };
  App.views.users = view;
})(window);
