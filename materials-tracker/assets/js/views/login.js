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
            <p class="eyebrow mono">SEC · NAJRAN · MATERIALS</p>
            <h1 class="display">تابع كل مادة من الطلب حتى الصرف.</h1>
            <p class="lead">صوّر القوائم الثلاث. شاهد الناقص والزائد بالألوان. صدّر التقرير إلى Excel.</p>
            <ol class="steps">
              <li class="step step-cl"><span class="step-n mono">01</span><strong>Checklist</strong><small>المطلوب صرفه من شركة الكهرباء</small></li>
              <li class="step step-uds"><span class="step-n mono">02</span><strong>UDS</strong><small>المسجّل على النظام</small></li>
              <li class="step step-gp"><span class="step-n mono">03</span><strong>Gate Pass</strong><small>المصروف فعليًا من المستودع</small></li>
            </ol>
          </section>
          <section class="login-card card" aria-labelledby="login-h">
            <h2 id="login-h" class="card-title">${sb ? (signup ? 'أنشئ حسابك' : 'ادخل إلى حسابك') : 'ادخل بالوضع المحلي'}</h2>
            ${sb ? '' : `<p class="note note-warn">لم يُربط التطبيق بقاعدة بيانات بعد. بياناتك تبقى على هذا الجهاز فقط. لربط Supabase اتبع ملف README-AR.md.</p>`}
            <form id="login-form" novalidate>
              ${sb ? `
                ${signup ? `<label class="field"><span class="field-label">الاسم</span><input class="input" name="name" autocomplete="name" required></label>` : ''}
                <label class="field"><span class="field-label">البريد الإلكتروني</span><input class="input" dir="ltr" type="email" name="email" autocomplete="email" required></label>
                <label class="field"><span class="field-label">كلمة المرور</span><input class="input" dir="ltr" type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required></label>`
              : `<label class="field"><span class="field-label">اسمك</span><input class="input" name="name" autocomplete="name" placeholder="مثال: م. أحمد زهران" required></label>`}
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
            else await Store.signIn({ name });
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
