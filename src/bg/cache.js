/**
 * Кэш переводов поверх chrome.storage.local.
 *
 * Хранилище приходит параметром, а не берётся из глобального chrome:
 * так функции проверяются обычным объектом в Node, без браузера.
 *
 * Время тоже параметром: тест на срок жизни не должен ждать месяц.
 */

/** Префикс, чтобы записи кэша не смешивались с настройками. */
const PREFIX = 'glosst:';

export async function cacheSet(storage, key, entry, now) {
  await storage.set({ [PREFIX + key]: { ...entry, ts: now } });
}

export async function cacheGet(storage, key, ttlMs, now) {
  const full = PREFIX + key;
  const got = await storage.get(full);
  const entry = got[full];

  if (!entry) {
    return null;
  }

  if (now - entry.ts > ttlMs) {
    // Удаляем сразу: иначе хранилище растёт записями, которые уже
    // никогда не пригодятся.
    await storage.remove(full);
    return null;
  }

  return entry;
}

/** Разовая уборка всего просроченного. Возвращает число удалённых. */
export async function cacheSweep(storage, ttlMs, now) {
  const all = await storage.get(null);
  const dead = Object.keys(all).filter(
    (k) => k.startsWith(PREFIX) && now - all[k].ts > ttlMs
  );

  if (dead.length > 0) {
    await storage.remove(dead);
  }

  return dead.length;
}
