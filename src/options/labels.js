/**
 * Названия клавиш-модификаторов под конкретную систему.
 *
 * Чистые функции, без обращения к глобальному navigator: так их можно
 * проверить в Node, подсунув объект с нужными полями.
 *
 * Зачем вообще: подписывать маководу «Alt» неверно — такой клавиши у
 * него на клавиатуре нет, там Option. И наоборот, «Command» на Windows
 * не существует. Человек ищет глазами ту клавишу, что видит перед собой.
 */

/**
 * Mac ли это.
 *
 * `navigator.platform` объявлен устаревшим, поэтому сначала спрашиваем
 * `userAgentData`. Но в вебвью и старых сборках его может не быть вовсе,
 * так что старое поле остаётся запасным путём, а не наоборот.
 */
export function isMacPlatform(nav) {
  const platform = nav?.userAgentData?.platform ?? nav?.platform ?? '';
  return /mac/i.test(platform);
}

/**
 * Подписи для выпадающего списка клавиши вызова.
 *
 * На Mac к названию добавлен значок с самой клавиши: его и видно на
 * клавиатуре, по нему и ищут. На Windows и Linux значков на клавишах
 * нет, поэтому только слова.
 *
 * Клавишу meta зовут по-разному: Command на Mac, Windows на Windows,
 * Super в Linux. Для не-Mac пишем оба слова — одна подпись на обе
 * системы честнее, чем угадывать между ними.
 */
export function modifierLabels(isMac) {
  if (isMac) {
    return {
      alt: '⌥ Option',
      meta: '⌘ Command',
      ctrl: '⌃ Control',
      shift: '⇧ Shift',
      none: 'No key',
    };
  }

  return {
    alt: 'Alt',
    meta: 'Win / Super',
    ctrl: 'Ctrl',
    shift: 'Shift',
    none: 'No key',
  };
}

/**
 * Проставить подписи в уже готовый список.
 *
 * Разметка остаётся статической — значения в ней те же всегда, меняются
 * только надписи. Значение, выбранное человеком, при этом не трогается.
 */
export function applyModifierLabels(doc, isMac) {
  const select = doc.getElementById('modifier');
  if (!select) {
    return;
  }

  const labels = modifierLabels(isMac);

  for (const option of select.options) {
    const label = labels[option.value];
    if (label) {
      option.textContent = label;
    }
  }
}
