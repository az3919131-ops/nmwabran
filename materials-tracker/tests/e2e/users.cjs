/* إدارة المستخدمين والأدوار (الوضع المحلي): مدير النظام، مستخدم رئيسي، مشاهد */
const { launch, fileUrl, DEPS } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const axeSrc = fs.readFileSync(path.join(DEPS, 'axe-core', 'axe.min.js'), 'utf8');
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'mt-users');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { browser, page, errors } = await launch({ width: 1440, height: 900 });
  let fail = 0;
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fail++; };
  const login = async (name, email = '') => {
    await page.goto(fileUrl()); await page.reload();
    await page.waitForSelector('#login-form');
    await page.fill('input[name=name]', name);
    if (email) await page.fill('input[name=email]', email);
    await page.click('button[type=submit]');
  };
  const logout = async () => { await page.click('#acct'); await page.click('[data-action=logout]'); await page.waitForSelector('#login-form'); };
  const navs = () => page.$$eval('.sidebar [data-nav]', (a) => a.map((x) => x.dataset.nav));

  console.log('== مدير النظام');
  await login('أحمد زهران', 'az3919131@gmail.com');
  await page.waitForSelector('#add-demo');
  await page.click('#add-demo'); await page.waitForSelector('.kpis');
  ok(/مدير النظام/.test(await page.textContent('.account-text')), 'الدور ظاهر في الشريط: ' + (await page.textContent('.account-text')).replace(/\s+/g, ' '));
  await page.click('#acct');
  ok((await page.$('[data-action=users]')) !== null, 'قائمة الحساب فيها إدارة المستخدمين');
  await page.click('[data-action=users]');
  await page.waitForSelector('#u-form');
  ok((await page.$$eval('tbody tr', (r) => r.length)) === 1 && (await page.$('[data-role="az3919131@gmail.com"][disabled]')) !== null, 'المالك وحده ودوره مقفل');
  await page.fill('#u-form [name=email]', 'bad'); await page.click('#u-form button[type=submit]');
  ok(/بريدًا/.test(await page.textContent('#u-err')), 'بريد غير صحيح يُرفض');
  for (const [mail, role] of [['viewer@x.com', 'viewer'], ['editor@x.com', 'editor'], ['stop@x.com', 'editor']]) {
    await page.fill('#u-form [name=email]', mail); await page.selectOption('#u-form [name=role]', role);
    await page.click('#u-form button[type=submit]');
    await page.waitForSelector(`[data-role="${mail}"]`);
  }
  ok((await page.$$eval('tbody tr', (r) => r.length)) === 4, 'أربعة مستخدمين');
  await page.selectOption('[data-role="viewer@x.com"]', 'viewer');
  await page.uncheck('[data-active="stop@x.com"]');
  await page.waitForSelector('[data-active="stop@x.com"]:not(:checked)');
  ok(true, 'إيقاف مستخدم');
  await page.screenshot({ path: OUT + '/users.png', fullPage: true });
  await page.evaluate(axeSrc);
  const ax = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  ok(ax.violations.length === 0, 'axe: ' + (ax.violations.map((v) => v.id + ':' + v.nodes.map((n) => n.target.join(' ')).join('|')).join('; ') || 'نظيفة'));
  await logout();

  console.log('== مشاهد');
  await login('فني', 'viewer@x.com');
  await page.waitForSelector('.project-card, .grid-cards, #new-project, .page');
  ok(!(await navs()).includes('import') && (await navs()).includes('totals'), 'لا استيراد في القائمة: ' + (await navs()).join());
  ok((await page.$('#new-project')) === null && (await page.$('[data-del]')) === null, 'لا إنشاء ولا حذف مشاريع');
  await page.click('[data-open]'); await page.waitForSelector('.kpis');
  await page.goto(fileUrl('#/import/checklist'));
  await page.waitForSelector('.toast-msg:has-text("مشاهد فقط")');
  ok((await page.$('.dropzone')) === null, 'مسار الاستيراد لا يُعرض للمشاهد');
  await page.click('#acct');
  ok((await page.$('[data-action=users]')) === null, 'لا إدارة مستخدمين للمشاهد');
  await page.keyboard.press('Escape');
  await page.goto(fileUrl('#/users'));
  await page.waitForSelector('.toast-msg:has-text("لمدير النظام")');
  const err = await page.evaluate(async () => { try { await MT.Store.importList('uds', [], {}); return ''; } catch (e) { return e.message; } });
  ok(/مشاهد فقط/.test(err), 'حماية الكتابة في الطبقة الداخلية: ' + err);
  await page.goto(fileUrl('#/catalog')); await page.waitForSelector('.table');
  ok((await page.$('#cat-file')) === null, 'لا استيراد كتالوج للمشاهد');
  await page.goto(fileUrl('#/totals')); await page.waitForSelector('.tt-table');
  ok(true, 'الإجمالي متاح للمشاهد');
  await logout();

  console.log('== مستخدم رئيسي');
  await login('محرر', 'editor@x.com');
  await page.waitForSelector('.page');
  ok((await navs()).includes('import'), 'الاستيراد ظاهر');
  await page.goto(fileUrl('#/projects')); await page.waitForSelector('#new-project');
  ok(true, 'ينشئ مشاريع');
  await page.click('#acct');
  ok((await page.$('[data-action=users]')) === null, 'لا إدارة مستخدمين للمستخدم الرئيسي');
  await page.keyboard.press('Escape');
  await logout();

  console.log('== موقوف وغير مضاف');
  await login('موقوف', 'stop@x.com');
  await page.waitForSelector('#login-err:not(:empty)');
  ok(/موقوف/.test(await page.textContent('#login-err')), 'الحساب الموقوف لا يدخل: ' + (await page.textContent('#login-err')));
  await login('غريب', 'nobody@x.com');
  await page.waitForSelector('.page');
  ok(!(await navs()).includes('import'), 'غير المضاف يدخل كمشاهد');
  await logout();
  await login('جهاز شخصي');
  await page.waitForSelector('.page');
  await page.click('#acct');
  ok((await page.$('[data-action=users]')) !== null, 'الدخول بالاسم فقط (جهاز شخصي) مدير');

  await page.reload(); await page.waitForSelector('.page');
  await page.click('#acct');
  ok((await page.$('[data-action=users]')) !== null, 'بعد إعادة التحميل يبقى الدور مديرًا');
  const real = errors.filter((e) => !/CORS policy|preload assets|ERR_FAILED/.test(e));
  ok(real.length === 0, 'لا أخطاء في الـ console ' + JSON.stringify(real));
  await browser.close();
  if (fail) { console.log('FAILED', fail); process.exit(1); }
  console.log('USERS OK');
})().catch((e) => { console.error(e); process.exit(1); });
