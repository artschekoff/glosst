/**
 * Доступ к глобально установленному playwright.
 *
 * Прямой ESM-импорт здесь не работает: NODE_PATH действует на require,
 * но не на import. createRequire даёт нам require внутри ES-модуля и
 * тем самым возвращает NODE_PATH в игру.
 *
 * Ссылки в node_modules сознательно НЕ используем: свежий клон их не
 * получит, и DOM-сюита сломается молча.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let playwright;
try {
  playwright = require('playwright');
} catch (cause) {
  throw new Error(
    'Не найден playwright. Он установлен глобально, а ESM-import его не видит:\n' +
    'NODE_PATH действует на require, но не на import.\n' +
    'Запускать так:\n' +
    '  npm run test:dom\n' +
    '(скрипт сам подставляет NODE_PATH; если ошибка осталась — путь к\n' +
    'глобальным модулям на этой машине другой, поправьте его в package.json)',
    { cause }
  );
}

export const { chromium } = playwright;
