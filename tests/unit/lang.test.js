import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageLang, LANG_CHOICES } from '../../src/content/lang.js';

// Настоящий document не нужен: функции хватает одного поля.
const doc = (lang) => ({ documentElement: { lang } });

test('берёт язык из html lang', () => {
  assert.equal(pageLang(doc('es')), 'es');
});

// Intl.Segmenter принял бы и es-AR, но ключ кэша и список языков
// проще держать в базовой форме.
test('региональный код сводится к базовому', () => {
  assert.equal(pageLang(doc('es-AR')), 'es');
  assert.equal(pageLang(doc('pt-BR')), 'pt');
});

test('регистр не важен', () => {
  assert.equal(pageLang(doc('ES-AR')), 'es');
});

// Эти случаи обязаны дать null, а не догадку: пустой или мусорный
// атрибут встречается чаще, чем кажется.
test('пустой или отсутствующий атрибут даёт null', () => {
  assert.equal(pageLang(doc('')), null);
  assert.equal(pageLang(doc(undefined)), null);
  assert.equal(pageLang({ documentElement: {} }), null);
});

test('мусор в атрибуте даёт null', () => {
  assert.equal(pageLang(doc('—')), null);
  assert.equal(pageLang(doc('unknown language')), null);
});

test('в списке для вопроса есть испанский и он с названием', () => {
  const es = LANG_CHOICES.find((l) => l.code === 'es');
  assert.ok(es);
  assert.ok(es.label.length > 0);
});
