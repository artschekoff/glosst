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
  // Разделитель пробел не встречается в нормальном тексте, поэтому
  // ('ab','c') и ('a','bc') дают разные ключи.
  const material = [text, targetLang, model].join(' ');
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
