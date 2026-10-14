import { unitBounds } from './segment.js';
import { pageLang, LANG_CHOICES } from './lang.js';
import { installStyles, markActive, markSeen, markError, clearActive, clearError } from './highlight.js';
import { rangeAtPoint, closestBlock, watchDwell } from './hover.js';
import { createTooltip } from './tooltip.js';

/**
 * Связка контент-скрипта.
 *
 * Всё внешнее приходит параметром: в браузере это обёртки над
 * chrome.runtime.sendMessage, в тестах подделки. Поэтому весь ход
 * «зажал Alt → навёл → подсветилось → перевелось → показалось»
 * проверяется без расширения и без сети.
 */
export function start({ doc, settings, ask, getLang, setLang }) {
  installStyles({
    active: settings.colorActive,
    seen: settings.colorSeen,
    error: settings.colorError,
  });

  const tip = createTooltip(doc);

  // Текст последней единицы: мышь дрожит внутри одного предложения, и
  // спрашивать его заново на каждое дрожание незачем.
  let lastText = null;

  // Готовый ответ на неё же. Нужен, чтобы ту же фразу в ДРУГОМ месте
  // страницы показать сразу, не обращаясь к сети второй раз.
  let lastAnswer = null;

  /**
   * Язык страницы: из атрибута, иначе из запомненного для домена,
   * иначе null — и тогда спросим.
   */
  async function resolveLang() {
    return pageLang(doc) ?? (await getLang());
  }

  async function translateRange(range, lang) {
    const text = range.toString().trim();
    if (!text) {
      return;
    }

    // Та же фраза, что и в прошлый раз: сеть не трогаем. Но подсветку и
    // подсказку переносим СЮДА. Одно и то же предложение встречается на
    // странице дважды чаще, чем кажется — повторы в списках, заголовки,
    // реплики, — и если при наведении на второе ничего не шевельнётся,
    // человек решит, что расширение сломалось. Дрожание мыши внутри
    // одной фразы при этом ничего не стоит: перерисовка на том же месте.
    if (text === lastText) {
      if (lastAnswer) {
        showAnswer(range, lastAnswer);
      }
      return;
    }

    lastText = text;
    lastAnswer = null;

    markActive(range);
    tip.showLoading(range.getBoundingClientRect());

    const answer = await ask(text, lang);

    // Пока ждали ответ, курсор мог уехать на другое место.
    if (lastText !== text) {
      return;
    }

    lastAnswer = answer;
    showAnswer(range, answer);
  }

  /** Показать уже готовый ответ на указанном месте. */
  function showAnswer(range, answer) {
    markActive(range);
    const rect = range.getBoundingClientRect();

    if (answer.ok) {
      tip.showResult(rect, { translation: answer.translation, note: answer.note });
      markSeen(range);
    } else {
      tip.showError(rect, answer.message);
      markError(range);
    }
  }

  const stop = watchDwell(doc, {
    delayMs: settings.dwellMs,
    modifier: settings.modifier,

    onCancel() {
      clearActive();
      clearError();
      tip.hide();
      lastText = null;
      lastAnswer = null;
    },

    async onDwell(point) {
      try {
        await handleDwell(point);
      } catch (err) {
        // watchDwell зовёт onDwell из setTimeout: без try/catch здесь
        // неожиданный сбой (DOM-исключение, обрыв связи с воркером)
        // улетел бы необработанным отклонением и завис тултип в уже
        // неактуальном состоянии, не дав ни ошибки, ни результата.
        console.error('glosst: onDwell упал', err);
      }
    },
  });

  async function handleDwell({ x, y }) {
    const caret = rangeAtPoint(doc, x, y);
    if (!caret) {
      clearActive();
      clearError();
      tip.hide();
      lastText = null;
      return;
    }

    const node = caret.startContainer;
    const block = closestBlock(node);
    const lang = await resolveLang();

    // Режим абзаца, а блочного предка нет (closestBlock дошла до
    // <body>, не встретив ни одного подходящего display): единицы
    // перевода здесь нет. Раньше в этом месте закономерно
    // подставлялся document.body, и единицей становилась вся
    // страница — один платный запрос на весь её текст.
    const noUnitHere = settings.granularity === 'paragraph' && !block;
    if (noUnitHere) {
      return;
    }

    // Язык неизвестен — спрашиваем и ничего не переводим. Догадка
    // здесь хуже отказа: при неверном языке поедет нарезка.
    if (!lang) {
      const probe = doc.createRange();
      probe.selectNodeContents(block ?? node.parentElement);

      tip.showLanguagePicker(probe.getBoundingClientRect(), LANG_CHOICES, async (code) => {
        await setLang(code);
        lastText = null;
        // Человек уже навёл на нужное место — продолжаем с него же,
        // не заставляя наводить заново.
        const again = rangeAtPoint(doc, x, y);
        if (again) {
          const b = unitBounds(again.startContainer.textContent, again.startOffset, {
            granularity: settings.granularity,
            lang: code,
          });
          if (b) {
            await translateRange(buildRange(doc, again.startContainer, b, block, settings), code);
          }
        }
      });
      return;
    }

    const bounds = unitBounds(node.textContent, caret.startOffset, {
      granularity: settings.granularity,
      lang,
    });
    if (!bounds) {
      return;
    }

    await translateRange(buildRange(doc, node, bounds, block, settings), lang);
  }

  return () => {
    stop();
    tip.destroy();
    clearActive();
    clearError();
  };
}

/** Range на единицу перевода: предложение внутри узла либо блок целиком. */
function buildRange(doc, node, bounds, block, settings) {
  const range = doc.createRange();

  if (settings.granularity === 'paragraph' && block) {
    range.selectNodeContents(block);
  } else {
    range.setStart(node, bounds.start);
    range.setEnd(node, bounds.end);
  }

  return range;
}
