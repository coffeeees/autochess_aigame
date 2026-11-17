const { chromium } = require('playwright');
const S = (n) => (process.env.SHOT_DIR || __dirname + '/shots') + '/' + n + '.png';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const modalOpen = () =>
    p.evaluate(() => {
      const m = document.getElementById('modal');
      return !!m && !m.hidden && (m.open === undefined || m.open) &&
        document.getElementById('modalContent').innerText.trim().length > 0;
    });
  const mt = () => p.evaluate(() => document.getElementById('modalContent').innerText.slice(0, 80).replace(/\n/g, ' | '));
  const label = () => p.evaluate(() => document.getElementById('stageLabel')?.innerText + ' / ' + document.getElementById('fightBtn')?.innerText.replace(/\n/g, ' '));
  async function supply() {
    const slots = await p.$$('[data-supply-slot]');
    await slots[0].click();
    await p.waitForTimeout(200);
    const s2 = await p.$$('[data-supply-slot]');
    await s2[s2.length - 1].click();
    await p.waitForTimeout(200);
    await p.click('[data-confirm-supply]');
    await p.waitForTimeout(800);
  }
  async function drag(fromSel, toSel) {
    const f = await p.$(fromSel), t = await p.$(toSel);
    if (!f || !t) return false;
    const a = await f.boundingBox(), c = await t.boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await p.mouse.down();
    await p.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 - 10, { steps: 3 });
    await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 });
    await p.mouse.up();
    await p.waitForTimeout(300);
    return true;
  }
  await p.goto('http://127.0.0.1:4173/');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(1000);
  await p.click('#homeNewBtn');
  await p.waitForTimeout(300);
  await p.click('#confirmDifficultyBtn');
  await p.waitForTimeout(1000);
  const shot = {};
  for (let step = 0; step < 10; step++) {
    console.log('step', step, await label());
    if (await modalOpen()) {
      console.log(' modal:', await mt());
      if (await p.$('[data-supply-slot]')) {
        if (!shot.supply) { await p.screenshot({ path: S('05-supply') }); shot.supply = 1; }
        await supply();
        continue;
      }
      if (await p.$('#modalContent [data-augment]')) {
        if (!shot.aug) { await p.screenshot({ path: S('06-augment') }); shot.aug = 1; }
        await (await p.$$('#modalContent [data-augment]'))[0].click();
        await p.waitForTimeout(800);
        continue;
      }
      await p.screenshot({ path: S('09-result-' + step) });
      const btns = await p.$$('#modalContent button');
      if (btns.length) await btns[btns.length - 1].click();
      else await p.click('#closeModal');
      await p.waitForTimeout(800);
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const free = await p.evaluate(() =>
        [...document.querySelectorAll('[data-pos]')]
          .filter((c) => +c.dataset.pos >= 28 && !c.querySelector('[data-unit-uid]'))
          .map((c) => +c.dataset.pos));
      if (!(await p.$('#bench [data-unit-uid]')) || !free.length) break;
      await drag('#bench [data-unit-uid]', `[data-pos="${free[3] ?? free[0]}"]`);
    }
    if (!shot.deploy && step > 0) { await p.screenshot({ path: S('07-deployed') }); shot.deploy = 1; }
    await p.click('#fightBtn');
    await p.waitForTimeout(700);
    if ((await modalOpen()) && !(await p.$('[data-supply-slot]')) && !(await p.$('#modalContent [data-augment]'))) {
      console.log(' confirm?', await mt());
      const btns = await p.$$('#modalContent button');
      if (btns.length) await btns[btns.length - 1].click();
      await p.waitForTimeout(700);
    }
    if (!shot.battle && !(await modalOpen())) {
      await p.waitForTimeout(3500);
      const inBattle = await p.evaluate(() => document.getElementById('fightBtn')?.disabled || document.body.className);
      console.log(' battle?', inBattle);
      await p.screenshot({ path: S('08-battle-' + step) });
    }
    for (let w = 0; w < 60 && !(await modalOpen()); w++) await p.waitForTimeout(500);
  }
  for (const [btn, name] of [['#rosterBtn','10-codex'],['#settingsBtn','11-settings'],['#moreBtn','12-more'],['#patchBtn','13-patch-notes']]) {
    if (await modalOpen()) { const bt = await p.$('#closeModal'); if (bt) await bt.click(); await p.waitForTimeout(400); }
    await p.click(btn).catch((e) => console.log('miss', btn));
    await p.waitForTimeout(800);
    await p.screenshot({ path: S(name) });
    if (name === '12-more') continue;
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
  }
  console.log(errs);
  await b.close();
})();
