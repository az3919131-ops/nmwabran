/* شاشة 1: تسجيل الدخول */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const esc = U.esc;

  const view = {
    title: 'تسجيل الدخول',
    async render(root) {
      const sb = Store.mode === 'supabase';
      let signup = false;
      const draw = (error = '') => {
        root.innerHTML = `<div class="login">
          <section class="login-hero">
            <h1 class="display">تابع كل مادة من الطلب حتى الصرف.</h1>
            <p class="lead">ترفع صورة كل قائمة، فيحسب التطبيق ما نقص وما زاد في كل مادة ويعرضه لك بالألوان.</p>
            <ol class="steps" aria-label="القوائم الثلاث بترتيب مسارها">
              <li class="step step-cl"><span class="step-dot">${UI.icon('report', 22)}</span><strong>Checklist</strong><small>ما طلبته من شركة الكهرباء</small></li>
              <li class="step step-uds"><span class="step-dot">${UI.icon('layers', 22)}</span><strong>UDS</strong><small>ما سُجّل على النظام</small></li>
              <li class="step step-gp"><span class="step-dot">${UI.icon('folder', 22)}</span><strong>Gate Pass</strong><small>ما خرج فعليًا من المستودع</small></li>
            </ol>
          </section>
          <section class="login-card card" aria-labelledby="login-h">
            <h2 id="login-h" class="card-title">${sb ? (signup ? 'أنشئ حسابك' : 'ادخل إلى حسابك') : 'ادخل بالوضع المحلي'}</h2>
            ${sb ? '' : `<p class="note note-warn">لم تُربط قاعدة بيانات بعد، فتُحفظ بياناتك على هذا الجهاز فقط. خطوات الربط في ملف README-AR.md.</p>`}
            <form id="login-form" novalidate>
              ${sb ? `
                ${signup ? `<label class="field"><span class="field-label">الاسم</span><input class="input" name="name" autocomplete="name" required></label>` : ''}
                <label class="field"><span class="field-label">البريد الإلكتروني</span><input class="input" dir="ltr" type="email" name="email" autocomplete="email" required></label>
                <label class="field"><span class="field-label">كلمة المرور</span><input class="input" dir="ltr" type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required></label>`
              : `<label class="field"><span class="field-label">اسمك</span><input class="input" name="name" autocomplete="name" placeholder="مثال: م. أحمد زهران" required></label>
                <label class="field"><span class="field-label">البريد الإلكتروني (اختياري)</span><input class="input" dir="ltr" type="email" name="email" autocomplete="email" placeholder="يحدد دورك إن كان مضافًا في المستخدمين"></label>`}
              <p class="form-error" role="alert" id="login-err">${esc(error)}</p>
              <button class="btn btn-primary btn-block" type="submit">${sb ? (signup ? 'أنشئ الحساب' : 'ادخل إلى اللوحة') : 'ادخل إلى اللوحة'}</button>
            </form>
            ${sb ? `<button class="link-btn" type="button" id="toggle">${signup ? 'لديك حساب؟ سجّل الدخول' : 'ليس لديك حساب؟ أنشئ حسابًا'}</button>` : ''}
          </section>
          ${UI.pmFooter()}
        </div>`;
        const form = root.querySelector('#login-form');
        const first = form.querySelector('input');
        if (first) first.focus();
        const t = root.querySelector('#toggle');
        if (t) t.onclick = () => {
          signup = !signup;
          draw();
        };
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = new FormData(form);
          const btn = form.querySelector('button[type=submit]');
          const err = root.querySelector('#login-err');
          const name = (f.get('name') || '').trim();
          const email = (f.get('email') || '').trim();
          const password = f.get('password') || '';
          if (!sb && !name) return (err.textContent = 'اكتب اسمك للمتابعة.');
          if (sb && (!email || password.length < 6)) return (err.textContent = 'اكتب البريد وكلمة مرور من 6 أحرف على الأقل.');
          btn.disabled = true;
          btn.textContent = 'جارٍ الدخول...';
          try {
            if (sb) await (signup ? Store.signUp({ email, password, name }) : Store.signIn({ email, password }));
            else await Store.signIn({ name, email });
            await Store.refreshProjects();
            MT.App.go('#/projects');
          } catch (ex) {
            draw(ex.message || String(ex));
          }
        });
      };
      draw();
    },
  };
  MT.App.views.login = view;
})(window);
