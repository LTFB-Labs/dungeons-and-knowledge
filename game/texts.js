// @ts-check
// Everything the game says, in one place. Bulgarian only for now.

export const TEXT = {
  hint: 'Щракни плочка (двоен клик: бързо). Или ↑ напред, ← → завой, ↓ кръгом (Shift: бързо, E: отвори). Колелцето приближава.',
  hintShoot: 'В ръката ти е нещо, което стреля: интервалът (или десен клик) стреля към показалеца.',
  styleFlat: 'Вид: гладки кубчета',
  styleTextured: 'Вид: с текстури',
  chestTitle: 'Сандъкът',
  chestText: 'Тук се отваря близкият екран със задачата: ключалка с колела.',
  doorTitle: 'Пазителят на вратата',
  doorText: 'Пазителят пита.',
  doorRight: 'Вярно! Пазителят се отмества.',
  doorWrong: 'Не е това. Пазителят пита друго.',
  chest2Title: 'Сандък',
  goblinTitle: 'Гоблин',
  goblinText: 'Нямам какво да ти кажа в момента.',
  armorTitle: 'Кралски доспехи',
  armorText: 'Позлатени доспехи на стойка: шлем с червен перчем, броня, наколенници и ботуши.',
  armorTake: 'Вземи доспехите',
  armorTaken: 'Доспехите са в раницата. Облечи ги с Tab.',
  armorEmpty: 'Стойката е празна.',
  shieldTitle: 'Щит',
  shieldText: 'Син и сребърен щит на стената, с два кръстосани меча зад него.',
  shieldTake: 'Вземи щита',
  shieldEmpty: 'Тук висеше щит. Мечовете са останали.',
  spearTitle: 'Копие',
  spearText: 'Копие с желязно острие и червено флагче, до трона.',
  spearTake: 'Вземи копието',
  spearEmpty: 'Тук стоеше копие.',
  torchTitle: 'Факла',
  torchText: 'Факла на стената до пазителя. Свети и в ръка.',
  torchTake: 'Вземи факлата',
  torchEmpty: 'Тук гореше факла.',
  takenToBag: 'В раницата е. Сложи го в ръка с Tab.',
  bagFull: 'Няма достатъчно място в раницата.',
  chest2Text: 'Какво има в сандъка.',
  stone: 'Камък',
};

// The settings sheet: the name of each slider.
export const SETTINGS_TEXT = {
  fov: 'Перспектива',
  tilt: 'Наклон',
  focus: 'Фокус',
  pool: 'Светлина около героя',
  shine: 'Блясък',
  wind: 'Вятър и облаци',
  windNote: 'Само в горния свят',
  patches: 'Петна',
  torchShadows: 'Сенки от факли',
  shadowSize: 'Размер на сенките',
  map: 'Карта',
  mapNote: 'Клавиш M',
  fps: 'Брой кадри',
  sound: 'Звуци',
  music: 'Музика',
  musicVolume: 'Сила на музиката',
  specks: 'Частици',
  critters: 'Животинки',
  details: 'Детайли',
};

// What the guardian asks. One at random; only the right answer opens the door.
export const QUESTIONS = [
  { ask: 'Живеем върху скала, която лети през космоса и се казва Земя. Коя поред е тя от Слънцето?', answers: ['Първа', 'Втора', 'Трета', 'Четвърта'], right: 2 },
  { ask: 'Земята се върти около себе си като пумпал. За колко часа прави едно пълно завъртане?', answers: ['12 часа', '24 часа', '60 часа', '100 часа'], right: 1 },
  { ask: 'Светлината е най-бързото нещо на света, а пак ѝ трябва време да стигне от Слънцето до нас. Колко?', answers: ['8 секунди', '8 минути', '8 часа', '8 дни'], right: 1 },
  { ask: 'Пчелите строят питите си от малки килийки с равни стени. Колко стени има една килийка?', answers: ['3', '4', '6', '8'], right: 2 },
  { ask: 'Октоподът има осем пипала и повече от едно сърце. Колко сърца има?', answers: ['1', '2', '3', '8'], right: 2 },
];

// The sheet of the bookkeeper's chest. The rules of the task are in chest-task.js.
export const TASK_TEXT = {
  title: 'Сандъкът на ковчежника',
  ask: 'Ключалката се отваря с цената на въжетата.',
  total: 'цялото',
  stepPlace: 'Докосни число от бележката, после мястото му в гредата.',
  stepDial: 'Набери на ключалката колко струваха въжетата.',
  misplaced: 'Това число не е за тук.',
  wrong: 'Ключалката не поддава. Провери сметката.',
  won: 'Сандъкът се отвори! Въжетата струваха 631 жълтици.',
  check: 'Провери', back: 'Назад', again: 'Отначало',
};
export const TASK_NOTE = [
  'В сандъка имаше ', { chip: 'c-total' }, ' жълтици. Дадохме ', { chip: 'c-computers' }, ' за мечове и ',
  { chip: 'c-desks' }, ' за щитове. Купихме и въжета, но мастилото се е разляло. В сандъка останаха ', { chip: 'c-left' }, '.',
];
export const PART_LABEL = { computers: 'мечове', desks: 'щитове', mice: 'въжета', left: 'останали' };

export const INVENTORY_TEXT = {
  locale: 'bg-BG',
  title: 'Инвентар',
  placeFor: (spot) => `Място за ${spot}`,
  inHand: 'Държи се в ръка',
  wornOn: (spot) => `Носи се на: ${spot}`,
  walk: (percent) => `Ходене: с ${percent} по-бързо`,
  hurry: (percent) => `Бързане: с ${percent} по-бързо`,
  light: (what) => `Свети: ${what}`,
  wrongSlot: 'Това не става тук.',
};
export const SHOOT_TEXT = {
  key: 'интервал',
  shoots: (shooter) => `Стреля: ${shooter.name.toLowerCase()}, до ${shooter.range} плочки`,
};
