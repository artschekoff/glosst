import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from './playwright.js';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const fixture = pathToFileURL(path.join(here, 'fixtures/plain.html')).href;
const source = readFileSync(path.join(here, '../../src/content/hover.js'), 'utf8');

async function open(browser, { modifier = 'alt', delayMs = 150 } = {}) {
  const page = await browser.newPage();
  await page.goto(fixture);
  await page.addScriptTag({
    content: source.replace(/^export /gm, '') +
      `\nwindow.HV = { rangeAtPoint, closestBlock, watchDwell };
       window.fired = []; window.cancelled = 0;
       window.stop = watchDwell(document, {
         delayMs: ${delayMs}, modifier: '${modifier}',
         onDwell: (p) => window.fired.push(p),
         onCancel: () => window.cancelled++,
       });`,
    type: 'module',
  });
  await page.waitForFunction(() => !!window.HV);
  return page;
}

test('точка в тексте даёт текстовый узел и смещение', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const box = await page.locator('#p').boundingBox();
  const got = await page.evaluate(([x, y]) => {
    const r = window.HV.rangeAtPoint(document, x, y);
    return r ? { node: r.startContainer.nodeName, offset: r.startOffset } : null;
  }, [box.x + 30, box.y + 8]);

  assert.equal(got.node, '#text');
  assert.ok(Number.isInteger(got.offset));
  await browser.close();
});

test('точка вне текста даёт null', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  assert.equal(await page.evaluate(() => window.HV.rangeAtPoint(document, 5000, 5000)), null);
  await browser.close();
});

test('ближайший блок найден', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const id = await page.evaluate(() => window.HV.closestBlock(document.getElementById('p').firstChild).id);
  assert.equal(id, 'p');
  await browser.close();
});

// Главное свойство: без зажатой клавиши расширение молчит, сколько бы
// курсор ни стоял на тексте.
test('без зажатой клавиши не срабатывает никогда', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const box = await page.locator('#p').boundingBox();

  await page.mouse.move(box.x + 40, box.y + 8);
  await page.waitForTimeout(500);

  assert.deepEqual(await page.evaluate(() => window.fired), []);
  await browser.close();
});

test('с зажатой клавишей и остановкой срабатывает один раз', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const box = await page.locator('#p').boundingBox();

  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + 40, box.y + 8);
  await page.waitForTimeout(500);
  await page.keyboard.up('Alt');

  assert.equal((await page.evaluate(() => window.fired)).length, 1);
  await browser.close();
});

// Проводка мышью с зажатой клавишей не должна стоить ни одного запроса.
test('движение с зажатой клавишей без остановки не срабатывает', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const box = await page.locator('#p').boundingBox();

  await page.keyboard.down('Alt');
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(box.x + 10 + i * 20, box.y + 8);
    await page.waitForTimeout(40);
  }
  await page.keyboard.up('Alt');

  assert.deepEqual(await page.evaluate(() => window.fired), []);
  await browser.close();
});

// Клавишу можно зажать, не двигая мышью. Без обработки нажатия пришлось
// бы дёргать мышь, чтобы расширение заметило Alt.
test('нажатие клавиши при неподвижной мыши тоже срабатывает', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const box = await page.locator('#p').boundingBox();

  await page.mouse.move(box.x + 40, box.y + 8);
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => window.fired), [], 'до нажатия тишина');

  await page.keyboard.down('Alt');
  await page.waitForTimeout(400);
  await page.keyboard.up('Alt');

  assert.equal((await page.evaluate(() => window.fired)).length, 1);
  await browser.close();
});

test('отпускание клавиши отменяет показ', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const box = await page.locator('#p').boundingBox();

  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + 40, box.y + 8);
  await page.waitForTimeout(400);
  await page.keyboard.up('Alt');
  await page.waitForTimeout(100);

  assert.ok((await page.evaluate(() => window.cancelled)) > 0);
  await browser.close();
});

// Клавишу можно отключить совсем: тогда хватает одной задержки.
// onCancel обязан реагировать на свою клавишу, а не на любую: иначе
// набор текста в поле на странице сбрасывал бы показанную подсказку.
test('отпускание посторонней клавиши не отменяет показ', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const box = await page.locator('#p').boundingBox();

  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + 40, box.y + 8);
  await page.waitForTimeout(400);
  await page.keyboard.press('x');
  await page.waitForTimeout(100);

  assert.equal(await page.evaluate(() => window.cancelled), 0);
  await page.keyboard.up('Alt');
  await browser.close();
});

test('modifier none срабатывает без клавиш', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { modifier: 'none' });
  const box = await page.locator('#p').boundingBox();

  await page.mouse.move(box.x + 40, box.y + 8);
  await page.waitForTimeout(500);

  assert.equal((await page.evaluate(() => window.fired)).length, 1);
  await browser.close();
});

test('отписка выключает слежение', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  await page.evaluate(() => window.stop());
  const box = await page.locator('#p').boundingBox();

  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + 40, box.y + 8);
  await page.waitForTimeout(400);
  await page.keyboard.up('Alt');

  assert.deepEqual(await page.evaluate(() => window.fired), []);
  await browser.close();
});
