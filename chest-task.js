// Shared rules and texts for the look studies of "Разсеяният счетоводител".
// A look only draws and animates. All rules and all visible text live here,
// so the three looks differ in style only.

export const TASK = {
  total: 10000,
  answer: 631,
  fee: 40,
  // Bar segments, left to right. `value: null` is the unknown one.
  segments: [
    { id: 'computers', label: 'компютри', value: 3304 },
    { id: 'desks', label: 'бюра и столове', value: 5042 },
    { id: 'mice', label: 'мишки', value: null },
    { id: 'left', label: 'останали', value: 1023 },
  ],
};

// A chip is a number from the note. `slot` is the only place it belongs:
// 'total' is the whole bar, the rest are segment ids.
export const CHIPS = [
  { id: 'c-total', value: 10000, slot: 'total' },
  { id: 'c-computers', value: 3304, slot: 'computers' },
  { id: 'c-desks', value: 5042, slot: 'desks' },
  { id: 'c-left', value: 1023, slot: 'left' },
];

export const SLOTS = ['total', 'computers', 'desks', 'left'];

// The note as parts: plain text and chips, in reading order.
export const NOTE = [
  'Обърках сметките! Училището имаше ',
  { chip: 'c-total' },
  ' евро. Дадохме ',
  { chip: 'c-computers' },
  ' за компютри и ',
  { chip: 'c-desks' },
  ' за бюра и столове. Купихме и мишки, но бележката е залята с кафе. В касата останаха ',
  { chip: 'c-left' },
  ' евро.',
];

export const TEXT = {
  title: 'Разсеяният счетоводител',
  from: 'Бележка от счетоводителя',
  ask: 'Колко струваха мишките? Намериш ли ги, хонорарът е твой.',
  fee: 'Хонорар',
  wallet: 'Твоят бюджет',
  credits: 'кредита',
  stepPlace: 'Сложи числата от бележката на местата им в лентата.',
  stepDial: 'Набери на сейфа колко струваха мишките.',
  totalLabel: 'цялото',
  unknown: '?',
  misplaced: 'Това число не е за тук.',
  wrong: 'Сметката не излиза. Опитай пак.',
  won: 'Сейфът се отвори! Мишките струваха 631 евро.',
  check: 'Провери',
  again: 'Отначало',
};

export const DIAL_SIZE = 4;

// Bulgarian style: a space only from five digits up ("3304", "10 000").
export function formatNumber(n) {
  const s = String(n);
  return s.length < 5 ? s : s.replace(/\B(?=(\d{3})+$)/g, ' ');
}

// Share of the whole bar for each segment (0..1), the unknown one included.
// Looks should give narrow segments a minimum width so they stay tappable.
export function segmentShare(segmentId) {
  const segment = TASK.segments.find((s) => s.id === segmentId);
  const value = segment.value ?? TASK.answer;
  return value / TASK.total;
}

export function chipById(chipId) {
  return CHIPS.find((c) => c.id === chipId);
}

// Phases: 'place' (numbers into the bar) -> 'dial' (set the safe) -> 'won'.
// The listener gets (state, event) after every change. Events:
//   { type: 'start' }
//   { type: 'select', chipId }            chipId is null when deselected
//   { type: 'placed', chipId, slotId, allPlaced }
//   { type: 'misplaced', chipId, slotId }
//   { type: 'dial', index, digit }
//   { type: 'wrong', value }
//   { type: 'won', value, fee }
export function createGame(listener) {
  let state;

  const fresh = (wallet = 0) => ({
    phase: 'place',
    selected: null,
    placed: {}, // slotId -> chipId
    dial: Array(DIAL_SIZE).fill(0),
    attempts: 0,
    wallet,
  });

  const snapshot = () => ({ ...state, placed: { ...state.placed }, dial: [...state.dial] });
  const emit = (event) => listener(snapshot(), event);
  const isPlaced = (chipId) => Object.values(state.placed).includes(chipId);

  return {
    get state() {
      return snapshot();
    },

    start() {
      state = fresh();
      emit({ type: 'start' });
    },

    // Tap a chip to pick it up; tap it again to put it down.
    select(chipId) {
      if (state.phase !== 'place' || !chipById(chipId) || isPlaced(chipId)) return;
      state.selected = state.selected === chipId ? null : chipId;
      emit({ type: 'select', chipId: state.selected });
    },

    // Put the picked chip into a slot. A wrong slot sends it back, nothing is lost.
    place(slotId) {
      if (state.phase !== 'place' || !state.selected || !SLOTS.includes(slotId)) return;
      if (state.placed[slotId]) return;
      const chipId = state.selected;
      state.selected = null;
      if (chipById(chipId).slot !== slotId) {
        emit({ type: 'misplaced', chipId, slotId });
        return;
      }
      state.placed[slotId] = chipId;
      const allPlaced = SLOTS.every((s) => state.placed[s]);
      if (allPlaced) state.phase = 'dial';
      emit({ type: 'placed', chipId, slotId, allPlaced });
    },

    // Turn one wheel of the safe: delta is +1 or -1, digits wrap around.
    turn(index, delta) {
      if (state.phase !== 'dial' || index < 0 || index >= DIAL_SIZE) return;
      state.dial[index] = (state.dial[index] + delta + 10) % 10;
      emit({ type: 'dial', index, digit: state.dial[index] });
    },

    check() {
      if (state.phase !== 'dial') return;
      const value = Number(state.dial.join(''));
      if (value === TASK.answer) {
        state.phase = 'won';
        state.wallet += TASK.fee;
        emit({ type: 'won', value, fee: TASK.fee });
      } else {
        state.attempts += 1;
        emit({ type: 'wrong', value });
      }
    },

    // Play again; the wallet keeps what was earned.
    reset() {
      state = fresh(state.wallet);
      emit({ type: 'start' });
    },
  };
}
