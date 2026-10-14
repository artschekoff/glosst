/**
 * Всё, что связано с курсором: где он стоит и когда его позвали.
 *
 * Модуль ничего не знает ни о переводе, ни о подсветке — только о
 * странице, мыши и клавише.
 */

/**
 * Где переводить нечего.
 *
 * Селектор, а не набор имён, потому что проверять надо ВСЮ цепочку
 * предков, а не одного родителя. Подсветчики синтаксиса заворачивают
 * каждое слово в свой span: у текста внутри
 * `<pre><code><span>const</span></code></pre>` родитель — span, и
 * проверка одного родителя такой код пропускала бы на перевод.
 */
const SKIP_SELECTOR = 'script, style, noscript, textarea, input, code, pre';

/** Поле события и имя клавиши для каждого модификатора. */
const MODIFIER_FLAG = { alt: 'altKey', ctrl: 'ctrlKey', shift: 'shiftKey' };
const MODIFIER_KEY = { alt: 'Alt', ctrl: 'Control', shift: 'Shift' };

/**
 * Текстовая позиция под точкой экрана.
 *
 * caretRangeFromPoint — нестандартный, но в Chrome он есть и работает;
 * расширение и так только для Chrome.
 */
export function rangeAtPoint(doc, x, y) {
  const range = doc.caretRangeFromPoint(x, y);

  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const parent = range.startContainer.parentElement;
  if (parent && parent.closest(SKIP_SELECTOR)) {
    return null;
  }

  return range;
}

/** Ближайший блочный предок — единица для режима абзаца. */
export function closestBlock(node) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  while (el && el !== document.body) {
    const display = getComputedStyle(el).display;
    if (display === 'block' || display === 'list-item' || display === 'table-cell') {
      return el;
    }
    el = el.parentElement;
  }

  return el;
}

/**
 * Зовёт onDwell, когда зажата клавиша И курсор простоял delayMs.
 *
 * Два условия, а не одно. Клавиша — потому что курсор при чтении почти
 * всегда лежит где-то в тексте, и без неё каждая пауза оборачивалась бы
 * тултипом. Задержка — потому что проводка мышью с зажатой клавишей
 * иначе выстрелила бы десятком запросов.
 *
 * @returns {() => void} отписка
 */
export function watchDwell(doc, { delayMs, modifier, onDwell, onCancel = () => {} }) {
  const flag = MODIFIER_FLAG[modifier] ?? null;
  const key = MODIFIER_KEY[modifier] ?? null;
  let timer = null;
  // Последняя позиция курсора: нужна, когда клавишу нажали, не двигая
  // мышью, — движения в этот момент нет, а стрелять надо.
  let last = null;

  const held = (e) => flag === null || e[flag] === true;

  const arm = () => {
    if (!last) return;
    clearTimeout(timer);
    const { x, y } = last;
    timer = setTimeout(() => onDwell({ x, y }), delayMs);
  };

  const disarm = () => clearTimeout(timer);

  const onMove = (e) => {
    last = { x: e.clientX, y: e.clientY };
    if (held(e)) arm();
    else disarm();
  };

  const onKeyDown = (e) => {
    if (flag && e[flag]) arm();
  };

  const onKeyUp = (e) => {
    // Сверяемся с именем клавиши, а не с e[flag]: на keyup флаг уже
    // сброшен, и проверка «флага нет» срабатывала бы на отпускание
    // ЛЮБОЙ клавиши — набрал текст в поле, и подсказка пропала.
    if (key && e.key === key) {
      disarm();
      onCancel();
    }
  };

  const away = () => {
    disarm();
    onCancel();
  };

  doc.addEventListener('mousemove', onMove, { passive: true });
  doc.addEventListener('keydown', onKeyDown, { passive: true });
  doc.addEventListener('keyup', onKeyUp, { passive: true });
  doc.addEventListener('mouseleave', away, { passive: true });
  doc.addEventListener('scroll', away, { passive: true, capture: true });

  return () => {
    disarm();
    doc.removeEventListener('mousemove', onMove);
    doc.removeEventListener('keydown', onKeyDown);
    doc.removeEventListener('keyup', onKeyUp);
    doc.removeEventListener('mouseleave', away);
    doc.removeEventListener('scroll', away, { capture: true });
  };
}
