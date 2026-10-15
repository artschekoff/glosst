/**
 * Кнопка «Открыть документ» на вкладке с PDF.
 *
 * Во встроенный просмотрщик Chrome расширению хода нет: текст лежит в
 * странице другого расширения, а внедрять туда скрипты запрещено. Но во
 * ВНЕШНИЙ кадр вкладки контент-скрипт попадает, и нарисовать поверх
 * кнопку можно — проверено на настоящем просмотрщике.
 *
 * Кнопка открывает тот же документ в нашей странице просмотра, где
 * перевод работает. Привычный просмотрщик при этом остаётся по
 * умолчанию: сюда документ попадает только по нажатию.
 */

/** Высота, на которой у встроенного просмотрщика своя панель. */
const TOOLBAR_SAFE_TOP = 12;

/** Это вкладка с PDF? */
export function isPdfDocument(doc) {
  if (doc.contentType === 'application/pdf') {
    return true;
  }

  // Запасной признак: встроенный просмотрщик вставляет embed с этим
  // типом. contentType надёжнее, но за ним не во всех сборках правда.
  return Boolean(doc.querySelector('embed[type="application/pdf"]'));
}

/**
 * Показать кнопку.
 *
 * Живёт в shadow DOM по той же причине, что и подсказка: страницы
 * сплошь и рядом красят всё подряд через `!important`, и без изоляции
 * кнопка либо перекрашивается, либо прячется чужим правилом.
 *
 * @param {Document} doc
 * @param {(url: string) => void} onOpen  что делать по нажатию
 * @returns {() => void} убрать кнопку
 */
export function mountPdfButton(doc, onOpen) {
  const host = doc.createElement('glosst-open');
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('top', `${TOOLBAR_SAFE_TOP}px`, 'important');
  host.style.setProperty('right', '16px', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');

  const root = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = `
    button {
      padding: 9px 18px;
      border: none;
      border-radius: 8px;
      background: #2f6fd0;
      color: #fff;
      font: 600 14px/1.2 -apple-system, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, .28);
      cursor: pointer;
    }
    button:hover { background: #2a63ba; }
    button:active { background: #24569f; }
  `;

  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = 'Open in Glosst';
  button.addEventListener('click', () => onOpen(doc.location.href));

  root.append(style, button);
  doc.documentElement.append(host);

  return () => host.remove();
}
