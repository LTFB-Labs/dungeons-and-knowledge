// @ts-check
// The settings sheet: one slider for each setting, with its name and its value, or a switch for what is only on
// or off. A choice is remembered in this browser, where the browser lets it (inside a sandboxed frame it does
// not, and then it just is not remembered).

/**
 * @param {object} o
 * @param {{ id: string, label: string, start: number, min?: number, max?: number, step?: number, unit?: string, note?: string, toggle?: boolean, shown?: (value: number) => string }[]} o.list
 *   the settings, in the order they are shown; `toggle`: a switch, 1 or 0, in place of a slider from `min` to `max`;
 *   `note` is a hint shown on hover; `shown(value)` writes the value in its own way
 * @param {{ list: HTMLElement, open: HTMLElement, close: HTMLElement }} o.els where the rows go; the buttons that open and close the sheet
 * @param {string} o.prefix what the names start with in the browser's memory
 * @param {(id: string, value: number) => void} o.apply called for every setting at the start, and whenever it changes
 */
export function createSettings({ list, els, prefix, apply }) {
  const values = {};
  const show = {};                 // id -> puts a value on the row and applies it
  for (const setting of list) {
    const { id, toggle } = setting;
    const min = toggle ? 0 : setting.min;
    const max = toggle ? 1 : setting.max;
    const row = document.createElement('div');
    row.className = 'setting';
    if (setting.note) row.title = setting.note;
    const name = document.createElement('span');
    name.textContent = setting.label;
    const input = document.createElement('input');
    input.ariaLabel = setting.label;
    if (toggle) {
      input.type = 'checkbox';
      row.append(name, input);
    } else {
      Object.assign(input, { type: 'range', min: String(min), max: String(max), step: String(setting.step ?? 1) });
      row.append(name, document.createElement('b'), input);
    }
    show[id] = (value) => {
      values[id] = Math.max(min, Math.min(max, value));
      if (toggle) input.checked = values[id] > 0;
      else {
        input.value = String(values[id]);
        row.children[1].textContent = setting.shown ? setting.shown(values[id]) : `${Math.round(values[id])}${setting.unit ?? ''}`;
      }
      apply(id, values[id]);
    };
    input.addEventListener('input', () => choose(id, toggle ? Number(input.checked) : Number(input.value)));
    for (const letGo of ['change', 'pointerup']) input.addEventListener(letGo, () => input.blur());      // the keys go back to the game
    els.list.append(row);
    let kept = null;
    try { kept = localStorage.getItem(prefix + id); } catch { /* nothing is remembered */ }
    show[id](kept === null || Number.isNaN(Number(kept)) ? setting.start : Number(kept));
  }
  /** A choice: shown, applied and remembered. */
  function choose(id, value) {
    show[id](value);
    try { localStorage.setItem(prefix + id, String(values[id])); } catch { /* it just is not remembered */ }
  }

  const open = (on) => {
    document.body.classList.toggle('is-settings', on);
    document.activeElement?.blur?.();
  };
  els.open.addEventListener('click', () => open(!document.body.classList.contains('is-settings')));
  els.close.addEventListener('click', () => open(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('is-settings')) open(false);
  });
  return { values, choose };
}
