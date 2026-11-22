// @ts-check
// What the game sounds like: every sound is a few tones and bursts of noise from the engine's audio.js.
// The air of the place (a hum and drips below; wind and birds above), the torches and the water by how near
// they are, steps by what is underfoot, and one sound for each thing that happens.

const up = (base, steps) => base * 2 ** (steps / 12);

/**
 * @param {object} o
 * @param {any} o.audio from createAudio
 * @param {boolean} o.above the land above (else the dungeon)
 */
export function createSounds({ audio, above }) {
  const rand = Math.random;
  const beds = { air: null, torch: null, water: null };
  audio.whenReady(() => {
    beds.air = above ? audio.bed({ filter: 'bandpass', freq: 420, q: 0.5 }) : audio.bed({ filter: 'lowpass', freq: 110, q: 0.7, wet: 0.4 });
    beds.torch = audio.bed({ filter: 'highpass', freq: 2600, q: 0.5 });
    beds.water = audio.bed({ filter: 'bandpass', freq: 1700, q: 0.6, wet: 0.2 });
  });
  let nextCall = 3;                // seconds to the next drip (below) or bird (above)
  let torchNow = 0;
  let waterNow = 0;

  const STEP = {
    stone: () => { audio.noise({ filter: 'bandpass', from: 900 + rand() * 300, q: 2, time: 0.07, gain: 0.16, wet: above ? 0 : 0.25 }); audio.tone({ from: 150, to: 90, time: 0.05, gain: 0.07 }); },
    grass: () => audio.noise({ filter: 'bandpass', from: 2400 + rand() * 900, q: 0.8, time: 0.1, gain: 0.07, attack: 0.02 }),
    wood: () => { audio.tone({ type: 'triangle', from: 210 + rand() * 30, to: 120, time: 0.09, gain: 0.14 }); audio.noise({ from: 700, time: 0.04, gain: 0.06 }); },
    water: () => { audio.noise({ filter: 'bandpass', from: 1200, to: 2600, q: 1.2, time: 0.16, gain: 0.1, attack: 0.02, wet: 0.2 }); audio.tone({ from: 500, to: 900, time: 0.06, gain: 0.03, delay: 0.03 }); },
  };

  return {
    /** A step onto a tile. `ground`: 'stone', 'grass', 'wood' or 'water'. */
    step(ground, hurried) { (STEP[ground] ?? STEP.stone)(); if (hurried) audio.noise({ from: 500, time: 0.03, gain: 0.03 }); },
    click() { audio.tone({ type: 'square', from: 520, to: 400, time: 0.045, gain: 0.035 }); },
    /** A lid goes up: a creak, then it knocks against the back. */
    chest() {
      audio.tone({ type: 'sawtooth', from: 95, to: 170, time: 0.55, gain: 0.05, attack: 0.1, wet: 0.3 });
      audio.tone({ type: 'sawtooth', from: 143, to: 250, time: 0.5, gain: 0.025, attack: 0.1 });
      audio.noise({ from: 380, to: 120, time: 0.16, gain: 0.2, delay: 0.5, wet: 0.3 });
    },
    coins() { for (let k = 0; k < 5; k++) audio.tone({ from: 2300 + rand() * 1500, time: 0.18, gain: 0.05, delay: 0.25 + k * 0.07 + rand() * 0.03, wet: 0.2 }); },
    /** The lock of the task chest does not give. */
    rattle() { for (let k = 0; k < 3; k++) audio.noise({ filter: 'bandpass', from: 1500, q: 3, time: 0.05, gain: 0.12, delay: k * 0.07 }); },
    right() { [0, 4, 7].forEach((steps, k) => audio.tone({ type: 'triangle', from: up(392, steps), time: 0.7, gain: 0.09, delay: k * 0.13, wet: 0.5 })); },
    wrong() { audio.tone({ type: 'triangle', from: 196, to: 147, time: 0.45, gain: 0.1, wet: 0.3 }); audio.tone({ type: 'triangle', from: 185, to: 139, time: 0.45, gain: 0.07 }); },
    /** The stone door slides down and the guardian steps aside. */
    door() { audio.noise({ from: 160, to: 70, q: 1.5, time: 1.5, gain: 0.35, attack: 0.25, wet: 0.5 }); audio.noise({ from: 300, time: 0.2, gain: 0.25, delay: 1.3, wet: 0.5 }); },
    pick() { audio.tone({ type: 'triangle', from: 660, to: 880, time: 0.06, gain: 0.05 }); },
    equip() { audio.noise({ filter: 'bandpass', from: 1900, q: 1.5, time: 0.09, gain: 0.1 }); audio.tone({ type: 'triangle', from: 330, to: 440, time: 0.1, gain: 0.06, delay: 0.03 }); },
    /** Something is shot. `look`: 'fire' or an arrow. */
    shot(look) {
      if (look === 'fire') { audio.noise({ filter: 'bandpass', from: 500, to: 2200, q: 0.8, time: 0.4, gain: 0.16, attack: 0.08 }); audio.tone({ from: 220, to: 110, time: 0.3, gain: 0.05 }); }
      else { audio.tone({ type: 'triangle', from: 320, to: 180, time: 0.14, gain: 0.12 }); audio.noise({ filter: 'highpass', from: 3000, time: 0.12, gain: 0.05, attack: 0.02 }); }
    },
    /** And it stops against something. */
    hit(look) {
      if (look === 'fire') { audio.noise({ from: 900, to: 150, time: 0.45, gain: 0.3, wet: 0.4 }); audio.tone({ from: 120, to: 50, time: 0.3, gain: 0.12 }); }
      else { audio.tone({ type: 'triangle', from: 170, to: 110, time: 0.08, gain: 0.16 }); audio.noise({ from: 600, time: 0.04, gain: 0.1 }); }
    },
    /**
     * Every frame. `torch`: how near the nearest burning torch is, 0 (far) to 1 (at it); `water`: the same for
     * open water.
     */
    update(dt, t, torch, water) {
      if (!audio.on || !audio.volume.sound || !beds.air) return;
      torchNow += (torch - torchNow) * Math.min(1, dt * 4);
      waterNow += (water - waterNow) * Math.min(1, dt * 3);
      beds.air.gain.value = above ? 0.035 + 0.02 * Math.sin(t * 0.23) + 0.012 * Math.sin(t * 0.61) : 0.3;
      beds.torch.gain.value = 0.035 * torchNow * torchNow * (0.6 + 0.8 * rand());
      beds.water.gain.value = 0.11 * waterNow * waterNow;
      if (torchNow > 0.15 && rand() < dt * 7 * torchNow) audio.noise({ filter: 'bandpass', from: 1500 + rand() * 2500, q: 2, time: 0.025, gain: 0.07 * torchNow });
      nextCall -= dt;
      if (nextCall > 0) return;
      if (above) {                                       // a bird: a few short chirps
        const pitch = 2500 + rand() * 1400;
        for (let k = 0, chirps = 2 + Math.floor(rand() * 3); k < chirps; k++) audio.tone({ from: pitch, to: pitch * (1.15 + rand() * 0.2), time: 0.08, gain: 0.03, attack: 0.02, delay: k * 0.13, wet: 0.15 });
        nextCall = 4 + rand() * 9;
      } else {                                           // a drip, and its echo in the hall
        const pitch = 1100 + rand() * 700;
        audio.tone({ from: pitch, to: pitch * 0.55, time: 0.09, gain: 0.1, wet: 0.9 });
        nextCall = 2 + rand() * 6;
      }
    },
  };
}
