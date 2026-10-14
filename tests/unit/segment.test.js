import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitBounds } from '../../src/content/segment.js';

const es = { granularity: 'sentence', lang: 'es' };
const slice = (t, b) => t.slice(b.start, b.end);

test('берёт предложение, внутри которого стоит курсор', () => {
  const t = 'Vino a casa muy tarde, porque el tren se retrasó. Luego cenamos juntos.';
  assert.equal(slice(t, unitBounds(t, 5, es)), 'Vino a casa muy tarde, porque el tren se retrasó.');
  assert.equal(slice(t, unitBounds(t, 55, es)), 'Luego cenamos juntos.');
});

// Сегментер режет «Sr. García» на два куска, и единицей стал бы огрызок
// «Sr. » — бесполезный для перевода и всё равно платный.
test('не разрывает сокращение с точкой', () => {
  const t = 'Sr. García llegó tarde. Cenamos juntos.';
  assert.equal(slice(t, unitBounds(t, 6, es)), 'Sr. García llegó tarde.');
});

test('не разрывает адрес с сокращением', () => {
  const t = 'Vive en Av. Corrientes. Trabaja cerca.';
  assert.equal(slice(t, unitBounds(t, 15, es)), 'Vive en Av. Corrientes.');
});

test('не разрывает число с точкой-разделителем', () => {
  const t = 'Cuesta 1.500 pesos. Es barato.';
  assert.equal(slice(t, unitBounds(t, 9, es)), 'Cuesta 1.500 pesos.');
});

test('не разрывает многоточие', () => {
  const t = 'No sé... quizá mañana. Ya veremos.';
  assert.equal(slice(t, unitBounds(t, 3, es)), 'No sé... quizá mañana.');
});

test('текст без финальной точки — одна единица', () => {
  const t = 'Hola mundo';
  assert.equal(slice(t, unitBounds(t, 4, es)), 'Hola mundo');
});

test('режим абзаца берёт весь текст блока', () => {
  const t = 'Primera frase. Segunda frase.';
  const b = unitBounds(t, 5, { granularity: 'paragraph', lang: 'es' });
  assert.deepEqual(b, { start: 0, end: t.length });
});

test('смещение вне текста даёт null, а не исключение', () => {
  assert.equal(unitBounds('Hola', 99, es), null);
  assert.equal(unitBounds('', 0, es), null);
});

// Пробелы между предложениями сегментер отдаёт в конце куска. В перевод
// их слать незачем, и подсветка на них выглядит как хвост.
test('границы не захватывают хвостовой пробел', () => {
  const t = 'Uno. Dos.';
  const b = unitBounds(t, 1, es);
  assert.equal(t.slice(b.start, b.end), 'Uno.');
});

// Каретка сразу за последним символом — обычное положение при наведении
// на конец абзаца. Цикл ищет offset < end и такое смещение не находит,
// поэтому конец текста разбирается отдельно.
test('курсор ровно в конце текста относится к последней единице', () => {
  assert.equal(slice('Uno. Dos.', unitBounds('Uno. Dos.', 9, es)), 'Dos.');
  assert.equal(slice('Hola mundo', unitBounds('Hola mundo', 10, es)), 'Hola mundo');
});

// Ud., Uds. и etc. — не то же самое, что Sr. и Dr.: они сплошь и рядом
// ЗАКАНЧИВАЮТ предложение. Склеивать их всегда значит сливать два
// независимых предложения в одну единицу перевода.
test('etc. в конце предложения не склеивается со следующим', () => {
  const t = 'Compré frutas, verduras, etc. Fue una compra grande.';
  assert.equal(slice(t, unitBounds(t, 2, es)), 'Compré frutas, verduras, etc.');
});

test('Ud. в конце предложения не склеивается со следующим', () => {
  const t = 'Hablé con Ud. Fue agradable.';
  assert.equal(slice(t, unitBounds(t, 2, es)), 'Hablé con Ud.');
});

// Но когда следующий кусок начинается со строчной — это продолжение
// той же фразы, и склеить обязаны.
//
// Перенос строки в примерах не для красоты: без него ICU отдаёт такой
// текст ОДНИМ куском, склейка не вызывается вовсе, и тест проходил бы
// даже с удалённой веткой — то есть не проверял бы ничего. На переносе
// ICU делит, и ветка «клеить по строчной» работает по‑настоящему.
// Для веб‑страниц это не экзотика: переносы внутри текстового узла
// обычны.
test('etc. с продолжением со строчной склеивается', () => {
  const t = 'Trajo manzanas, etc.\npero sin naranjas.';
  assert.equal(slice(t, unitBounds(t, 2, es)), t);
});

test('Ud. с продолжением со строчной склеивается', () => {
  const t = 'Hablé con Ud.\ny con su hermano.';
  assert.equal(slice(t, unitBounds(t, 2, es)), t);
});

// Правка «конец текста» не должна давать пустой диапазон на строке из
// одних пробелов: раньше тут был null, и так правильнее.
test('текст из одних пробелов даёт null', () => {
  assert.equal(unitBounds('   ', 3, es), null);
});

// Граница сокращения не только по пробелу: «(Sr. García» тоже сокращение.
test('сокращение после скобки распознаётся', () => {
  const t = '(Sr. García llegó.)';
  assert.equal(slice(t, unitBounds(t, 2, es)), t);
});
