/**
 * Нарезка текста на единицы перевода.
 *
 * Чистая функция, без DOM: её можно гонять в Node, а значит проверять
 * быстро и без браузера. Всё, что знает о странице, живёт в hover.js.
 */

/**
 * Сокращения, после которых точка не заканчивает предложение.
 *
 * Intl.Segmenter правила языка знает, но на сокращениях ошибается:
 * «Sr. García llegó tarde.» он делит на «Sr. » и «García llegó tarde. ».
 * Единицей стал бы огрызок «Sr. » — для перевода бесполезный и платный.
 *
 * Список заведомо неполон, и это приемлемо: промах даёт короткую
 * единицу, а не сломанную страницу. Пополняется по мере находок.
 */
export const ABBREVIATIONS =
  /(?:^|\s)(?:Sr|Sra|Srta|Dr|Dra|Ud|Uds|Av|Lic|Ing|etc|núm|pág)\.\s*$/i;

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
    if (prev && ABBREVIATIONS.test(prev.segment)) {
      prev.segment += s.segment;
    } else {
      out.push({ index: s.index, segment: s.segment });
    }
  }

  return out;
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

  for (const s of sentences(text, opts.lang)) {
    const start = s.index;
    const end = start + s.segment.length;
    if (offset >= start && offset < end) {
      // Хвостовой пробел сегментер отдаёт внутри куска: в перевод он не
      // нужен, а подсветка на нём выглядит как лишний хвост.
      const trimmed = s.segment.replace(/\s+$/, '');
      return { start, end: start + trimmed.length };
    }
  }

  return null;
}
