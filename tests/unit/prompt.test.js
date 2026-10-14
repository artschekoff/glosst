import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBody, parseAnswer } from '../../src/bg/prompt.js';

test('тело запроса несёт модель и текст', () => {
  const b = buildBody({ text: 'Hola', targetLang: 'ru', model: 'gpt-4o-mini', wantNote: true });
  assert.equal(b.model, 'gpt-4o-mini');
  assert.ok(JSON.stringify(b.messages).includes('Hola'));
});

// Без строгого JSON разбор ответа превращается в угадывание.
test('ответ просим строгим JSON', () => {
  const b = buildBody({ text: 'Hola', targetLang: 'ru', model: 'gpt-4o-mini', wantNote: true });
  assert.deepEqual(b.response_format, { type: 'json_object' });
});

test('язык цели попадает в запрос', () => {
  const b = buildBody({ text: 'Hola', targetLang: 'ru', model: 'gpt-4o-mini', wantNote: true });
  assert.match(JSON.stringify(b.messages), /ru|русск/i);
});

// Пометки стоят лишних токенов: выключили — не просим.
test('без пометок их не просят', () => {
  const withNote = JSON.stringify(buildBody({ text: 'x', targetLang: 'ru', model: 'm', wantNote: true }));
  const without = JSON.stringify(buildBody({ text: 'x', targetLang: 'ru', model: 'm', wantNote: false }));
  assert.ok(withNote.includes('note'));
  assert.ok(!without.includes('note'));
});

const answer = (content) => ({ choices: [{ message: { content } }] });

test('разбирает перевод и пометку', () => {
  const r = parseAnswer(answer('{"translation":"Привет","note":"vino — от venir"}'));
  assert.equal(r.translation, 'Привет');
  assert.equal(r.note, 'vino — от venir');
});

test('пометки может не быть', () => {
  assert.equal(parseAnswer(answer('{"translation":"Привет"}')).note, '');
});

test('не-JSON в ответе — ошибка, а не тихий мусор', () => {
  assert.throws(() => parseAnswer(answer('Привет, вот перевод')), /ответ/i);
});

test('JSON без перевода — ошибка', () => {
  assert.throws(() => parseAnswer(answer('{"note":"только пометка"}')), /ответ/i);
});

test('пустой список choices — ошибка', () => {
  assert.throws(() => parseAnswer({ choices: [] }), /ответ/i);
});
