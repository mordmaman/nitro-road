// The road is a long loop of short "segments". Each one can bend (curve) and go up or down (hills).
// This file builds the four tracks and decorates them with scenery.

const SEG_LEN = 200;      // length of one road segment
const RUMBLE_LEN = 3;     // segments per red/white stripe
const ROAD_W = 2000;      // half the road width (in world units)
const LANES = 3;
const LANE_X = [-2 / 3, 0, 2 / 3];   // lane centres (-1 = left edge, 1 = right edge)

const LEN = { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 };
const HILL = { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 };
const CURVE = { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 };

const THEMES = {
  valley: {
    name: 'Green Valley', sky: ['#2f86e6', '#bfe3ff'], fog: '#cfe8fb', ground: '#4aa343', dust: '#7a6a3a',
    light: { road: '#6c6c70', grass: '#55b24c', rumble: '#f6f6f6', lane: '#f6f6f6' },
    dark: { road: '#646468', grass: '#4ba644', rumble: '#d4202a' },
    swatch: 'linear-gradient(#56a8f0 0 45%, #5eb352 45% 70%, #6c6c70 70%)',
  },
  desert: {
    name: 'Desert Canyon', sky: ['#38246a', '#ff9f68'], fog: '#ffb98a', ground: '#d4904a', dust: '#e2c08a',
    light: { road: '#78695f', grass: '#e8b26c', rumble: '#f6f6f6', lane: '#f5e6c6' },
    dark: { road: '#706258', grass: '#dfa663', rumble: '#c8402a' },
    swatch: 'linear-gradient(#5b2f7a, #ff9f68 45%, #e8a85e 45% 70%, #78695f 70%)',
  },
  snow: {
    name: 'Snowy Peaks', sky: ['#7aa4da', '#e6eef8'], fog: '#e9f0f8', ground: '#e9f0f8', dust: '#ffffff', slide: 1.15,
    light: { road: '#7e8794', grass: '#f2f6fb', rumble: '#f6f6f6', lane: '#ffffff' },
    dark: { road: '#78818e', grass: '#e4ebf3', rumble: '#d23040' },
    swatch: 'linear-gradient(#7aa4da, #e6eef8 45%, #f4f8fd 45% 70%, #7e8794 70%)',
  },
  city: {
    name: 'Neon City', sky: ['#04051a', '#2c1d5c'], fog: '#1d1742', ground: '#12142c', dust: '#8a8aa0', night: true,
    light: { road: '#3c3c4e', grass: '#272b46', rumble: '#ff2d95', lane: '#ffd23f' },
    dark: { road: '#363648', grass: '#22263f', rumble: '#2de2ff' },
    swatch: 'linear-gradient(#04051a, #2c1d5c 45%, #15173a 45% 70%, #3c3c4e 70%)',
  },
};

class TrackBuilder {
  constructor() { this.segs = []; }
  lastY() { return this.segs.length ? this.segs[this.segs.length - 1].p2.world.y : 0; }
  add(curve, y) {
    const n = this.segs.length;
    this.segs.push({
      index: n, curve,
      p1: { world: { x: 0, y: this.lastY(), z: n * SEG_LEN }, camera: {}, screen: {} },
      p2: { world: { x: 0, y, z: (n + 1) * SEG_LEN }, camera: {}, screen: {} },
      alt: Math.floor(n / RUMBLE_LEN) % 2 === 1,
      sprites: [], decals: [], fog: 1, clip: 0,
    });
  }
  road(enter, hold, leave, curve, y) {
    const startY = this.lastY(), endY = startY + (y || 0) * SEG_LEN, total = enter + hold + leave;
    let i = 0;
    for (let n = 0; n < enter; n++) this.add(U.easeIn(0, curve, n / enter), U.easeInOut(startY, endY, ++i / total));
    for (let n = 0; n < hold; n++) this.add(curve, U.easeInOut(startY, endY, ++i / total));
    for (let n = 0; n < leave; n++) this.add(U.easeInOut(curve, 0, n / leave), U.easeInOut(startY, endY, ++i / total));
    return this;
  }
  straight(n = LEN.MEDIUM) { return this.road(n, n, n, 0, 0); }
  hill(n = LEN.MEDIUM, h = HILL.MEDIUM) { return this.road(n, n, n, 0, h); }
  curve(n = LEN.MEDIUM, c = CURVE.MEDIUM, h = HILL.NONE) { return this.road(n, n, n, c, h); }
  rolling(n = LEN.SHORT, h = HILL.LOW) {
    this.road(n, n, n, 0, h / 2); this.road(n, n, n, 0, -h); this.road(n, n, n, CURVE.EASY, h);
    this.road(n, n, n, 0, 0); this.road(n, n, n, -CURVE.EASY, h / 2); return this.road(n, n, n, 0, 0);
  }
  sCurves() {
    const M = LEN.MEDIUM;
    this.road(M, M, M, -CURVE.EASY, HILL.NONE); this.road(M, M, M, CURVE.MEDIUM, HILL.MEDIUM);
    this.road(M, M, M, CURVE.EASY, -HILL.LOW); this.road(M, M, M, -CURVE.EASY, HILL.MEDIUM);
    return this.road(M, M, M, -CURVE.MEDIUM, -HILL.MEDIUM);
  }
  bumps() {
    [5, -2, -5, 8, 5, -7, 5, -2].forEach((h) => this.road(10, 10, 10, 0, h));
    return this;
  }
  home(curve = 0) {
    // bring the road back down to the start height so the loop joins up smoothly
    this.road(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, curve, -this.lastY() / SEG_LEN);
    return this.straight(LEN.SHORT);
  }
}

const TRACK_DEFS = [
  {
    id: 'valley', theme: 'valley', seed: 11, blurb: 'Gentle hills — great to start',
    build: (b) => b.straight(LEN.SHORT).rolling().curve(LEN.MEDIUM, CURVE.EASY, HILL.LOW).curve(LEN.MEDIUM, CURVE.MEDIUM, HILL.NONE)
      .hill(LEN.MEDIUM, HILL.MEDIUM).curve(LEN.LONG, CURVE.MEDIUM, -HILL.LOW).straight(LEN.MEDIUM)
      .curve(LEN.MEDIUM, -CURVE.EASY, HILL.MEDIUM).curve(LEN.MEDIUM, CURVE.EASY, -HILL.LOW).curve(LEN.LONG, CURVE.MEDIUM, HILL.NONE).home(CURVE.EASY),
  },
  {
    id: 'desert', theme: 'desert', seed: 23, blurb: 'Big jumps over the dunes',
    build: (b) => b.straight(LEN.SHORT).hill(LEN.MEDIUM, HILL.HIGH).bumps().curve(LEN.MEDIUM, CURVE.MEDIUM, -HILL.HIGH)
      .hill(LEN.SHORT, HILL.MEDIUM).hill(LEN.SHORT, -HILL.MEDIUM).curve(LEN.LONG, CURVE.EASY, HILL.LOW).sCurves()
      .straight(LEN.MEDIUM).curve(LEN.MEDIUM, CURVE.HARD, HILL.NONE).bumps().curve(LEN.LONG, CURVE.MEDIUM, -HILL.LOW).home(CURVE.EASY),
  },
  {
    id: 'snow', theme: 'snow', seed: 37, blurb: 'Slippery bends — careful!',
    build: (b) => b.straight(LEN.SHORT).hill(LEN.LONG, HILL.HIGH).curve(LEN.MEDIUM, -CURVE.MEDIUM, -HILL.LOW)
      .curve(LEN.MEDIUM, CURVE.HARD, HILL.MEDIUM).bumps().curve(LEN.LONG, CURVE.EASY, -HILL.HIGH).rolling()
      .curve(LEN.MEDIUM, CURVE.HARD, HILL.NONE).curve(LEN.SHORT, -CURVE.MEDIUM, HILL.LOW).curve(LEN.MEDIUM, CURVE.MEDIUM, -HILL.MEDIUM).home(CURVE.MEDIUM),
  },
  {
    id: 'city', theme: 'city', seed: 53, blurb: 'Sharp turns at night',
    build: (b) => b.straight(LEN.MEDIUM).road(LEN.SHORT, LEN.SHORT, LEN.SHORT, CURVE.HARD, 0).straight(LEN.SHORT)
      .road(LEN.SHORT, LEN.SHORT, LEN.SHORT, -CURVE.HARD, HILL.LOW).curve(LEN.MEDIUM, CURVE.MEDIUM, HILL.LOW).straight(LEN.LONG)
      .road(LEN.SHORT, LEN.SHORT, LEN.SHORT, CURVE.HARD, -HILL.LOW).road(LEN.SHORT, LEN.MEDIUM, LEN.SHORT, CURVE.HARD, 0).sCurves()
      .straight(LEN.MEDIUM).road(LEN.SHORT, LEN.SHORT, LEN.SHORT, CURVE.HARD, 0).curve(LEN.MEDIUM, -CURVE.EASY, -HILL.LOW).home(CURVE.HARD),
  },
];

// ---- scenery for each theme: [sprite factory, weight, min offset, max offset]
const SCENERY = {
  valley: () => [
    [() => Art.tree('tree', '#5cc25a', '#3e9e42', '#2c7a33'), 5, 1.35, 3.2],
    [() => Art.tree('tree2', '#ffcf4a', '#f29c2b', '#c86a1c'), 1.5, 1.35, 3.2],
    [() => Art.pine('pine', false), 3, 1.3, 3],
    [() => Art.bush('bush', '#6ccf5a', '#3f9a3a'), 3, 1.15, 2.2],
    [() => Art.rock('rock', '#a7adb5', '#80868f', false), 1, 1.3, 2.6],
    [() => Art.house(), 0.5, 2.2, 3.2],
    [() => Art.sheep(), 1, 1.5, 2.8],
    [() => Art.flowers(), 2, 1.12, 2.2],
  ],
  desert: () => [
    [() => Art.cactus(), 5, 1.3, 3.2],
    [() => Art.barrelCactus(), 2, 1.15, 2.4],
    [() => Art.redRock(), 2, 1.4, 3.2],
    [() => Art.mesa(), 0.5, 3.2, 3.6],
    [() => Art.deadTree(), 1.5, 1.35, 3],
    [() => Art.tumbleweed(), 2, 1.12, 2.4],
    [() => Art.palm(), 0.6, 1.4, 3],
  ],
  snow: () => [
    [() => Art.pine('spine', true), 8, 1.3, 3.2],
    [() => Art.rock('srock', '#b0b8c4', '#8a93a0', true), 1.5, 1.3, 2.6],
    [() => Art.snowman(), 1, 1.3, 2.4],
    [() => Art.cabin(), 0.5, 2.3, 3.2],
  ],
  city: () => [
    [() => Art.palm(), 1, 1.3, 1.5],
  ],
};

const Tracks = {
  cache: {},
  get(i) {
    if (this.cache[i]) return this.cache[i];
    const def = TRACK_DEFS[i];
    const b = new TrackBuilder();
    def.build(b);
    const segs = b.segs;
    const t = { def, id: def.id, index: i, theme: THEMES[def.theme], themeId: def.theme, segs, length: segs.length * SEG_LEN, pickups: [], pads: [] };
    decorate(t);
    t.map = computeMap(segs);
    return (this.cache[i] = t);
  },
};

function placeSprite(seg, sprite, offset, extra) {
  seg.sprites.push(Object.assign({ sp: sprite, offset }, extra || {}));
}

function decorate(t) {
  const r = U.rng(t.def.seed);
  const segs = t.segs, N = segs.length;
  const themeId = t.themeId;

  // start / finish
  segs[0].decals.push({ kind: 'checker', x0: -1, x1: 1, row: 0 });
  segs[1].decals.push({ kind: 'checker', x0: -1, x1: 1, row: 1 });
  placeSprite(segs[2], Art.banner(), 0, { align: -0.5, noHit: true });

  // curve warning signs
  const signR = Art.chevronSign();
  const signL = Art.mirror(signR, 'signL');
  for (let n = 40; n < N; n++) {
    const c = segs[n].curve, pc = segs[n - 1].curve;
    if (Math.abs(c) >= 3.5 && Math.abs(pc) < 3.5) {
      const side = c > 0 ? -1 : 1;
      [36, 24, 12].forEach((k) => placeSprite(segs[n - k], c > 0 ? signR : signL, side * 1.2));
    }
  }

  // billboards
  let bi = 0;
  for (let n = 120; n < N - 60; n += 280 + Math.floor(r() * 120)) {
    const text = CONFIG.billboards[bi++ % CONFIG.billboards.length];
    const side = r() < 0.5 ? -1 : 1;
    const sp = themeId === 'city'
      ? Art.neonBoard(text, U.pick(r, ['#ff2d95', '#2de2ff', '#ffd23f']))
      : Art.billboard(text, U.pick(r, ['#ffd23f', '#1f7bff', '#e63946', '#2fd36b', '#ffffff']), '#14142e');
    placeSprite(segs[n], sp, side * 1.45);
  }

  // general scenery
  const list = SCENERY[themeId]();
  const total = list.reduce((s, e) => s + e[1], 0);
  const choose = () => { let v = r() * total; for (const e of list) { if ((v -= e[1]) <= 0) return e; } return list[0]; };
  const resolved = new Map();
  const spr = (e) => { if (!resolved.has(e)) resolved.set(e, e[0]()); return resolved.get(e); };

  if (themeId === 'city') {
    const lampL = Art.lamp(), lampR = Art.mirror(lampL, 'lampR');
    const blds = [0, 1, 2, 3, 4, 5].map((i) => Art.building(i));
    for (let n = 6; n < N; n += 16) { placeSprite(segs[n], lampL, -1.12); placeSprite(segs[n], lampR, 1.12); }
    for (const side of [-1, 1]) {
      for (let n = 8; n < N - 4; n += 5 + Math.floor(r() * 5)) placeSprite(segs[n], U.pick(r, blds), side * (1.55 + r() * 0.5));
      for (let n = 30; n < N - 4; n += 40 + Math.floor(r() * 60)) placeSprite(segs[n], spr(list[0]), side * 1.3);
    }
  } else {
    const spacing = themeId === 'snow' ? [2, 5] : [3, 7];
    for (const side of [-1, 1]) {
      let n = 8 + Math.floor(r() * 4);
      while (n < N - 4) {
        if (n > 5) {
          const e = choose();
          placeSprite(segs[n], spr(e), side * (e[2] + r() * (e[3] - e[2])));
          if (r() < 0.06) { // a little clump of trees
            const e2 = list[0];
            for (let k = 1; k < 5 && n + k < N; k++) placeSprite(segs[n + k], spr(e2), side * (e2[2] + r() * 0.8));
          }
        }
        n += spacing[0] + Math.floor(r() * (spacing[1] - spacing[0] + 1));
      }
    }
  }

  // nitro canisters (Race + Time Trial) — they come back every lap
  for (let n = 140; n < N - 40; n += 220 + Math.floor(r() * 90)) {
    const pk = { seg: n, x: U.pick(r, LANE_X), lap: -99 };
    t.pickups.push(pk);
    (segs[n].pickups = segs[n].pickups || []).push(pk);
  }
  // boost strips on straight bits
  for (let n = 60; n < N - 60; n++) {
    let ok = true;
    for (let k = 0; k < 40; k++) if (Math.abs(segs[n + k].curve) > 0.6) { ok = false; break; }
    if (!ok) continue;
    const lane = U.pick(r, LANE_X);
    addPad(segs, n + 6, lane, 8);
    t.pads.push({ seg: n + 6, len: 8, x: lane, w: 0.42 });
    n += 420;
  }
}

function addPad(segs, start, x, len) {
  const out = [];
  for (let k = 0; k < len; k++) {
    const seg = segs[(start + k) % segs.length];
    const d = { kind: 'pad', x0: x - 0.21, x1: x + 0.21, k };
    seg.decals.push(d);
    out.push([seg, d]);
  }
  return out;
}

// a little top-down outline of the track for the mini-map
function computeMap(segs) {
  let total = 0, abs = 0;
  for (const s of segs) { total += s.curve; abs += Math.abs(s.curve); }
  const k = Math.abs(total) > abs * 0.15 ? (Math.PI * 2 * Math.sign(total)) / total : (Math.PI * 2) / Math.max(abs, 1);
  let h = 0, x = 0, y = 0;
  const pts = [];
  for (const s of segs) { h += s.curve * k; x += Math.sin(h); y -= Math.cos(h); pts.push([x, y]); }
  const n = pts.length, ex = pts[n - 1][0], ey = pts[n - 1][1];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach((p, i) => {
    p[0] -= ex * (i / (n - 1)); p[1] -= ey * (i / (n - 1));
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  });
  const sc = 1 / Math.max(maxX - minX, maxY - minY);
  return pts.map((p) => [(p[0] - minX) * sc, (p[1] - minY) * sc, (maxX - minX) * sc, (maxY - minY) * sc]);
}
