/**
 * Язык страницы — для нарезки.
 *
 * Чистая функция от документа: в тестах хватает объекта с одним полем,
 * настоящий DOM не нужен.
 */

/** Что предлагаем, когда язык неизвестен. Список короткий намеренно. */
export const LANG_CHOICES = [
  { code: 'es', label: 'Spanish' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
];

/**
 * Базовый код языка из <html lang>, иначе null.
 *
 * null означает «спросить человека». Догадку здесь не возвращаем
 * принципиально: ошиблись языком — поехала нарезка, и человек получил
 * кривую единицу, не понимая почему.
 */
export function pageLang(doc) {
  const raw = doc?.documentElement?.lang;

  if (typeof raw !== 'string') {
    return null;
  }

  // Только форма вида "es" или "es-AR": всё остальное — мусор в
  // атрибуте, а не язык.
  const match = raw.trim().match(/^([a-z]{2,3})(?:[-_][a-z0-9]+)*$/i);

  return match ? match[1].toLowerCase() : null;
}
