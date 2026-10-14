import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheKey } from '../../src/bg/cachekey.js';

test('одинаковый вход даёт одинаковый ключ', async () => {
  const a = await cacheKey('Hola', 'ru', 'gpt-4o-mini');
  const b = await cacheKey('Hola', 'ru', 'gpt-4o-mini');
  assert.equal(a, b);
});

// Модель в ключе обязательна: сменили модель — прежние переводы не
// должны выдаваться за новые.
test('смена модели меняет ключ', async () => {
  const a = await cacheKey('Hola', 'ru', 'gpt-4o-mini');
  const b = await cacheKey('Hola', 'ru', 'gpt-4o');
  assert.notEqual(a, b);
});

test('смена языка цели меняет ключ', async () => {
  const a = await cacheKey('Hola', 'ru', 'gpt-4o-mini');
  const b = await cacheKey('Hola', 'en', 'gpt-4o-mini');
  assert.notEqual(a, b);
});

// Склейка через разделитель, а не конкатенация: иначе ('ab','c') и
// ('a','bc') дали бы один ключ.
test('границы полей не склеиваются', async () => {
  const a = await cacheKey('ab', 'c', 'm');
  const b = await cacheKey('a', 'bc', 'm');
  assert.notEqual(a, b);
});

test('ключ — hex и фиксированной длины', async () => {
  const k = await cacheKey('Hola', 'ru', 'gpt-4o-mini');
  assert.match(k, /^[0-9a-f]{64}$/);
});
