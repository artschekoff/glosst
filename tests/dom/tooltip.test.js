import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from './playwright.js';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, '../../src/content/tooltip.js'), 'utf8');
const url = (f) => pathToFileURL(path.join(here, 'fixtures', f)).href;

async function open(browser, fixture) {
  const page = await browser.newPage();
  await page.goto(url(fixture));
  await page.addScriptTag({
    content: source.replace(/^export /gm, '') + '\nwindow.T = createTooltip(document);',
    type: 'module',
  });
  await page.waitForFunction(() => !!window.T);
  return page;
}

const rect = { left: 20, top: 40, bottom: 60, width: 200 };

test('показывает перевод и пометку', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, 'plain.html');
  const text = await page.evaluate((r) => {
    window.T.showResult(r, { translation: 'Пришёл домой поздно.', note: 'vino — от venir' });
    return document.querySelector('glosst-tip').shadowRoot.textContent;
  }, rect);

  assert.ok(text.includes('Пришёл домой поздно.'));
  assert.ok(text.includes('vino — от venir'));
  await browser.close();
});

// Пустую пометку показывать нечего — пустая строка в тултипе выглядит
// как обрезанный текст.
test('пустая пометка не рисуется', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, 'plain.html');
  const has = await page.evaluate((r) => {
    window.T.showResult(r, { translation: 'Привет', note: '' });
    return !!document.querySelector('glosst-tip').shadowRoot.querySelector('.note');
  }, rect);

  assert.equal(has, false);
  await browser.close();
});

test('показывает ожидание и ошибку', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, 'plain.html');
  const states = await page.evaluate((r) => {
    const sr = () => document.querySelector('glosst-tip').shadowRoot.textContent;
    window.T.showLoading(r); const loading = sr();
    window.T.showError(r, 'Закончился баланс'); const error = sr();
    return { loading, error };
  }, rect);

  assert.ok(states.loading.length > 0);
  assert.ok(states.error.includes('Закончился баланс'));
  await browser.close();
});

test('hide убирает тултип с глаз', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, 'plain.html');
  const visible = await page.evaluate((r) => {
    window.T.showResult(r, { translation: 'Привет', note: '' });
    window.T.hide();
    const host = document.querySelector('glosst-tip');
    return getComputedStyle(host).display !== 'none';
  }, rect);

  assert.equal(visible, false);
  await browser.close();
});

// Когда у страницы нет <html lang>, язык спрашиваем, а не угадываем:
// ошиблись языком — поехала нарезка, и человек получил кривую единицу,
// не понимая почему.
test('спрашивает язык списком и отдаёт выбор', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, 'plain.html');
  const picked = await page.evaluate(async (r) => {
    return await new Promise((resolve) => {
      window.T.showLanguagePicker(r, [
        { code: 'es', label: 'Испанский' },
        { code: 'en', label: 'Английский' },
      ], resolve);
      const sr = document.querySelector('glosst-tip').shadowRoot;
      sr.querySelector('[data-code="en"]').click();
    });
  }, rect);

  assert.equal(picked, 'en');
  await browser.close();
});

test('в списке языков видны названия', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, 'plain.html');
  const text = await page.evaluate((r) => {
    window.T.showLanguagePicker(r, [{ code: 'es', label: 'Испанский' }], () => {});
    return document.querySelector('glosst-tip').shadowRoot.textContent;
  }, rect);

  assert.ok(text.includes('Испанский'));
  await browser.close();
});

// Ради этого тултип и живёт в shadow DOM: стили сайта не должны его
// доставать. Страница hostile.html красит всё подряд с !important.
test('стили враждебного сайта не достают тултип', async () => {
  const browser = await chromium.launch();
  const page = await open(browser, 'hostile.html');
  const style = await page.evaluate((r) => {
    window.T.showResult(r, { translation: 'Привет', note: '' });
    const host = document.querySelector('glosst-tip');
    const inner = host.shadowRoot.querySelector('.body');
    const cs = getComputedStyle(inner);
    return { color: cs.color, fontSize: cs.fontSize, display: getComputedStyle(host).display };
  }, rect);

  assert.notEqual(style.color, 'rgb(255, 0, 0)', 'цвет сайта не должен протечь');
  assert.notEqual(style.fontSize, '40px', 'размер шрифта сайта не должен протечь');
  assert.notEqual(style.display, 'none', 'правило сайта не должно спрятать тултип');
  await browser.close();
});
