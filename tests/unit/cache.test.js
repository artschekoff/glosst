import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheGet, cacheSet, cacheSweep } from '../../src/bg/cache.js';

// Подделка chrome.storage.local: те же три метода, обычный объект внутри.
// Настоящее хранилище в тестах не нужно, а поведение проверяется то же.
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
    async remove(keys) {
      for (const k of (Array.isArray(keys) ? keys : [keys])) delete data[k];
    },
  };
}

const DAY = 86400000;
const entry = { translation: 'Привет', note: '', model: 'gpt-4o-mini' };

test('записанное читается', async () => {
  const s = fakeStorage();
  await cacheSet(s, 'k1', entry, 1000);
  assert.equal((await cacheGet(s, 'k1', 30 * DAY, 2000)).translation, 'Привет');
});

test('чего нет — null', async () => {
  assert.equal(await cacheGet(fakeStorage(), 'нет', 30 * DAY, 1000), null);
});

test('просроченное не отдаётся', async () => {
  const s = fakeStorage();
  await cacheSet(s, 'k1', entry, 0);
  assert.equal(await cacheGet(s, 'k1', 30 * DAY, 31 * DAY), null);
});

test('не просроченное отдаётся', async () => {
  const s = fakeStorage();
  await cacheSet(s, 'k1', entry, 0);
  assert.ok(await cacheGet(s, 'k1', 30 * DAY, 29 * DAY));
});

// Просроченное не только не отдаётся, но и удаляется при чтении: иначе
// хранилище растёт на записях, которые уже никогда не пригодятся.
test('просроченное удаляется при чтении', async () => {
  const s = fakeStorage();
  await cacheSet(s, 'k1', entry, 0);
  await cacheGet(s, 'k1', 30 * DAY, 31 * DAY);
  assert.equal('glosst:k1' in s.data, false);
});

test('уборка сносит только просроченное', async () => {
  const s = fakeStorage();
  await cacheSet(s, 'старое', entry, 0);
  await cacheSet(s, 'свежее', entry, 29 * DAY);
  const removed = await cacheSweep(s, 30 * DAY, 31 * DAY);
  assert.equal(removed, 1);
  assert.equal('glosst:старое' in s.data, false);
  assert.equal('glosst:свежее' in s.data, true);
});

// У чужих записей здесь СВОЙ ts, и он просрочен. Это принципиально:
// без него (как было в первой редакции) запись выживала бы и без
// фильтра по приставке — `now - undefined` даёт NaN, а `NaN > ttlMs`
// ложно. Тест проходил бы с вырезанным фильтром, то есть не проверял
// бы ничего. С просроченным ts запись спасает только фильтр.
test('уборка не трогает чужие ключи', async () => {
  const s = fakeStorage({
    settings: { model: 'gpt-4o-mini', ts: 0 },
    'glosst-lang:https://a.com': { lang: 'es', ts: 0 },
  });
  await cacheSet(s, 'старое', entry, 0);

  const removed = await cacheSweep(s, 30 * DAY, 31 * DAY);

  assert.equal(removed, 1, 'снести можно только запись кэша');
  assert.deepEqual(s.data.settings, { model: 'gpt-4o-mini', ts: 0 });
  assert.deepEqual(s.data['glosst-lang:https://a.com'], { lang: 'es', ts: 0 });
});
