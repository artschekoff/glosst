import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, loadSettings, saveSettings } from '../../src/bg/settings.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      if (keys === null || keys === undefined) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(obj) { Object.assign(data, obj); },
    async remove(keys) { for (const k of (Array.isArray(keys) ? keys : [keys])) delete data[k]; },
  };
}

test('на пустом хранилище отдаёт умолчания', async () => {
  assert.deepEqual(await loadSettings(fakeStorage()), DEFAULTS);
});

test('модель по умолчанию gpt-4o-mini', () => {
  assert.equal(DEFAULTS.model, 'gpt-4o-mini');
});

test('ключа по умолчанию нет', () => {
  assert.equal(DEFAULTS.apiKey, '');
});

test('режим по умолчанию — предложение', () => {
  assert.equal(DEFAULTS.granularity, 'sentence');
});

// Без модификатора тултипы выскакивали бы при обычном чтении: курсор
// почти всегда лежит где-то в тексте.
test('по умолчанию вызов по Alt', () => {
  assert.equal(DEFAULTS.modifier, 'alt');
});

test('сохранённое перекрывает умолчание', async () => {
  const s = fakeStorage();
  await saveSettings(s, { model: 'gpt-4o' });
  assert.equal((await loadSettings(s)).model, 'gpt-4o');
});

// Добавили новую настройку в новой версии — у человека в хранилище её
// нет. Отдать undefined значит уронить расширение после обновления.
test('частично сохранённое дополняется умолчаниями', async () => {
  const s = fakeStorage({ settings: { model: 'gpt-4o' } });
  const got = await loadSettings(s);
  assert.equal(got.model, 'gpt-4o');
  assert.equal(got.granularity, DEFAULTS.granularity);
  assert.equal(got.dwellMs, DEFAULTS.dwellMs);
});

test('сохранение не стирает прочие настройки', async () => {
  const s = fakeStorage();
  await saveSettings(s, { model: 'gpt-4o' });
  await saveSettings(s, { targetLang: 'en' });
  const got = await loadSettings(s);
  assert.equal(got.model, 'gpt-4o');
  assert.equal(got.targetLang, 'en');
});
