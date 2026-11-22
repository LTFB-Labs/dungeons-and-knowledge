// @ts-check
// Shooting. Whatever in the walker's hands can shoot gets a square at the bottom of the screen. One of them is
// the chosen one (a click on a square chooses it when both hands can shoot). What is shot flies straight until
// it meets something that cannot be walked through, or as far as it reaches.
import * as THREE from './three.js';

/**
 * @param {object} o
 * @param {any} o.scene
 * @param {Record<string, { name: string, icon: string, tile?: string, look: string, speed: number, range: number }>} o.shooters  `tile`: a picture for its square at the bottom (else the small item icon)
 *   by item id. look: 'fire' (a glowing ball that flares out where it stops), or a name from `looks`.
 *   speed: tiles a second; range: tiles.
 * @param {Record<string, any>} [o.looks] groups for the other looks; each points along +z, the way it flies
 * @param {any} o.inv from createInventory
 * @param {any} o.walker from createWalker
 * @param {() => boolean} o.busy a close-up is on
 * @param {(i: number, j: number) => boolean} o.walkable
 * @param {Record<string, string>} o.icons
 * @param {HTMLElement} o.bar where the squares go
 * @param {{ key: string }} o.text key: what the chosen square says (the name of the key that shoots)
 * @param {number} [o.castSeconds] how long the arm is up
 * @param {(look: string) => void} [o.onShot] it leaves the hand
 * @param {(look: string) => void} [o.onHit] it stops against something (not when it only runs out of reach)
 */
export function createProjectiles({ scene, shooters: SHOOTERS, looks = {}, inv, walker, busy, walkable, icons: ICON, bar, text, castSeconds: CAST = 0.4, onShot, onHit }) {
  const hero = walker.rig.group;
  const inventory = inv.model;
  const bolt = { state: 'idle', look: 'fire', dir: new THREE.Vector3(), travelled: 0, t: 0, speed: 9, range: 8, group: new THREE.Group() };
  const fireLook = new THREE.Group();
  const boltCore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  const boltShell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.55, depthWrite: false }));
  fireLook.add(boltCore, boltShell);
  bolt.group.add(fireLook, ...Object.values(looks));
  bolt.group.visible = false;
  scene.add(bolt.group);
  const boltLight = new THREE.PointLight(0xff8a3a, 0, 4, 2);       // always there and dark until a firebolt flies: a light added later would rebuild every material
  scene.add(boltLight);
  let activeHand = null;           // which hand shoots
  /** A hand that holds something that shoots, if any. */
  const shooterHand = () => ['handR', 'handL'].find((k) => SHOOTERS[inventory.equip[k]?.id]);
  function renderActions() {
    const hands = ['handR', 'handL'].filter((k) => SHOOTERS[inventory.equip[k]?.id]);
    if (!hands.includes(activeHand)) activeHand = hands[0] ?? null;
    bar.replaceChildren(...hands.map((k) => {
      const shooter = SHOOTERS[inventory.equip[k].id];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `action${k === activeHand ? ' is-on' : ''}`;
      button.title = shooter.name;
      if (shooter.tile) button.classList.add('has-tile');
      button.innerHTML = `<img alt="" src="${shooter.tile ?? ICON[shooter.icon]}"><b>${k === activeHand ? text.key : shooter.name}</b>`;
      button.addEventListener('click', () => { activeHand = k; renderActions(); button.blur(); });
      return button;
    }));
  }
  /** Shoots the chosen thing the way `angle` points. */
  function shoot(angle) {
    const shooter = SHOOTERS[inventory.equip[activeHand]?.id];
    if (!shooter || walker.walk || busy() || bolt.state !== 'idle') return;
    walker.faceGoal = angle;
    walker.rig.cast(activeHand === 'handR' ? 1 : 0, CAST);
    Object.assign(bolt, { look: shooter.look, speed: shooter.speed, range: shooter.range, travelled: 0, state: 'wait', t: 0 });
    bolt.dir.set(Math.sin(angle), 0, Math.cos(angle));
    bolt.group.rotation.set(0, angle, 0);
    bolt.group.position.set(hero.position.x, hero.position.y + 0.95, hero.position.z).addScaledVector(bolt.dir, 0.4);
    fireLook.visible = shooter.look === 'fire';
    for (const [name, look] of Object.entries(looks)) look.visible = shooter.look === name;
  }
  /** Every frame. */
  function update(dt) {
    if (bolt.state === 'idle') return;
    bolt.t += dt;
    const fire = bolt.look === 'fire';
    if (bolt.state === 'wait') {                    // it leaves once the arm is up
      if (bolt.t < CAST * 0.45) return;
      bolt.state = 'fly';
      bolt.t = 0;
      onShot?.(bolt.look);
      bolt.group.visible = true;
      boltShell.scale.setScalar(1);
      boltShell.material.opacity = 0.55;
      boltCore.scale.setScalar(1);
    }
    if (bolt.state === 'fly') {
      boltCore.rotation.set(bolt.t * 9, bolt.t * 7, 0);
      boltShell.rotation.set(-bolt.t * 6, bolt.t * 8, 0);
      boltLight.intensity = fire ? 3.5 : 0;
      // A fast shot moves in short hops, so even a slow frame cannot carry it through a one-tile wall.
      const travel = dt * bolt.speed;
      const hops = Math.ceil(travel / 0.4);
      for (let hop = 0; hop < hops && bolt.state === 'fly'; hop++) {
        bolt.group.position.addScaledVector(bolt.dir, travel / hops);
        bolt.travelled += travel / hops;
        const p = bolt.group.position;
        const i = Math.round(p.x);
        const j = Math.round(p.z);
        const solid = !(i === walker.tile.i && j === walker.tile.j) && !walkable(i, j);
        if (solid || bolt.travelled > bolt.range) { bolt.state = 'stop'; bolt.t = 0; }
        if (solid) onHit?.(bolt.look);
      }
    } else if (fire) {
      const k = Math.min(1, bolt.t / 0.35);           // a firebolt flares, then nothing
      boltShell.scale.setScalar(1 + k * 4);
      boltShell.material.opacity = 0.55 * (1 - k);
      boltCore.scale.setScalar(Math.max(0.001, 1 - k));
      boltLight.intensity = 6 * (1 - k);
      if (k >= 1) { bolt.state = 'idle'; bolt.group.visible = false; boltLight.intensity = 0; }
    } else if (bolt.t > 0.6) {                        // an arrow sticks for a moment, then is gone
      bolt.state = 'idle';
      bolt.group.visible = false;
    }
    boltLight.position.copy(bolt.group.position);
  }
  /** One line about a thing that shoots, for the inventory; null for the rest. */
  const describe = (id) => (SHOOTERS[id] ? text.shoots(SHOOTERS[id]) : null);
  return { shoot, update, renderActions, shooterHand, describe };
}
