// @ts-check
// What every game says by default, in one place. Bulgarian only for now. A game spreads these and adds its own.

export const TEXT = {
  hint: 'Щракни плочка (двоен клик: бързо). Или ↑ напред, ← → завой, ↓ кръгом (Shift: бързо, E: отвори). Колелцето приближава.',
  hintShoot: 'В ръката ти е нещо, което стреля: интервалът (или десен клик) стреля към показалеца.',
  styleFlat: 'Вид: гладки кубчета',
  styleTextured: 'Вид: с текстури',
  takenToBag: 'В раницата е. Сложи го в ръка с Tab.',
  bagFull: 'Няма достатъчно място в раницата.',
};

// The settings sheet: the name of each slider the engine knows (play.js: effects).
export const SETTINGS_TEXT = {
  fov: 'Перспектива',
  tilt: 'Наклон',
  focus: 'Фокус',
  pool: 'Светлина около героя',
  shine: 'Блясък',
  patches: 'Петна',
  torchShadows: 'Сенки от факли',
  shadowSize: 'Размер на сенките',
  map: 'Карта',
  mapNote: 'Клавиш M',
  fps: 'Брой кадри',
  sound: 'Звуци',
  music: 'Музика',
  musicVolume: 'Сила на музиката',
};

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

// What is written on the page itself (page.js).
export const PAGE_TEXT = {
  loading: 'Зареждане…',
  inventoryOpen: 'Инвентар (Tab)',
  settings: 'Настройки',
  toHero: 'Към героя',
  back: 'Назад',
  inventory: 'Инвентар',
  inBox: 'В сандъка',
  yours: 'Твоите неща',
  closeInventory: 'Затвори (Tab)',
  closeSettings: 'Затвори (Esc)',
};
