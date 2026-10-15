import { handleTranslate } from './handler.js';
import { cacheSweep } from './cache.js';
import { loadSettings } from './settings.js';
import { getSiteLang, setSiteLang } from './sitelang.js';

const DAY = 86400000;

const ROUTES = {
  translate: (msg) => handleTranslate(msg, { storage: chrome.storage.local }),

  getSiteLang: async (msg) => ({
    ok: true,
    lang: await getSiteLang(chrome.storage.local, msg.origin),
  }),

  // Открываем свою страницу просмотра из воркера, а не из
  // контент-скрипта: переход на chrome-extension:// со страницы сайта
  // браузер бы не пустил.
  openViewer: async (msg) => {
    const url = chrome.runtime.getURL('src/viewer/viewer.html')
      + '?file=' + encodeURIComponent(msg.file);
    await chrome.tabs.create({ url });
    return { ok: true };
  },

  setSiteLang: async (msg) => {
    await setSiteLang(chrome.storage.local, msg.origin, msg.lang);
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const route = ROUTES[msg?.type];
  if (!route) {
    return false;
  }

  route(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, code: 'http', message: String(e) }));

  // true — ответ придёт асинхронно. Без этого канал закроется раньше
  // ответа, и контент-скрипт не дождётся ничего.
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('glosst-sweep', { periodInMinutes: 60 * 24 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'glosst-sweep') return;
  const { ttlDays } = await loadSettings(chrome.storage.local);
  await cacheSweep(chrome.storage.local, ttlDays * DAY, Date.now());
});
