// @ts-check
// The music: made as it goes, calm and endless. Long soft chords that melt into one another, and now and then a
// single plucked note, all in one scale, so nothing ever clashes and no tune comes round again. Below: low and
// minor. Above: lighter and major. While the guardian asks or a chest stands open, a thin high layer joins in.

const hertz = (note) => 440 * 2 ** ((note - 69) / 12);        // from a MIDI note number
const BELOW = {
  chords: [[38, 45, 50, 53], [36, 43, 48, 52], [41, 48, 53, 57], [38, 45, 52, 57]],         // D minor, C, F, D sus
  scale: [62, 65, 67, 69, 72, 74, 77],                                                       // D minor pentatonic
  chord: { type: 'sine', gain: 0.05, wet: 0.6 }, pluck: { type: 'triangle', gain: 0.035, wet: 0.9 }, every: [4, 9],
};
const ABOVE = {
  chords: [[48, 55, 60, 64], [53, 57, 60, 65], [45, 52, 57, 60], [43, 50, 55, 62]],         // C, F, A minor, G
  scale: [67, 69, 72, 74, 76, 79, 81],                                                       // C major pentatonic
  chord: { type: 'triangle', gain: 0.035, wet: 0.35 }, pluck: { type: 'sine', gain: 0.04, wet: 0.5 }, every: [3, 7],
};

/**
 * @param {object} o
 * @param {any} o.audio from createAudio
 * @param {boolean} o.above the land above (else the dungeon)
 */
export function createMusic({ audio, above }) {
  const mood = above ? ABOVE : BELOW;
  const rand = Math.random;
  let chordIn = 1;                 // seconds to the next chord, the next plucked note, the next high note
  let pluckIn = 5;
  let highIn = 2;
  let chord = 0;
  let step = 3;                    // where in the scale the last plucked note was: the next is a step or two away
  return {
    /** Every frame. `more`: the thin high layer plays too. */
    update(dt, more) {
      if (!audio.on || !audio.volume.music) return;
      chordIn -= dt; pluckIn -= dt; highIn -= dt;
      if (chordIn <= 0) {
        chord = (chord + 1 + Math.floor(rand() * (mood.chords.length - 1))) % mood.chords.length;       // never the same twice
        mood.chords[chord].forEach((note, k) => audio.tone({ bus: 'music', ...mood.chord, from: hertz(note), time: 13, attack: 4, delay: k * 0.4 }));
        chordIn = 9;
      }
      if (pluckIn <= 0) {
        step = Math.max(0, Math.min(mood.scale.length - 1, step + Math.floor(rand() * 5) - 2));
        audio.tone({ bus: 'music', ...mood.pluck, from: hertz(mood.scale[step]), time: 2.6, attack: 0.012 });
        pluckIn = mood.every[0] + rand() * (mood.every[1] - mood.every[0]);
      }
      if (more && highIn <= 0) {
        audio.tone({ bus: 'music', type: 'sine', from: hertz(mood.scale[Math.floor(rand() * 4)] + 12), time: 7, attack: 2.5, gain: 0.02, wet: 0.9 });
        highIn = 3 + rand() * 3;
      }
    },
  };
}
