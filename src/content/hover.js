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
const MODIFIER_FLAG = { alt: 'altKey', ctrl: 'ctrlKey', shift: 'shiftKey', meta: 'metaKey' };
const MODIFIER_KEY = { alt: 'Alt', ctrl: 'Control', shift: 'Shift', meta: 'Meta' };

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

/**
 * Какие display считаются блочной единицей для режима абзаца.
 *
 * inline-block, flex, grid, table и flow-root добавлены не для
 * полноты: верстальщики сплошь и рядом заворачивают текст абзаца в
 * такой контейнер (разметка карточек, таблицы макета, flex-колонки), и
 * без них цикл ниже не находил ничего и уходил до самого body.
 */
const BLOCK_DISPLAYS = new Set([
  'block', 'list-item', 'table-cell', 'inline-block', 'flex', 'grid', 'table', 'flow-root',
]);

/**
 * Диапазон, который человек выделил мышью, если он есть.
 *
 * Выделение — прямое указание «переводи вот это»: границы человек
 * видит глазами до того, как заплатит, и может захватить сколько
 * нужно, хоть через границы абзацев. Нарезка на предложения в этом
 * случае не участвует вовсе.
 *
 * null означает «выделения нет». Свёрнутое выделение (просто курсор) и
 * пустое по тексту идут сюда же: переводить нечего.
 */
export function selectionRange(doc) {
  const sel = doc.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    return null;
  }

  const range = sel.getRangeAt(0);
  return range.toString().trim() ? range : null;
}


/**
 * Ближайший блочный предок — единица для режима абзаца.
 *
 * Если до document.body дошли, не встретив ни одного подходящего
 * display, — null, а НЕ body. Body ни разу не единица перевода: это
 * вся страница целиком, один платный запрос на весь её текст. Вызывающий
 * обязан воспринять null как «единицы здесь нет», а не переводить его.
 */
export function closestBlock(node) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  while (el && el !== document.body) {
    const display = getComputedStyle(el).display;
    if (BLOCK_DISPLAYS.has(display)) {
      return el;
    }
    el = el.parentElement;
  }

  return null;
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
export function watchDwell(doc, { delayMs, modifier, onDwell, onCancel = () => {}, onMove = () => {} }) {
  const flag = MODIFIER_FLAG[modifier] ?? null;
  const key = MODIFIER_KEY[modifier] ?? null;
  let timer = null;
  // Последняя позиция курсора: нужна, когда клавишу нажали, не двигая
  // мышью, — движения в этот момент нет, а стрелять надо.
  let last = null;

  const held = (e) => flag === null || e[flag] === true;

  const arm = () => {
    clearTimeout(timer);
    // Позиция курсора может быть неизвестна: клавишу можно нажать, ни
    // разу не двинув мышью — например выделив текст с клавиатуры. Для
    // выделения координаты не нужны вовсе, поэтому передаём как есть, а
    // решает уже вызывающий.
    const point = last ? { x: last.x, y: last.y } : null;
    timer = setTimeout(() => onDwell(point), delayMs);
  };

  const disarm = () => clearTimeout(timer);

  const handleMove = (e) => {
    last = { x: e.clientX, y: e.clientY };
    if (held(e)) arm();
    else disarm();
    // О каждом движении сообщаем отдельно: показанный перевод живёт,
    // пока курсор над ним, и гаснет, когда человек ушёл. Решает это
    // вызывающий — ему известны границы показанного.
    onMove({ x: last.x, y: last.y });
  };

  const onKeyDown = (e) => {
    if (flag && e[flag]) arm();
  };

  const onKeyUp = (e) => {
    // Сверяемся с именем клавиши, а не с e[flag]: на keyup флаг уже
    // сброшен, и проверка «флага нет» срабатывала бы на отпускание
    // ЛЮБОЙ клавиши — набрал текст в поле, и подсказка пропала.
    //
    // Отпускание СНИМАЕТ ОТСЧЁТ, но не гасит уже показанный перевод:
    // держать клавишу всё время чтения утомительно. Показанное живёт,
    // пока курсор над ним, — за это отвечает onMove у вызывающего.
    if (key && e.key === key) {
      disarm();
    }
  };

  const away = () => {
    disarm();
    onCancel();
  };

  doc.addEventListener('mousemove', handleMove, { passive: true });
  doc.addEventListener('keydown', onKeyDown, { passive: true });
  doc.addEventListener('keyup', onKeyUp, { passive: true });
  doc.addEventListener('mouseleave', away, { passive: true });
  doc.addEventListener('scroll', away, { passive: true, capture: true });

  return () => {
    disarm();
    doc.removeEventListener('mousemove', handleMove);
    doc.removeEventListener('keydown', onKeyDown);
    doc.removeEventListener('keyup', onKeyUp);
    doc.removeEventListener('mouseleave', away);
    doc.removeEventListener('scroll', away, { capture: true });
  };
}
