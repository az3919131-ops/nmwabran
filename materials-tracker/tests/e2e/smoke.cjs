const { launch, fileUrl } = require('./harness.cjs');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-nmwabran/bcbad044-f9e9-50f8-94b4-ce0e32325ad5/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto(fileUrl());
  await page.waitForSelector('.login-card');
  await page.screenshot({ path: OUT + '/01-login.png' });
  await page.fill('input[name=name]', 'م. أحمد زهران');
  await page.click('button[type=submit]');
  await page.waitForSelector('.project-card, .state-empty');
  await page.screenshot({ path: OUT + '/02-projects.png' });
  await page.click('#add-demo');
  await page.waitForSelector('.kpis');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/03-dashboard.png', fullPage: true });
  const kpis = await page.$$eval('.kpi', (els) => els.map((e) => e.getAttribute('aria-label')));
  console.log(kpis);
  console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
