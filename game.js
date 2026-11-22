// @ts-check
// D&K: Dungeons and Knowledge. startGame() puts the game's screen into `el` and starts it (game/main.js, which
// finds its parts by id). Opened alone it runs from index.html; inside LevAcademy from academy-app.js.

export const FONTS = 'https://fonts.googleapis.com/css2?family=Balsamiq+Sans:wght@400;700&family=Rubik:wght@500;700&display=swap';

const MARKUP = `
<canvas id="backdrop" aria-hidden="true"></canvas>
<canvas id="scene"></canvas>
<div class="vignette"></div>
<div class="night is-on" id="night"></div>

<div class="hud">
  <div class="left">
    <div class="pill fps" id="fps">fps</div>
    <div class="pill"><i class="coin"></i>Жълтици <b id="purse">0</b></div>
  </div>
  <div class="right">
    <button id="stone" type="button" hidden></button>
    <button id="style" type="button" hidden>Вид: гладки кубчета</button>
    <button id="inv-open" type="button">Инвентар (Tab)</button>
    <button id="settings-open" type="button">Настройки</button>
    <button id="to-hero" type="button" hidden>Към героя</button>
  </div>
</div>
<canvas id="minimap" aria-hidden="true"></canvas>
<div class="hint" id="hint"></div>
<div class="actions" id="actions"></div>
<div class="panel" role="dialog" aria-live="polite">
  <h2 id="panel-title"></h2>
  <p id="panel-text"></p>
  <div class="answers" id="answers" hidden></div>
  <button id="back" type="button">Назад</button>
</div>

<section class="task" id="task" data-phase="place" aria-live="polite">
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

<section class="task inv" id="inv" aria-live="polite">
  <h2 id="inv-title">Инвентар</h2>
  <div class="inv-grid">
    <div class="equip" id="inv-equip"></div>
    <div>
      <p class="inv-label box-only">В сандъка</p>
      <div class="bag box-only" id="inv-box"></div>
      <p class="inv-label box-only">Твоите неща</p>
      <div class="bag" id="inv-bag"></div>
      <div class="inv-info"><p class="inv-name" id="inv-name"></p><ul class="inv-props" id="inv-props"></ul></div>
    </div>
  </div>
  <div class="row"><button class="plain" id="inv-close" type="button">Затвори (Tab)</button></div>
</section>
<section class="task settings" id="settings">
  <h2>Настройки</h2>
  <div id="settings-list"></div>
  <div class="row"><button class="plain" id="settings-close" type="button">Затвори (Esc)</button></div>
</section>
<div class="held" id="held" hidden><img alt=""><span></span></div>

`;

/** @param {HTMLElement} el */
export async function startGame(el) {
  el.innerHTML = MARKUP;
  await import('./game/main.js');
}
