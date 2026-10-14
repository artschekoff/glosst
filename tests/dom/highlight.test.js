import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const fixture = pathToFileURL(path.join(here, 'fixtures/plain.html')).href;
const source = readFileSync(path.join(here, '../../src/content/highlight.js'), 'utf8');

/** Подключает модуль на страницу и возвращает открытую вкладку. */
async function open(browser) {
  const page = await browser.newPage();
  await page.goto(fixture);
  await page.addScriptTag({ content: source.replace(/^export /gm, ''), type: 'module' });
  // Модуль через addScriptTag не виден в evaluate: вешаем на window.
  await page.addScriptTag({
    content: source.replace(/^export /gm, '') +
      '\nwindow.H = { LAYERS, installStyles, markActive, markSeen, markError, clearActive, clearError, clearAll };',
    type: 'module',
  });
  await page.waitForFunction(() => !!window.H);
  return page;
}

test('подсветка не меняет разметку страницы', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);

  const before = await page.$eval('#p', (el) => el.outerHTML);
  await page.evaluate(() => {
    const tn = document.getElementById('p').firstChild;
    const r = new Range(); r.setStart(tn, 0); r.setEnd(tn, 10);
    window.H.installStyles({ active: '#ffe08a', seen: '#d9f2d9', error: '#ffd6d6' });
    window.H.markActive(r);
  });
  const after = await page.$eval('#p', (el) => el.outerHTML);

  assert.equal(after, before, 'разметка обязана остаться побайтово прежней');
  await browser.close();
});

test('слои живут одновременно', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const keys = await page.evaluate(() => {
    const tn = document.getElementById('p').firstChild;
    const mk = (a, z) => { const r = new Range(); r.setStart(tn, a); r.setEnd(tn, z); return r; };
    window.H.installStyles({ active: '#ffe08a', seen: '#d9f2d9', error: '#ffd6d6' });
    window.H.markSeen(mk(0, 48));
    window.H.markActive(mk(0, 4));
    return [...CSS.highlights.keys()].sort();
  });
  assert.deepEqual(keys, ['glosst-active', 'glosst-seen']);
  await browser.close();
});

// При наложении активный слой обязан перекрывать след, иначе место под
// курсором теряется среди уже прочитанного.
test('активный слой приоритетнее следа', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const prio = await page.evaluate(() => {
    const tn = document.getElementById('p').firstChild;
    const mk = (a, z) => { const r = new Range(); r.setStart(tn, a); r.setEnd(tn, z); return r; };
    window.H.installStyles({ active: '#ffe08a', seen: '#d9f2d9', error: '#ffd6d6' });
    window.H.markSeen(mk(0, 48));
    window.H.markActive(mk(0, 4));
    return {
      active: CSS.highlights.get('glosst-active').priority,
      seen: CSS.highlights.get('glosst-seen').priority,
    };
  });
  assert.ok(prio.active > prio.seen);
  await browser.close();
});

// След копится за сеанс: снятие активной подсветки не должно его стирать.
test('след переживает снятие активного слоя', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const keys = await page.evaluate(() => {
    const tn = document.getElementById('p').firstChild;
    const mk = (a, z) => { const r = new Range(); r.setStart(tn, a); r.setEnd(tn, z); return r; };
    window.H.installStyles({ active: '#ffe08a', seen: '#d9f2d9', error: '#ffd6d6' });
    window.H.markSeen(mk(0, 48));
    window.H.markActive(mk(0, 4));
    window.H.clearActive();
    return [...CSS.highlights.keys()];
  });
  assert.deepEqual(keys, ['glosst-seen']);
  await browser.close();
});

test('след накапливает несколько мест', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const size = await page.evaluate(() => {
    const tn = document.getElementById('p').firstChild;
    const mk = (a, z) => { const r = new Range(); r.setStart(tn, a); r.setEnd(tn, z); return r; };
    window.H.installStyles({ active: '#ffe08a', seen: '#d9f2d9', error: '#ffd6d6' });
    window.H.markSeen(mk(0, 10));
    window.H.markSeen(mk(49, 60));
    return CSS.highlights.get('glosst-seen').size;
  });
  assert.equal(size, 2);
  await browser.close();
});
