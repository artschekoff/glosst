import { start } from './index.js';

/**
 * Умолчания на случай, если настройки ещё не сохранялись.
 * Полный их список живёт в src/bg/settings.js; здесь только то, без
 * чего контент-скрипт не стартует.
 */
const FALLBACK = {
  granularity: 'sentence', targetLang: 'ru', dwellMs: 300, modifier: 'alt',
  colorActive: '#ffe08a', colorSeen: '#d9f2d9', colorError: '#ffd6d6',
};

(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...FALLBACK, ...(settings ?? {}) };
  const origin = location.origin;

  start({
    doc: document,
    settings: s,
    // lang воркеру не шлём: он нужен только нарезке на этой стороне.
    // Язык оригинала модель определяет сама (см. спеку, «Запрос к модели»).
    ask: (text) =>
      chrome.runtime.sendMessage({ type: 'translate', text, targetLang: s.targetLang }),
    getLang: async () =>
      (await chrome.runtime.sendMessage({ type: 'getSiteLang', origin })).lang,
    setLang: (lang) =>
      chrome.runtime.sendMessage({ type: 'setSiteLang', origin, lang }),
  });
})();
