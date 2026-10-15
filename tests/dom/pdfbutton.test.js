import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from './playwright.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, '../..');
const source = readFileSync(path.join(root, 'src/content/pdfbutton.js'), 'utf8')
  .replace(/^export /gm, '');

async function open(browser) {
  const page = await browser.newPage();
  // Враждебная страница: красит и прячет всё подряд. Кнопка обязана
  // устоять — иначе на реальном сайте её бы просто не было видно.
  await page.setContent(`<style>
      * { color: red !important; font-size: 40px !important; }
      button { display: none !important; }
    </style><p>страница</p>`);
  await page.addScriptTag({
    content: source + '\nwindow.B = { isPdfDocument, mountPdfButton };',
    type: 'module',
  });
  await page.waitForFunction(() => !!window.B);
  return page;
}

test('кнопка рисуется и устойчива к стилям страницы', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);

  const got = await page.evaluate(() => {
    window.B.mountPdfButton(document, () => {});
    const host = document.querySelector('glosst-open');
    const button = host.shadowRoot.querySelector('button');
    const cs = getComputedStyle(button);
    const box = button.getBoundingClientRect();
    return {
      текст: button.textContent,
      ширина: Math.round(box.width),
      высота: Math.round(box.height),
      цвет: cs.color,
      фон: cs.backgroundColor,
      показана: cs.display,
    };
  });

  // Сперва убеждаемся, что кнопка вообще занимает место: иначе проверки
  // «цвет не сайта» прошли бы и для отсутствующего элемента.
  assert.ok(got.ширина > 0 && got.высота > 0, 'кнопка должна занимать место');
  assert.notEqual(got.показана, 'none', 'правило display:none с сайта не должно её скрыть');
  assert.equal(got.цвет, 'rgb(255, 255, 255)', 'цвет наш, а не сайта');
  assert.equal(got.фон, 'rgb(47, 111, 208)', 'фон как у кнопки в настройках');
  assert.equal(got.текст, 'Open in Glosst');

  await browser.close();
});

test('нажатие отдаёт адрес документа', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);

  const отдано = await page.evaluate(() => new Promise((resolve) => {
    window.B.mountPdfButton(document, resolve);
    document.querySelector('glosst-open').shadowRoot.querySelector('button').click();
  }));

  assert.equal(отдано, await page.evaluate(() => location.href));
  await browser.close();
});

test('снятие убирает кнопку со страницы', async () => {
  const browser = await chromium.launch();
  const page = await open(browser);

  const осталась = await page.evaluate(() => {
    const off = window.B.mountPdfButton(document, () => {});
    off();
    return !!document.querySelector('glosst-open');
  });

  assert.equal(осталась, false);
  await browser.close();
});
