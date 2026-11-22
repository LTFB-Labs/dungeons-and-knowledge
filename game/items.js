// @ts-check
// The things the hero can have: what each is called and does, where it is worn, its picture, and what shoots.
// How a thing looks on him is in wear.js.

// Items are small pixel pictures drawn from letter grids: a letter is a colour.
export const PIXEL = {
  '#': '#2f2a26', l: '#e3e6ea', m: '#b6bcc5', d: '#7c838e', r: '#c8372d', R: '#8e2620', w: '#efe2c0',
  f: '#5a4630', y: '#ffd35a', b: '#d79a4a', B: '#a8682a', h: '#8a5a34', H: '#5c3a20', g: '#e3ac2a',
  p: '#d0549a', P: '#9c2f70', c: '#cfe7f0',
  u: '#2f6fbf', U: '#22528c', n: '#3b4267', N: '#2c3150', k: '#8a6a48', K: '#6b5038', o: '#6f5740', O: '#4a3524',
  v: '#7a4fb5', V: '#4c2b78', e: '#787e33', s: '#c2a878',
};
export const ICON_ROWS = {
  spear: ['..........m.', '.........ml.', '........mlm.', '.......rmm..', '......rh....', '.....h......', '....h.......', '...h........', '..h.........', '.h..........', 'h...........', '............'],
  shield: ['............', '.##########.', '.#uuuummmm#.', '.#uuuummmm#.', '.#uuuggmmm#.', '.#uuuggmmm#.', '.#uuuummmm#.', '..#uuummm#..', '...#uumm#...', '....#um#....', '.....##.....', '............'],
  royalHelmet: ['....rrr.....', '.....rr.....', '...######...', '..#llllll#..', '.#llmmmmll#.', '.#mmmmmmmm#.', '.#mm####mm#.', '.#mg#..#gm#.', '.#gg#..#gg#.', '..##....##..', '............', '............'],
  royalChest: ['............', '.###....###.', '.#m#....#m#.', '.#mm####mm#.', '.#mllllllm#.', '..#mllllm#..', '..#mmmmmm#..', '..#mmmmmm#..', '..#gmmmmg#..', '..#gggggg#..', '..########..', '............'],
  royalLegs: ['............', '..########..', '..#llllll#..', '..#mmmmmm#..', '..#mm##mm#..', '..#mm##mm#..', '..#mm##mm#..', '..#mm##mm#..', '..#gg##gg#..', '..#gg##gg#..', '..###..###..', '............'],
  royalBoots: ['............', '............', '..###...###.', '..#l#...#l#.', '..#m#...#m#.', '..#m#...#m#.', '.##m#..##m#.', '#mmm#.#mmm#.', '#ggg#.#ggg#.', '#####.#####.', '............', '............'],
  helmet: ['............', '............', '...######...', '..#llllll#..', '.#llmmmmll#.', '.#mmmmmmmm#.', '.#mm####mm#.', '.#md#..#dm#.', '.#dd#..#dd#.', '..##....##..', '............', '............'],
  chest: ['............', '.###....###.', '.#m#....#m#.', '.#mm####mm#.', '.#mllllllm#.', '..#mllllm#..', '..#mmmmmm#..', '..#mmmmmm#..', '..#dmmmmd#..', '..#dddddd#..', '..########..', '............'],
  legs: ['............', '..########..', '..#llllll#..', '..#mmmmmm#..', '..#mm##mm#..', '..#mm##mm#..', '..#mm##mm#..', '..#mm##mm#..', '..#dd##dd#..', '..#dd##dd#..', '..###..###..', '............'],
  boots: ['............', '............', '..###...###.', '..#l#...#l#.', '..#m#...#m#.', '..#m#...#m#.', '.##m#..##m#.', '#mmm#.#mmm#.', '#ddd#.#ddd#.', '#####.#####.', '............', '............'],
  sword: ['..........##', '.........#l#', '........#l#.', '.......#l#..', '......#l#...', '.....#l#....', '.#..#l#.....', '..##l#......', '..#g#.......', '.#h##.......', '#h#..#......', '.#..........'],
  tnt: ['........y...', '.......y.y..', '......f.....', '.....f......', '..########..', '..#rRrRrR#..', '..#wwwwww#..', '..#rRrRrR#..', '..#rRrRrR#..', '..#wwwwww#..', '..#rRrRrR#..', '..########..'],
  bread: ['............', '............', '............', '...######...', '..#bbbbbb#..', '.#bwbwbwbb#.', '.#bbbbbbbb#.', '.#BBBBBBBB#.', '..########..', '............', '............', '............'],
  torch: ['.....yy.....', '....yyyy....', '....yrry....', '.....##.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....##.....', '............'],
  potion: ['....####....', '.....##.....', '.....cc.....', '....#cc#....', '...#cccc#...', '..#pppppp#..', '..#ppwppp#..', '..#pppppp#..', '..#PPPPPP#..', '...######...', '............', '............'],
  tunic: ['............', '..##.rr.##..', '.#uu#rr#uu#.', '#uuuuuuuuuu#', '#uu#uuuu#uu#', '.##UuuuuU##.', '...#uuuu#...', '...#uuuu#...', '...#hhhh#...', '...#uuuu#...', '...#UUUU#...', '...######...'],
  trousers: ['............', '..########..', '..#hhhhhh#..', '..#nnnnnn#..', '..#nn##nn#..', '..#nn##nn#..', '..#nn##nn#..', '..#nn##nn#..', '..#NN##NN#..', '..#NN##NN#..', '..###..###..', '............'],
  leatherBoots: ['............', '............', '..###...###.', '..#b#...#b#.', '..#h#...#h#.', '..#h#...#h#.', '.##h#..##h#.', '#hhh#.#hhh#.', '#HHH#.#HHH#.', '#####.#####.', '............', '............'],
  pack: ['............', '....####....', '...#eeee#...', '..########..', '..#bbbbbb#..', '..#bbbbbb#..', '..#BBBBBB#..', '..#hhgghh#..', '..#hhgghh#..', '..#hhhhhh#..', '..########..', '............'],
  shirt: ['............', '..##.KK.##..', '.#kk#KK#kk#.', '#kkkkkkkkkk#', '#kk#kkkk#kk#', '.##KkkkkK##.', '...#kkkk#...', '...#kkkk#...', '...#ssss#...', '...#kkkk#...', '...#KKKK#...', '...######...'],
  pants: ['............', '..########..', '..#ssssss#..', '..#oooooo#..', '..#oo##oo#..', '..#oo##oo#..', '..#ok##oo#..', '..#oo##oo#..', '..#OO##OO#..', '..#OO##OO#..', '..###..###..', '............'],
  shoes: ['............', '............', '............', '............', '............', '..###...###.', '..#o#...#o#.', '.##o#..##o#.', '#ooo#.#ooo#.', '#OOO#.#OOO#.', '#####.#####.', '............'],
  cloak: ['............', '....####....', '...#oggo#...', '..#oooooo#..', '..#oooooo#..', '.#oooooooo#.', '.#ooOooOoo#.', '.#ooOooOoo#.', '#oooOooOooo#', '#ooOooooOoo#', '#OOOOOOOOOO#', '############'],
  magicCloak: ['............', '....####....', '...#vyyv#...', '..#vvvvvv#..', '..#vvvvvv#..', '.#vvvvvvvv#.', '.#vvcvvVvv#.', '.#vvVvvVvv#.', '#vvvVvvVvvv#', '#vvVvvvcVvv#', '#VVVVVVVVVV#', '############'],
  wizardHat: ['............', '.....##.....', '....#vv#....', '....#vv#....', '...#vyvv#...', '...#vvvv#...', '..#vvvvyv#..', '..#vvvvvv#..', '..#gggggg#..', '.##########.', '#VVVVVVVVVV#', '.##########.'],
  wizardRobe: ['............', '..##.gg.##..', '.#vv#gg#vv#.', '#vvvvvvvvvv#', '#vv#vvvv#vv#', '.##VvvvvV##.', '...#gggg#...', '...#vvvv#...', '..#vvyvvv#..', '..#vvvvvv#..', '.#VVVVVVVV#.', '.##########.'],
  wizardBoots: ['............', '............', '..###...###.', '..#g#...#g#.', '..#v#...#v#.', '..#v#...#v#.', '.##v#..##v#.', '#gvv#.#gvv#.', '#VVV#.#VVV#.', '#####.#####.', '............', '............'],
  wand: ['.......y....', '...........y', '........yr..', '........ry..', '.......h....', '......hH....', '.....hH.....', '....gg......', '...hH.......', '..hH........', '.hH.........', '.H..........'],
  bow: ['....hhH.....', '...hH..w....', '..hH....w...', '..h.....w...', '.hH.....w...', '.gg.....w...', '.gg.....w...', '.hH.....w...', '..h.....w...', '..hH....w...', '...hH..w....', '....hhH.....'],
  firebolt: ['............', '.......yyy..', '......ywwwy.', '.....ywwwwy.', '....yrwwwry.', '...yrrwwrry.', '..yrrrrrry..', '.yrr.rrry...', '.yr..ryy....', 'yr..yy......', 'y...........', '............'],
  arrow: ['............', '........mmm.', '.........mm.', '........m.m.', '.......h....', '......h.....', '.....h......', '....h.......', '.w.h........', '.wh.........', 'www.........', '............'],
  key: ['............', '..###.......', '.#ggg#......', '.#g.g#......', '.#ggg#......', '..#g#.......', '..#g#.......', '..#g##......', '..#gg#......', '..#g#.......', '..#gg#......', '...##.......'],
};
// What each thing is. `note` says what it is like; the rest does something:
// `walk` and `hurry` speed him up while it is worn, `light` says what light it makes round him (see main.js).
export const ITEMS = {
  helmet: { name: 'Железен шлем', slot: 'head', note: 'Желязо. Пази главата.' },
  chest: { name: 'Железна броня', slot: 'chest', note: 'Желязо, с ризница на ръцете.' },
  legs: { name: 'Железни наколенници', slot: 'legs', note: 'Желязо върху подплата.' },
  boots: { name: 'Железни ботуши', slot: 'feet', note: 'Желязо. Тежки, но здрави.' },
  spear: { name: 'Копие', slot: 'hand', note: 'Дълго, с желязно острие и червено флагче.' },
  shield: { name: 'Щит', slot: 'hand', note: 'Син и сребърен, със златна пъпка. Носи се в ръка.' },
  royalHelmet: { name: 'Кралски шлем', slot: 'head', note: 'Позлатено желязо, с червен перчем.' },
  royalChest: { name: 'Кралска броня', slot: 'chest', note: 'Позлатена, с лъв на гърдите и нараменници.' },
  royalLegs: { name: 'Кралски наколенници', slot: 'legs', note: 'Позлатено желязо върху подплата.' },
  royalBoots: { name: 'Кралски ботуши', slot: 'feet', note: 'Позлатени, тежки.' },
  sword: { name: 'Меч', slot: 'hand', note: 'Остър, с позлатена дръжка.' },
  tnt: { name: 'Динамит', slot: 'hand', stack: true, note: 'Червени пръчки с фитил.' },
  bread: { name: 'Хляб', slot: 'hand', stack: true, note: 'Храна за из път.' },
  torch: { name: 'Факла', slot: 'hand', stack: true, note: 'Гори, докато е в ръка.', light: 'топла светлина около героя' },
  potion: { name: 'Отвара', slot: 'hand', stack: true, note: 'Розова, в стъклено шише.' },
  key: { name: 'Ключ', slot: 'hand', note: 'Стар златен ключ.' },
  bow: { name: 'Лък', slot: 'hand', note: 'Дървен, с опъната тетива.' },
  magicCloak: { name: 'Магическо наметало', slot: 'back', note: 'Плат, който свети сам.', light: 'лилава светлина, малко по-силна от факла' },
  wand: { name: 'Магическа пръчка', slot: 'hand', note: 'С жарава на върха.' },
  tunic: { name: 'Синя туника с шал', slot: 'chest', note: 'С колан и кожени нараменници.' },
  trousers: { name: 'Тъмни панталони', slot: 'legs', note: 'Здрави, за път.' },
  leatherBoots: { name: 'Кожени ботуши', slot: 'feet', note: 'Удобни.' },
  pack: { name: 'Раница', slot: 'back', note: 'С постелка отгоре.' },
  shirt: { name: 'Кърпена риза', slot: 'chest', note: 'Евтина, с въже за колан.' },
  pants: { name: 'Къси панталони от зебло', slot: 'legs', note: 'Евтини, с кръпка на коляното.' },
  shoes: { name: 'Прости обувки', slot: 'feet', note: 'Евтини, вързани с връв.' },
  cloak: { name: 'Кафяво наметало', slot: 'back', note: 'Старо и кърпено.' },
  wizardHat: { name: 'Магьосническа шапка', slot: 'head', note: 'Островърха, със звезди.' },
  wizardRobe: { name: 'Магьосническа мантия', slot: 'chest', note: 'Със златен пояс.' },
  wizardBoots: { name: 'Магьоснически обувки', slot: 'feet', note: 'С извити носове.', walk: 1.075, hurry: 1.15 },
};
export const EQUIP = [
  { key: 'head', label: 'глава', empty: 'helmet' },
  { key: 'back', label: 'гръб', empty: 'cloak' },
  { key: 'chest', label: 'тяло', empty: 'chest' },
  { key: 'legs', label: 'крака', empty: 'legs' },
  { key: 'feet', label: 'ходила', empty: 'boots' },
  { key: 'handR', label: 'дясна ръка', empty: 'torch' },
  { key: 'handL', label: 'лява ръка', empty: 'sword' },
];

// What shoots: the name of the shot, its picture, its look, tiles a second, how many tiles it reaches.
export const SHOOTERS = {
  wand: { name: 'Огнена стрела', icon: 'firebolt', tile: new URL('icons/firebolt.svg', import.meta.url).href, look: 'fire', speed: 18, range: 8 },
  bow: { name: 'Стрела', icon: 'arrow', tile: new URL('icons/arrow.svg', import.meta.url).href, look: 'arrow', speed: 26, range: 10 },
};

// What he has at the very start: [item, count] in each place.
export const START = {
  // he starts with torches in his right hand, and in poor brown clothes
  equip: { back: ['cloak'], chest: ['shirt'], legs: ['pants'], feet: ['shoes'] },       // no torch: he takes one off the wall by the guardian
  bag: {
    0: ['helmet'], 1: ['chest'], 2: ['legs'], 3: ['boots'], 4: ['sword'], 5: ['tnt', 5],
    9: ['bread', 3], 10: ['potion', 2], 11: ['key'], 12: ['bow'],
    18: ['tunic'], 19: ['trousers'], 20: ['leatherBoots'], 21: ['pack'],
  },
  box: { 0: ['wizardHat'], 1: ['wizardRobe'], 2: ['wizardBoots'], 3: ['wand'], 4: ['magicCloak'] },      // the chest in the far chamber
};
