// @ts-check
// Going from one map to another, and what is carried along. Which map is open is said by the # in the address;
// travelling sets it and loads the page again. What must survive (the inventory, what has been opened) rides
// in window.name: inside a sandboxed frame (LevAcademy's) the browser's storage is shut, window.name is not.

/** The place the page was opened at: the text after # ('' when there is none). */
export const place = () => location.hash.slice(1);

/**
 * @param {object} o
 * @param {string} o.saveKey marks our own text in window.name
 * @param {HTMLElement} o.curtain gets `is-on` to darken the screen while the page changes
 */
export function createTravel({ saveKey, curtain }) {
  let saved = null;
  if (window.name.startsWith(`${saveKey}:`)) {
    try { saved = JSON.parse(window.name.slice(saveKey.length + 1)); } catch { saved = null; }
    window.name = '';
  }
  return {
    /** What was carried here, or null. */
    saved,
    /** Leaves for the place `to`, taking `state` along. */
    go(to, state) {
      window.name = `${saveKey}:${JSON.stringify(state)}`;
      curtain.classList.add('is-on');
      setTimeout(() => { location.hash = to; location.reload(); }, 420);
    },
    /** The page is ready: the curtain lifts. */
    arrive() { setTimeout(() => curtain.classList.remove('is-on'), 60); },
  };
}
