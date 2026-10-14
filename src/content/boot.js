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
  // Статический import здесь невозможен: Chrome внедряет контент-скрипт
  // обычным скриптом, ключа "type":"module" у content_scripts нет. Через
  // динамический import остальные модули остаются ES-модулями, а файлы
  // открыты расширению благодаря web_accessible_resources в манифесте.
  const { start } = await import(chrome.runtime.getURL('src/content/index.js'));

  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...FALLBACK, ...(settings ?? {}) };
  const origin = location.origin;

  start({
    doc: document,
    settings: s,
    // lang воркеру не шлём: он нужен только нарезке на этой стороне.
    // Язык оригинала модель определяет сама (см. спеку, «Запрос к модели»).
    //
    // Все три обёртки ловят отказ sendMessage: воркер мог умереть или
    // расширение — перезагрузиться, и тогда promise падает. Без ловли
    // здесь отказ всплывал бы внутри setTimeout в hover.js, где его
    // некому поймать, и тултип навсегда застревал на «Перевожу…».
    ask: async (text) => {
      try {
        return await chrome.runtime.sendMessage({ type: 'translate', text, targetLang: s.targetLang });
      } catch {
        return { ok: false, code: 'internal', message: 'Расширение перезагружено, обновите страницу' };
      }
    },
    getLang: async () => {
      try {
        return (await chrome.runtime.sendMessage({ type: 'getSiteLang', origin })).lang;
      } catch {
        return null;
      }
    },
    setLang: async (lang) => {
      try {
        await chrome.runtime.sendMessage({ type: 'setSiteLang', origin, lang });
      } catch {
        // Смена языка не критична: если не дошла, человек увидит это
        // по тому, что язык снова спросят в следующий раз.
      }
    },
  });
})();
