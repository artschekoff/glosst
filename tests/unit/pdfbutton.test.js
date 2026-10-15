import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPdfDocument } from '../../src/content/pdfbutton.js';

// Настоящий document не нужен: функции хватает двух полей.
const doc = ({ type, embed = null }) => ({
  contentType: type,
  querySelector: (sel) => (embed && sel.includes('application/pdf') ? embed : null),
});

test('вкладка с PDF опознаётся по типу содержимого', () => {
  assert.equal(isPdfDocument(doc({ type: 'application/pdf' })), true);
});

// Запасной признак: встроенный просмотрщик вставляет такой embed.
// Нужен потому, что contentType правдив не во всех сборках.
test('вкладка с PDF опознаётся по встроенному объекту', () => {
  assert.equal(isPdfDocument(doc({ type: 'text/html', embed: {} })), true);
});

test('обычная страница за PDF не принимается', () => {
  assert.equal(isPdfDocument(doc({ type: 'text/html' })), false);
});

// На обычной странице кнопка не нужна: там и так всё работает, а лишний
// элемент поверх чужой вёрстки — помеха.
test('пустой тип содержимого не считается PDF', () => {
  assert.equal(isPdfDocument(doc({ type: undefined })), false);
});
