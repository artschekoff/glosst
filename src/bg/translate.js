import { buildBody, parseAnswer } from './prompt.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/** Ошибка с кодом: по коду тултип выбирает, что показать человеку. */
export class TranslateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TranslateError';
    this.code = code;
  }
}

/** Классификация неуспешного HTTP-ответа. */
async function classify(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    // тело может быть не JSON — код ответа важнее
  }

  const code = body?.error?.code ?? '';

  if (response.status === 401) {
    return new TranslateError('unauthorized', 'API key was rejected');
  }

  if (response.status === 429) {
    // Пустой баланс OpenAI отдаёт как 429. Это не превышение частоты:
    // ждать бесполезно, нужно пополнить счёт. Поэтому коды разные.
    return code === 'insufficient_quota'
      ? new TranslateError('quota', 'Out of credit — top up your OpenAI balance')
      : new TranslateError('rate-limit', 'Too many requests — try again shortly');
  }

  return new TranslateError('http', `Server responded ${response.status}`);
}

/**
 * Перевод одного фрагмента.
 *
 * fetchImpl параметром, чтобы тесты не ходили в сеть и не тратили деньги.
 */
export async function translate({ text, targetLang, model, apiKey, wantNote, fetchImpl = fetch }) {
  if (!apiKey) {
    // До сети не доходим: без ключа запрос всё равно бессмысленный.
    throw new TranslateError('no-key', 'No API key set — open the extension settings');
  }

  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildBody({ text, targetLang, model, wantNote })),
  };

  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetchImpl(ENDPOINT, init);
      break;
    } catch (e) {
      // Обрыв связи бывает разовым, поэтому одна повторная попытка.
      // Больше одной — человек уже ждёт слишком долго.
      if (attempt === 1) {
        throw new TranslateError('network', 'No connection');
      }
    }
  }

  if (!response.ok) {
    throw await classify(response);
  }

  try {
    return parseAnswer(await response.json());
  } catch (e) {
    throw new TranslateError('bad-response', e.message);
  }
}
