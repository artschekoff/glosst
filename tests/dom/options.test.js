import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from './playwright.js';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, '../..');
const page_ = pathToFileURL(path.join(root, 'src/options/options.html')).href;
const strip = (p) => readFileSync(path.join(root, p), 'utf8').replace(/^(export |import .*\n)/gm, '');
// settings.js подключаем первым: readForm обращается к DEFAULTS для
// клампа пустых числовых полей, а import-строка сама по себе из
// склейки вырезается.
const source = strip('src/bg/settings.js') + '\n' + strip('src/options/labels.js')
  + '\n' + strip('src/options/options.js');

async function open(browser) {
  const page = await browser.newPage();
  await page.goto(page_);
  await page.addScriptTag({ content: source + '\nwindow.F = { fillForm, readForm, DEFAULTS, applyModifierLabels, modifierLabels };', type: 'module' });
  await page.waitForFunction(() => !!window.F);
  return page;
}

test('форма заполняется настройками', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const vals = await page.evaluate(() => {
    window.F.fillForm(document, { apiKey: 'sk-x', model: 'gpt-4o', targetLang: 'en',
      granularity: 'paragraph', dwellMs: 500, ttlDays: 7, wantNote: false,
      colorActive: '#111111', colorSeen: '#222222', colorError: '#333333' });
    return {
      key: document.getElementById('apiKey').value,
      model: document.getElementById('model').value,
      gran: document.getElementById('granularity').value,
      note: document.getElementById('wantNote').checked,
    };
  });
  assert.equal(vals.key, 'sk-x');
  assert.equal(vals.model, 'gpt-4o');
  assert.equal(vals.gran, 'paragraph');
  assert.equal(vals.note, false);
  await browser.close();
});

test('прочитанное из формы совпадает с записанным', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const out = await page.evaluate(() => {
    const s = { apiKey: 'sk-y', model: 'gpt-4o-mini', targetLang: 'ru',
      granularity: 'sentence', dwellMs: 250, ttlDays: 14, wantNote: true,
      colorActive: '#ffe08a', colorSeen: '#d9f2d9', colorError: '#ffd6d6' };
    window.F.fillForm(document, s);
    return window.F.readForm(document);
  });
  assert.equal(out.apiKey, 'sk-y');
  assert.equal(out.dwellMs, 250);
  assert.equal(out.ttlDays, 14);
  assert.equal(out.wantNote, true);
  await browser.close();
});

// Модель должна и выбираться из списка, и вписываться руками:
// провайдеры меняют названия чаще, чем выходят версии расширения.
test('модель можно вписать свою', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const got = await page.evaluate(() => {
    document.getElementById('model').value = 'какая-то-новая-модель';
    return window.F.readForm(document).model;
  });
  assert.equal(got, 'какая-то-новая-модель');
  await browser.close();
});

// Клавишу вызова можно сменить или отключить совсем.
test('клавиша вызова читается и пишется', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const got = await page.evaluate(() => {
    window.F.fillForm(document, { apiKey: '', model: 'm', targetLang: 'ru',
      granularity: 'sentence', modifier: 'ctrl', dwellMs: 300, ttlDays: 30, wantNote: true,
      colorActive: '#ffe08a', colorSeen: '#d9f2d9', colorError: '#ffd6d6' });
    const shown = document.getElementById('modifier').value;
    document.getElementById('modifier').value = 'none';
    return { shown, read: window.F.readForm(document).modifier };
  });
  assert.equal(got.shown, 'ctrl');
  assert.equal(got.read, 'none');
  await browser.close();
});

test('числовые поля приходят числами, а не строками', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const t = await page.evaluate(() => {
    document.getElementById('dwellMs').value = '400';
    const r = window.F.readForm(document);
    return typeof r.dwellMs;
  });
  assert.equal(t, 'number');
  await browser.close();
});

// Круговой тест (fillForm → readForm) не различает перестановку двух
// числовых полей местами: если обе функции спутают id одинаково, round
// trip всё равно сойдётся. Проверяем DOM после fillForm напрямую, минуя
// readForm, — так перестановка dwellMs/ttlDays видна.
test('числовые поля не перепутаны местами', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const vals = await page.evaluate(() => {
    window.F.fillForm(document, { apiKey: '', model: 'm', targetLang: 'ru',
      granularity: 'sentence', modifier: 'alt', dwellMs: 111, ttlDays: 222, wantNote: true,
      colorActive: '#ffe08a', colorSeen: '#d9f2d9', colorError: '#ffd6d6' });
    return {
      dwell: document.getElementById('dwellMs').value,
      ttl: document.getElementById('ttlDays').value,
    };
  });
  assert.equal(vals.dwell, '111');
  assert.equal(vals.ttl, '222');
  await browser.close();
});

// Number('') === 0, а markup min= никогда не проверяется — формы без
// submit браузер не валидирует. ttlDays:0 "просрочивает" весь кэш
// немедленно (каждое наведение снова платное), dwellMs:0 стреляет
// запросом на любое шевеление мыши без паузы.
test('опустошённое числовое поле возвращается умолчанием, а не нулём', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);
  const out = await page.evaluate(() => {
    document.getElementById('dwellMs').value = '';
    document.getElementById('ttlDays').value = '';
    return window.F.readForm(document);
  });
  assert.equal(out.dwellMs, (await page.evaluate(() => window.F.DEFAULTS.dwellMs)));
  assert.equal(out.ttlDays, (await page.evaluate(() => window.F.DEFAULTS.ttlDays)));
  assert.notEqual(out.dwellMs, 0);
  assert.notEqual(out.ttlDays, 0);
  await browser.close();
});

// Подписывать маководу «Alt» неверно: такой клавиши у него на
// клавиатуре нет. Проверяем, что названия и правда меняются, а значения
// при этом остаются прежними — на них завязаны и настройки, и код.
test('клавиши подписаны по системе', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);

  const got = await page.evaluate(() => {
    const read = () => [...document.getElementById('modifier').options]
      .map((o) => [o.value, o.textContent]);

    window.F.applyModifierLabels(document, true);
    const mac = read();
    window.F.applyModifierLabels(document, false);
    const win = read();
    return { mac, win };
  });

  const macText = Object.fromEntries(got.mac);
  const winText = Object.fromEntries(got.win);

  assert.match(macText.alt, /Option/, 'на Mac это Option, а не Alt');
  assert.match(macText.meta, /Command/);
  assert.equal(winText.alt, 'Alt');
  assert.match(winText.meta, /Win/);

  // Значения трогать нельзя: по ним хранятся настройки.
  assert.deepEqual(got.mac.map(([v]) => v), got.win.map(([v]) => v));
  assert.deepEqual(got.mac.map(([v]) => v), ['alt', 'ctrl', 'meta', 'shift', 'none']);

  await browser.close();
});
