/**
 * Настройки расширения.
 *
 * Всё читается через loadSettings: она дополняет сохранённое
 * умолчаниями. Без этого новая настройка, добавленная в новой версии,
 * приходила бы undefined тем, у кого хранилище от старой.
 */

const KEY = 'settings';

export const DEFAULTS = {
  apiKey: '',
  model: 'gpt-4o-mini',
  targetLang: 'ru',
  sourceLang: 'auto',
  granularity: 'sentence',
  modifier: 'alt',
  dwellMs: 300,
  ttlDays: 30,
  wantNote: true,
  colorActive: '#ffe08a',
  colorSeen: '#d9f2d9',
  colorError: '#ffd6d6',
};

export async function loadSettings(storage) {
  const got = await storage.get(KEY);
  return { ...DEFAULTS, ...(got[KEY] ?? {}) };
}

export async function saveSettings(storage, patch) {
  const current = await loadSettings(storage);
  await storage.set({ [KEY]: { ...current, ...patch } });
}
