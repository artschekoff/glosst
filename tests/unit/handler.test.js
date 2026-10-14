import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleTranslate } from '../../src/bg/handler.js';
import { TranslateError } from '../../src/bg/translate.js';

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

const msg = { type: 'translate', text: 'Hola', targetLang: 'ru' };
const withKey = { settings: { apiKey: 'k' } };

test('промах кэша идёт в сеть и отдаёт перевод', async () => {
  const r = await handleTranslate(msg, {
    storage: fakeStorage(withKey),
    translateImpl: async () => ({ translation: 'Привет', note: '' }),
    now: 1000,
  });
  assert.deepEqual(r, { ok: true, translation: 'Привет', note: '', cached: false });
});

// Ради этого кэш и заводился: второй заход не должен стоить денег.
test('второй раз берётся из кэша, в сеть не ходим', async () => {
  const storage = fakeStorage(withKey);
  let calls = 0;
  const deps = {
    storage,
    translateImpl: async () => { calls++; return { translation: 'Привет', note: '' }; },
    now: 1000,
  };
  await handleTranslate(msg, deps);
  const second = await handleTranslate(msg, deps);
  assert.equal(calls, 1, 'сеть должна быть вызвана один раз');
  assert.equal(second.cached, true);
  assert.equal(second.translation, 'Привет');
});

test('ошибка перевода отдаётся кодом, а не исключением', async () => {
  const r = await handleTranslate(msg, {
    storage: fakeStorage(withKey),
    translateImpl: async () => { throw new TranslateError('quota', 'Закончился баланс'); },
    now: 1000,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'quota');
});

// Неудачу кэшировать нельзя: пополнил баланс — должно заработать сразу.
test('ошибка не попадает в кэш', async () => {
  const storage = fakeStorage(withKey);
  let calls = 0;
  const failing = async () => { calls++; throw new TranslateError('quota', 'нет денег'); };
  await handleTranslate(msg, { storage, translateImpl: failing, now: 1000 });
  await handleTranslate(msg, { storage, translateImpl: failing, now: 1000 });
  assert.equal(calls, 2);
});

test('без ключа отвечает no-key', async () => {
  const r = await handleTranslate(msg, {
    storage: fakeStorage(),
    translateImpl: async () => { throw new TranslateError('no-key', 'нет ключа'); },
    now: 1000,
  });
  assert.equal(r.code, 'no-key');
});

// Смена модели не должна выдавать старые переводы за новые.
test('смена модели обходит кэш', async () => {
  const storage = fakeStorage({ settings: { apiKey: 'k', model: 'gpt-4o-mini' } });
  let calls = 0;
  const impl = async () => { calls++; return { translation: 'Привет', note: '' }; };
  await handleTranslate(msg, { storage, translateImpl: impl, now: 1000 });
  storage.data.settings = { apiKey: 'k', model: 'gpt-4o' };
  await handleTranslate(msg, { storage, translateImpl: impl, now: 1000 });
  assert.equal(calls, 2);
});
