import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from './playwright.js';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

/**
 * Единственный тест этого файла грузит НАСТОЯЩЕЕ расширение, как его
 * грузит браузер человека, — а не склейку модулей, как остальная
 * DOM-сюита. Склейка однажды мариновала мёртвое расширение: манифест
 * был битым (`"type":"module"` там, где Chrome его не читает), контент
 * скрипт падал на первой же строке, а 42 теста это не заметили,
 * потому что тестировали не ту сборку, которая ставится.
 */

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, '../..');
const fixture = pathToFileURL(path.join(here, 'fixtures/spanish.html')).href;

test('расширение реально запускается на странице, без склейки модулей', async (t) => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glosst-profile-'));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`,
    ],
  });

  t.after(async () => {
    await context.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(fixture);
  // Контент-скрипт грузится асинхронно (динамический import), даём
  // ему время отработать, прежде чем проверять результат.
  await page.waitForTimeout(1000);

  assert.deepEqual(errors, [], 'содержимое страницы не должно кидать ошибок при внедрении контент-скрипта');

  const hasTip = await page.evaluate(() => !!document.querySelector('glosst-tip'));
  assert.ok(hasTip, 'контент-скрипт обязан был вставить хост тултипа — доказательство, что он реально выполнился');
});
