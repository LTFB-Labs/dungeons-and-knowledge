// @ts-check
// Sound made in the browser, with no audio files: tones and filtered noise, a stone-hall echo from an impulse
// that is rolled here, two volumes (`sound` and `music`). The browser lets sound start only after the player has
// touched the page, so everything waits for the first press or key. While both volumes are 0 nothing is made
// (and what was made is put to sleep).

export function createAudio() {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  const volume = { sound: 0, music: 0 };
  let ctx = null;
  let touched = false;
  let out = null;                  // everything goes through here: it fades in at the start and out on leaving
  let buses = null;                // { sound, music }: the two volumes
  let sends = null;                // { sound, music }: into the hall's echo
  let hiss = null;                 // two seconds of noise, for everything that is not a tone
  const ready = [];                // what waits for the first touch

  // The echo of a stone hall: noise that dies away, a little different in each ear.
  function hallImpulse(seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let side = 0; side < 2; side++) {
      const data = impulse.getChannelData(side);
      for (let k = 0; k < length; k++) data[k] = (Math.random() * 2 - 1) * (1 - k / length) ** 3;
    }
    return impulse;
  }
  function build() {
    ctx = new Context();
    out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    out.connect(ctx.destination);
    const hall = ctx.createConvolver();
    hall.buffer = hallImpulse(2.6);
    hall.connect(out);
    buses = {};
    sends = {};
    for (const bus of ['sound', 'music']) {
      buses[bus] = ctx.createGain();
      buses[bus].gain.value = volume[bus];
      buses[bus].connect(out);
      sends[bus] = ctx.createGain();
      sends[bus].gain.value = volume[bus];
      sends[bus].connect(hall);
    }
    hiss = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = hiss.getChannelData(0);
    for (let k = 0; k < data.length; k++) data[k] = Math.random() * 2 - 1;
    ready.splice(0).forEach((make) => make());
  }
  // Awake only while something may be heard.
  function wake() {
    if (!touched || !Context) return;
    const wanted = volume.sound > 0 || volume.music > 0;
    if (wanted && !ctx) build();
    if (ctx) { if (wanted) ctx.resume(); else ctx.suspend(); }
  }
  for (const first of ['pointerdown', 'keydown']) window.addEventListener(first, () => { if (!touched) { touched = true; wake(); } });

  // A source through its envelope, to its volume and (by `wet`) into the hall.
  function play(source, o, t0) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(o.gain ?? 0.2, t0 + (o.attack ?? 0.005));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.time);
    source.connect(env);
    env.connect(buses[o.bus ?? 'sound']);
    if (o.wet) {
      const send = ctx.createGain();
      send.gain.value = o.wet;
      env.connect(send);
      send.connect(sends[o.bus ?? 'sound']);
    }
    source.start(t0);
    source.stop(t0 + o.time + 0.05);
  }
  const heard = (o) => ctx && volume[o.bus ?? 'sound'] > 0;

  const audio = {
    volume,
    /** Is anything being played at all? */
    get on() { return Boolean(ctx) && (volume.sound > 0 || volume.music > 0); },
    /** `bus`: 'sound' or 'music'; 0 is silence. */
    setVolume(bus, value) {
      volume[bus] = value;
      if (ctx) { buses[bus].gain.value = value; sends[bus].gain.value = value; }
      wake();
    },
    /** Runs `make` once sound has started (at once, if it has). */
    whenReady(make) { if (ctx) make(); else ready.push(make); },
    /**
     * A tone: { type, from, to, time, gain, attack, wet, delay, bus }. It glides from `from` to `to` hertz and
     * dies away over `time` seconds.
     */
    tone(o) {
      if (!heard(o)) return;
      const t0 = ctx.currentTime + (o.delay ?? 0);
      const osc = ctx.createOscillator();
      osc.type = o.type ?? 'sine';
      osc.frequency.setValueAtTime(o.from, t0);
      if (o.to && o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.time);
      play(osc, o, t0);
    },
    /** A burst of noise through a filter: { filter, from, to, q, time, gain, attack, wet, delay, bus }. */
    noise(o) {
      if (!heard(o)) return;
      const t0 = ctx.currentTime + (o.delay ?? 0);
      const source = ctx.createBufferSource();
      source.buffer = hiss;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = o.filter ?? 'lowpass';
      filter.Q.value = o.q ?? 1;
      filter.frequency.setValueAtTime(o.from, t0);
      if (o.to && o.to !== o.from) filter.frequency.exponentialRampToValueAtTime(o.to, t0 + o.time);
      source.connect(filter);
      play({ connect: (to) => filter.connect(to), start: (t) => source.start(t, Math.random()), stop: (t) => source.stop(t) }, o, t0);
    },
    /**
     * Noise that goes on and on (wind, water, a fire): { filter, freq, q, wet, bus }. Call only from whenReady.
     * Gives back its loudness, to be set while it plays: bed.gain.value = ...
     */
    bed(o) {
      const source = ctx.createBufferSource();
      source.buffer = hiss;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = o.filter ?? 'lowpass';
      filter.frequency.value = o.freq;
      filter.Q.value = o.q ?? 1;
      const level = ctx.createGain();
      level.gain.value = 0;
      source.connect(filter);
      filter.connect(level);
      level.connect(buses[o.bus ?? 'sound']);
      if (o.wet) {
        const send = ctx.createGain();
        send.gain.value = o.wet;
        level.connect(send);
        send.connect(sends[o.bus ?? 'sound']);
      }
      source.start(0, Math.random());
      return level;
    },
    /** Everything fades to `to` (0 to 1) over `seconds`: for leaving the page. */
    fade(to, seconds) {
      if (!ctx) return;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.linearRampToValueAtTime(to, ctx.currentTime + seconds);
    },
  };
  return audio;
}
