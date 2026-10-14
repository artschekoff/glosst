/**
 * Выбранный человеком язык страницы, по доменам.
 *
 * Отдельно от кэша переводов и от настроек: своя приставка, свой сброс.
 * Вопрос задаётся один раз на домен — дальше сайт работает молча.
 */

const PREFIX = 'glosst-lang:';

export async function getSiteLang(storage, origin) {
  const key = PREFIX + origin;
  const got = await storage.get(key);
  return got[key] ?? null;
}

export async function setSiteLang(storage, origin, lang) {
  await storage.set({ [PREFIX + origin]: lang });
}

/** Сброс всех выбранных языков. Возвращает, сколько записей снято. */
export async function clearSiteLangs(storage) {
  const all = await storage.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));

  if (keys.length > 0) {
    await storage.remove(keys);
  }

  return keys.length;
}
