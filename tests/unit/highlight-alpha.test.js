import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAlpha } from '../../src/content/highlight.js';

// Сплошная заливка закрывает текст на слоях, где сам текст прозрачный,
// а видимые глифы нарисованы ниже — так устроен просмотрщик PDF.
// Полупрозрачная подсветка пропускает их наружу.
test('hex превращается в rgba с прозрачностью', () => {
  assert.equal(withAlpha('#d9f2d9', 0.35), 'rgba(217, 242, 217, 0.35)');
});

test('короткая запись hex тоже понимается', () => {
  assert.equal(withAlpha('#fff', 0.5), 'rgba(255, 255, 255, 0.5)');
});

test('регистр букв не важен', () => {
  assert.equal(withAlpha('#FFE08A', 0.35), withAlpha('#ffe08a', 0.35));
});

// Если в настройках окажется не hex, молча подсунуть прозрачность
// нельзя: лучше отдать значение как есть, чем сломать правило CSS.
test('не-hex возвращается нетронутым', () => {
  assert.equal(withAlpha('rgba(1, 2, 3, 0.5)', 0.35), 'rgba(1, 2, 3, 0.5)');
  assert.equal(withAlpha('red', 0.35), 'red');
  assert.equal(withAlpha('', 0.35), '');
});
