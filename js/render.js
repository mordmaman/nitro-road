// Draws the pseudo-3D road (the classic arcade racer trick), the scenery, the cars and effects.

const CAM_H = 1000;                                   // camera height
const FOV = 100;                                      // field of view (degrees)
const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
const PLAYER_Z = CAM_H * CAM_DEPTH;                   // how far in front of the camera your car sits
const DRAW_DIST = 300;                                // segments drawn ahead
const FOG_DENSITY = 5;
const CAR_WORLD = 560;                                // player car width in world units
const CAR_W = CAR_WORLD / ROAD_W;                     // ...as a fraction of half the road

const R = {
  cv: null, ctx: null, w: 0, h: 0, dpr: 1, H0: 0, YS: 0, halfW: 0, u: 1,
  theme: null, bg: null, skyGrad: null, nightGrad: null,
  particles: [], flakes: [],

  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d', { alpha: false });
    this.resize();
    for (let i = 0; i < 90; i++) this.flakes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), d: Math.random() * 6 });
  },

  resize() {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cssW * dpr > 2400) dpr = 2400 / cssW;
    this.dpr = dpr;
    this.w = Math.round(cssW * dpr);
    this.h = Math.round(cssH * dpr);
    this.cv.width = this.w; this.cv.height = this.h;
    this.halfW = this.w / 2;
    this.XS = Math.min(this.w, this.h * 1.75) / 2;   // horizontal world scale
    this.H0 = this.h * 0.5;
    this.YS = this.h * 0.5;
    this.u = Math.min(this.w, this.h * 1.8) / 100;
    this.skyGrad = null; this.nightGrad = null;
  },

  setTheme(theme) {
    this.theme = theme;
    this.bg = Art.background(Object.keys(THEMES).find((k) => THEMES[k] === theme));
    this.skyGrad = null; this.nightGrad = null;
  },

  project(p, camX, camY, camZ) {
    p.camera.x = p.world.x - camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    const s = CAM_DEPTH / p.camera.z;
    p.screen.scale = s;
    p.screen.x = Math.round(this.halfW + s * p.camera.x * this.XS);
    p.screen.y = Math.round(this.H0 - s * p.camera.y * this.YS);
    p.screen.w = Math.round(s * ROAD_W * this.XS);
  },

  poly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.lineTo(x4, y4); c.closePath(); c.fill();
  },

  // ---------------------------------------------------------------- the whole scene
  renderWorld(v) {
    const c = this.ctx, w = this.w, h = this.h, th = this.theme;
    const track = v.track, segs = track.segs, N = segs.length, L = track.length;
    const position = U.mod(v.camZ, L);
    const base = segs[Math.floor(position / SEG_LEN) % N];
    const basePercent = (position % SEG_LEN) / SEG_LEN;
    const playerPos = U.mod(position + PLAYER_Z, L);
    const pSeg = segs[Math.floor(playerPos / SEG_LEN) % N];
    const pPercent = (playerPos % SEG_LEN) / SEG_LEN;
    const playerY = U.lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPercent);

    c.save();
    if (v.shake > 0) c.translate((Math.random() - 0.5) * v.shake * this.u * 2, (Math.random() - 0.5) * v.shake * this.u * 2);

    this.drawBackground(v.bgOff, playerY);

    let maxy = h, x = 0, dx = -(base.curve * basePercent);
    const camX = v.playerX * ROAD_W;
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[(base.index + n) % N];
      const looped = seg.index < base.index;
      seg.fog = U.fog(n / DRAW_DIST, FOG_DENSITY);
      seg.clip = maxy;
      seg.n = n;
      this.project(seg.p1, camX - x, playerY + CAM_H, position - (looped ? L : 0));
      this.project(seg.p2, camX - x - dx, playerY + CAM_H, position - (looped ? L : 0));
      x += dx; dx += seg.curve;
      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      this.drawSegment(seg, th);
      maxy = seg.p1.screen.y;
    }

    if (th.night) this.drawNight();

    // sprites + cars, far to near
    for (let n = DRAW_DIST - 1; n > 0; n--) {
      const seg = segs[(base.index + n) % N];
      if (seg.p1.camera.z <= CAM_DEPTH) continue;
      const alpha = Math.min(1, seg.fog * 1.8);
      for (const s of seg.sprites) {
        const scale = seg.p1.screen.scale;
        const sx = seg.p1.screen.x + scale * s.offset * ROAD_W * this.XS;
        const align = s.align != null ? s.align : (s.offset < 0 ? -1 : 0);
        this.drawSprite(s.sp, scale, sx, seg.p1.screen.y, align, -1, seg.clip, alpha);
      }
      const items = v.items.get(seg.index);
      if (seg === pSeg) {
        if (items) this.drawItems(seg, items, (p) => p > pPercent, alpha);
        this.drawPlayer(v, pSeg, pPercent);
        if (items) this.drawItems(seg, items, (p) => p <= pPercent, alpha);
      } else if (items) {
        this.drawItems(seg, items, null, alpha);
      }
    }
    c.restore();
  },

  drawBackground(off, playerY) {
    const c = this.ctx, w = this.w, h = this.h, th = this.theme, H0 = this.H0;
    if (!this.skyGrad) {
      const g = c.createLinearGradient(0, 0, 0, H0);
      g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
      this.skyGrad = g;
    }
    c.fillStyle = this.skyGrad; c.fillRect(0, 0, w, H0 + 2);
    c.fillStyle = th.ground; c.fillRect(0, H0, w, h - H0);
    const lift = U.clamp(playerY / 12000, -0.2, 0.3);
    const layer = (img, o, hh, bottom) => {
      if (!img) return;
      const dh = hh, dw = dh * 4;
      let sx = -U.mod(o, 1) * dw;
      const y = bottom - dh;
      for (; sx < w; sx += dw) c.drawImage(img, sx, y, dw + 1, dh);
    };
    layer(this.bg.sky, off[0], H0, H0);
    layer(this.bg.far, off[1], H0 * 0.85, H0 + 2 + H0 * lift * 0.15);
    layer(this.bg.near, off[2], H0 * 0.62, H0 + 3 + H0 * lift * 0.4);
    c.fillStyle = th.ground; c.fillRect(0, H0 + 2 + H0 * lift * 0.4, w, h);
  },

  drawSegment(seg, th) {
    const c = this.ctx, w = this.w;
    const p1 = seg.p1.screen, p2 = seg.p2.screen;
    const col = seg.alt ? th.dark : th.light;
    const x1 = p1.x, y1 = p1.y, w1 = p1.w, x2 = p2.x, y2 = p2.y, w2 = p2.w;
    const r1 = w1 / 6, r2 = w2 / 6;
    c.fillStyle = col.grass; c.fillRect(0, y2, w, y1 - y2 + 1);
    this.poly(x1 - w1 - r1, y1 + 1, x1 - w1, y1 + 1, x2 - w2, y2, x2 - w2 - r2, y2, col.rumble);
    this.poly(x1 + w1 + r1, y1 + 1, x1 + w1, y1 + 1, x2 + w2, y2, x2 + w2 + r2, y2, col.rumble);
    this.poly(x1 - w1, y1 + 1, x1 + w1, y1 + 1, x2 + w2, y2, x2 - w2, y2, col.road);
    if (!seg.alt) {
      const l1 = w1 / 28, l2 = w2 / 28, lw1 = (w1 * 2) / LANES, lw2 = (w2 * 2) / LANES;
      let lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2;
      for (let lane = 1; lane < LANES; lane++, lx1 += lw1, lx2 += lw2) {
        this.poly(lx1 - l1 / 2, y1 + 1, lx1 + l1 / 2, y1 + 1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, th.light.lane);
      }
    }
    for (const d of seg.decals) this.drawDecal(d, x1, y1, w1, x2, y2, w2);
    if (seg.fog < 1) {
      c.globalAlpha = 1 - seg.fog;
      c.fillStyle = th.fog; c.fillRect(0, y2, w, y1 - y2 + 1);
      c.globalAlpha = 1;
    }
  },

  drawDecal(d, x1, y1, w1, x2, y2, w2) {
    const c = this.ctx;
    const a1 = x1 + w1 * d.x0, b1 = x1 + w1 * d.x1, a2 = x2 + w2 * d.x0, b2 = x2 + w2 * d.x1;
    if (d.kind === 'checker') {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        this.poly(U.lerp(a1, b1, t0), y1 + 1, U.lerp(a1, b1, t1), y1 + 1, U.lerp(a2, b2, t1), y2, U.lerp(a2, b2, t0), y2, (i + d.row) % 2 ? '#111' : '#f4f4f4');
      }
    } else if (d.kind === 'pad') {
      const glow = (Math.floor(performance.now() / 90) + d.k) % 3 === 0;
      this.poly(a1, y1 + 1, b1, y1 + 1, b2, y2, a2, y2, d.k % 2 ? (glow ? '#ffffff' : '#9df4ff') : '#18d6ff');
    } else if (d.kind === 'oil') {
      const sh = [0.55, 1, 1, 0.55][d.k] || 1, sh2 = [1, 1, 0.55, 0.3][d.k] || 1;
      const m1 = (a1 + b1) / 2, m2 = (a2 + b2) / 2, hw1 = (b1 - a1) / 2 * sh, hw2 = (b2 - a2) / 2 * sh2;
      c.globalAlpha = 0.9;
      this.poly(m1 - hw1, y1 + 1, m1 + hw1, y1 + 1, m2 + hw2, y2, m2 - hw2, y2, '#0c0c14');
      this.poly(m1 - hw1 * 0.3, y1 + 1, m1 + hw1 * 0.1, y1 + 1, m2 + hw2 * 0.1, y2, m2 - hw2 * 0.3, y2, 'rgba(120,90,200,0.55)');
      c.globalAlpha = 1;
    }
  },

  drawSprite(sp, scale, x, y, alignX, alignY, clipY, alpha, scaleX, lift) {
    const destW = sp.worldW * scale * this.XS;
    const destH = destW * sp.aspect;
    let dx = x + destW * alignX;
    const dy = y + destH * alignY - (lift || 0) * scale * this.YS;
    if (destW < 0.5 || dy > this.h || dx > this.w || dx + destW < 0 || dy + destH < 0) return;
    const clipH = clipY ? Math.max(0, dy + destH - clipY) : 0;
    if (clipH >= destH) return;
    const c = this.ctx;
    c.globalAlpha = alpha == null ? 1 : alpha;
    let dw = destW;
    if (scaleX != null && scaleX !== 1) { dw = destW * scaleX; dx += (destW - dw) / 2; }
    const f = 1 - clipH / destH;
    c.drawImage(sp.img, 0, 0, sp.img.width, sp.img.height * f, dx, dy, dw, destH - clipH);
    c.globalAlpha = 1;
  },

  drawItems(seg, items, filter, fogAlpha) {
    const list = filter ? items.filter((it) => filter(it.percent)) : items;
    if (list.length > 1) list.sort((a, b) => b.percent - a.percent);
    for (const it of list) {
      const scale = U.lerp(seg.p1.screen.scale, seg.p2.screen.scale, it.percent);
      const sx = U.lerp(seg.p1.screen.x, seg.p2.screen.x, it.percent) + scale * it.x * ROAD_W * this.XS;
      const sy = U.lerp(seg.p1.screen.y, seg.p2.screen.y, it.percent);
      if (it.shadow) {
        const sw = it.sp.worldW * scale * this.XS * 0.5;
        this.ctx.globalAlpha = 0.25 * fogAlpha; this.ctx.fillStyle = '#000';
        this.ctx.beginPath(); this.ctx.ellipse(sx, sy, sw, sw * 0.12, 0, 0, Math.PI * 2); this.ctx.fill(); this.ctx.globalAlpha = 1;
      }
      this.drawSprite(it.sp, scale, sx, sy, -0.5, -1, seg.clip, (it.alpha == null ? 1 : it.alpha) * fogAlpha, it.scaleX, it.lift);
      if (it.blink) {
        const destW = it.sp.worldW * scale * this.XS;
        const destH = destW * it.sp.aspect;
        const bx = sx + it.blink * destW * 0.42, by = sy - (it.lift || 0) * scale * this.YS - destH * 0.45;
        const c = this.ctx;
        if (sy < seg.clip) {
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(bx, by, 0, bx, by, destW * 0.16);
          g.addColorStop(0, 'rgba(255,190,40,1)'); g.addColorStop(1, 'rgba(255,140,0,0)');
          c.fillStyle = g; c.fillRect(bx - destW * 0.16, by - destW * 0.16, destW * 0.32, destW * 0.32);
          c.globalCompositeOperation = 'source-over';
        }
      }
    }
  },

  drawPlayer(v, pSeg, pPercent) {
    const c = this.ctx, p = v.car;
    if (!p || p.hidden) return;
    const scale = CAM_DEPTH / PLAYER_Z;
    const sp = p.sprite;
    const destW = sp.worldW * scale * this.XS;
    const destH = destW * sp.aspect;
    const camY = U.lerp(pSeg.p1.camera.y, pSeg.p2.camera.y, pPercent);
    const groundY = this.H0 - scale * camY * this.YS - this.h * 0.012;
    const air = p.air * scale * this.YS;
    const bounce = p.bounce * this.u * 0.25;
    const cx = this.halfW + p.steer * destW * 0.04;
    const cy = groundY - air - bounce;

    // shadow
    c.fillStyle = 'rgba(0,0,0,0.35)';
    const shw = destW * (0.52 - Math.min(0.2, p.air / 4000));
    c.beginPath(); c.ellipse(cx, groundY - destH * 0.02, shw, destW * 0.07, 0, 0, Math.PI * 2); c.fill();

    c.save();
    c.translate(cx, cy);
    c.rotate(p.steer * 0.045 + p.spin);
    c.globalAlpha = p.alpha;
    c.drawImage(sp.img, -destW / 2, -destH, destW, destH);
    c.globalAlpha = 1;

    // nitro / boost flames out of the exhausts
    if (p.flame > 0) {
      c.globalCompositeOperation = 'lighter';
      const exY = -destH * (p.exY || 0.19);
      const xs = p.exX || [-0.17, 0.17];
      for (const ex of xs) {
        const fx = ex * destW, len = destW * (0.12 + Math.random() * 0.08) * p.flame, wid = destW * 0.045;
        const g = c.createRadialGradient(fx, exY, 0, fx, exY + len * 0.4, len);
        const cols = p.flameColor === 'orange' ? ['rgba(255,255,220,1)', 'rgba(255,170,40,0.9)', 'rgba(255,60,0,0)'] : ['rgba(255,255,255,1)', 'rgba(80,220,255,0.9)', 'rgba(40,80,255,0)'];
        g.addColorStop(0, cols[0]); g.addColorStop(0.35, cols[1]); g.addColorStop(1, cols[2]);
        c.fillStyle = g;
        c.beginPath(); c.ellipse(fx, exY + len * 0.45, wid, len * 0.6, 0, 0, Math.PI * 2); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
    this.carScreen = { x: cx, y: cy, w: destW, h: destH, ground: groundY };
  },

  drawNight() {
    const c = this.ctx, w = this.w, h = this.h;
    if (!this.nightGrad) {
      const g = c.createRadialGradient(w / 2, h * 0.95, h * 0.08, w / 2, h * 0.75, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(255,240,200,0.10)'); g.addColorStop(0.45, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,20,0.5)');
      this.nightGrad = g;
    }
    c.fillStyle = this.nightGrad; c.fillRect(0, 0, w, h);
  },

  // ---------------------------------------------------------------- effects on top
  speedLines(amount, t) {
    if (amount <= 0) return;
    const c = this.ctx, w = this.w, h = this.h, cx = w / 2, cy = this.H0;
    c.strokeStyle = `rgba(255,255,255,${0.18 * amount})`;
    c.lineWidth = Math.max(1, this.u * 0.25);
    c.beginPath();
    const n = Math.floor(18 * amount);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = Math.max(w, h) * (0.35 + Math.random() * 0.25), r1 = r0 + Math.max(w, h) * (0.12 + Math.random() * 0.2);
      c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7);
      c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7);
    }
    c.stroke();
  },

  nitroVignette(amount) {
    if (amount <= 0) return;
    const c = this.ctx, w = this.w, h = this.h;
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(60,200,255,0)'); g.addColorStop(1, `rgba(60,200,255,${0.28 * amount})`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  },

  snow(dt, speedPct) {
    const c = this.ctx, w = this.w, h = this.h;
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.flakes) {
      f.y += dt * (0.08 + speedPct * 0.35) * f.s;
      f.x += dt * ((f.x - 0.5) * speedPct * 0.9 + Math.sin(f.d += dt) * 0.02);
      if (f.y > 1 || f.x < 0 || f.x > 1) { f.y = Math.random() * 0.3; f.x = 0.2 + Math.random() * 0.6; }
      c.beginPath(); c.arc(f.x * w, f.y * h, this.u * 0.25 * f.s, 0, Math.PI * 2); c.fill();
    }
  },

  emit(x, y, n, opt) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * (opt.spread || 0), y,
        vx: (Math.random() - 0.5) * (opt.vx || 1) * this.u * 20, vy: -(Math.random() * (opt.vy || 1)) * this.u * 20,
        life: 0, max: (opt.life || 0.6) * (0.6 + Math.random() * 0.6), color: opt.color, size: (opt.size || 1) * this.u * (0.4 + Math.random() * 0.6),
        grav: opt.grav == null ? 1 : opt.grav,
      });
    }
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
  },

  drawParticles(dt) {
    const c = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += this.u * 60 * p.grav * dt;
      c.globalAlpha = 1 - p.life / p.max;
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.size * (1 + p.life / p.max), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  },

  // ---------------------------------------------------------------- HUD helpers
  text(str, x, y, size, color, align, opt) {
    const c = this.ctx;
    opt = opt || {};
    c.font = `${opt.weight || ''} ${Math.round(size)}px ${opt.font || FONT}`;
    c.textAlign = align || 'left';
    c.textBaseline = opt.baseline || 'middle';
    if (opt.stroke !== false) {
      c.lineJoin = 'round';
      c.lineWidth = size * (opt.strokeW || 0.16);
      c.strokeStyle = opt.stroke || 'rgba(10,10,30,0.85)';
      c.strokeText(str, x, y);
    }
    c.fillStyle = color;
    c.fillText(str, x, y);
  },

  panel(x, y, w, h, alpha) {
    const c = this.ctx;
    c.fillStyle = `rgba(10,12,40,${alpha == null ? 0.62 : alpha})`;
    Art.rr(c, x, y, w, h, this.u * 1.6); c.fill();
  },
};
