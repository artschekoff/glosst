import { DEFAULTS, loadSettings, saveSettings } from '../bg/settings.js';
import { clearSiteLangs } from '../bg/sitelang.js';

const TEXT = ['apiKey', 'model', 'targetLang', 'granularity', 'modifier', 'colorActive', 'colorSeen', 'colorError'];
const NUM = ['dwellMs', 'ttlDays'];

export function fillForm(doc, s) {
  for (const id of TEXT) doc.getElementById(id).value = s[id];
  for (const id of NUM) doc.getElementById(id).value = s[id];
  doc.getElementById('wantNote').checked = s.wantNote;
}

export function readForm(doc) {
  const out = {};
  for (const id of TEXT) out[id] = doc.getElementById(id).value;
  // Поля number отдают строку; в настройках нужны числа, иначе
  // ttlDays * DAY даст строку и срок жизни посчитается неверно.
  //
  // Опустошённое поле не должно превращаться в 0 — Number('') === 0,
  // а атрибуты min в разметке никогда не проверяются: формы без submit
  // браузер не валидирует. ttlDays:0 тут же "просрочивает" весь кэш, и
  // каждое наведение снова платное; dwellMs:0 стреляет запросом на
  // любое шевеление мыши. При нечисловом или неположительном значении
  // падаем на умолчание — оно уже импортировано из settings.js.
  for (const id of NUM) {
    const n = Number(doc.getElementById(id).value);
    out[id] = Number.isFinite(n) && n > 0 ? n : DEFAULTS[id];
  }
  out.wantNote = doc.getElementById('wantNote').checked;
  return out;
}

// В тестах модуль подключается отдельно, без chrome — тогда привязку
// к странице не вешаем.
if (typeof chrome !== 'undefined' && chrome.storage) {
  (async () => {
    fillForm(document, await loadSettings(chrome.storage.local));

    document.getElementById('save').addEventListener('click', async () => {
      await saveSettings(chrome.storage.local, readForm(document));
      const saved = document.getElementById('saved');
      saved.hidden = false;
      setTimeout(() => { saved.hidden = true; }, 1500);
    });

    document.getElementById('clearCache').addEventListener('click', async () => {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith('glosst:'));
      await chrome.storage.local.remove(keys);
      alert(`Удалено записей: ${keys.length}`);
    });

    document.getElementById('clearLangs').addEventListener('click', async () => {
      const n = await clearSiteLangs(chrome.storage.local);
      alert(`Забыто языков: ${n}. Сайты без <html lang> спросят заново.`);
    });
  })();
}
