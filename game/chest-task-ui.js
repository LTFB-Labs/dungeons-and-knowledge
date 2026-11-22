// @ts-check
// The close-up screen of the bookkeeper's chest: the task itself.
// The treasurer left a note with the chest. The numbers in it are stone tablets;
// they go into the beam (the whole, and its parts), and the missing part opens the lock.
// The rules come from chest-task.js, which was tested on its own; this is only the sheet.
import { createGame, TASK, DIAL_SIZE, formatNumber, segmentShare, chipById } from './chest-task.js';
import { TASK_TEXT, TASK_NOTE, PART_LABEL } from './texts.js';

/**
 * @param {object} o
 * @param {() => void} o.onBack the sheet is left
 * @param {() => void} o.onFail a wrong try: the chest shakes
 * @param {(open: boolean) => void} o.onOpen the chest is open (or shut again, when the task starts over)
 */
export function mountChestTask({ onBack, onFail, onOpen }) {
  const el = (id) => document.getElementById(id);
  el('task-title').textContent = TASK_TEXT.title;
  el('task-ask').textContent = TASK_TEXT.ask;
  el('task-check').textContent = TASK_TEXT.check;
  el('task-back').textContent = TASK_TEXT.back;
  el('task-again').textContent = TASK_TEXT.again;

  const chipButtons = new Map();
  for (const part of TASK_NOTE) {
    if (typeof part === 'string') { el('task-note').append(part); continue; }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = formatNumber(chipById(part.chip).value);
    button.addEventListener('click', () => chestGame.select(part.chip));
    chipButtons.set(part.chip, button);
    el('task-note').append(button);
  }

  const slotButtons = new Map([['total', el('task').querySelector('[data-slot="total"]')]]);
  slotButtons.get('total').querySelector('.label').textContent = TASK_TEXT.total;
  let unknownPart;
  for (const segment of TASK.segments) {
    const known = segment.value !== null;
    const node = document.createElement(known ? 'button' : 'div');
    node.className = known ? 'slot' : 'unknown';
    node.style.flex = `${Math.max(0.17, segmentShare(segment.id))} 1 0`;      // as wide as its share of the whole
    node.innerHTML = '<b></b><span class="label"></span>';
    node.querySelector('.label').textContent = PART_LABEL[segment.id];
    if (known) { node.type = 'button'; slotButtons.set(segment.id, node); } else unknownPart = node;
    el('task-segments').append(node);
  }
  slotButtons.forEach((node, slot) => node.addEventListener('click', () => chestGame.place(slot)));

  const wheels = Array.from({ length: DIAL_SIZE }, (_, k) => {
    const wheel = document.createElement('div');
    wheel.className = 'wheel';
    const turnButton = (label, delta) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => chestGame.turn(k, delta));
      return button;
    };
    const digit = document.createElement('b');
    const buttons = [turnButton('▲', 1), turnButton('▼', -1)];
    wheel.append(buttons[0], digit, buttons[1]);
    el('task-dial').append(wheel);
    return { digit, buttons };
  });
  el('task-check').addEventListener('click', () => chestGame.check());
  el('task-back').addEventListener('click', onBack);
  el('task-again').addEventListener('click', () => chestGame.reset());

  function renderTask(state, event) {
    el('task').dataset.phase = state.phase;
    const used = new Set(Object.values(state.placed));
    chipButtons.forEach((button, id) => {
      button.classList.toggle('is-picked', state.selected === id);
      button.classList.toggle('is-used', used.has(id));
      button.disabled = used.has(id) || state.phase !== 'place';
    });
    slotButtons.forEach((node, slot) => {
      const chip = state.placed[slot];
      node.querySelector('b').textContent = chip ? formatNumber(chipById(chip).value) : '';
      node.classList.toggle('is-filled', Boolean(chip));
      node.disabled = Boolean(chip) || state.phase !== 'place';
    });
    unknownPart.querySelector('b').textContent = state.phase === 'won' ? formatNumber(TASK.answer) : '?';
    unknownPart.classList.toggle('is-solved', state.phase === 'won');
    wheels.forEach((wheel, k) => {
      wheel.digit.textContent = state.dial[k];
      wheel.buttons.forEach((button) => { button.disabled = state.phase !== 'dial'; });
    });
    el('task-check').disabled = state.phase !== 'dial';
    el('task-again').hidden = state.phase !== 'won';
    el('task-step').textContent = state.phase === 'place' ? TASK_TEXT.stepPlace : state.phase === 'dial' ? TASK_TEXT.stepDial : '';
    el('purse').textContent = state.wallet;

    const message = el('task-message');
    const failed = event.type === 'misplaced' || event.type === 'wrong';
    message.textContent = event.type === 'misplaced' ? TASK_TEXT.misplaced : event.type === 'wrong' ? TASK_TEXT.wrong
      : state.phase === 'won' ? TASK_TEXT.won : '';
    message.classList.toggle('is-good', state.phase === 'won');
    if (failed) {                                   // a wrong try costs nothing: the sheet and the chest just shake
      const grid = el('task-grid');
      grid.classList.remove('is-shaking');
      void grid.offsetWidth;
      grid.classList.add('is-shaking');
      onFail();
    }
    onOpen(state.phase === 'won');
  }
  const chestGame = createGame(renderTask);
  chestGame.start();
}
