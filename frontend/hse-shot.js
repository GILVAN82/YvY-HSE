const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  await p.goto('http://localhost:4200/', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2500);
  const shot = 'C:/Users/Gil/AppData/Local/Temp/claude/c--Users-Gil-Documents-hse-system-app/7aa3fb84-df3b-48f3-92ab-b4c04bd9e600/scratchpad/hse-home.png';
  await p.screenshot({ path: shot, fullPage: true });
  const text = (await p.innerText('body')).slice(0, 400);
  console.log('TITLE:', await p.title());
  console.log('BODY:', text.replace(/\n+/g,' | '));
  console.log('CONSOLE_ERRORS:', errors.slice(0,5).join(' || ') || 'none');
  console.log('SHOT:', shot);
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
