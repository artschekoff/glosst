/**
 * Своя страница просмотра PDF.
 *
 * Зачем она есть. Во встроенный просмотрщик Chrome расширению хода
 * нет: текст документа живёт внутри страницы ДРУГОГО расширения
 * (chrome-extension://mhjfbmd…), а внедрять туда скрипты браузер
 * запрещает. Проверено — в кадре со встроенным просмотрщиком нашего
 * расширения не оказывается.
 *
 * Поэтому документ открывается здесь: страница наша, значит модули
 * перевода подключаются к ней напрямую, без контент-скрипта и без
 * ограничений.
 *
 * Выбор сознательный: привычный просмотрщик остаётся по умолчанию, а
 * сюда документ попадает только по кнопке.
 */
import * as pdfjs from './vendor/pdf.min.mjs';
import { start } from '../content/index.js';

const FALLBACK = {
  granularity: 'sentence',
  targetLang: 'ru',
  dwellMs: 300,
  modifier: 'alt',
  colorActive: '#ffe08a',
  colorSeen: '#d9f2d9',
  colorError: '#ffd6d6',
};

/** Во сколько раз увеличивать страницу: мельче читать тяжело. */
const SCALE = 1.5;

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

/** Показать сообщение вместо документа. */
function showStatus(title, text, extra = '') {
  document.getElementById('main').innerHTML = '';
  const box = document.createElement('div');
  box.className = 'status';

  const h = document.createElement('h1');
  h.textContent = title;

  const p = document.createElement('p');
  p.textContent = text;

  box.append(h, p);

  if (extra) {
    const c = document.createElement('code');
    c.textContent = extra;
    box.append(c);
  }

  document.getElementById('main').append(box);
}

/** Нарисовать одну страницу: картинка плюс слой текста поверх неё. */
async function renderPage(page, into) {
  const viewport = page.getViewport({ scale: SCALE });

  const wrap = document.createElement('div');
  wrap.className = 'page';
  wrap.style.width = `${Math.round(viewport.width)}px`;
  wrap.style.height = `${Math.round(viewport.height)}px`;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const layer = document.createElement('div');
  layer.className = 'textLayer';

  wrap.append(canvas, layer);
  into.append(wrap);

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  // Слой текста обязателен: без него на странице нечего выделять и
  // нечего переводить — остались бы одни картинки.
  const textLayer = new pdfjs.TextLayer({
    textContentSource: await page.getTextContent(),
    container: layer,
    viewport,
  });
  await textLayer.render();
}

async function main() {
  const file = new URLSearchParams(location.search).get('file');

  if (!file) {
    showStatus('Нечего показывать', 'Адрес документа не передан.');
    return;
  }

  document.getElementById('name').textContent = decodeURIComponent(file.split('/').pop());

  let doc;
  try {
    // Строкой этот вызов не принимает: нужен объект с url.
    doc = await pdfjs.getDocument({ url: file }).promise;
  } catch (err) {
    // Самая частая причина для file:// — выключённый доступ к файлам.
    // Говорим прямо, что нажать, а не «не удалось открыть».
    showStatus(
      'Документ не открылся',
      file.startsWith('file:')
        ? 'Для файлов с диска включите доступ к файлам у расширения и откройте документ заново.'
        : String(err && err.message ? err.message : err),
      file.startsWith('file:') ? 'chrome://extensions → Glosst → Разрешить доступ к файлам' : ''
    );
    return;
  }

  const main = document.getElementById('main');
  main.innerHTML = '';

  for (let n = 1; n <= doc.numPages; n++) {
    await renderPage(await doc.getPage(n), main);
  }

  document.getElementById('hint').textContent =
    doc.numPages === 1 ? '1 страница' : `${doc.numPages} страниц`;

  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...FALLBACK, ...(settings ?? {}) };

  // Страница наша, поэтому модули перевода подключаются напрямую —
  // контент-скрипт здесь не нужен и не сработал бы.
  start({
    doc: document,
    settings: s,
    ask: async (text) => {
      try {
        return await chrome.runtime.sendMessage({ type: 'translate', text, targetLang: s.targetLang });
      } catch {
        return { ok: false, code: 'internal', message: 'Extension reloaded — refresh the page' };
      }
    },
    getLang: async () => {
      try {
        return (await chrome.runtime.sendMessage({ type: 'getSiteLang', origin: file })).lang;
      } catch {
        return null;
      }
    },
    setLang: async (lang) => {
      try {
        await chrome.runtime.sendMessage({ type: 'setSiteLang', origin: file, lang });
      } catch {
        // Молча: язык спросится заново при следующем открытии.
      }
    },
  });
}

main();
