// Every picture in the game is drawn here with code, once, then reused.
// A "sprite" is { img, worldW (size in the world), hit (how much of it you can crash into), hitAt }.

const FONT = "'Russo One', Impact, 'Arial Black', sans-serif";

const Art = (() => {
  const cache = {};
  const S = 2; // draw sprites at 2x so they stay sharp up close

  function mk(w, h, s) {
    s = s || S;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
    const x = c.getContext('2d');
    x.scale(s, s);
    return [c, x];
  }
  function rr(x, X, Y, W, H, r) {
    r = Math.max(0, Math.min(r, W / 2, H / 2));
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + W, Y, X + W, Y + H, r);
    x.arcTo(X + W, Y + H, X, Y + H, r);
    x.arcTo(X, Y + H, X, Y, r);
    x.arcTo(X, Y, X + W, Y, r);
    x.closePath();
  }
  function poly(x, pts) {
    x.beginPath();
    x.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.closePath();
  }
  function circle(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); }
  function lin(x, x0, y0, x1, y1, stops) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  function sp(key, w, h, worldW, hit, draw, opt) {
    if (cache[key]) return cache[key];
    opt = opt || {};
    const [c, x] = mk(w, h, opt.s);
    draw(x, w, h);
    return (cache[key] = { img: c, worldW, hit: hit || 0, hitAt: opt.hitAt != null ? opt.hitAt : 0.5, aspect: h / w, key, align: opt.align });
  }
  function mirror(src, key) {
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = src.img.width; c.height = src.img.height;
    const x = c.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1);
    x.drawImage(src.img, 0, 0);
    return (cache[key] = Object.assign({}, src, { img: c, hitAt: 1 - src.hitAt, key }));
  }
  function hslHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
    return '#' + f(0) + f(8) + f(4);
  }
  function lum(hex) { const [r, g, b] = U.rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  // ------------------------------------------------------------------ cars (seen from behind)
  const CAR_DIMS = { sport: [200, 120, 560], muscle: [200, 124, 580], rocket: [200, 112, 580], van: [200, 160, 600], truck: [220, 200, 760] };

  function car(color, body, brake) {
    body = body || 'sport';
    const key = `car|${color}|${body}|${brake ? 1 : 0}`;
    if (cache[key]) return cache[key];
    const [W, H, worldW] = CAR_DIMS[body];
    return sp(key, W, H, worldW, 1, (x) => drawCar(x, color, body, brake));
  }

  function drawCar(x, color, body, brake) {
    const light = U.shade(color, 0.38), mid = color, dark = U.shade(color, -0.32), darker = U.shade(color, -0.58);
    const tl = brake ? '#ff2a2a' : '#9c141b';
    const tlHi = brake ? '#ffd6d6' : '#d9454c';
    const glass = (y0, y1) => lin(x, 0, y0, 0, y1, ['#6f93b8', '#2a3d52', '#121a24']);
    const wheel = (X, Y, W, H, r) => {
      x.fillStyle = '#111'; rr(x, X, Y, W, H, r || 6); x.fill();
      x.fillStyle = '#2b2b2b';
      for (let i = Y + 5; i < Y + H - 3; i += 6) x.fillRect(X + 3, i, W - 6, 2);
    };
    const tail = (X, Y, W, H) => {
      x.save();
      if (brake) { x.shadowColor = '#ff2020'; x.shadowBlur = 16; }
      x.fillStyle = tl; rr(x, X, Y, W, H, 3); x.fill();
      x.restore();
      x.fillStyle = tlHi; rr(x, X + 3, Y + 2, W - 6, Math.max(2, H * 0.32), 2); x.fill();
    };
    const plate = (cx, y) => {
      x.fillStyle = '#f5f5f5'; rr(x, cx - 20, y, 40, 12, 2); x.fill();
      x.fillStyle = '#333'; x.font = `9px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('NITRO', cx, y + 6.5);
    };
    const pipe = (cx, cy, r) => {
      x.fillStyle = '#8a8f96'; circle(x, cx, cy, r); x.fill();
      x.fillStyle = '#121212'; circle(x, cx, cy, r * 0.6); x.fill();
    };

    if (body === 'sport') {
      wheel(12, 80, 36, 38); wheel(152, 80, 36, 38);
      x.fillStyle = lin(x, 0, 46, 0, 104, [light, mid, mid, dark]); rr(x, 4, 48, 192, 56, 18); x.fill();
      x.fillStyle = lin(x, 0, 14, 0, 56, [light, mid]);
      x.beginPath(); x.moveTo(34, 56); x.lineTo(54, 22); x.quadraticCurveTo(100, 11, 146, 22); x.lineTo(166, 56); x.closePath(); x.fill();
      x.fillStyle = glass(24, 50);
      x.beginPath(); x.moveTo(52, 50); x.lineTo(64, 28); x.quadraticCurveTo(100, 20, 136, 28); x.lineTo(148, 50); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.22)'; poly(x, [70, 49, 84, 27, 97, 25, 83, 49]); x.fill();
      x.fillStyle = darker; rr(x, 6, 35, 188, 9, 4); x.fill(); rr(x, 40, 42, 7, 10, 2); x.fill(); rr(x, 153, 42, 7, 10, 2); x.fill();
      x.fillStyle = darker; rr(x, 60, 62, 80, 9, 3); x.fill();
      tail(14, 60, 46, 13); tail(140, 60, 46, 13);
      x.fillStyle = '#1d1d24'; rr(x, 8, 86, 184, 14, 6); x.fill();
      plate(100, 74);
      pipe(66, 97, 5); pipe(134, 97, 5);
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(22, 52); x.lineTo(178, 52); x.stroke();
    } else if (body === 'muscle') {
      wheel(10, 82, 40, 40); wheel(150, 82, 40, 40);
      x.fillStyle = lin(x, 0, 44, 0, 108, [light, mid, dark]); rr(x, 2, 46, 196, 62, 10); x.fill();
      x.fillStyle = lin(x, 0, 10, 0, 50, [light, mid]); poly(x, [42, 50, 60, 12, 140, 12, 158, 50]); x.fill();
      const stripe = lum(color) > 0.72 ? '#262630' : 'rgba(255,255,255,0.92)';
      x.fillStyle = stripe; x.fillRect(84, 12, 10, 92); x.fillRect(106, 12, 10, 92);
      x.fillStyle = glass(18, 44); poly(x, [56, 45, 69, 18, 131, 18, 144, 45]); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.2)'; poly(x, [72, 44, 82, 19, 92, 19, 82, 44]); x.fill();
      x.fillStyle = darker; rr(x, 4, 44, 192, 7, 3); x.fill();
      x.fillStyle = darker; rr(x, 8, 56, 184, 16, 4); x.fill();
      tail(12, 58, 66, 12); tail(122, 58, 66, 12);
      x.fillStyle = lin(x, 0, 90, 0, 102, ['#eef1f5', '#9aa1ab']); rr(x, 4, 90, 192, 12, 5); x.fill();
      plate(100, 76);
      pipe(36, 106, 6); pipe(164, 106, 6);
    } else if (body === 'rocket') {
      x.strokeStyle = '#222'; x.lineWidth = 4;
      x.beginPath(); x.moveTo(44, 74); x.lineTo(70, 78); x.moveTo(156, 74); x.lineTo(130, 78); x.stroke();
      wheel(0, 50, 46, 60, 10); wheel(154, 50, 46, 60, 10);
      x.fillStyle = lin(x, 64, 0, 136, 0, [dark, light, mid, dark]); poly(x, [62, 104, 66, 56, 88, 30, 112, 30, 134, 56, 138, 104]); x.fill();
      x.fillStyle = lin(x, 0, 12, 0, 44, [light, dark]); rr(x, 90, 12, 20, 34, 8); x.fill();
      x.fillStyle = darker; rr(x, 80, 18, 6, 18, 2); x.fill(); rr(x, 114, 18, 6, 18, 2); x.fill();
      x.fillStyle = lin(x, 0, 4, 0, 22, [mid, darker]); rr(x, 14, 4, 172, 17, 4); x.fill();
      x.fillStyle = light; rr(x, 10, 0, 11, 36, 3); x.fill(); rr(x, 179, 0, 11, 36, 3); x.fill();
      x.fillStyle = '#ffffff'; x.font = `16px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('1', 100, 64);
      tail(68, 70, 12, 8); tail(120, 70, 12, 8); tail(93, 84, 14, 9);
      x.fillStyle = '#1d1d24'; rr(x, 60, 96, 80, 13, 3); x.fill();
      x.fillStyle = '#3a3a44'; for (let i = 70; i < 136; i += 12) x.fillRect(i, 97, 3, 11);
    } else if (body === 'van') {
      wheel(18, 124, 34, 34); wheel(148, 124, 34, 34);
      x.fillStyle = lin(x, 0, 8, 0, 132, [light, mid, mid, dark]); rr(x, 6, 8, 188, 124, 12); x.fill();
      x.fillStyle = glass(22, 64); rr(x, 22, 22, 72, 42, 5); x.fill(); rr(x, 106, 22, 72, 42, 5); x.fill();
      x.strokeStyle = darker; x.lineWidth = 2; x.beginPath(); x.moveTo(100, 14); x.lineTo(100, 126); x.stroke();
      x.fillStyle = darker; x.fillRect(90, 76, 7, 3); x.fillRect(103, 76, 7, 3);
      tail(8, 72, 14, 40); tail(178, 72, 14, 40);
      x.fillStyle = '#2a2a30'; rr(x, 4, 126, 192, 14, 5); x.fill();
      plate(100, 108);
    } else if (body === 'truck') {
      x.fillStyle = '#111'; [10, 38, 156, 184].forEach((X) => { rr(x, X, 166, 26, 32, 5); x.fill(); });
      x.fillStyle = '#26262c'; rr(x, 6, 154, 208, 16, 3); x.fill();
      x.fillStyle = lin(x, 0, 4, 0, 158, [light, mid, dark]); rr(x, 4, 4, 212, 154, 6); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 2;
      for (let i = 30; i < 210; i += 26) { x.beginPath(); x.moveTo(i, 10); x.lineTo(i, 152); x.stroke(); }
      x.strokeStyle = darker; x.lineWidth = 3; x.beginPath(); x.moveTo(110, 8); x.lineTo(110, 154); x.stroke();
      x.fillStyle = '#8a8f96'; x.fillRect(70, 10, 5, 142); x.fillRect(145, 10, 5, 142);
      tail(10, 158, 30, 8); tail(180, 158, 30, 8);
      x.fillStyle = '#18181c'; x.fillRect(64, 170, 10, 26); x.fillRect(146, 170, 10, 26);
    }
  }

  // ------------------------------------------------------------------ road things
  function cone() {
    return sp('cone', 60, 80, 200, 0.8, (x) => {
      x.fillStyle = '#c84c0c'; rr(x, 4, 68, 52, 11, 3); x.fill();
      x.fillStyle = lin(x, 8, 0, 52, 0, ['#ffb066', '#ff6a00', '#c94d00']); poly(x, [26, 4, 34, 4, 50, 70, 10, 70]); x.fill();
      x.fillStyle = '#ffffff';
      const band = (y0, y1) => { const a = (y) => 26 - (y - 4) * 16 / 66, b = (y) => 34 + (y - 4) * 16 / 66; poly(x, [a(y0), y0, b(y0), y0, b(y1), y1, a(y1), y1]); x.fill(); };
      band(22, 31); band(44, 53);
    });
  }
  function barrel() {
    return sp('barrel', 64, 86, 250, 0.9, (x) => {
      x.fillStyle = lin(x, 6, 0, 58, 0, ['#a8380c', '#ff7a2e', '#ff8d45', '#a8380c']); rr(x, 6, 8, 52, 74, 9); x.fill();
      x.save(); rr(x, 6, 8, 52, 74, 9); x.clip();
      x.fillStyle = 'rgba(255,255,255,0.92)'; x.fillRect(6, 28, 52, 10); x.fillRect(6, 54, 52, 10);
      x.restore();
      x.fillStyle = '#ffa070'; x.beginPath(); x.ellipse(32, 10, 25, 5, 0, 0, Math.PI * 2); x.fill();
    });
  }
  function barrier(on) {
    return sp('barrier' + (on ? 1 : 0), 220, 100, 700, 0.95, (x) => {
      x.fillStyle = '#5a5e66'; rr(x, 22, 52, 10, 44, 2); x.fill(); rr(x, 188, 52, 10, 44, 2); x.fill();
      rr(x, 10, 90, 34, 9, 3); x.fill(); rr(x, 176, 90, 34, 9, 3); x.fill();
      x.save(); rr(x, 4, 22, 212, 34, 4); x.clip();
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 220, 100);
      x.fillStyle = '#e0202a';
      for (let i = -40; i < 240; i += 32) { poly(x, [i, 56, i + 16, 56, i + 50, 22, i + 34, 22]); x.fill(); }
      x.restore();
      x.strokeStyle = '#222'; x.lineWidth = 2; rr(x, 4, 22, 212, 34, 4); x.stroke();
      [36, 184].forEach((cx) => {
        x.fillStyle = '#333'; rr(x, cx - 9, 6, 18, 16, 3); x.fill();
        x.save(); if (on) { x.shadowColor = '#ffb000'; x.shadowBlur = 18; }
        x.fillStyle = on ? '#ffc21a' : '#7a5600'; circle(x, cx, 13, 6); x.fill(); x.restore();
      });
    });
  }
  function coin() {
    return sp('coin', 64, 64, 230, 0, (x) => {
      const g = x.createRadialGradient(24, 20, 2, 32, 32, 31);
      g.addColorStop(0, '#fff7b8'); g.addColorStop(0.45, '#ffcf1f'); g.addColorStop(1, '#b97d00');
      x.fillStyle = g; circle(x, 32, 32, 30); x.fill();
      x.strokeStyle = '#a86e00'; x.lineWidth = 3; circle(x, 32, 32, 22); x.stroke();
      star(x, 32, 33, 12, 5.5, '#fff3a6', '#b97d00');
    });
  }
  function star(x, cx, cy, R, r, fill, stroke) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    x.closePath(); x.fillStyle = fill; x.fill();
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1.5; x.stroke(); }
  }
  function nitroCan() {
    return sp('nitro', 70, 100, 240, 0, (x) => {
      const g = x.createRadialGradient(35, 52, 4, 35, 52, 36);
      g.addColorStop(0, 'rgba(90,220,255,0.55)'); g.addColorStop(1, 'rgba(90,220,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 70, 100);
      x.fillStyle = lin(x, 16, 0, 54, 0, ['#0a4fb8', '#5ccaff', '#1b74e0', '#0a4fb8']); rr(x, 16, 20, 38, 74, 10); x.fill();
      x.fillStyle = '#d0d7e0'; rr(x, 24, 8, 22, 14, 4); x.fill();
      x.fillStyle = '#9aa3ae'; rr(x, 30, 3, 10, 7, 2); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(16, 42, 38, 28);
      x.fillStyle = '#ffcc00'; x.strokeStyle = '#c07000'; x.lineWidth = 1.5;
      poly(x, [38, 44, 27, 58, 34, 58, 30, 69, 43, 53, 36, 53]); x.fill(); x.stroke();
    });
  }
  function heart() {
    return sp('heart', 70, 64, 230, 0, (x) => {
      x.fillStyle = lin(x, 0, 6, 0, 60, ['#ff7a8f', '#ff2747', '#c2102b']);
      x.beginPath(); x.moveTo(35, 60);
      x.bezierCurveTo(-8, 30, 8, -6, 35, 16);
      x.bezierCurveTo(62, -6, 78, 30, 35, 60); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.ellipse(21, 20, 7, 4, -0.6, 0, Math.PI * 2); x.fill();
    });
  }
  function ramp() {
    return sp('ramp', 220, 100, 820, 0.9, (x) => {
      x.fillStyle = '#7a5d10'; poly(x, [0, 100, 30, 8, 44, 8, 16, 100]); x.fill(); poly(x, [220, 100, 190, 8, 176, 8, 204, 100]); x.fill();
      x.save(); poly(x, [14, 100, 42, 8, 178, 8, 206, 100]); x.clip();
      x.fillStyle = lin(x, 0, 8, 0, 100, ['#fff1a0', '#ffcc1a', '#e5a800']); x.fillRect(0, 0, 220, 100);
      x.fillStyle = 'rgba(20,20,20,0.85)';
      for (let i = -60; i < 260; i += 40) { poly(x, [i, 100, i + 18, 100, i + 48, 8, i + 30, 8]); x.fill(); }
      x.fillStyle = '#fff6c0'; x.fillRect(0, 8, 220, 6);
      x.restore();
      x.fillStyle = '#ffffff';
      [[110, 30], [110, 62]].forEach(([cx, cy]) => { poly(x, [cx, cy - 10, cx + 16, cy + 6, cx + 8, cy + 6, cx, cy - 2, cx - 8, cy + 6, cx - 16, cy + 6]); x.fill(); });
    });
  }
  function chevronSign() {
    const s = sp('signR', 90, 120, 520, 0.5, (x) => {
      x.fillStyle = '#9aa3ad'; rr(x, 41, 60, 8, 60, 2); x.fill();
      x.fillStyle = '#ffd23f'; rr(x, 4, 4, 82, 62, 7); x.fill();
      x.strokeStyle = '#1a1a1a'; x.lineWidth = 4; rr(x, 4, 4, 82, 62, 7); x.stroke();
      x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(24, 17); x.lineTo(40, 35); x.lineTo(24, 53); x.moveTo(48, 17); x.lineTo(64, 35); x.lineTo(48, 53); x.stroke();
    });
    return s;
  }
  function billboard(text, bg, fg, idx) {
    return sp('bill|' + text + '|' + bg, 400, 260, 2400, 0.92, (x) => {
      x.fillStyle = '#5b5f66'; rr(x, 70, 160, 18, 100, 3); x.fill(); rr(x, 312, 160, 18, 100, 3); x.fill();
      x.fillStyle = '#41454b'; x.fillRect(88, 200, 224, 8);
      x.fillStyle = bg; rr(x, 8, 8, 384, 160, 12); x.fill();
      x.strokeStyle = fg; x.lineWidth = 6; rr(x, 20, 20, 360, 136, 8); x.stroke();
      fitText(x, text, 200, 90, 330, 84, fg, 'rgba(0,0,0,0.35)');
      x.fillStyle = '#2c2f35'; [110, 290].forEach((cx) => { rr(x, cx - 12, 0, 24, 10, 3); x.fill(); });
    }, { hitAt: 0.5 });
  }
  function neonBoard(text, c1) {
    return sp('neon|' + text + '|' + c1, 400, 260, 2400, 0.92, (x) => {
      x.fillStyle = '#3a3d48'; rr(x, 70, 160, 16, 100, 3); x.fill(); rr(x, 314, 160, 16, 100, 3); x.fill();
      x.fillStyle = '#120a26'; rr(x, 8, 8, 384, 160, 14); x.fill();
      x.save(); x.shadowColor = c1; x.shadowBlur = 18;
      x.strokeStyle = c1; x.lineWidth = 5; rr(x, 20, 20, 360, 136, 10); x.stroke();
      fitText(x, text, 200, 90, 320, 80, '#ffffff', null, c1);
      x.restore();
    });
  }
  function fitText(x, text, cx, cy, maxW, size, fill, stroke, glow) {
    x.font = `${size}px ${FONT}`;
    const w = x.measureText(text).width;
    if (w > maxW) { size = size * maxW / w; x.font = `${size}px ${FONT}`; }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (glow) { x.shadowColor = glow; x.shadowBlur = 22; }
    if (stroke) { x.lineWidth = size * 0.12; x.strokeStyle = stroke; x.lineJoin = 'round'; x.strokeText(text, cx, cy + size * 0.04); }
    x.fillStyle = fill; x.fillText(text, cx, cy + size * 0.04);
  }
  function banner() {
    return sp('banner', 1000, 300, 5000, 0, (x) => {
      [[10, 40], [950, 40]].forEach(([X, Y]) => {
        x.fillStyle = '#e8ebef'; rr(x, X, Y, 40, 260, 6); x.fill();
        x.fillStyle = '#e63946'; for (let y = Y + 30; y < 300; y += 50) x.fillRect(X, y, 40, 18);
      });
      x.fillStyle = '#14142e'; rr(x, 26, 26, 948, 118, 10); x.fill();
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 46; i++) {
          x.fillStyle = (i + row) % 2 ? '#111' : '#fff';
          x.fillRect(40 + i * 20, 34 + row * 10, 20, 10);
          x.fillStyle = (i + row + 1) % 2 ? '#111' : '#fff';
          x.fillRect(40 + i * 20, 116 + row * 10, 20, 10);
        }
      }
      fitText(x, 'START  •  FINISH', 500, 86, 860, 52, '#ffd23f', '#000');
    }, { align: -0.5 });
  }

  // ------------------------------------------------------------------ scenery
  function blob(x, pts, fill) { x.fillStyle = fill; pts.forEach(([cx, cy, r]) => { circle(x, cx, cy, r); x.fill(); }); }

  function tree(key, c1, c2, c3) {
    return sp(key, 220, 260, 1500, 0.16, (x) => {
      x.fillStyle = lin(x, 98, 0, 124, 0, ['#5a3a1c', '#8a5a2e', '#5a3a1c']); poly(x, [96, 258, 101, 140, 119, 140, 124, 258]); x.fill();
      blob(x, [[110, 106, 72], [58, 140, 50], [162, 140, 50], [110, 160, 52]], c3);
      blob(x, [[110, 96, 68], [62, 130, 46], [158, 130, 46], [84, 70, 42], [138, 70, 42]], c2);
      blob(x, [[96, 74, 34], [132, 66, 26], [64, 116, 26], [112, 108, 30]], c1);
    });
  }
  function pine(key, snow) {
    return sp(key, 160, 280, 1100, 0.14, (x) => {
      x.fillStyle = '#5a3a1f'; x.fillRect(72, 228, 16, 52);
      for (let i = 0; i < 4; i++) {
        const top = 8 + i * 48, base = 92 + i * 54, hw = 34 + i * 13;
        x.fillStyle = '#1f6b3a'; poly(x, [80, top, 80 + hw, base, 80 - hw, base]); x.fill();
        x.fillStyle = '#185530'; poly(x, [80, top, 80 + hw, base, 80, base]); x.fill();
        if (snow) {
          x.fillStyle = '#f4f8fc';
          poly(x, [80, top, 80 + hw * 0.55, top + (base - top) * 0.55, 80 + hw * 0.25, top + (base - top) * 0.5, 80, top + (base - top) * 0.6, 80 - hw * 0.3, top + (base - top) * 0.5, 80 - hw * 0.55, top + (base - top) * 0.55]); x.fill();
          x.fillStyle = 'rgba(244,248,252,0.9)'; x.fillRect(80 - hw, base - 4, hw * 2, 5);
        }
      }
    });
  }
  function bush(key, c1, c2) {
    return sp(key, 160, 90, 800, 0, (x) => {
      blob(x, [[40, 62, 30], [80, 50, 38], [122, 62, 30], [60, 70, 24], [104, 70, 24]], c2);
      blob(x, [[70, 44, 22], [102, 50, 18], [40, 58, 16]], c1);
    });
  }
  function rock(key, c1, c2, snow) {
    return sp(key, 160, 110, 850, 0.75, (x) => {
      x.fillStyle = c2; poly(x, [8, 108, 24, 46, 62, 14, 112, 20, 146, 54, 154, 108]); x.fill();
      x.fillStyle = c1; poly(x, [24, 46, 62, 14, 112, 20, 96, 56, 54, 70]); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.15)'; poly(x, [96, 56, 146, 54, 154, 108, 100, 108]); x.fill();
      if (snow) { x.fillStyle = '#f4f8fc'; poly(x, [30, 40, 62, 12, 112, 18, 128, 36, 100, 34, 70, 42, 46, 48]); x.fill(); }
    });
  }
  function house() {
    return sp('house', 300, 240, 3000, 0.9, (x) => {
      x.fillStyle = '#efe3c8'; x.fillRect(30, 100, 240, 136);
      x.fillStyle = '#d7c8a8'; x.fillRect(200, 100, 70, 136);
      x.fillStyle = '#8b3a2a'; x.fillRect(205, 30, 24, 60);
      x.fillStyle = '#c0392b'; poly(x, [12, 108, 150, 22, 288, 108]); x.fill();
      x.fillStyle = '#9e2d22'; poly(x, [150, 22, 288, 108, 220, 108]); x.fill();
      [[56, 132], [196, 132]].forEach(([X, Y]) => { x.fillStyle = '#fff'; x.fillRect(X - 3, Y - 3, 52, 44); x.fillStyle = '#7fb8e6'; x.fillRect(X, Y, 46, 38); x.fillStyle = '#fff'; x.fillRect(X + 21, Y, 4, 38); x.fillRect(X, Y + 17, 46, 4); });
      x.fillStyle = '#6b3d1f'; rr(x, 128, 160, 44, 76, 4); x.fill();
      x.fillStyle = '#ffd23f'; circle(x, 162, 200, 3); x.fill();
    });
  }
  function sheep() {
    return sp('sheep', 100, 76, 420, 0, (x) => {
      x.fillStyle = '#2a2a2a'; [24, 40, 62, 76].forEach((X) => x.fillRect(X, 52, 6, 22));
      blob(x, [[30, 40, 18], [50, 32, 20], [70, 40, 18], [50, 48, 18], [38, 50, 14], [64, 50, 14]], '#f4f4f0');
      x.fillStyle = '#2a2a2a'; x.beginPath(); x.ellipse(86, 36, 11, 14, 0.3, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; circle(x, 89, 32, 2.4); x.fill();
    });
  }
  function flowers() {
    return sp('flowers', 120, 50, 600, 0, (x) => {
      blob(x, [[30, 40, 18], [64, 36, 22], [96, 42, 16]], '#3f9a3a');
      const r = U.rng(7);
      for (let i = 0; i < 16; i++) {
        x.fillStyle = U.pick(r, ['#ff5fb3', '#ffd23f', '#ffffff', '#9b5de5', '#ff7b1c']);
        circle(x, 14 + r() * 92, 18 + r() * 24, 3 + r() * 2); x.fill();
      }
    });
  }
  function cactus() {
    return sp('cactus', 140, 240, 950, 0.22, (x) => {
      const g = lin(x, 0, 0, 140, 0, ['#1f7a33', '#3cb054', '#1f7a33']);
      x.fillStyle = g;
      rr(x, 52, 18, 36, 222, 18); x.fill();
      rr(x, 18, 112, 44, 18, 9); x.fill(); rr(x, 18, 58, 18, 70, 9); x.fill();
      rr(x, 80, 92, 44, 18, 9); x.fill(); rr(x, 106, 40, 18, 70, 9); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2;
      [62, 70, 78].forEach((X) => { x.beginPath(); x.moveTo(X, 26); x.lineTo(X, 238); x.stroke(); });
    });
  }
  function barrelCactus() {
    return sp('cactus2', 80, 90, 420, 0.6, (x) => {
      x.fillStyle = lin(x, 8, 0, 72, 0, ['#2a8a3e', '#4cc066', '#2a8a3e']); x.beginPath(); x.ellipse(40, 56, 32, 32, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ff5fb3'; blob(x, [[40, 24, 7], [30, 27, 5], [50, 27, 5]], '#ff5fb3');
    });
  }
  function redRock() {
    return sp('redrock', 200, 140, 1400, 0.8, (x) => {
      x.fillStyle = '#9a4423'; poly(x, [6, 140, 18, 50, 44, 20, 150, 16, 182, 44, 196, 140]); x.fill();
      x.fillStyle = '#c4643a'; poly(x, [18, 50, 44, 20, 150, 16, 182, 44, 120, 50]); x.fill();
      x.strokeStyle = 'rgba(80,25,10,0.35)'; x.lineWidth = 3;
      [70, 96, 120].forEach((Y) => { x.beginPath(); x.moveTo(12, Y); x.lineTo(190, Y + 4); x.stroke(); });
    });
  }
  function mesa() {
    return sp('mesa', 420, 260, 6500, 0.95, (x) => {
      x.fillStyle = '#a24f2c'; poly(x, [0, 260, 40, 80, 70, 40, 350, 36, 384, 84, 420, 260]); x.fill();
      x.fillStyle = '#c66b3d'; poly(x, [40, 80, 70, 40, 350, 36, 384, 84]); x.fill();
      x.strokeStyle = 'rgba(80,25,10,0.3)'; x.lineWidth = 5;
      [120, 160, 200].forEach((Y) => { x.beginPath(); x.moveTo(20, Y); x.lineTo(400, Y); x.stroke(); });
    });
  }
  function deadTree() {
    return sp('deadtree', 170, 220, 1100, 0.12, (x) => {
      x.strokeStyle = '#6e4b2a'; x.lineCap = 'round';
      const br = (x0, y0, a, len, w) => {
        if (len < 10) return;
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
        x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
        br(x1, y1, a - 0.5, len * 0.66, w * 0.65); br(x1, y1, a + 0.45, len * 0.6, w * 0.65);
      };
      br(85, 220, -Math.PI / 2, 80, 14);
    });
  }
  function tumbleweed() {
    return sp('tumble', 90, 80, 420, 0, (x) => {
      x.strokeStyle = '#a8854a'; x.lineWidth = 2.5;
      const r = U.rng(3);
      for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(45 + (r() - 0.5) * 30, 44 + (r() - 0.5) * 24, 10 + r() * 22, r() * 6, r() * 6 + 2); x.stroke(); }
    });
  }
  function palm() {
    return sp('palm', 220, 320, 1600, 0.1, (x) => {
      x.strokeStyle = '#8a6a3d'; x.lineWidth = 16; x.lineCap = 'round';
      x.beginPath(); x.moveTo(100, 318); x.quadraticCurveTo(96, 180, 124, 70); x.stroke();
      x.strokeStyle = '#6e5230'; x.lineWidth = 2;
      for (let t = 0.1; t < 1; t += 0.08) { const yy = 318 - t * 248, xx = 100 + Math.pow(t, 2) * 24; x.beginPath(); x.moveTo(xx - 8, yy); x.lineTo(xx + 8, yy - 3); x.stroke(); }
      const frond = (a, len, col) => {
        x.fillStyle = col; x.save(); x.translate(124, 70); x.rotate(a);
        x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(len * 0.5, -26, len, 12); x.quadraticCurveTo(len * 0.5, -6, 0, 6); x.fill(); x.restore();
      };
      [[-2.9, 96, '#237a35'], [-2.2, 100, '#2f9e44'], [-1.4, 80, '#2f9e44'], [-0.7, 100, '#237a35'], [0.1, 96, '#2f9e44'], [-3.5, 80, '#2f9e44'], [0.6, 80, '#237a35']].forEach(([a, l, c]) => frond(a, l, c));
      blob(x, [[118, 80, 7], [130, 80, 7], [124, 88, 7]], '#6b4a1f');
    }, { hitAt: 0.47 });
  }
  function building(i) {
    const r = U.rng(100 + i);
    const H = 380 + Math.floor(r() * 260);
    const cols = ['#2a2f52', '#3a2a52', '#1f3a52', '#3a2a3e', '#24405a', '#40304a'];
    const base = cols[i % cols.length];
    return sp('bld' + i, 300, H, 3600, 0.95, (x) => {
      x.fillStyle = lin(x, 0, 0, 300, 0, [U.shade(base, 0.12), base, U.shade(base, -0.35)]); x.fillRect(10, 20, 280, H - 20);
      x.fillStyle = U.shade(base, -0.4); x.fillRect(4, 14, 292, 12);
      if (r() < 0.6) { x.fillStyle = '#555a66'; x.fillRect(140, 0, 4, 20); x.fillStyle = '#ff3040'; circle(x, 142, 2, 3); x.fill(); }
      const ww = 22, wh = 26;
      for (let yy = 40; yy < H - 50; yy += 40) {
        for (let xx = 26; xx < 270; xx += 36) {
          const lit = r();
          x.fillStyle = lit < 0.45 ? (r() < 0.7 ? '#ffd36b' : '#9fe0ff') : '#161a2c';
          x.fillRect(xx, yy, ww, wh);
        }
      }
      x.fillStyle = '#0f1220'; x.fillRect(110, H - 46, 80, 46);
      x.fillStyle = r() < 0.5 ? '#ff2d95' : '#2de2ff'; x.fillRect(100, H - 54, 100, 6);
    });
  }
  function lamp() {
    return sp('lamp', 120, 320, 950, 0.12, (x) => {
      const g = x.createRadialGradient(104, 46, 2, 104, 46, 44);
      g.addColorStop(0, 'rgba(255,230,150,0.95)'); g.addColorStop(0.3, 'rgba(255,200,90,0.5)'); g.addColorStop(1, 'rgba(255,200,90,0)');
      x.fillStyle = g; x.fillRect(56, 0, 64, 100);
      x.fillStyle = '#4a4f5a'; rr(x, 12, 30, 9, 290, 3); x.fill();
      x.strokeStyle = '#4a4f5a'; x.lineWidth = 7; x.beginPath(); x.moveTo(16, 36); x.quadraticCurveTo(20, 22, 50, 26); x.lineTo(102, 34); x.stroke();
      x.fillStyle = '#2e323a'; rr(x, 88, 30, 30, 10, 4); x.fill();
      x.fillStyle = '#fff2c4'; rr(x, 92, 39, 22, 5, 2); x.fill();
    }, { hitAt: 0.14 });
  }
  function snowman() {
    return sp('snowman', 120, 170, 600, 0.55, (x) => {
      blob(x, [[60, 128, 40]], '#e6edf5'); blob(x, [[56, 124, 36]], '#ffffff');
      blob(x, [[60, 76, 28]], '#e6edf5'); blob(x, [[57, 73, 25]], '#ffffff');
      blob(x, [[60, 36, 20]], '#e6edf5'); blob(x, [[58, 34, 18]], '#ffffff');
      x.fillStyle = '#d23040'; rr(x, 38, 50, 44, 9, 4); x.fill(); x.fillRect(66, 54, 9, 24);
      x.fillStyle = '#222'; x.fillRect(40, 4, 40, 16); x.fillRect(32, 18, 56, 5);
      blob(x, [[52, 32, 2.6], [66, 32, 2.6], [60, 70, 3], [60, 84, 3], [60, 118, 3]], '#222');
      x.fillStyle = '#ff7b1c'; poly(x, [59, 37, 74, 41, 59, 42]); x.fill();
      x.strokeStyle = '#6e4b2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(34, 76); x.lineTo(6, 58); x.moveTo(86, 76); x.lineTo(114, 60); x.stroke();
    });
  }
  function cabin() {
    return sp('cabin', 300, 230, 2800, 0.9, (x) => {
      x.fillStyle = '#7a4a26'; x.fillRect(30, 100, 240, 128);
      x.strokeStyle = '#5a3418'; x.lineWidth = 3;
      for (let y = 112; y < 228; y += 14) { x.beginPath(); x.moveTo(30, y); x.lineTo(270, y); x.stroke(); }
      x.fillStyle = '#5a3a28'; x.fillRect(200, 28, 24, 60);
      x.fillStyle = '#f4f8fc'; x.fillRect(196, 22, 32, 10);
      x.fillStyle = '#4a2a18'; poly(x, [12, 110, 150, 30, 288, 110]); x.fill();
      x.fillStyle = '#f4f8fc'; poly(x, [8, 108, 150, 24, 292, 108, 270, 112, 150, 44, 30, 112]); x.fill();
      x.fillStyle = '#ffcf6b'; x.fillRect(60, 138, 50, 40); x.fillRect(190, 138, 50, 40);
      x.fillStyle = '#5a3418'; x.fillRect(83, 138, 4, 40); x.fillRect(213, 138, 4, 40);
      x.fillStyle = '#3d2412'; rr(x, 128, 150, 44, 78, 3); x.fill();
    });
  }

  // ------------------------------------------------------------------ backgrounds (wrap around sideways)
  const BW = 2048, BH = 512;
  function ridgeY(base, waves, X) {
    let y = base;
    for (const [f, a, p] of waves) y -= a * Math.sin((X / BW) * Math.PI * 2 * f + p);
    return y;
  }
  function fillRidge(x, base, waves, fill, cap) {
    x.beginPath(); x.moveTo(0, BH);
    for (let X = 0; X <= BW; X += 6) {
      let y = ridgeY(base, waves, X);
      if (cap != null) y = Math.max(y, cap);
      x.lineTo(X, y);
    }
    x.lineTo(BW, BH); x.closePath(); x.fillStyle = fill; x.fill();
  }
  function wrap(fn, X, w) { fn(X); if (X + w > BW) fn(X - BW); if (X < 0) fn(X + BW); }

  function cloudLayer(seed, col, shade, n, yMin, yMax) {
    const [c, x] = mk(BW, BH, 1);
    const r = U.rng(seed);
    for (let i = 0; i < n; i++) {
      const cx = r() * BW, cy = yMin + r() * (yMax - yMin), s = 30 + r() * 50;
      wrap((X) => {
        blob(x, [[X - s, cy + s * 0.25, s * 0.6], [X, cy, s * 0.85], [X + s, cy + s * 0.2, s * 0.65], [X + s * 0.45, cy - s * 0.3, s * 0.55]], shade);
        blob(x, [[X - s, cy + s * 0.15, s * 0.55], [X, cy - s * 0.1, s * 0.8], [X + s, cy + s * 0.1, s * 0.6], [X + s * 0.45, cy - s * 0.4, s * 0.5]], col);
      }, cx - s * 2, s * 4);
    }
    return c;
  }

  function background(id) {
    const key = 'bg|' + id;
    if (cache[key]) return cache[key];
    let sky = null, far, near;
    const r = U.rng(id.length * 97 + 11);
    if (id === 'valley') {
      sky = cloudLayer(5, 'rgba(255,255,255,0.95)', 'rgba(205,225,245,0.95)', 12, 70, 260);
      [far] = [mk(BW, BH, 1)];
      let x = far[1];
      const mw = [[2, 60, 0.5], [5, 45, 1.3], [11, 18, 0.2], [23, 6, 2]];
      fillRidge(x, 380, mw, '#86a7d2');
      x.save(); x.beginPath(); x.moveTo(0, BH); for (let X = 0; X <= BW; X += 6) x.lineTo(X, ridgeY(380, mw, X)); x.lineTo(BW, BH); x.clip();
      x.fillStyle = 'rgba(240,246,255,0.95)'; x.fillRect(0, 0, BW, 300); x.restore();
      x.fillStyle = lin(x, 0, 330, 0, BH, ['rgba(190,224,255,0)', 'rgba(190,224,255,0.7)']); x.fillRect(0, 330, BW, BH - 330);
      far = far[0];
      const n = mk(BW, BH, 1); x = n[1];
      const hw = [[3, 30, 0], [7, 18, 1.7], [13, 8, 0.6]];
      fillRidge(x, 430, hw, '#5eb352');
      for (let X = 0; X < BW; X += 9) if (r() < 0.5) { blob(x, [[X, ridgeY(430, hw, X) + 8 + r() * 10, 6 + r() * 6]], '#2f7d35'); }
      fillRidge(x, 470, [[4, 20, 2], [9, 10, 0.3]], '#4aa343');
      near = n[0];
    } else if (id === 'desert') {
      const s = mk(BW, BH, 1); let x = s[1];
      const g = x.createRadialGradient(1024, 400, 20, 1024, 400, 260);
      g.addColorStop(0, 'rgba(255,240,170,0.9)'); g.addColorStop(1, 'rgba(255,160,90,0)');
      x.fillStyle = g; x.fillRect(700, 100, 650, 412);
      x.fillStyle = lin(x, 0, 290, 0, 510, ['#fff4b8', '#ffb347', '#ff7a3c']); circle(x, 1024, 400, 110); x.fill();
      x.fillStyle = 'rgba(255,170,150,0.55)';
      for (let i = 0; i < 7; i++) { const cx = r() * BW, cy = 120 + r() * 200, w = 160 + r() * 260; wrap((X) => { rr(x, X, cy, w, 10 + r() * 8, 8); x.fill(); }, cx, w); }
      sky = s[0];
      const f = mk(BW, BH, 1); x = f[1];
      fillRidge(x, 420, [[3, 80, 0.4], [7, 60, 2.1], [13, 30, 1]], '#9a4c63', 290);
      x.fillStyle = lin(x, 0, 300, 0, BH, ['rgba(255,170,120,0)', 'rgba(255,170,120,0.55)']); x.fillRect(0, 280, BW, BH - 280);
      far = f[0];
      const n = mk(BW, BH, 1); x = n[1];
      fillRidge(x, 450, [[2, 30, 1], [5, 14, 0.3], [11, 5, 2]], '#e8a85e');
      fillRidge(x, 482, [[3, 16, 2], [7, 8, 0.7]], '#d4904a');
      near = n[0];
    } else if (id === 'city') {
      const s = mk(BW, BH, 1); let x = s[1];
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; x.fillRect(r() * BW, r() * 380, r() < 0.1 ? 3 : 2, r() < 0.1 ? 3 : 2); }
      x.fillStyle = '#fff3d0'; circle(x, 1540, 130, 46); x.fill();
      x.globalCompositeOperation = 'destination-out'; circle(x, 1562, 116, 42); x.fill(); x.globalCompositeOperation = 'source-over';
      sky = s[0];
      const f = mk(BW, BH, 1); x = f[1];
      for (let X = 0; X < BW;) {
        const w = 40 + r() * 80, h = 80 + r() * 200;
        wrap((XX) => {
          x.fillStyle = '#262a5c'; x.fillRect(XX, BH - h, w, h);
          for (let yy = BH - h + 8; yy < BH - 6; yy += 10) for (let xx = XX + 5; xx < XX + w - 5; xx += 9) if (r() < 0.22) { x.fillStyle = 'rgba(255,214,120,0.55)'; x.fillRect(xx, yy, 4, 5); }
        }, X, w);
        X += w + r() * 6;
      }
      far = f[0];
      const n = mk(BW, BH, 1); x = n[1];
      for (let X = 0; X < BW;) {
        const w = 50 + r() * 110, h = 120 + r() * 300, neon = r() < 0.3 ? U.pick(r, ['#ff2d95', '#2de2ff', '#ffd23f']) : null;
        wrap((XX) => {
          x.fillStyle = '#15173a'; x.fillRect(XX, BH - h, w, h);
          for (let yy = BH - h + 10; yy < BH - 8; yy += 14) for (let xx = XX + 6; xx < XX + w - 8; xx += 12) if (r() < 0.32) { x.fillStyle = r() < 0.7 ? 'rgba(255,210,110,0.85)' : 'rgba(150,220,255,0.8)'; x.fillRect(xx, yy, 6, 7); }
          if (neon) { x.fillStyle = neon; x.fillRect(XX, BH - h, w, 4); }
        }, X, w);
        X += w + r() * 10;
      }
      near = n[0];
    } else {
      sky = cloudLayer(9, 'rgba(255,255,255,0.9)', 'rgba(210,222,238,0.9)', 10, 60, 240);
      const f = mk(BW, BH, 1); let x = f[1];
      const mw = [[2, 90, 0.2], [4, 50, 1.1], [9, 25, 2.2], [19, 8, 0.7]];
      fillRidge(x, 400, mw, '#93abcb');
      x.save(); x.beginPath(); x.moveTo(0, BH); for (let X = 0; X <= BW; X += 6) x.lineTo(X, ridgeY(400, mw, X)); x.lineTo(BW, BH); x.clip();
      x.fillStyle = '#f4f8fd'; x.fillRect(0, 0, BW, 330);
      x.fillStyle = 'rgba(160,185,215,0.5)'; for (let X = 0; X < BW; X += 70) poly(x, [X, 330, X + 30, 250, X + 46, 330]), x.fill();
      x.restore();
      x.fillStyle = lin(x, 0, 340, 0, BH, ['rgba(230,238,248,0)', 'rgba(230,238,248,0.8)']); x.fillRect(0, 340, BW, BH - 340);
      far = f[0];
      const n = mk(BW, BH, 1); x = n[1];
      const tw = [[3, 18, 0], [8, 9, 1]];
      for (let X = 0; X < BW; X += 11) {
        const by = ridgeY(468, tw, X), th = 30 + r() * 40, w = 10 + r() * 9;
        wrap((XX) => {
          x.fillStyle = '#2d4a48'; poly(x, [XX, by - th, XX + w, by + 6, XX - w, by + 6]); x.fill();
          x.fillStyle = '#eef4fa'; poly(x, [XX, by - th, XX + w * 0.35, by - th * 0.6, XX - w * 0.35, by - th * 0.6]); x.fill();
        }, X - w, w * 2);
      }
      fillRidge(x, 482, [[4, 10, 1.3], [9, 6, 0.4]], '#e9f0f8');
      near = n[0];
    }
    return (cache[key] = { sky, far, near });
  }

  function get(key) { return cache[key]; }

  return {
    car, cone, barrel, barrier, coin, nitroCan, heart, ramp, chevronSign, billboard, neonBoard, banner,
    tree, pine, bush, rock, house, sheep, flowers, cactus, barrelCactus, redRock, mesa, deadTree, tumbleweed, palm,
    building, lamp, snowman, cabin, background, mirror, hslHex, get, star, rr, CAR_DIMS,
  };
})();
