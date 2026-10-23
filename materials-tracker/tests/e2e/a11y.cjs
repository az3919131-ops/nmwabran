/* فحص إمكانية الوصول بـ axe-core على كل الشاشات (WCAG 2 A/AA) */
const { launch, fileUrl, DEPS } = require('./harness.cjs');
const path = require('path');
const fs = require('fs');
const axeSrc = fs.readFileSync(path.join(DEPS, 'axe-core', 'axe.min.js'), 'utf8');
(async () => {
  const W = Number(process.env.W || 1440);
  const { browser, page, errors } = await launch({ width: W, height: W < 700 ? 740 : 900, mobile: W < 700 });
  let total = 0;
  const check = async (name) => {
    await page.waitForTimeout(400);
    await page.evaluate(axeSrc);
    const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
    const v = res.violations;
    total += v.length;
    console.log(`${name}: ${v.length ? v.length + ' مخالفة' : 'نظيفة'}`);
    v.forEach((x) => console.log(`   [${x.impact}] ${x.id}: ${x.help} (${x.nodes.length}) ->`, x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | '), '\n      ', x.nodes[0].failureSummary.split('\n').slice(0, 3).join(' / ').slice(0, 260)));
  };
  await page.goto(fileUrl());
  await page.waitForSelector('.login-card');
  await check('login');
  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.waitForSelector('#add-demo');
  await check('projects-empty');
  await page.click('#add-demo');
  await page.waitForSelector('.kpis');
  await check('dashboard');
  for (const [name, hash, sel] of [['compare', '#/compare', '.table'], ['compare-orders', '#/compare?view=orders', '.wo-card'], ['reports-summary', '#/reports', '.table'], ['reports-pair', '#/reports?tab=cl-gp', '.table'], ['reports-shortage', '#/reports?tab=shortage', '.table'], ['import-checklist', '#/import/checklist', '.dropzone'], ['import-gatepass', '#/import/gatepass', '.dropzone'], ['catalog', '#/catalog', '.table'], ['projects', '#/projects', '.project-card']]) {
    await page.goto(fileUrl(hash));
    await page.waitForSelector(sel);
    await check(name);
  }
  await page.goto(fileUrl('#/compare'));
  await page.waitForSelector('[data-detail]');
  await page.click('[data-detail]');
  await page.waitForSelector('dialog[open]');
  await check('detail-dialog');
  await page.keyboard.press('Escape');
  await page.goto(fileUrl('#/import/checklist'));
  await page.waitForSelector('#skip, [data-pick]');
  await page.setInputFiles('#f-img', '/tmp/claude-0/-home-user-nmwabran/bcbad044-f9e9-50f8-94b4-ce0e32325ad5/images/2.webp');
  await page.waitForSelector('#skip');
  await check('import-prepare');
  await page.click('#skip');
  await page.waitForSelector('#rv-body', { state: 'attached' });
  await page.click('#add-row');
  await check('import-review');
  await page.click('#bell').catch(() => {});
  console.log('TOTAL', total, 'ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
