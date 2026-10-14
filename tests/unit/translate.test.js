import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, TranslateError } from '../../src/bg/translate.js';

const ok = (content) => async () => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});
const fail = (status, body) => async () => ({
  ok: false, status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const args = { text: 'Hola', targetLang: 'ru', model: 'gpt-4o-mini', apiKey: 'k', wantNote: true };

test('успешный перевод возвращается', async () => {
  const r = await translate({ ...args, fetchImpl: ok('{"translation":"Привет"}') });
  assert.equal(r.translation, 'Привет');
});

test('ключ уходит в заголовке', async () => {
  let seen;
  const spy = async (url, init) => { seen = init; return (await ok('{"translation":"x"}')()); };
  await translate({ ...args, fetchImpl: spy });
  assert.equal(seen.headers.Authorization, 'Bearer k');
});

test('без ключа в сеть не ходим вовсе', async () => {
  let called = false;
  const spy = async () => { called = true; };
  await assert.rejects(
    translate({ ...args, apiKey: '', fetchImpl: spy }),
    (e) => e instanceof TranslateError && e.code === 'no-key'
  );
  assert.equal(called, false, 'запроса быть не должно');
});

test('401 — ключ не принят', async () => {
  await assert.rejects(
    translate({ ...args, fetchImpl: fail(401, { error: { message: 'bad key' } }) }),
    (e) => e.code === 'unauthorized'
  );
});

// Пустой баланс приходит как 429, и это НЕ то же, что превышение частоты:
// лечится пополнением, а не ожиданием. Коды разные.
test('429 с insufficient_quota — это кончились деньги', async () => {
  await assert.rejects(
    translate({ ...args, fetchImpl: fail(429, { error: { code: 'insufficient_quota' } }) }),
    (e) => e.code === 'quota'
  );
});

test('429 без insufficient_quota — превышение частоты', async () => {
  await assert.rejects(
    translate({ ...args, fetchImpl: fail(429, { error: { code: 'rate_limit_exceeded' } }) }),
    (e) => e.code === 'rate-limit'
  );
});

test('обрыв сети — одна повторная попытка, потом ошибка', async () => {
  let calls = 0;
  const flaky = async () => { calls++; throw new TypeError('Failed to fetch'); };
  await assert.rejects(
    translate({ ...args, fetchImpl: flaky }),
    (e) => e.code === 'network'
  );
  assert.equal(calls, 2, 'одна попытка и один повтор');
});

test('обрыв на первой попытке, успех на второй', async () => {
  let calls = 0;
  const flaky = async (u, i) => {
    calls++;
    if (calls === 1) throw new TypeError('Failed to fetch');
    return ok('{"translation":"Привет"}')();
  };
  assert.equal((await translate({ ...args, fetchImpl: flaky })).translation, 'Привет');
});

test('мусор в ответе — bad-response', async () => {
  await assert.rejects(
    translate({ ...args, fetchImpl: ok('не json') }),
    (e) => e.code === 'bad-response'
  );
});

test('прочий HTTP-код не теряется', async () => {
  await assert.rejects(
    translate({ ...args, fetchImpl: fail(500, {}) }),
    (e) => e.code === 'http'
  );
});
