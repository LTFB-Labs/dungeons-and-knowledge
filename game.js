// @ts-check
// D&K: Dungeons and Knowledge. startGame() puts the game's screen into `el` and starts it (game/main.js, which
// finds its parts by id). Opened alone it runs from index.html; inside LevAcademy from academy-app.js.
// The screen is the engine's default page (engine/defaults/page.js) with what is D&K's own added to it: the
// backdrop, the purse, the button for the stone, and the sheet of the chest task.
import { pageMarkup } from './engine/defaults/page.js';

export { FONTS } from './engine/defaults/page.js';

const TASK = `<section class="task" id="task" data-phase="place" aria-live="polite">
  <h2 id="task-title"></h2>
  <div class="seal" aria-hidden="true">✓</div>
  <div class="task-grid" id="task-grid">
    <div>
      <p class="note" id="task-note"></p>
      <p class="ask" id="task-ask"></p>
      <div class="bar">
        <button class="slot total" type="button" data-slot="total"><b></b><span class="label"></span></button>
        <div class="segments" id="task-segments"></div>
      </div>
    </div>
    <div class="lock">
      <div class="dial" id="task-dial"></div>
      <button class="check" id="task-check" type="button"></button>
    </div>
  </div>
  <p class="step" id="task-step"></p>
  <p class="message" id="task-message"></p>
  <div class="row">
    <button class="plain" id="task-back" type="button"></button>
    <button class="plain" id="task-again" type="button" hidden></button>
  </div>
</section>

`;
const MARKUP = pageMarkup({
  before: '<canvas id="backdrop" aria-hidden="true"></canvas>\n',
  left: '    <div class="pill"><i class="coin"></i>Жълтици <b id="purse">0</b></div>\n',
  right: '    <button id="stone" type="button" hidden></button>\n',
  sheets: TASK,
});

/** @param {HTMLElement} el */
export async function startGame(el) {
  el.innerHTML = MARKUP;
  await import('./game/main.js');
}
