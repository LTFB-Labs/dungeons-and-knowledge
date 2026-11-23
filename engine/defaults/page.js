// @ts-check
// The default page of a game: the elements play.js looks for by id (the scene, the top bar, the hint, the panel
// of a close-up, the inventory and the settings sheets), as markup; page.css gives them their look.
// A game puts pageMarkup() into its element before it calls createGame, and may add its own parts to it.
import { PAGE_TEXT, TEXT } from './texts.js';

export const FONTS = 'https://fonts.googleapis.com/css2?family=Balsamiq+Sans:wght@400;700&family=Rubik:wght@500;700&display=swap';

/**
 * @param {object} [o] what the game adds, as markup
 * @param {string} [o.before] before everything (a backdrop behind the scene)
 * @param {string} [o.left] in the left of the top bar, after the frame counter
 * @param {string} [o.right] at the start of the right of the top bar
 * @param {string} [o.sheets] its own sheets, before the inventory
 * @param {Record<string, string>} [o.text] what the page says (texts.js: PAGE_TEXT)
 */
export function pageMarkup({ before = '', left = '', right = '', sheets = '', text = PAGE_TEXT } = {}) {
  return `
${before}<canvas id="scene"></canvas>
<div class="vignette"></div>
<div class="night is-on" id="night"><div class="loading"><span class="loading-blocks" aria-hidden="true"><i></i><i></i><i></i></span><b>${text.loading}</b></div></div>

<div class="hud">
  <div class="left">
    <div class="pill fps" id="fps">fps</div>
${left}  </div>
  <div class="right">
${right}    <button id="style" type="button" hidden>${TEXT.styleFlat}</button>
    <button id="inv-open" type="button">${text.inventoryOpen}</button>
    <button id="settings-open" type="button">${text.settings}</button>
    <button id="to-hero" type="button" hidden>${text.toHero}</button>
  </div>
</div>
<canvas id="minimap" aria-hidden="true"></canvas>
<div class="hint" id="hint"></div>
<div class="actions" id="actions"></div>
<div class="panel" role="dialog" aria-live="polite">
  <h2 id="panel-title"></h2>
  <p id="panel-text"></p>
  <div class="answers" id="answers" hidden></div>
  <button id="back" type="button">${text.back}</button>
</div>

${sheets}<section class="task inv" id="inv" aria-live="polite">
  <h2 id="inv-title">${text.inventory}</h2>
  <div class="inv-grid">
    <div class="equip" id="inv-equip"></div>
    <div>
      <p class="inv-label box-only">${text.inBox}</p>
      <div class="bag box-only" id="inv-box"></div>
      <p class="inv-label box-only">${text.yours}</p>
      <div class="bag" id="inv-bag"></div>
      <div class="inv-info"><p class="inv-name" id="inv-name"></p><ul class="inv-props" id="inv-props"></ul></div>
    </div>
  </div>
  <div class="row"><button class="plain" id="inv-close" type="button">${text.closeInventory}</button></div>
</section>
<section class="task settings" id="settings">
  <h2>${text.settings}</h2>
  <div id="settings-list"></div>
  <div class="row"><button class="plain" id="settings-close" type="button">${text.closeSettings}</button></div>
</section>
<div class="held" id="held" hidden><img alt=""><span></span></div>

`;
}
