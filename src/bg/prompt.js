/**
 * Что отправляем модели и как читаем ответ.
 *
 * Отделено от сети: сборка и разбор проверяются без единого запроса.
 */

function systemPrompt(targetLang, wantNote) {
  const base =
    `Ты помогаешь читать текст в оригинале. Переведи присланный фрагмент ` +
    `на язык "${targetLang}". Перевод должен быть естественным, а не ` +
    `подстрочником. Верни JSON.`;

  return wantNote
    ? base +
        ` Поля: "translation" — перевод, "note" — короткая пометка о том, ` +
        `что в этом месте легко понять неправильно: форма глагола, идиома, ` +
        `местный оборот. Если место простое, "note" опусти.`
    : base + ` Поле: "translation" — перевод.`;
}

export function buildBody({ text, targetLang, model, wantNote }) {
  return {
    model,
    // Строгий JSON: иначе модель вернёт «Вот перевод: …», и разбор
    // превратится в угадывание.
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt(targetLang, wantNote) },
      { role: 'user', content: text },
    ],
  };
}

export function parseAnswer(json) {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Unexpected model response: no content');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Unexpected model response: not JSON');
  }

  if (typeof parsed.translation !== 'string' || parsed.translation === '') {
    throw new Error('Unexpected model response: no translation');
  }

  return {
    translation: parsed.translation,
    note: typeof parsed.note === 'string' ? parsed.note : '',
  };
}
