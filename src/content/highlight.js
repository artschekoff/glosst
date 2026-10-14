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
export function installStyles(colors) {
  if (!styleEl) {
    styleEl = document.createElement('style');
    // Стиль живёт в <head>, но текст страницы не трогает: ::highlight()
    // красит диапазоны, а не элементы.
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    ::highlight(${LAYERS.active}) { background: ${colors.active}; }
    ::highlight(${LAYERS.seen})   { background: ${colors.seen}; text-decoration: underline; }
    ::highlight(${LAYERS.error})  { background: ${colors.error}; }
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
