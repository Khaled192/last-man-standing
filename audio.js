// River Fisher — synthesised audio engine. No asset files; everything
// generated live with Web Audio. Exposed as window.fishAudio.

(function () {
  let ctx = null;
  let master, ambientGain, sfxGain;
  let initialized = false;
  let muted = false;
  let masterLevel = 0.75;
  let layers = {};
  let reelNode = null;

  // ─── Noise generation ──────────────────────────────────────────────
  function makeNoise(seconds, type) {
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, length, sr);
    const d = buf.getChannelData(0);
    if (type === "pink") {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 = -0.7616*b5 - w*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else if (type === "brown") {
      let last = 0;
      for (let i = 0; i < length; i++) {
        const w = (Math.random() * 2 - 1) * 0.04;
        last = Math.max(-1, Math.min(1, last + w));
        d[i] = last * 2.4;
      }
    } else {
      for (let i = 0; i < length; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function loopedSource(buf, dest, baseGain, filt) {
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.value = baseGain;
    const f = ctx.createBiquadFilter();
    f.type = filt.type; f.frequency.value = filt.freq; f.Q.value = filt.Q || 0.7;
    src.connect(f).connect(g).connect(dest);
    src.start();
    return { src, g, f };
  }

  function ramp(p, v, t = 0.6) {
    if (!ctx) return;
    const now = ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(v, now + t);
  }

  // ─── Init (lazy, on first user gesture) ────────────────────────────
  function init() {
    if (initialized) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    initialized = true;

    master = ctx.createGain(); master.gain.value = masterLevel; master.connect(ctx.destination);
    ambientGain = ctx.createGain(); ambientGain.gain.value = 0.85; ambientGain.connect(master);
    sfxGain     = ctx.createGain(); sfxGain.gain.value = 1.0;    sfxGain.connect(master);

    const pink  = makeNoise(4, "pink");
    const white = makeNoise(4, "white");
    const brown = makeNoise(4, "brown");

    // River flow — brown noise, low-passed, with slow LFO swell
    const river = loopedSource(brown, ambientGain, 0, { type: "lowpass", freq: 420, Q: 0.5 });
    const riverSwell = ctx.createOscillator(); riverSwell.frequency.value = 0.07;
    const riverSwellG = ctx.createGain(); riverSwellG.gain.value = 0.05;
    riverSwell.connect(riverSwellG).connect(river.g.gain); riverSwell.start();

    // River shimmer — high bandpass over pink, very faint
    const shimmer = loopedSource(pink, ambientGain, 0, { type: "bandpass", freq: 2800, Q: 0.8 });

    // Wind — pink noise lowpassed, swelling
    const wind = loopedSource(pink, ambientGain, 0, { type: "lowpass", freq: 600, Q: 0.9 });
    const windLFO = ctx.createOscillator(); windLFO.frequency.value = 0.15;
    const windLFOG = ctx.createGain(); windLFOG.gain.value = 0.12;
    windLFO.connect(windLFOG).connect(wind.g.gain); windLFO.start();

    // Rain — white noise high-passed
    const rain = loopedSource(white, ambientGain, 0, { type: "highpass", freq: 1800, Q: 0.7 });

    // Heavy rain low layer — wet patter, white lowpassed
    const rainLow = loopedSource(white, ambientGain, 0, { type: "bandpass", freq: 900, Q: 0.5 });

    // Crickets — fast-modulated bandpass
    const crickets = loopedSource(white, ambientGain, 0, { type: "bandpass", freq: 5400, Q: 14 });
    const cLFO = ctx.createOscillator(); cLFO.frequency.value = 11; cLFO.type = "sawtooth";
    const cLFOG = ctx.createGain(); cLFOG.gain.value = 0.4;
    cLFO.connect(cLFOG).connect(crickets.g.gain); cLFO.start();

    // Lantern flame — soft crackle
    const flame = loopedSource(pink, ambientGain, 0, { type: "lowpass", freq: 260, Q: 0.9 });

    layers = { river, shimmer, wind, rain, rainLow, crickets, flame };
  }

  function resume() {
    if (initialized && ctx.state === "suspended") ctx.resume();
  }

  // ─── Ambient environment ───────────────────────────────────────────
  function setEnvironment(env) {
    if (!initialized) return;
    const { weather, timeOfDay, rain, lantern } = env;
    // River — always present and prominent (sound of the water)
    ramp(layers.river.g.gain,    weather === "storm" ? 0.85 : weather === "drizzle" ? 0.62 : 0.50, 1.2);
    ramp(layers.shimmer.g.gain,  0.08, 1.5);
    // Wind
    const windLvl = weather === "storm" ? 0.62 : weather === "drizzle" ? 0.26 : 0.10;
    ramp(layers.wind.g.gain, windLvl, 1.5);
    // Rain
    const rainHi = !rain ? 0 : (weather === "storm" ? 0.55 : weather === "drizzle" ? 0.26 : 0);
    const rainLo = !rain ? 0 : (weather === "storm" ? 0.40 : weather === "drizzle" ? 0.14 : 0);
    ramp(layers.rain.g.gain,    rainHi, 1.2);
    ramp(layers.rainLow.g.gain, rainLo, 1.2);
    // Crickets — night only & calm weather
    ramp(layers.crickets.g.gain, (timeOfDay === "night" && weather === "clear") ? 0.08 : 0, 1.6);
    // Lantern flame
    ramp(layers.flame.g.gain, lantern ? 0.06 : 0, 1.0);
  }

  // ─── One-shot SFX ──────────────────────────────────────────────────
  function osc({ type = "sine", freq, freqEnd, dur, peak, attack = 0.005, dest = sfxGain, delay = 0 }) {
    if (!initialized) return;
    const o = ctx.createOscillator(); o.type = type;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(dest);
    const t0 = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise({ dur, peak, filt, freqStart, freqEnd, dest = sfxGain, delay = 0, attack = 0.01 }) {
    if (!initialized) return;
    const src = ctx.createBufferSource(); src.buffer = makeNoise(Math.max(dur, 0.1), "white");
    const f = ctx.createBiquadFilter(); f.type = filt.type; f.Q.value = filt.Q || 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(dest);
    const t0 = ctx.currentTime + delay;
    f.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  function playClick() {
    osc({ type: "square", freq: 920, freqEnd: 540, dur: 0.08, peak: 0.09 });
  }

  function playCast() {
    // Rod whoosh — bandpassed noise sweeping up
    noise({ dur: 0.35, peak: 0.32, filt: { type: "bandpass", Q: 3 },
            freqStart: 380, freqEnd: 2600 });
    // Reel-out tick
    osc({ type: "sawtooth", freq: 1400, dur: 0.05, peak: 0.06, delay: 0.05 });
  }

  function playSplash(intensity = 1) {
    // Splash — wide noise sweep
    noise({ dur: 0.55, peak: 0.42 * intensity, filt: { type: "lowpass", Q: 0.7 },
            freqStart: 2600, freqEnd: 380 });
    // Sub thunk
    osc({ type: "sine", freq: 130, freqEnd: 50, dur: 0.22, peak: 0.32 * intensity });
    // Bubbles after
    osc({ type: "sine", freq: 800, freqEnd: 1400, dur: 0.18, peak: 0.05, delay: 0.15 });
    osc({ type: "sine", freq: 600, freqEnd: 1100, dur: 0.16, peak: 0.04, delay: 0.22 });
  }

  function playBite() {
    osc({ type: "triangle", freq: 200, freqEnd: 80, dur: 0.28, peak: 0.2 });
    osc({ type: "sine",     freq: 380, freqEnd: 180, dur: 0.18, peak: 0.12, delay: 0.02 });
  }

  function startReel() {
    if (!initialized) return;
    stopReel();
    const src = ctx.createBufferSource(); src.buffer = makeNoise(2, "white"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3400; f.Q.value = 5;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(sfxGain);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 18; lfo.type = "square";
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.15;
    lfo.connect(lfoG).connect(g.gain);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.18, t + 0.08);
    src.start(t); lfo.start(t);
    reelNode = { src, g, lfo };
  }
  function stopReel() {
    if (!reelNode || !initialized) return;
    const t = ctx.currentTime;
    const { src, g, lfo } = reelNode;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.stop(t + 0.22); lfo.stop(t + 0.22);
    reelNode = null;
  }

  function playCatch() {
    // Wet breach
    playSplash(0.9);
    // Flop slap
    setTimeout(() => {
      osc({ type: "sine", freq: 240, freqEnd: 90, dur: 0.16, peak: 0.26 });
      osc({ type: "triangle", freq: 420, freqEnd: 180, dur: 0.1, peak: 0.12, delay: 0.05 });
    }, 90);
  }

  function playEliminate() {
    // 3-note descending tone with a subtle sub thud
    const t = ctx.currentTime;
    [560, 410, 260].forEach((f, i) => {
      osc({ type: "triangle", freq: f, freqEnd: f * 0.95, dur: 0.18,
            peak: 0.18, delay: i * 0.085 });
    });
    osc({ type: "sine", freq: 90, freqEnd: 40, dur: 0.4, peak: 0.18, delay: 0.18 });
  }

  function playWin() {
    // C major arpeggio + brass pad
    const notes = [261.63, 329.63, 392, 523.25, 659.25, 784];
    notes.forEach((f, i) => {
      osc({ type: "sawtooth", freq: f, dur: 0.55, peak: 0.16, delay: i * 0.11 });
    });
    // Sustained chord (root, third, fifth, octave) with lowpass for warmth
    [261.63, 329.63, 392, 523.25].forEach((f) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 1500;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(filt).connect(g).connect(sfxGain);
      const t = ctx.currentTime + 0.5;
      g.gain.linearRampToValueAtTime(0.09, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.start(t); o.stop(t + 3.3);
    });
    // Crowd-ish noise swell
    noise({ dur: 2.0, peak: 0.08, filt: { type: "bandpass", Q: 0.6 },
            freqStart: 1200, freqEnd: 1200, attack: 0.6, delay: 0.2 });
  }

  function playThunder() {
    if (!initialized) return;
    // Initial crack
    noise({ dur: 0.32, peak: 0.4, filt: { type: "bandpass", Q: 2 },
            freqStart: 2400, freqEnd: 800 });
    // Long rumble
    const src = ctx.createBufferSource(); src.buffer = makeNoise(3.2, "brown");
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(sfxGain);
    const t = ctx.currentTime + 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.15);
    g.gain.linearRampToValueAtTime(0.35, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(110, t + 2.5);
    src.start(t); src.stop(t + 3.3);
  }

  // ─── Volume / mute ─────────────────────────────────────────────────
  function setVolume(v) {
    masterLevel = Math.max(0, Math.min(1, v));
    if (!initialized || muted) return;
    ramp(master.gain, masterLevel, 0.2);
  }

  function setMuted(m) {
    muted = m;
    if (!initialized) return;
    ramp(master.gain, m ? 0 : masterLevel, 0.2);
  }

  window.fishAudio = {
    init, resume, setEnvironment, setMuted, setVolume,
    playClick, playCast, playSplash, playBite,
    startReel, stopReel, playCatch, playEliminate,
    playWin, playThunder,
    get initialized() { return initialized; },
  };
})();
