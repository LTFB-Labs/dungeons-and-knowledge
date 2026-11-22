// @ts-check
// The guardian asks one question at random, never the same one twice in a row.
// Only the right answer opens the door. A wrong answer costs nothing, but he asks something else.
import { TEXT, QUESTIONS } from './texts.js';

/**
 * @param {object} o
 * @param {{ text: HTMLElement, answers: HTMLElement }} o.panel
 * @param {() => boolean} o.asking the close-up of the guardian is still on and the door is still shut
 * @param {() => void} o.onRight
 * @param {(right: boolean) => void} [o.onAnswer] an answer was given
 */
export function createGuardian({ panel, asking, onRight, onAnswer }) {
  let question = null;
  function ask() {
    const others = QUESTIONS.filter((q) => q !== question);
    question = others[Math.floor(Math.random() * others.length)];
    panel.text.textContent = question.ask;
    panel.answers.replaceChildren(...question.answers.map((label, k) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => answer(button, k));
      return button;
    }));
    panel.answers.hidden = false;
  }
  function answer(button, k) {
    [...panel.answers.children].forEach((b) => { b.disabled = true; });
    const right = k === question.right;
    onAnswer?.(right);
    button.classList.add(right ? 'is-right' : 'is-wrong');
    panel.text.textContent = right ? TEXT.doorRight : TEXT.doorWrong;
    if (right) setTimeout(onRight, 900);
    else setTimeout(() => { if (asking()) ask(); }, 1300);
  }
  return { ask };
}
