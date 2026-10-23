/* شاشة 2: اختيار أو إنشاء مشروع */
(function (g) {
  'use strict';
  const MT = g.MT;
  const U = MT.Util;
  const UI = MT.UI;
  const Store = MT.Store;
  const esc = U.esc;

  const view = {
    title: 'المشاريع',
    async render(root) {
      await Store.refreshProjects();
      const list = Store.projects;
      const hasDemo = list.some((p) => p.demo || /تجريبي/.test(p.name));
      const cards = list
        .map((p) => {
          const active = Store.project && Store.project.id === p.id;
          return `<article class="card project-card ${active ? 'is-active' : ''}">
            <p class="eyebrow mono">${esc(p.region || 'نجران')} · ${U.fmtDate((p.created_at || '').slice(0, 10))}</p>
            <h2 class="project-title">${esc(p.name)}</h2>
            <p class="muted">${p.contractor ? 'المقاول: ' + esc(p.contractor) : 'بدون اسم مقاول'}</p>
            <div class="card-actions">
              <button class="btn btn-primary" type="button" data-open="${p.id}">${active ? 'تابع في هذا المشروع' : 'افتح المشروع'}</button>
              <button class="btn btn-danger btn-sm" type="button" data-del="${p.id}" aria-label="احذف مشروع ${esc(p.name)}">${UI.icon('trash', 18)}<span>احذف</span></button>
            </div>
          </article>`;
        })
        .join('');
      root.innerHTML = `<div class="page">
        <header class="page-head">
          <div><p class="eyebrow mono">01 · PROJECTS</p><h1 class="h1">اختر مشروعك</h1><p class="lead">كل مشروع له Checklist وUDS وGate Pass خاصة به.</p></div>
          <div class="page-actions"><button class="btn btn-primary" type="button" id="new-project">${UI.icon('plus', 20)}<span>أنشئ مشروعًا</span></button></div>
        </header>
        ${list.length
          ? `<section class="grid-cards">${cards}</section>`
          : `<section class="card">${UI.empty({ title: 'لا توجد مشاريع بعد', text: 'أنشئ مشروعك الأول، أو حمّل المشروع التجريبي لترى الشاشات بأرقام حقيقية من الصورتين.' })}</section>`}
        ${!hasDemo ? `<p class="demo-line"><button class="link-btn" type="button" id="add-demo">حمّل المشروع التجريبي</button><span class="muted"> مبني على صورة الـ Gate Pass وصورة الـ Checklist المرسلتين.</span></p>` : ''}
      </div>`;

      UI.on(root, 'click', '[data-open]', async (e, el) => {
        el.disabled = true;
        await Store.openProject(el.dataset.open);
        MT.App.go('#/dashboard');
      });
      UI.on(root, 'click', '[data-del]', async (e, el) => {
        const p = list.find((x) => x.id === el.dataset.del);
        if (!(await UI.confirm(`سيُحذف مشروع «${p.name}» وكل قوائمه وصوره. لا يمكن التراجع.`, { ok: 'احذف المشروع', danger: true }))) return;
        await Store.deleteProject(p.id);
        UI.toast('تم حذف المشروع.');
        view.render(root);
        MT.App.chrome();
      });
      const demo = root.querySelector('#add-demo');
      if (demo)
        demo.onclick = async () => {
          demo.disabled = true;
          const p = await Store.addDemo();
          UI.toast('تم تحميل المشروع التجريبي.');
          await Store.openProject(p.id);
          MT.App.go('#/dashboard');
        };
      root.querySelector('#new-project').onclick = async () => {
        const body = `<label class="field"><span class="field-label">اسم المشروع</span><input class="input" id="np-name" required placeholder="مثال: توسعة شبكة التوزيع في شرورة"></label>
          <label class="field"><span class="field-label">المنطقة</span><input class="input" id="np-region" value="نجران"></label>
          <label class="field"><span class="field-label">المقاول</span><input class="input" id="np-contractor" placeholder="مثال: شركة ناصر مانع وبران"></label>`;
        let data = null;
        await UI.dialog({
          title: 'مشروع جديد',
          size: 'sm',
          body,
          actions: [
            { label: 'إلغاء', value: false },
            {
              label: 'أنشئ المشروع',
              kind: 'primary',
              noClose: true,
              onClick: (d) => {
                const name = d.querySelector('#np-name').value.trim();
                if (!name) {
                  d.querySelector('#np-name').focus();
                  return UI.toast('اكتب اسم المشروع.', { type: 'error' });
                }
                data = { name, region: d.querySelector('#np-region').value, contractor: d.querySelector('#np-contractor').value };
                d.close('0');
              },
            },
          ],
        });
        if (!data) return;
        try {
          const p = await Store.createProject(data);
          await Store.openProject(p.id);
          UI.toast('تم إنشاء المشروع.');
          MT.App.go('#/import/checklist');
        } catch (e) {
          UI.toast(e.message, { type: 'error' });
        }
      };
    },
  };
  MT.App.views.projects = view;
})(window);
