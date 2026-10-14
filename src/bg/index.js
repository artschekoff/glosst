import { handleTranslate } from './handler.js';
import { cacheSweep } from './cache.js';
import { loadSettings } from './settings.js';

const DAY = 86400000;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'translate') {
    return false;
  }

  handleTranslate(msg, { storage: chrome.storage.local })
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
