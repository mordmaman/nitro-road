// Small maths helpers + saving progress in the browser.

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  easeIn: (a, b, t) => a + (b - a) * t * t,
  easeInOut: (a, b, t) => a + (b - a) * ((-Math.cos(t * Math.PI) / 2) + 0.5),
  mod: (n, m) => ((n % m) + m) % m,
  approach: (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target)),
  overlap(x1, w1, x2, w2, pct) {
    const h = (pct || 1) / 2;
    return !((x1 + w1 * h) < (x2 - w2 * h) || (x1 - w1 * h) > (x2 + w2 * h));
  },
  fog: (d, density) => 1 / Math.pow(Math.E, d * d * density),
  // seeded random numbers, so every track looks the same each time
  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  pick: (r, arr) => arr[Math.floor(r() * arr.length)],
  fmtTime(s) {
    if (s == null || !isFinite(s)) return '-:--.--';
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(2);
  },
  ordinal: (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'),
  rgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  // amt > 0 lightens towards white, amt < 0 darkens towards black
  shade(hex, amt) {
    const [r, g, b] = U.rgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const f = (c) => Math.round(c + (t - c) * p);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  },
  rgba(hex, a) {
    const [r, g, b] = U.rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  },
  hsl: (h, s, l) => `hsl(${h},${s}%,${l}%)`,
};

const Store = {
  key: 'nitroRoad.v1',
  data: null,
  load() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { d = {}; }
    d.records = d.records || {};
    d.ghosts = d.ghosts || {};
    d.paint = d.paint || 'red';
    d.body = d.body || 'sport';
    d.settings = d.settings || {};
    d.last = d.last || {};
    this.data = d;
    return d;
  },
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked */ }
  },
  totalStars() {
    let n = 0;
    for (const k in this.data.records) n += this.data.records[k].stars || 0;
    return n;
  },
};
