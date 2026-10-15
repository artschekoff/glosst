import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMacPlatform, modifierLabels } from '../../src/options/labels.js';

test('Mac опознаётся по современному userAgentData', () => {
  assert.equal(isMacPlatform({ userAgentData: { platform: 'macOS' } }), true);
});

// navigator.platform объявлен устаревшим, но в вебвью и старых сборках
// это всё ещё единственное, что есть.
test('Mac опознаётся и по устаревшему platform', () => {
  assert.equal(isMacPlatform({ platform: 'MacIntel' }), true);
});

test('Windows и Linux за Mac не принимаются', () => {
  assert.equal(isMacPlatform({ userAgentData: { platform: 'Windows' } }), false);
  assert.equal(isMacPlatform({ platform: 'Linux x86_64' }), false);
});

test('пустой navigator не роняет и даёт не-Mac', () => {
  assert.equal(isMacPlatform(undefined), false);
  assert.equal(isMacPlatform({}), false);
});

// Главное: подписывать маководу «Alt» неверно — такой клавиши у него
// на клавиатуре просто нет, там Option.
test('на Mac клавиши названы по-маковски', () => {
  const l = modifierLabels(true);
  assert.match(l.alt, /Option/);
  assert.match(l.meta, /Command/);
  assert.match(l.ctrl, /Control/);
});

test('на Windows и Linux клавиши названы по-своему', () => {
  const l = modifierLabels(false);
  assert.equal(l.alt, 'Alt');
  assert.equal(l.ctrl, 'Ctrl');
  assert.match(l.meta, /Win/);
});

test('подписи есть у всех поддерживаемых значений, включая отказ от клавиши', () => {
  for (const mac of [true, false]) {
    const l = modifierLabels(mac);
    for (const key of ['alt', 'ctrl', 'shift', 'meta', 'none']) {
      assert.equal(typeof l[key], 'string', `нет подписи для ${key} (mac=${mac})`);
      assert.ok(l[key].length > 0, `пустая подпись для ${key} (mac=${mac})`);
    }
  }
});
