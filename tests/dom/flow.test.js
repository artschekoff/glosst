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

async function open(browser, { answer, fixture = 'plain.html', savedLang = `'es'`, settings = SETTINGS }) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(here, 'fixtures', fixture)).href);
  await page.addScriptTag({
    content: BUNDLE + `
      window.asked = []; window.savedLang = ${savedLang}; window.setCalls = [];
      window.stop = start({
        doc: document,
        settings: ${settings},
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

// Одна и та же фраза встречается на странице дважды — повтор в списке,
// заголовок, реплика, — и это обычное дело, а не редкость. Второе
// место отделено распоркой, которой хватает, чтобы тултип первого
// места физически не мог его накрыть, но не настолько высокой, чтобы
// понадобилась прокрутка: прокрутка сама по себе гасит наведение
// (см. hover.js), и это увело бы тест в сторону от дедупликации.
test('та же фраза в другом месте получает ответ, а не тишину', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { answer: OK, fixture: 'twice.html' });

  const boxA = await page.locator('#a').boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(boxA.x + 30, boxA.y + 10);
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });

  const boxB = await page.locator('#b').boundingBox();
  await page.mouse.move(boxB.x + 30, boxB.y + 10);

  // Ждём, пока активная подсветка реально переедет на второй абзац —
  // не просто появится где-то, а встанет именно там.
  await page.waitForFunction(
    (bTop) => {
      const h = CSS.highlights.get('glosst-active');
      if (!h || h.size === 0) return false;
      const [range] = h;
      return Math.abs(range.getBoundingClientRect().top - bTop) < 5;
    },
    boxB.y,
    { timeout: 3000 }
  );

  assert.equal(
    (await page.evaluate(() => window.asked)).length, 1,
    'ответ уже есть — сеть трогать незачем'
  );

  const rects = await page.evaluate(() => {
    const h = CSS.highlights.get('glosst-active');
    const [range] = h;
    const active = range.getBoundingClientRect();
    const b = document.getElementById('b').getBoundingClientRect();
    return { activeTop: active.top, bTop: b.top };
  });
  assert.ok(
    Math.abs(rects.activeTop - rects.bTop) < 5,
    'подсветка должна стоять на втором абзаце, а не остаться на первом'
  );

  await browser.close();
});

// closestBlock раньше принимала только block/list-item/table-cell и,
// не найдя их, доходила до document.body. Текст, завёрнутый в
// inline-block (частая верстальщицкая обёртка карточек и колонок),
// именно так и ловился: единицей режима абзаца становилась вся
// страница — один платный запрос на весь её текст.
test('режим абзаца внутри inline-block берёт блок, а не всю страницу', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, {
    answer: OK,
    fixture: 'inline-block.html',
    settings: `{ granularity: 'paragraph', targetLang: 'ru', dwellMs: 100, modifier: 'alt',
                 colorActive: '#ffe08a', colorSeen: '#d9f2d9', colorError: '#ffd6d6' }`,
  });
  const box = await page.locator('#p').boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + 10, box.y + 8);
  await page.waitForFunction(() => window.asked.length > 0, null, { timeout: 3000 });

  const asked = await page.evaluate(() => window.asked);
  assert.equal(
    asked[0].text,
    'Vino a casa muy tarde, porque el tren se retrasó. Luego cenamos juntos.',
    'в запрос должен уйти только текст абзаца внутри inline-block'
  );
  assert.ok(
    !asked[0].text.includes('Esto no debe'),
    'текст соседнего блока страницы не должен попасть в запрос'
  );
  await browser.close();
});
