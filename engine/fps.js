// @ts-check
// A frame counter: frames a second, averaged over half a second, and the longest frame in that time.

/** @param {HTMLElement} el where it is written, at most twice a second */
export function createFps(el) {
  let since = 0;                   // when the count began, in milliseconds
  let last = 0;                    // when the frame before this one was
  let frames = 0;
  let worst = 0;
  return {
    get on() { return !el.hidden; },
    set(on) { el.hidden = !on; since = 0; },
    /** Every frame. */
    tick() {
      if (el.hidden) return;
      const now = performance.now();
      if (!since) { since = last = now; frames = 0; worst = 0; return; }
      frames++;
      worst = Math.max(worst, now - last);
      last = now;
      if (now - since < 500) return;
      el.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${Math.round(worst)} ms`;
      since = now; frames = 0; worst = 0;
    },
  };
}
