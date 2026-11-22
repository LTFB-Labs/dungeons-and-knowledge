// @ts-check
// The inventory: what is worn (one thing per slot, and one in each hand), a bag, and a box that stands for
// an open chest. And its sheet: a click picks a thing up and puts it down, a double click moves it straight
// to where it belongs; under the bag the thing under the pointer is named, with what it does.

/**
 * Small pixel pictures from letter grids. `rows`: { id: 12 strings of 12 letters }, `palette`: { letter: '#rrggbb' };
 * a letter that is not in the palette is see-through. Gives { id: data URL }.
 */
export function makeIcons(rows, palette) {
  return Object.fromEntries(Object.entries(rows).map(([id, lines]) => {
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    const ctx = c.getContext('2d');
    lines.forEach((row, y) => [...row].forEach((ch, x) => { if (palette[ch]) { ctx.fillStyle = palette[ch]; ctx.fillRect(x, y, 1, 1); } }));
    return [id, c.toDataURL()];
  }));
}

/**
 * @param {object} o
 * @param {Record<string, { name: string, slot: string, stack?: boolean, note?: string, walk?: number, hurry?: number, light?: string }>} o.items
 *   slot: the key of a worn slot, or 'hand' (either hand). walk, hurry: he is that many times faster while it is worn.
 * @param {{ key: string, label: string, empty: string }[]} o.slots the worn slots, among them handR and handL;
 *   `empty` is the icon shown while nothing is there
 * @param {Record<string, string>} o.icons
 * @param {number} [o.bagSize]
 * @param {number} [o.boxSize]
 * @param {number} o.hurry how many times faster hurrying is than walking
 * @param {{ equip: HTMLElement, bag: HTMLElement, box: HTMLElement, name: HTMLElement, props: HTMLElement, held: HTMLElement, title: HTMLElement }} o.els
 * @param {any} o.text the words of the sheet (see game/texts.js)
 * @param {(id: string) => string | null} [o.more] one more line about a thing (what it shoots)
 * @param {HTMLElement} [o.root] gets `is-inv` while the sheet is up, and `is-box` while the box is shown too
 */
export function createInventory({ items: ITEMS, slots: EQUIP, icons: ICON, bagSize = 27, boxSize = 9, hurry: HURRY, els, text, more, root = document.body }) {
  const inventory = {
    equip: Object.fromEntries(EQUIP.map(({ key }) => [key, null])),
    bag: Array(bagSize).fill(null),
    box: Array(boxSize).fill(null),
  };
  let held = null;
  const changed = [];              // () => {}: called whenever anything has moved
  const gearOn = () => Object.values(inventory.equip).filter(Boolean).map((it) => ITEMS[it.id]);

  const inv = {
    model: inventory, changed,
    boxOpen: false,
    item: (id, count = 1) => ({ id, count }),
    walkPace: () => gearOn().reduce((pace, thing) => pace * (thing.walk ?? 1), 1),
    hurryPace: () => HURRY * gearOn().reduce((pace, thing) => pace * (thing.hurry ?? 1), 1),
    /** Is this thing in one of his hands? */
    holds: (id) => inventory.equip.handR?.id === id || inventory.equip.handL?.id === id,
    render: renderInventory, dropHeld,
    /** Takes over what was saved: { equip, bag, box }. */
    restore(saved) {
      Object.assign(inventory.equip, saved.equip);
      saved.bag.forEach((it, k) => { inventory.bag[k] = it; });
      saved.box?.forEach((it, k) => { inventory.box[k] = it; });
      renderInventory();
    },
    /**
     * Ties the sheet to the rest: `open()` is a close-up of the walker with the sheet under him, `toggle()` opens
     * and shuts it; when any close-up ends, what is picked up drops back into the bag.
     */
    attach({ ui, cam, walker }) {
      const spot = walker.tilePos({ i: 0, j: 0 });
      ui.sheets.add('is-inv').add('is-box');
      ui.closing.push(() => { inv.boxOpen = false; dropHeld(); });
      inv.open = () => {
        if (walker.walk) return;
        walker.clearSelection();
        const at = walker.rig.group.position;
        cam.focus(spot.set(at.x, at.y + 0.8, at.z), 2.7, 0.27);          // the walker above the sheet
        walker.faceGoal = Math.PI / 4;                                   // turns to face us
        ui.enter('hero');
        inv.show(text.title);
      };
      inv.toggle = () => { if (ui.closeUp === 'hero' || inv.boxOpen) ui.close(); else if (!ui.closeUp) inv.open(); };
    },
    /** The sheet comes up, with the title given; `withBox`: the box is shown too, and things go across. */
    show(title, withBox = false) {
      inv.boxOpen = withBox;
      els.title.textContent = title;
      root.classList.add('is-inv');
      if (withBox) root.classList.add('is-box');
      renderInventory();
    },
  };

  // ---- the sheet ----
  const invName = els.name;
  const invProps = els.props;
  const heldBox = els.held;
  const slotNodes = [];
  function slotButton(where, key, extra = '') {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `slot-i ${extra}`;
    node.innerHTML = '<img alt=""><span></span>';
    node.addEventListener('click', () => clickSlot(where, key));
    node.addEventListener('dblclick', () => quickMove(where, key));
    node.addEventListener('mouseenter', () => describe(where, key));
    node.addEventListener('mouseleave', () => { showItem(held); node.classList.remove('is-wrong'); });      // back to what is picked up, if anything
    slotNodes.push({ node, where, key });
    return node;
  }
  EQUIP.forEach(({ key }) => {
    const node = slotButton('equip', key, 'is-equip');
    node.style.gridArea = key;                                    // placed on the figure: head, body, legs, feet, hands
    els.equip.append(node);
  });
  inventory.bag.forEach((_, k) => els.bag.append(slotButton('bag', k)));
  inventory.box.forEach((_, k) => els.box.append(slotButton('box', k)));

  const getSlot = (where, key) => inventory[where][key];
  const setSlot = (where, key, value) => { inventory[where][key] = value; };
  const fits = (it, where, key) => where !== 'equip' || key.startsWith('hand') || ITEMS[it.id].slot === key;

  // The name of a thing and its properties, listed under the bag: on hover, and while it is picked up.
  const percent = (factor) => `${((factor - 1) * 100).toLocaleString(text.locale, { maximumFractionDigits: 1 })}%`;
  function showItem(it, spot = null) {
    if (!it) {
      invName.textContent = spot ? text.placeFor(spot) : '';
      invProps.replaceChildren();
      return;
    }
    const info = ITEMS[it.id];
    invName.textContent = info.name + (it.count > 1 ? ` × ${it.count}` : '');
    const lines = [info.slot === 'hand' ? text.inHand : text.wornOn(EQUIP.find((e) => e.key === info.slot).label)];
    if (info.note) lines.push(info.note);
    if (info.walk) lines.push(text.walk(percent(info.walk)));
    if (info.hurry) lines.push(text.hurry(percent(info.hurry)));
    if (info.light) lines.push(text.light(info.light));
    const extra = more?.(it.id);
    if (extra) lines.push(extra);
    invProps.replaceChildren(...lines.map((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      return li;
    }));
  }
  function describe(where, key) {
    showItem(getSlot(where, key), where === 'equip' ? EQUIP.find((e) => e.key === key).label : null);
  }
  function clickSlot(where, key) {
    const here = getSlot(where, key);
    const node = slotNodes.find((s) => s.where === where && s.key === key).node;
    if (!held) {
      if (!here) return;
      held = here;
      setSlot(where, key, null);
    } else if (!fits(held, where, key)) {
      node.classList.add('is-wrong');
      invName.textContent = text.wrongSlot;
      return;
    } else if (here && here.id === held.id && ITEMS[here.id].stack) {
      here.count += held.count;
      held = null;
    } else {
      setSlot(where, key, held);
      held = here;
    }
    renderInventory();
    describe(where, key);
  }
  // A double click moves a thing straight to where it belongs, and back.
  function quickMove(where, key) {
    if (held) { clickSlot(where, key); }
    const it = getSlot(where, key);
    if (!it) return;
    if (inv.boxOpen && where !== 'equip') {          // with the box open: across, between the box and the bag
      const to = where === 'box' ? 'bag' : 'box';
      const free = inventory[to].indexOf(null);
      if (free < 0) return;
      inventory[to][free] = it;
      inventory[where][key] = null;
    } else if (where === 'equip') {
      const free = inventory.bag.indexOf(null);
      if (free < 0) return;
      inventory.bag[free] = it;
      inventory.equip[key] = null;
    } else {
      let target = ITEMS[it.id].slot;
      if (target === 'hand') target = !inventory.equip.handR ? 'handR' : !inventory.equip.handL ? 'handL' : 'handR';
      inventory.bag[key] = inventory.equip[target];
      inventory.equip[target] = it;
    }
    renderInventory();
  }
  function dropHeld() {
    if (!held) return;
    const free = inventory.bag.indexOf(null);
    if (free >= 0) inventory.bag[free] = held;
    held = null;
    renderInventory();
  }
  function renderInventory() {
    slotNodes.forEach(({ node, where, key }) => {
      const it = getSlot(where, key);
      const img = node.querySelector('img');
      const empty = where === 'equip' ? EQUIP.find((e) => e.key === key).empty : null;
      img.src = it ? ICON[it.id] : empty ? ICON[empty] : '';
      img.style.visibility = it || empty ? 'visible' : 'hidden';
      img.classList.toggle('is-empty', !it);
      node.querySelector('span').textContent = it && it.count > 1 ? it.count : '';
    });
    heldBox.hidden = !held;
    if (held) {
      heldBox.querySelector('img').src = ICON[held.id];
      heldBox.querySelector('span').textContent = held.count > 1 ? held.count : '';
    }
    changed.forEach((tell) => tell());
  }
  document.addEventListener('pointermove', (e) => { heldBox.style.left = `${e.clientX}px`; heldBox.style.top = `${e.clientY}px`; });
  return inv;
}
