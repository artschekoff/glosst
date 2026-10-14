import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../../src/bg/translate.js';

const live = process.env.GLOSST_LIVE === '1' && process.env.OPENAI_API_KEY;

// Единственный тест, который тратит деньги. Включается явно:
//   GLOSST_LIVE=1 OPENAI_API_KEY=sk-... npm test
// Нужен, чтобы заметить, если формат запроса или ответа у провайдера
// разойдётся с тем, что собрано в prompt.js. Подделки этого не поймут.
test('живой вызов возвращает разумный перевод', { skip: !live }, async () => {
  const r = await translate({
    text: 'Vino a casa muy tarde, porque el tren se retrasó.',
    targetLang: 'ru',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    wantNote: true,
  });

  assert.ok(r.translation.length > 10, 'перевод не должен быть пустым');
  assert.match(r.translation, /[а-яё]/i, 'перевод должен быть на русском');
  assert.equal(typeof r.note, 'string');
});
