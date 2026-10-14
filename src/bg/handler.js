import { cacheKey } from './cachekey.js';
import { cacheGet, cacheSet } from './cache.js';
import { loadSettings } from './settings.js';
import { translate as realTranslate } from './translate.js';

const DAY = 86400000;

/**
 * Обработка одного запроса на перевод: кэш → сеть → кэш.
 *
 * Зависимости приходят параметром (хранилище, переводчик, время), чтобы
 * проверять порядок обращений без браузера и без сети.
 *
 * Ошибки не бросаются наружу, а возвращаются кодом: на том конце
 * контент-скрипт, и ему нужно показать человеку причину, а не поймать
 * исключение через границу сообщений.
 */
export async function handleTranslate(msg, deps) {
  const { storage, translateImpl = realTranslate, now = Date.now() } = deps;
  const settings = await loadSettings(storage);
  const targetLang = msg.targetLang ?? settings.targetLang;

  const key = await cacheKey(msg.text, targetLang, settings.model);
  const hit = await cacheGet(storage, key, settings.ttlDays * DAY, now);

  if (hit) {
    return { ok: true, translation: hit.translation, note: hit.note, cached: true };
  }

  let result;
  try {
    result = await translateImpl({
      text: msg.text,
      targetLang,
      model: settings.model,
      apiKey: settings.apiKey,
      wantNote: settings.wantNote,
    });
  } catch (e) {
    // Неудачу не кэшируем: пополнил баланс — должно заработать сразу,
    // а не через месяц, когда протухнет запись.
    return { ok: false, code: e.code ?? 'http', message: e.message };
  }

  await cacheSet(storage, key, { ...result, model: settings.model }, now);

  return { ok: true, translation: result.translation, note: result.note, cached: false };
}
