/**
 * Тултип с переводом.
 *
 * Живёт в shadow DOM: сайты сплошь и рядом красят всё подряд через
 * `* { ... !important }`, и без изоляции тултип либо раскрашивается в
 * цвета сайта, либо вовсе прячется правилом вроде `div { display: none }`.
 * Проверяется на hostile.html, где ровно это и сделано.
 */

const CSS_TEXT = `
  :host { all: initial; }
  .body {
    /*
     * Тултип не ловит курсор. Он встаёт прямо ПОД разобранной фразой —
     * то есть на следующей строке текста, куда взгляд и переходит. Без
     * этого наведение на неё попадает по тултипу, caretRangeFromPoint
     * не находит текста, и связка гасит подсветку и подсказку: со
     * стороны выглядит поломкой. Кнопки выбора языка возвращают себе
     * клики отдельно (.lang ниже).
     */
    pointer-events: none;
    position: fixed;
    z-index: 2147483647;
    max-width: 420px;
    padding: 10px 12px;
    border-radius: 8px;
    background: #1f2430;
    color: #f2f4f8;
    font: 14px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 6px 24px rgba(0,0,0,.35);
  }
  .note {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(255,255,255,.18);
    color: #c9d1e1;
    font-size: 13px;
  }
  .err { color: #ffb4b4; }
  .ask { margin-bottom: 6px; }
  .lang {
    /* Кнопкам клики нужны: .body их отключает для всего тултипа. */
    pointer-events: auto;
    margin: 2px 4px 0 0;
    padding: 4px 10px;
    border: 1px solid rgba(255,255,255,.3);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .lang:hover { background: rgba(255,255,255,.12); }
`;

export function createTooltip(doc) {
  const host = doc.createElement('glosst-tip');
  // Элемент с неизвестным сайту именем: его собственные селекторы по
  // div/p/span в него не попадут даже без shadow DOM.
  host.style.setProperty('display', 'block', 'important');
  const root = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = CSS_TEXT;

  const body = doc.createElement('div');
  body.className = 'body';

  root.append(style, body);
  doc.documentElement.append(host);

  function place(rect) {
    host.style.setProperty('display', 'block', 'important');
    body.style.left = `${Math.max(8, rect.left)}px`;
    body.style.top = `${rect.bottom + 8}px`;
  }

  return {
    showLoading(rect) {
      body.textContent = 'Перевожу…';
      place(rect);
    },

    showResult(rect, { translation, note }) {
      body.textContent = '';

      const main = doc.createElement('div');
      main.textContent = translation;
      body.append(main);

      // Пустую пометку не рисуем: она выглядит как обрезанный текст.
      if (note) {
        const n = doc.createElement('div');
        n.className = 'note';
        n.textContent = note;
        body.append(n);
      }

      place(rect);
    },

    showError(rect, message) {
      body.textContent = '';
      const e = doc.createElement('div');
      e.className = 'err';
      e.textContent = message;
      body.append(e);
      place(rect);
    },

    /**
     * Спросить язык страницы.
     *
     * Показывается вместо перевода, когда у страницы нет <html lang>.
     * Угадывание здесь хуже отказа: при неверном языке нарезка поедет,
     * а человек не поймёт, почему подсветилась не та часть фразы.
     */
    showLanguagePicker(rect, langs, onPick) {
      body.textContent = '';

      const ask = doc.createElement('div');
      ask.className = 'ask';
      ask.textContent = 'Язык этой страницы?';
      body.append(ask);

      for (const { code, label } of langs) {
        const b = doc.createElement('button');
        b.className = 'lang';
        b.dataset.code = code;
        b.textContent = label;
        b.addEventListener('click', () => onPick(code));
        body.append(b);
      }

      place(rect);
    },

    hide() {
      host.style.setProperty('display', 'none', 'important');
    },

    destroy() {
      host.remove();
    },
  };
}
