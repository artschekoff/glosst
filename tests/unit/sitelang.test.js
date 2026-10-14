import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSiteLang, setSiteLang, clearSiteLangs } from '../../src/bg/sitelang.js';

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

test('язык запоминается на домен', async () => {
  const s = fakeStorage();
  await setSiteLang(s, 'https://clarin.com', 'es');
  assert.equal(await getSiteLang(s, 'https://clarin.com'), 'es');
});

test('у незнакомого домена языка нет', async () => {
  assert.equal(await getSiteLang(fakeStorage(), 'https://nueva.com'), null);
});

// Вопрос задаётся один раз на домен, а не один раз вообще.
test('домены не делят язык между собой', async () => {
  const s = fakeStorage();
  await setSiteLang(s, 'https://clarin.com', 'es');
  assert.equal(await getSiteLang(s, 'https://lemonde.fr'), null);
});

test('выбор можно поменять', async () => {
  const s = fakeStorage();
  await setSiteLang(s, 'https://clarin.com', 'es');
  await setSiteLang(s, 'https://clarin.com', 'pt');
  assert.equal(await getSiteLang(s, 'https://clarin.com'), 'pt');
});

test('сброс сносит все языки и говорит сколько', async () => {
  const s = fakeStorage();
  await setSiteLang(s, 'https://a.com', 'es');
  await setSiteLang(s, 'https://b.com', 'en');
  assert.equal(await clearSiteLangs(s), 2);
  assert.equal(await getSiteLang(s, 'https://a.com'), null);
});

// В том же хранилище лежат настройки и кэш переводов.
test('сброс языков не трогает настройки и кэш', async () => {
  const s = fakeStorage({ settings: { model: 'gpt-4o-mini' }, 'glosst:abc': { translation: 'x' } });
  await setSiteLang(s, 'https://a.com', 'es');
  await clearSiteLangs(s);
  assert.deepEqual(s.data.settings, { model: 'gpt-4o-mini' });
  assert.ok(s.data['glosst:abc']);
});
