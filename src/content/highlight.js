/**
 * Слои подсветки.
 *
 * CSS Custom Highlight API вместо обёртки текста в теги: разметка
 * страницы остаётся нетронутой, а значит не ломаются ни SPA, ни
 * селекторы сайта, ни вёрстка. Это главная гарантия всего расширения,
 * и на неё есть отдельный тест.
 */

export const LAYERS = {
  active: 'glosst-active',
  seen: 'glosst-seen',
  error: 'glosst-error',
};

/** Приоритеты при наложении: активное место обязано быть видно поверх следа. */
const PRIORITY = { [LAYERS.seen]: 1, [LAYERS.error]: 2, [LAYERS.active]: 3 };

let styleEl = null;

/** Оформление слоёв. Цвета настраиваемые: на тёмной теме умолчания слепнут. */
/**
 * Доля непрозрачности подсветки.
 *
 * Сплошная заливка закрывает текст там, где сам текст прозрачный, а
 * видимые глифы нарисованы ниже: так устроен просмотрщик PDF — буквы
 * на canvas, а поверх невидимый слой для выделения. Подсветка такого
 * слоя ложится ПОВЕРХ картинки, и строка превращается в цветную
 * полосу без текста. Полупрозрачность пропускает глифы наружу и на
 * обычных страницах читается не хуже сплошной.
 */
const ALPHA = 0.35;

/**
 * Перевести #rrggbb (или #rgb) в rgba с прозрачностью.
 *
 * Значение не из hex возвращается как есть: подставить в CSS битое
 * правило хуже, чем оставить непрозрачный, но рабочий цвет.
 */
export function withAlpha(color, alpha) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
  if (!m) {
    return color;
  }

  let hex = m[1];
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }

  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function installStyles(colors) {
  if (!styleEl) {
    styleEl = document.createElement('style');
    // Стиль живёт в <head>, но текст страницы не трогает: ::highlight()
    // красит диапазоны, а не элементы.
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    ::highlight(${LAYERS.active}) { background: ${withAlpha(colors.active, ALPHA)}; }
    ::highlight(${LAYERS.seen})   { background: ${withAlpha(colors.seen, ALPHA)}; text-decoration: underline; }
    ::highlight(${LAYERS.error})  { background: ${withAlpha(colors.error, ALPHA)}; }
  `;
}

function layer(name) {
  let h = CSS.highlights.get(name);
  if (!h) {
    h = new Highlight();
    h.priority = PRIORITY[name];
    CSS.highlights.set(name, h);
  }
  return h;
}

function only(name, range) {
  const h = layer(name);
  h.clear();
  h.add(range);
}

export function markActive(range) { only(LAYERS.active, range); }
export function markError(range) { only(LAYERS.error, range); }

/** След копится за сеанс, поэтому add, а не замена. */
export function markSeen(range) { layer(LAYERS.seen).add(range); }

export function clearActive() { CSS.highlights.delete(LAYERS.active); }
export function clearError() { CSS.highlights.delete(LAYERS.error); }

export function clearAll() {
  for (const name of Object.values(LAYERS)) {
    CSS.highlights.delete(name);
  }
}
