/**
 * Разделитель полей ключа — U+001F (UNIT SEPARATOR).
 *
 * Берётся через fromCharCode, а не вписывается символом: литеральный
 * управляющий символ в исходнике невидим в редакторе и ломает grep.
 * В нормальном тексте этот код не встречается, поэтому ('ab','c') и
 * ('a','bc') дают разные ключи — и, в отличие от пробела, это верно
 * и когда в самом тексте есть пробелы.
 */
const FIELD_SEPARATOR = String.fromCharCode(0x1f);

/**
 * Ключ записи кэша.
 *
 * Хэш от текста, языка цели и модели — но не от URL: одна и та же фраза
 * встречается на разных страницах, и платить за неё дважды незачем.
 *
 * Модель входит в ключ обязательно: сменили модель — прежние переводы
 * не должны выдаваться за новые.
 */
export async function cacheKey(text, targetLang, model) {
  const material = [text, targetLang, model].join(FIELD_SEPARATOR);
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
