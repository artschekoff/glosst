/**
 * Нарезка текста на единицы перевода.
 *
 * Чистая функция, без DOM: её можно гонять в Node, а значит проверять
 * быстро и без браузера. Всё, что знает о странице, живёт в hover.js.
 */

/**
 * Сокращения, после которых ВСЕГДА идёт имя или число.
 *
 * Intl.Segmenter правила языка знает, но на сокращениях ошибается:
 * «Sr. García llegó tarde.» он делит на «Sr. » и «García llegó tarde. ».
 * Единицей стал бы огрызок «Sr. » — для перевода бесполезный и платный.
 *
 * Граница не только по пробелу: «(Sr. García» — тоже сокращение.
 */
export const ABBREVIATIONS_ALWAYS =
  /(?:^|[\s(«"])(?:Sr|Sra|Srta|Dr|Dra|Av|Lic|Ing|núm|pág)\.\s*$/i;

/**
 * Сокращения, которые бывают и концом предложения.
 *
 * Отдельный класс, потому что склеивать их всегда — хуже, чем не
 * склеивать: «Compré frutas, verduras, etc. Fue una compra grande.» это
 * ДВА предложения, и слитые в одну единицу они дают неверный перевод.
 * А «etc. y luego vemos» — одно. Различаем по следующему куску: строчная
 * буква значит продолжение, прописная — новое предложение.
 *
 * Оба списка заведомо неполны, и это приемлемо: промах даёт неудачную
 * границу, а не сломанную страницу. Пополняются по мере находок.
 */
export const ABBREVIATIONS_AMBIGUOUS =
  /(?:^|[\s(«"])(?:Ud|Uds|etc)\.\s*$/i;

/** Начинается ли кусок со строчной буквы (то есть продолжает фразу). */
function startsLowercase(text) {
  const c = text.trimStart()[0];
  // Сравнение регистров отсекает цифры и знаки: у них обе формы равны.
  return c !== undefined && c === c.toLowerCase() && c !== c.toUpperCase();
}

/** Клеить ли этот кусок с предыдущим. */
function shouldMerge(prev, next) {
  if (ABBREVIATIONS_ALWAYS.test(prev)) {
    return true;
  }
  if (!ABBREVIATIONS_AMBIGUOUS.test(prev)) {
    return false;
  }
  return startsLowercase(next);
}

/**
 * Предложения с их смещениями, уже склеенные по сокращениям.
 *
 * @returns {{index: number, segment: string}[]}
 */
/**
 * Предложения с их смещениями, уже склеенные по сокращениям.
 *
 * @returns {{index: number, segment: string}[]}
 */
function sentences(text, lang) {
  const raw = [...new Intl.Segmenter(lang, { granularity: 'sentence' }).segment(text)];
  const out = [];

  for (const s of raw) {
    const prev = out[out.length - 1];
    if (prev && shouldMerge(prev.segment, s.segment)) {
      prev.segment += s.segment;
    } else {
      out.push({ index: s.index, segment: s.segment });
    }
  }

  return out;
}

/** Границы куска без хвостовых пробелов. */
function trimmedBounds(s) {
  return { start: s.index, end: s.index + s.segment.replace(/\s+$/, '').length };
}

/**
 * Границы единицы перевода, внутри которой стоит смещение.
 *
 * @param {string} text  текст блока
 * @param {number} offset  смещение курсора в этом тексте
 * @param {{granularity: 'sentence'|'paragraph', lang: string}} opts
 * @returns {{start: number, end: number} | null}  null, если текста нет
 *          или смещение вне его
 */
export function unitBounds(text, offset, opts) {
  if (!text || offset < 0 || offset > text.length) {
    return null;
  }

  if (opts.granularity === 'paragraph') {
    return { start: 0, end: text.length };
  }

  const list = sentences(text, opts.lang);

  for (const s of list) {
    const start = s.index;
    const end = start + s.segment.length;
    if (offset >= start && offset < end) {
      // Хвостовой пробел сегментер отдаёт внутри куска: в перевод он не
      // нужен, а подсветка на нём выглядит как лишний хвост.
      return trimmedBounds(s);
    }
  }

  // Смещение, равное длине текста, циклу выше недостижимо: он ищет
  // offset < end. А каретка сразу за последним символом — обычное
  // положение при наведении на конец абзаца, и молчать тут нельзя.
  if (offset === text.length && list.length > 0) {
    return trimmedBounds(list[list.length - 1]);
  }

  return null;
}
