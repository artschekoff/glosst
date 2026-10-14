import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from './playwright.js';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8').replace(/^(export |import .*\n)/gm, '');

// Модули склеиваются в один скрипт: в тесте нет сборщика, а порядок
// известен заранее.
const BUNDLE = [
  'src/content/segment.js',
  'src/content/lang.js',
  'src/content/highlight.js',
  'src/content/hover.js',
  'src/content/tooltip.js',
  'src/content/index.js',
].map(read).join('\n');

const SETTINGS = `{ granularity: 'sentence', targetLang: 'ru', dwellMs: 100, modifier: 'alt',
                    colorActive: '#ffe08a', colorSeen: '#d9f2d9', colorError: '#ffd6d6' }`;

async function open(browser, { answer, fixture = 'plain.html', savedLang = `'es'` }) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(here, 'fixtures', fixture)).href);
  await page.addScriptTag({
    content: BUNDLE + `
      window.asked = []; window.savedLang = ${savedLang}; window.setCalls = [];
      window.stop = start({
        doc: document,
        settings: ${SETTINGS},
        ask: async (text, lang) => { window.asked.push({ text, lang }); return (${answer}); },
        getLang: async () => window.savedLang,
        setLang: async (code) => { window.setCalls.push(code); window.savedLang = code; },
      });`,
    type: 'module',
  });
  await page.waitForFunction(() => !!window.stop);
  return page;
}

const OK = `{ ok: true, translation: 'Пришёл домой очень поздно.', note: 'vino — от venir' }`;

/** Навести с зажатым Alt и отпустить. */
async function hover(page, dx = 30, dy = 10) {
  const box = await page.locator('#p').boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + dx, box.y + dy);
}

test('наведение с Alt переводит предложение под курсором', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK });
  await hover(page);
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });

  const asked = await page.evaluate(() => window.asked);
  assert.equal(asked[0].text, 'Vino a casa muy tarde, porque el tren se retrasó.');
  await browser.close();
});

// Главное свойство вызова: без Alt расширение молчит.
test('без Alt ничего не происходит', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK });
  const box = await page.locator('#p').boundingBox();
  await page.mouse.move(box.x + 30, box.y + 10);
  await page.waitForTimeout(500);

  assert.deepEqual(await page.evaluate(() => window.asked), []);
  await browser.close();
});

test('перевод доезжает до тултипа', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK });
  await hover(page);
  await page.waitForFunction(
    () => document.querySelector('glosst-tip')?.shadowRoot.textContent.includes('Пришёл'),
    null, { timeout: 3000 }
  );
  await browser.close();
});

// Главная гарантия спеки — проверяем её на полном ходе, а не только на
// подсветке в отрыве.
test('после полного прохода разметка страницы прежняя', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK });
  const before = await page.$eval('#p', (el) => el.outerHTML);
  await hover(page);
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });

  assert.equal(await page.$eval('#p', (el) => el.outerHTML), before);
  await browser.close();
});

test('переведённое место остаётся в следе', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK });
  await hover(page);
  await page.waitForFunction(() => CSS.highlights.get('glosst-seen')?.size > 0, null, { timeout: 3000 });
  await browser.close();
});

test('ошибка показывается человеку, а не глотается', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: `{ ok: false, code: 'quota', message: 'Закончился баланс' }` });
  await hover(page);
  await page.waitForFunction(
    () => document.querySelector('glosst-tip')?.shadowRoot.textContent.includes('баланс'),
    null, { timeout: 3000 }
  );
  await browser.close();
});

test('повторное наведение на то же место не спрашивает заново', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK });
  await hover(page, 30);
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });
  await page.mouse.move((await page.locator('#p').boundingBox()).x + 34, (await page.locator('#p').boundingBox()).y + 10);
  await page.waitForTimeout(400);

  assert.equal((await page.evaluate(() => window.asked)).length, 1);
  await browser.close();
});

// У plain.html нет <html lang>. Язык обязаны спросить, а не угадать.
test('без html lang спрашивает язык и не переводит', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK, savedLang: 'null' });
  await hover(page);
  await page.waitForFunction(
    () => document.querySelector('glosst-tip')?.shadowRoot.textContent.includes('Язык'),
    null, { timeout: 3000 }
  );

  assert.deepEqual(await page.evaluate(() => window.asked), [], 'до ответа переводить нечего');
  await browser.close();
});

test('выбранный язык запоминается и перевод идёт дальше', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK, savedLang: 'null' });
  await hover(page);
  await page.waitForFunction(
    () => document.querySelector('glosst-tip')?.shadowRoot.querySelector('[data-code="es"]'),
    null, { timeout: 3000 }
  );
  await page.evaluate(() =>
    document.querySelector('glosst-tip').shadowRoot.querySelector('[data-code="es"]').click()
  );
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });

  assert.deepEqual(await page.evaluate(() => window.setCalls), ['es']);
  assert.equal((await page.evaluate(() => window.asked))[0].lang, 'es');
  await browser.close();
});

test('запомненный язык вопроса не вызывает', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK, savedLang: `'es'` });
  await hover(page);
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });

  assert.deepEqual(await page.evaluate(() => window.setCalls), [], 'спрашивать было незачем');
  await browser.close();
});

// У spanish.html атрибут есть — вопроса быть не должно вовсе.
test('с html lang язык берётся молча', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK, fixture: 'spanish.html' });
  await hover(page);
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });

  assert.equal((await page.evaluate(() => window.asked))[0].lang, 'es');
  assert.deepEqual(await page.evaluate(() => window.setCalls), []);
  await browser.close();
});
