// All sounds are made on the fly with the Web Audio API — no sound files needed.

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  let eng = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, freq, q, type, slideTo, delay) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(freq || 1000, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  function loopNoise(freq, type, q) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master);
    s.start();
    return { s, f, g };
  }

  // ---- engine: two detuned oscillators through a filter, plus hiss / rumble / screech layers
  function engineStart() {
    if (!ctx || eng) return;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
    o1.frequency.value = 60; o2.frequency.value = 30;
    o1.start(); o2.start();
    eng = {
      o1, o2, f, g,
      hiss: loopNoise(2600, 'bandpass', 0.8),
      rumble: loopNoise(180, 'lowpass', 1),
      screech: loopNoise(2900, 'bandpass', 6),
    };
  }

  function engineUpdate(rpm, load, nitro, offroad, screech, on) {
    if (!ctx || !eng) return;
    const t = ctx.currentTime;
    const freq = 48 + rpm * 120;
    eng.o1.frequency.setTargetAtTime(freq, t, 0.04);
    eng.o2.frequency.setTargetAtTime(freq * 0.505, t, 0.04);
    eng.f.frequency.setTargetAtTime(350 + rpm * 1500 + load * 500 + (nitro ? 900 : 0), t, 0.05);
    eng.g.gain.setTargetAtTime(on ? 0.05 + load * 0.035 : 0, t, 0.05);
    eng.hiss.g.gain.setTargetAtTime(on && nitro ? 0.09 : 0, t, 0.05);
    eng.rumble.g.gain.setTargetAtTime(on && offroad ? 0.22 : 0, t, 0.05);
    eng.screech.g.gain.setTargetAtTime(on ? Math.min(0.06, screech * 0.06) : 0, t, 0.05);
  }

  const sfx = {
    click: () => tone(720, 0.05, 'square', 0.05),
    coin: () => { tone(988, 0.07, 'square', 0.09); tone(1480, 0.16, 'square', 0.09, null, 0.06); },
    nitro: () => { tone(500, 0.18, 'triangle', 0.12, 1200); tone(1200, 0.12, 'square', 0.06, null, 0.12); },
    heart: () => [660, 880, 1100].forEach((f, i) => tone(f, 0.14, 'triangle', 0.14, null, i * 0.07)),
    crash: () => { noise(0.6, 0.55, 1400, 0.7, 'lowpass', 120); tone(110, 0.45, 'sawtooth', 0.18, 40); },
    bump: () => { noise(0.16, 0.3, 700, 1); tone(140, 0.12, 'square', 0.08, 80); },
    knock: () => { noise(0.12, 0.25, 1800, 2, 'bandpass'); tone(320, 0.1, 'triangle', 0.08, 180); },
    whoosh: () => noise(0.4, 0.22, 600, 1.5, 'bandpass', 3200),
    boost: () => { noise(0.8, 0.28, 300, 1, 'bandpass', 2600); tone(200, 0.6, 'sawtooth', 0.06, 700); },
    beep: (hi) => tone(hi ? 880 : 440, hi ? 0.55 : 0.22, 'square', 0.13),
    lap: () => { tone(660, 0.12, 'square', 0.1); tone(990, 0.22, 'square', 0.1, null, 0.12); },
    finish: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i === 4 ? 0.5 : 0.18, 'square', 0.1, null, i * 0.11)),
    lose: () => { tone(392, 0.25, 'triangle', 0.14); tone(311, 0.25, 'triangle', 0.14, null, 0.22); tone(233, 0.6, 'triangle', 0.14, null, 0.44); },
    jump: () => tone(260, 0.35, 'square', 0.08, 820),
    land: () => noise(0.22, 0.32, 500, 1),
    oil: () => tone(500, 0.7, 'sine', 0.12, 140),
    nearMiss: () => { noise(0.25, 0.16, 900, 2, 'bandpass', 3200); tone(1250, 0.07, 'triangle', 0.07); },
    pass: () => tone(880, 0.1, 'triangle', 0.08, 1320),
    unlock: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.13, null, i * 0.1)),
    star: (i) => tone(880 + i * 220, 0.2, 'square', 0.1),
    level: () => [440, 554, 659, 880].forEach((f, i) => tone(f, 0.15, 'square', 0.09, null, i * 0.08)),
  };

  return {
    init, setMuted, engineStart, engineUpdate, sfx,
    get muted() { return muted; },
    get ready() { return !!ctx; },
  };
})();
