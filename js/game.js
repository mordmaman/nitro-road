// The game itself: driving physics, the three modes, the computer drivers, scoring, HUD and main loop.

const STEP = 1 / 60;
const BASE_MAX = SEG_LEN / STEP;   // top speed on Medium (12000 world units a second)
const CAR_LEN = 260;               // how long a car is, for bumping
const GRAVITY = 4200;
const EXHAUST = { sport: [[-0.17, 0.17], 0.19], muscle: [[-0.32, 0.32], 0.15], rocket: [[0], 0.12] };

const Input = {
  keys: { left: false, right: false, gas: false, brake: false, nitro: false },
  touch: { left: false, right: false, gas: false, brake: false, nitro: false },
  gasEdge: -10,
  read() {
    const k = this.keys, t = this.touch;
    return {
      steer: ((k.right || t.right) ? 1 : 0) - ((k.left || t.left) ? 1 : 0),
      gas: k.gas || t.gas, brake: k.brake || t.brake, nitro: k.nitro || t.nitro,
    };
  },
};

const G = {
  state: 'boot', mode: 'race', trackIdx: 0, diff: 'medium',
  track: null, D: DIFFICULTY.medium, maxSpeed: BASE_MAX,
  P: null, ai: [], objs: [], dynDecals: [],
  ghost: null, ghostRec: null, ghostSprite: null,
  t: 0, raceT: 0, cd: 0, cdShown: 0, doneT: 0, stepN: 0,
  bgOff: [0, 0, 0], shake: 0,
  msg: null, popups: [], items: new Map(),
  autoGas: false, result: null, pausedFrom: null, car: null,
  lapTimes: [], lapStart: 0, lastPos: 0, lapDelta: null,
};

// ------------------------------------------------------------------ helpers
const segAt = (d) => G.track.segs[Math.floor(U.mod(d, G.track.length) / SEG_LEN) % G.track.segs.length];
const wrapDz = (dz) => U.mod(dz + G.track.length / 2, G.track.length) - G.track.length / 2;
const laps = () => (G.mode === 'race' ? CONFIG.raceLaps : CONFIG.trialLaps);

function forPassed(prev, cur, fn) {
  const N = G.track.segs.length;
  const a = Math.floor(prev / SEG_LEN), b = Math.floor(cur / SEG_LEN);
  const n = U.clamp(b - a, 0, 4);
  for (let k = 0; k <= n; k++) if (fn(G.track.segs[U.mod(a + k, N)]) === true) return;
}

function say(text, sub, color, dur) { G.msg = { text, sub, color: color || '#ffd23f', t: 0, dur: dur || 1.4 }; }
function popup(text, color, big) { G.popups.push({ text, color: color || '#fff', t: 0, big }); if (G.popups.length > 3) G.popups.shift(); }

function newPlayer() {
  return {
    dist: 0, prevDist: 0, x: 0, speed: 0, steerVis: 0,
    nitro: 0.3, nitroOn: false, nitroMin: 0, boostT: 0, air: 0, vy: 0,
    spinT: 0, invT: 0, crashCool: 0, oilCool: 0, lives: 3, braking: false, offroad: false, drift: 0,
    lap: -1, finished: false, place: 0, drafting: false,
  };
}

function buildCarSprites() {
  const paint = PAINTS.find((p) => p.id === Store.data.paint) || PAINTS[0];
  const body = Store.data.body || 'sport';
  const ex = EXHAUST[body] || EXHAUST.sport;
  if (paint.color === 'rainbow') {
    const frames = [];
    for (let i = 0; i < 12; i++) { const c = Art.hslHex(i * 30, 85, 55); frames.push([Art.car(c, body, false), Art.car(c, body, true)]); }
    G.car = { frames, exX: ex[0], exY: ex[1], body };
  } else {
    G.car = { frames: [[Art.car(paint.color, body, false), Art.car(paint.color, body, true)]], exX: ex[0], exY: ex[1], body };
  }
  G.ghostSprite = Art.car('#7fe3ff', body, true);
}

function clearDynamic() {
  for (const [seg, d] of G.dynDecals) { const i = seg.decals.indexOf(d); if (i >= 0) seg.decals.splice(i, 1); }
  G.dynDecals = [];
  G.objs = [];
}

function useTrack(i) {
  G.trackIdx = i;
  G.track = Tracks.get(i);
  R.setTheme(G.track.theme);
  G.bgOff = [0.3, 0.15, 0.6];
}

// ------------------------------------------------------------------ starting things
function startDemo(i) {
  G.mode = 'demo';
  useTrack(i);
  clearDynamic();
  G.D = DIFFICULTY.medium; G.maxSpeed = BASE_MAX;
  G.P = newPlayer(); G.P.dist = 30 * SEG_LEN; G.P.speed = BASE_MAX * 0.7;
  G.ai = [0, 1, 2].map((i) => {
    const o = CONFIG.opponents[i];
    return makeAI(o, G.P.dist + (12 + i * 22) * SEG_LEN, U.pick(Math.random, LANE_X), 0.76 + i * 0.03);
  });
  G.ai.forEach((a) => (a.speed = BASE_MAX * 0.7));
  G.state = 'menu';
  G.msg = null; G.popups = [];
}

function makeAI(o, dist, x, skill) {
  return {
    name: o.name, color: o.color, sprite: Art.car(o.color, o.body), brakeSprite: Art.car(o.color, o.body, true),
    dist, x, laneX: x, targetX: x, speed: 0, skill, react: 0.1 + Math.random() * 0.35,
    finished: false, finishT: 0, prevDz: 0, braking: false,
  };
}

function startGame(mode, trackIdx, diff) {
  Sound.init(); Sound.engineStart();
  G.mode = mode; G.diff = diff;
  useTrack(trackIdx);
  clearDynamic();
  G.D = DIFFICULTY[diff];
  G.maxSpeed = BASE_MAX * G.D.speed;
  const P = (G.P = newPlayer());
  G.ai = []; G.ghost = null; G.ghostRec = null;
  G.raceT = 0; G.stepN = 0; G.lapTimes = []; G.lapStart = 0; G.lapDelta = null;
  G.msg = null; G.popups = []; G.result = null; G.shake = 0;
  G.track.pickups.forEach((p) => (p.lap = -99));

  if (mode === 'race') {
    const n = CONFIG.opponents.length;
    const slots = [];
    for (let i = 0; i <= n; i++) slots.push({ dist: -(3 + Math.floor(i / 2) * 7) * SEG_LEN, x: i % 2 ? 0.42 : -0.42 });
    G.ai = CONFIG.opponents.map((o, i) => makeAI(o, slots[i].dist, slots[i].x, U.lerp(G.D.ai[1], G.D.ai[0], i / (n - 1))));
    G.ai.forEach((a) => { a.laneX = U.pick(Math.random, [-0.5, 0, 0.5]); });
    P.dist = slots[n].dist; P.x = slots[n].x;
    G.lastPos = n + 1;
  } else if (mode === 'trial') {
    P.dist = -3 * SEG_LEN;
    G.ghost = Store.data.ghosts[ghostKey()] || null;
    G.ghostRec = [];
    P.nitro = 0.3;
  } else {
    P.dist = 0;
    P.lives = G.D.lives;
    P.nitro = 0.2;
    G.level = 1; G.maxSpeed = dodgeMax(1);
    G.nextSpawn = 45 * SEG_LEN;
    G.score = 0; G.metres = 0; G.coins = 0; G.combo = 1; G.comboT = 0; G.nearMisses = 0; G.jumps = 0; G.lastPattern = null;
    G.groupSeen = new Set(); G.groupId = 0;
    G.dodgeBest = (Store.data.records[recordKey('dodge', trackIdx, diff)] || {}).best || 0; G.bestShown = false;
  }
  P.prevDist = P.dist;
  G.state = 'countdown';
  G.cd = 3.7; G.cdShown = 5;
  Input.gasEdge = -10;
}

const ghostKey = () => `${G.track.id}|${G.diff}`;
const recordKey = (mode, ti, diff) => `${mode}|${TRACK_DEFS[ti].id}|${diff}`;
const dodgeMax = (lvl) => BASE_MAX * G.D.speed * Math.min(1.16, 0.76 + 0.055 * (lvl - 1));

// ------------------------------------------------------------------ main update
function update(dt) {
  G.t += dt;
  if (G.msg) { G.msg.t += dt; if (G.msg.t > G.msg.dur) G.msg = null; }
  for (let i = G.popups.length - 1; i >= 0; i--) { G.popups[i].t += dt; if (G.popups[i].t > 1.1) G.popups.splice(i, 1); }
  G.shake = Math.max(0, G.shake - dt * 2.5);
  if (G.state === 'paused' || G.state === 'boot') return;

  const P = G.P;
  if (G.state === 'menu') {
    drive(dt, autopilot(0.7, Math.sin(G.t * 0.25) * 0.45));
    updateAI(dt, true);
  } else if (G.state === 'countdown') {
    G.cd -= dt;
    const shown = Math.ceil(G.cd);
    if (shown !== G.cdShown) {
      G.cdShown = shown;
      if (shown >= 1 && shown <= 3) Sound.sfx.beep(false);
    }
    if (G.cd <= 0) go();
    engine(Input.read());
  } else if (G.state === 'race' || G.state === 'done') {
    const done = G.state === 'done';
    let ctrl = Input.read();
    if (done) ctrl = G.mode === 'dodge' ? { steer: 0, gas: false, brake: true, nitro: false } : autopilot(0.55, 0);
    if (!done) { G.raceT += dt; G.stepN++; }
    drive(dt, ctrl);
    if (G.mode === 'race') { updateAI(dt, false); raceChecks(dt); }
    if (G.mode === 'trial') trialChecks();
    if (G.mode === 'dodge') dodgeUpdate(dt);
    if (G.mode !== 'dodge' && !done) lapChecks();
    if (done) {
      G.doneT += dt;
      if (G.doneT > (G.mode === 'dodge' ? 1.6 : 2.4) && !G.resultShown) { G.resultShown = true; UI.showResults(G.result); }
    }
    engine(ctrl);
  }
  // background parallax follows the bends
  const seg = segAt(P.dist + PLAYER_Z);
  const moved = (P.dist - P.prevDist) / SEG_LEN;
  G.bgOff[0] += 0.0004 * seg.curve * moved;
  G.bgOff[1] += 0.0010 * seg.curve * moved;
  G.bgOff[2] += 0.0024 * seg.curve * moved;
}

function go() {
  G.state = 'race';
  Sound.sfx.beep(true);
  say('GO!', null, '#3df07a', 0.9);
  const P = G.P;
  const ctrl = Input.read();
  if (G.t - Input.gasEdge < 0.45 && (ctrl.gas || ctrl.nitro)) {
    P.boostT = 1.2; P.speed = G.maxSpeed * 0.35;
    popup('TURBO START!', '#3df07a', true);
    Sound.sfx.boost();
  }
}

function autopilot(speedFrac, want) {
  const P = G.P;
  const ahead = segAt(P.dist + 10 * SEG_LEN);
  const err = want - P.x + ahead.curve * G.D.centrifugal * 0.25;
  return { steer: U.clamp(err * 3, -1, 1), gas: P.speed < G.maxSpeed * speedFrac, brake: P.speed > G.maxSpeed * (speedFrac + 0.12), nitro: false };
}

// ------------------------------------------------------------------ driving physics
function drive(dt, ctrl) {
  const P = G.P, D = G.D, max = G.maxSpeed, th = G.track.theme;
  const racing = G.state === 'race';
  P.prevDist = P.dist;
  const seg = segAt(P.dist);
  const speedPct = P.speed / max;

  let steer = ctrl.steer;
  if (P.spinT > 0) { P.spinT -= dt; steer = 0; }
  const dx = dt * 2 * Math.min(speedPct, 1.15);
  P.x += steer * dx * (P.air > 0 ? 0.6 : 1);
  const push = dx * Math.min(speedPct, 1.4) * seg.curve * D.centrifugal * (th.slide || 1);
  if (P.air <= 0) P.x -= push;
  P.drift = Math.abs(push / dt);
  P.steerVis = U.approach(P.steerVis, steer, dt * 7);

  // nitro
  if (racing && ctrl.nitro && !P.nitroOn && P.nitro > 0.08 && P.speed > max * 0.15) { P.nitroOn = true; P.nitroMin = 0.45; Sound.sfx.boost(); }
  if (P.nitroOn) {
    P.nitro -= dt * 0.42; P.nitroMin -= dt;
    if (P.nitro <= 0 || (!ctrl.nitro && P.nitroMin <= 0) || !racing) { P.nitroOn = false; P.nitro = Math.max(0, P.nitro); }
  } else if (racing && G.mode !== 'dodge') {
    P.nitro = Math.min(1, P.nitro + dt * 0.012);
  }

  // speed
  let top = max * (P.drafting ? 1.05 : 1);
  if (P.nitroOn) top = max * 1.38;
  if (P.boostT > 0) { top = Math.max(top, max * 1.3); P.boostT -= dt; }
  const gas = ctrl.gas || (G.autoGas && racing && !ctrl.brake);
  P.braking = ctrl.brake && P.speed > 1;
  if (P.spinT > 0) P.speed -= max * 0.35 * dt;
  else if (P.nitroOn || P.boostT > 0) P.speed = Math.min(top, P.speed + max * 1.1 * dt);
  else if (ctrl.brake) P.speed -= max * 1.1 * dt;
  else if (gas) { if (P.speed < top) P.speed = Math.min(top, P.speed + max * (0.42 - 0.22 * Math.min(1, speedPct)) * dt); }
  else P.speed -= max * 0.22 * dt;
  if (P.speed > top) P.speed = Math.max(top, P.speed - max * 0.5 * dt);
  P.speed = Math.max(0, P.speed);

  // grass
  P.offroad = Math.abs(P.x) > 1.02 && P.air <= 0;
  if (P.offroad) {
    if (P.speed > max * 0.3) P.speed = Math.max(max * 0.3, P.speed - max * D.offroadDrag * dt);
    if (D.assist) P.x -= Math.sign(P.x) * D.assist * dt * 0.8;
  }
  P.x = U.clamp(P.x, -D.edge, D.edge);

  // jumps
  if (P.air > 0 || P.vy > 0) {
    P.vy -= GRAVITY * dt; P.air += P.vy * dt;
    if (P.air <= 0) { P.air = 0; P.vy = 0; Sound.sfx.land(); G.shake = Math.max(G.shake, 0.35); }
  }

  P.dist += P.speed * dt;
  P.invT = Math.max(0, P.invT - dt);
  P.crashCool = Math.max(0, P.crashCool - dt);
  P.oilCool = Math.max(0, P.oilCool - dt);

  roadChecks();
}

// things lying on or beside the road you drove over this frame
function roadChecks() {
  const P = G.P;
  forPassed(P.prevDist, P.dist, (seg) => {
    if (P.air <= 0) {
      for (const d of seg.decals) {
        if (d.kind === 'pad' && P.x > d.x0 - CAR_W * 0.3 && P.x < d.x1 + CAR_W * 0.3) {
          if (P.boostT < 0.8) { P.boostT = 1.1; Sound.sfx.whoosh(); popup('BOOST!', '#18d6ff'); }
        } else if (d.kind === 'oil' && P.oilCool <= 0 && P.x > d.x0 - CAR_W * 0.2 && P.x < d.x1 + CAR_W * 0.2) {
          P.oilCool = 1.5; P.spinT = 0.85; P.speed *= 0.8; Sound.sfx.oil(); popup('OIL SLICK!', '#c9b6ff', true);
          if (G.mode === 'dodge') { G.combo = 1; }
        }
      }
    }
    if (P.air <= 0 && Math.abs(P.x) > 0.95 && P.crashCool <= 0) {
      for (const s of seg.sprites) {
        if (s.noHit || !s.sp.hit) continue;
        const wN = s.sp.worldW / ROAD_W;
        const align = s.align != null ? s.align : (s.offset < 0 ? -1 : 0);
        const cx = s.offset + align * wN + s.sp.hitAt * wN;
        if (U.overlap(P.x, CAR_W, cx, wN * s.sp.hit)) { crashScenery(cx); return true; }
      }
    }
    if (G.mode !== 'dodge' && G.state === 'race') {
      const pks = seg.pickups;
      if (pks) {
        const lap = Math.floor(P.dist / G.track.length);
        for (const pk of pks) {
          if (pk.lap !== lap && U.overlap(P.x, CAR_W, pk.x, 0.16)) {
            pk.lap = lap; P.nitro = Math.min(1, P.nitro + 0.34);
            Sound.sfx.nitro(); popup('+NITRO', '#5ccaff');
            sparkle('#5ccaff');
          }
        }
      }
    }
  });
}

function crashScenery(cx) {
  const P = G.P, D = G.D;
  const hard = P.speed > G.maxSpeed * 0.35;
  P.crashCool = 0.6;
  P.speed *= D.crashKeep;
  P.x -= Math.sign(P.x) * 0.12;
  P.nitroOn = false;
  G.shake = hard ? 1 : 0.5;
  if (hard) { Sound.sfx.crash(); buzz(80); } else Sound.sfx.bump();
  sparks();
  if (G.mode === 'dodge' && hard && P.invT <= 0) loseLife();
  else if (hard) popup('CRASH!', '#ff5a5a', true);
}

function sparks() {
  const cs = R.carScreen;
  if (cs) R.emit(cs.x, cs.y - cs.h * 0.4, 26, { color: '#ffcf3a', vx: 3, vy: 2, life: 0.6, size: 0.8, spread: cs.w * 0.6 });
}
function sparkle(color) {
  const cs = R.carScreen;
  if (cs) R.emit(cs.x, cs.y - cs.h * 0.8, 12, { color, vx: 2, vy: 1.5, life: 0.5, size: 0.7, spread: cs.w * 0.4, grav: 0.3 });
}

// ------------------------------------------------------------------ computer drivers
function updateAI(dt, demo) {
  const P = G.P, D = G.D, L = G.track.length, segs = G.track.segs, N = segs.length;
  const racers = G.ai;
  for (const a of racers) {
    if (!demo && G.state === 'countdown') continue;
    if (!demo && G.raceT < a.react) continue;
    let target = G.maxSpeed * a.skill;
    const idx = Math.floor(U.mod(a.dist, L) / SEG_LEN);
    let c = 0;
    for (let k = 0; k < 18; k += 3) c = Math.max(c, Math.abs(segs[(idx + k) % N].curve));
    target *= 1 - c * D.aiCorner;
    // same grip limit as you: too fast in a tight bend and you slide wide
    if (c > 0.5) target = Math.min(target, G.maxSpeed * Math.sqrt(1.25 / (c * D.centrifugal * (G.track.theme.slide || 1))));
    if (!demo && !P.finished) {
      const gap = a.dist - P.dist, span = L * 0.3;
      target *= gap > 0 ? 1 - D.rubberAhead * U.clamp(gap / span, 0, 1) : 1 + D.rubberBehind * U.clamp(-gap / span, 0, 1);
    }
    if (a.finished) target = G.maxSpeed * 0.5;

    // dodge whoever is in front
    let blocker = null, bdz = Infinity;
    const others = [P].concat(racers);
    for (const o of others) {
      if (o === a) continue;
      const dz = wrapDz(o.dist - a.dist);
      if (dz > 0 && dz < 14 * SEG_LEN && dz < bdz && o.speed < a.speed + 50 && U.overlap(a.x, CAR_W, o.x, CAR_W, 1.25)) { blocker = o; bdz = dz; }
    }
    if (blocker) {
      let side;
      if (blocker.x > 0.35) side = -1; else if (blocker.x < -0.35) side = 1; else side = a.x >= blocker.x ? 1 : -1;
      a.targetX = U.clamp(blocker.x + side * 0.45, -0.8, 0.8);
      if (bdz < 3 * SEG_LEN) target = Math.min(target, blocker.speed * 0.98);
    } else {
      a.targetX = U.approach(a.targetX, a.laneX, dt * 0.15);
    }
    a.x = U.approach(a.x, a.targetX, dt * 0.9);
    a.braking = a.speed > target + G.maxSpeed * 0.04;
    a.speed = a.speed < target ? Math.min(target, a.speed + G.maxSpeed * (0.4 - 0.2 * Math.min(1, a.speed / G.maxSpeed)) * dt) : Math.max(target, a.speed - G.maxSpeed * 0.5 * dt);
    a.dist += a.speed * dt;

    if (demo && a.dist - P.dist > 110 * SEG_LEN) { a.dist = P.dist - 14 * SEG_LEN; a.x = a.targetX = a.laneX = U.pick(Math.random, LANE_X); }
    if (!demo && !a.finished && a.dist >= laps() * L) { a.finished = true; a.finishT = G.raceT; }
  }
}

function raceChecks(dt) {
  const P = G.P, L = G.track.length;
  let closePass = false;
  P.drafting = false;
  for (const a of G.ai) {
    const dz = wrapDz(a.dist - P.dist);
    // bumping
    if (Math.abs(dz) < CAR_LEN && P.air <= 0 && U.overlap(P.x, CAR_W, a.x, CAR_W, 0.9)) {
      if (dz > 0 && P.speed > a.speed) {
        P.speed = a.speed * 0.82; P.dist += dz - CAR_LEN; P.prevDist = Math.min(P.prevDist, P.dist);
        Sound.sfx.bump(); G.shake = Math.max(G.shake, 0.45); P.nitroOn = false;
      } else if (dz <= 0 && a.speed > P.speed) {
        a.speed = P.speed * 0.9; a.dist -= CAR_LEN + dz;
        Sound.sfx.bump(); G.shake = Math.max(G.shake, 0.3);
      }
      const push = (P.x >= a.x ? 1 : -1) * 0.035;
      P.x += push; a.x -= push * 0.6;
    }
    // slipstream
    if (dz > CAR_LEN && dz < 16 * SEG_LEN && Math.abs(a.x - P.x) < 0.24 && P.speed > G.maxSpeed * 0.6) P.drafting = true;
    // overtakes
    const raw = a.dist - P.dist;
    if (G.state === 'race' && a.prevDz > 0 && raw <= 0) {
      if (Math.abs(P.x - a.x) < 0.42 && P.speed > G.maxSpeed * 0.5 && G.t - (a.passT || -9) > 3) {
        a.passT = G.t; closePass = true;
        P.nitro = Math.min(1, P.nitro + 0.12); Sound.sfx.nearMiss();
      } else Sound.sfx.pass();
    }
    a.prevDz = raw;
  }
  if (P.drafting) P.nitro = Math.min(1, P.nitro + 0.07 * dt);
  if (G.state === 'race') {
    const pos = racePos();
    const better = pos < G.lastPos && G.raceT > 1 && (G.t - (G.posPopT || -9) > 1.2 || pos < G.posPopV);
    if (better) { G.posPopT = G.t; G.posPopV = pos; popup(`${closePass ? 'CLOSE PASS! ' : ''}▲ ${U.ordinal(pos)}`, '#3df07a', true); }
    else if (closePass) popup('CLOSE PASS!', '#5ccaff');
    G.lastPos = pos;
  }
}

function racePos() {
  const P = G.P;
  if (P.finished) return P.place;
  let pos = 1;
  for (const a of G.ai) if (a.finished || a.dist > P.dist) pos++;
  return pos;
}

// ------------------------------------------------------------------ laps (Race + Time Trial)
function lapChecks() {
  const P = G.P, L = G.track.length;
  const lap = Math.floor(P.dist / L);
  if (lap <= P.lap) return;
  P.lap = lap;
  if (lap < 1) return;
  const lt = G.raceT - G.lapStart;
  G.lapStart = G.raceT;
  G.lapTimes.push(lt);
  if (lap >= laps()) { finish(); return; }
  Sound.sfx.lap();
  if (G.mode === 'trial') {
    const gt = ghostTimeAt(lap * L);
    G.lapDelta = gt != null ? { v: G.raceT - gt, t: G.t } : null;
    say(lap === laps() - 1 ? 'FINAL LAP' : `LAP ${lap + 1}`, `Lap time ${U.fmtTime(lt)}`, '#ffffff', 2);
  } else {
    say(lap === laps() - 1 ? 'FINAL LAP!' : `LAP ${lap + 1}`, null, '#ffffff', 1.6);
  }
}

// ------------------------------------------------------------------ Time Trial ghost
function trialChecks() {
  if (G.state === 'race' && (G.stepN - 1) % 4 === 0) G.ghostRec.push(Math.round(G.P.dist), Math.round(G.P.x * 1000));
}
function ghostAt(t) {
  const g = G.ghost;
  if (!g) return null;
  const d = g.d, n = d.length / 2;
  const fi = t / (STEP * 4);
  const i = Math.floor(fi);
  if (i >= n - 1) return { dist: d[(n - 1) * 2], x: d[(n - 1) * 2 + 1] / 1000 };
  const f = fi - i;
  return { dist: U.lerp(d[i * 2], d[i * 2 + 2], f), x: U.lerp(d[i * 2 + 1], d[i * 2 + 3], f) / 1000 };
}
function ghostTimeAt(dist) {
  const g = G.ghost;
  if (!g) return null;
  const d = g.d;
  for (let i = 0; i < d.length / 2 - 1; i++) {
    if (d[i * 2 + 2] >= dist) {
      const f = (dist - d[i * 2]) / Math.max(1, d[i * 2 + 2] - d[i * 2]);
      return (i + f) * STEP * 4;
    }
  }
  return null;
}
// medal times: based on a "perfect" lap that slows just enough for each bend
function trialPar() {
  const key = G.track.id + G.diff;
  if (G.parKey !== key) {
    const cf = G.D.centrifugal * (G.track.theme.slide || 1);
    let t = 0;
    for (const sg of G.track.segs) {
      const c = Math.abs(sg.curve);
      t += SEG_LEN / (G.maxSpeed * (c > 0.5 ? Math.min(1, Math.sqrt(1.25 / (c * cf))) : 1));
    }
    G.parKey = key; G.parIdeal = t * laps();
  }
  return G.D.trialPar.map((f) => Math.round(G.parIdeal * f * 10) / 10);
}

// ------------------------------------------------------------------ Dodge Run
const OBJ = {
  car: { w: CAR_W, len: 260, h: 380, solid: true },
  van: { w: 0.3, len: 300, h: 480, solid: true },
  truck: { w: 0.38, len: 440, h: 640, solid: true },
  cone: { w: 0.1, len: 60, h: 220, solid: true, light: true },
  barrel: { w: 0.125, len: 80, h: 280, solid: true, light: true },
  barrier: { w: 0.33, len: 80, h: 330, solid: true },
  coin: { w: 0.16, len: 150, collect: true },
  nitro: { w: 0.16, len: 150, collect: true },
  heart: { w: 0.16, len: 150, collect: true },
  ramp: { w: 0.4, len: 180 },
};

function dodgeUpdate(dt) {
  const P = G.P;
  if (G.state === 'race') {
    const m = (P.speed / BASE_MAX) * CONFIG.topKmh / 3.6 * dt;
    G.metres += m; G.score += m;
    const lvl = 1 + Math.floor(G.metres / 1000);
    if (lvl > G.level) { G.level = lvl; G.maxSpeed = dodgeMax(lvl); say(`LEVEL ${lvl}`, 'FASTER!', '#ffd23f', 1.6); Sound.sfx.level(); }
    if (G.combo > 1) { G.comboT -= dt; if (G.comboT <= 0) { G.combo--; G.comboT = 2.5; } }
    if (G.dodgeBest && !G.bestShown && G.score > G.dodgeBest) { G.bestShown = true; say('NEW BEST!', 'Keep going!', '#3df07a', 1.6); Sound.sfx.unlock(); }
    spawnAhead();
  }
  updateTraffic(dt);
  dodgeCollide();
  // tidy up things behind us
  for (let i = G.objs.length - 1; i >= 0; i--) {
    const o = G.objs[i];
    if (o.dead || o.dist < P.dist - 10 * SEG_LEN) {
      if (o.decals) for (const pair of o.decals) { const k = pair[0].decals.indexOf(pair[1]); if (k >= 0) pair[0].decals.splice(k, 1); }
      G.objs.splice(i, 1);
    }
  }
  G.dynDecals = G.dynDecals.filter(([seg, d]) => seg.decals.includes(d));
}

function addObj(type, dist, x, extra) {
  const o = Object.assign({ type, dist, x, air: 0, group: G.groupId }, OBJ[type], extra || {});
  if (!o.sp) {
    if (type === 'cone') o.sp = Art.cone();
    else if (type === 'barrel') o.sp = Art.barrel();
    else if (type === 'coin') o.sp = Art.coin();
    else if (type === 'nitro') o.sp = Art.nitroCan();
    else if (type === 'heart') o.sp = Art.heart();
    else if (type === 'ramp') o.sp = Art.ramp();
  }
  G.objs.push(o);
  return o;
}

function addTraffic(dist, x) {
  const r = Math.random();
  const body = r < 0.18 ? 'truck' : r < 0.38 ? 'van' : r < 0.7 ? 'sport' : 'muscle';
  const type = body === 'truck' ? 'truck' : body === 'van' ? 'van' : 'car';
  const color = body === 'truck' ? U.pick(Math.random, ['#f2f2f2', '#d8dde3', '#3b4a8c', '#c9a227']) : U.pick(Math.random, CONFIG.trafficColors);
  return addObj(type, dist, x, {
    sp: Art.car(color, body), speed: G.maxSpeed * (0.3 + Math.random() * 0.14), targetX: x,
    weave: Math.random() < G.D.weave && G.level >= 2, blink: 0, blinkT: 0,
  });
}

function addDecal(kind, startDist, x, w, len) {
  const segs = G.track.segs, N = segs.length;
  const s0 = Math.floor(U.mod(startDist, G.track.length) / SEG_LEN);
  const out = [];
  for (let k = 0; k < len; k++) {
    const seg = segs[(s0 + k) % N];
    const d = { kind, x0: x - w / 2, x1: x + w / 2, k };
    seg.decals.push(d); out.push([seg, d]); G.dynDecals.push([seg, d]);
  }
  // an invisible marker so the decal is removed once we've passed it
  addObj('coin', startDist + len * SEG_LEN, 99, { decals: out, collect: false, solid: false, sp: null, marker: true });
}

const lanePick = () => Math.floor(Math.random() * 3);
const S = SEG_LEN;

const PATTERNS = [
  { id: 'car', w: 4, lvl: 1, fn: (b) => { addTraffic(b, LANE_X[lanePick()]); return 6; } },
  { id: 'two', w: 2.5, lvl: 2, fn: (b) => {
    const free = lanePick(), ls = [0, 1, 2].filter((l) => l !== free);
    addTraffic(b, LANE_X[ls[0]]); addTraffic(b + Math.floor(Math.random() * 5) * S, LANE_X[ls[1]]); return 10; } },
  { id: 'cones', w: 3, lvl: 1, fn: (b) => {
    const open = lanePick();
    [0, 1, 2].forEach((l) => { if (l !== open) [-0.2, 0, 0.2].forEach((o) => addObj('cone', b, LANE_X[l] + o)); });
    for (let k = 0; k < 4; k++) addObj('coin', b + (k * 4 - 8) * S, LANE_X[open]);
    return 6; } },
  { id: 'slalom', w: 2, lvl: 2, fn: (b) => {
    let open = Math.random() < 0.5 ? 0 : 2;
    for (let k = 0; k < 3; k++) {
      [0, 1, 2].forEach((l) => { if (l !== open) addObj('barrel', b + k * 18 * S, LANE_X[l] + (Math.random() - 0.5) * 0.2); });
      addObj('coin', b + k * 18 * S, LANE_X[open]);
      open = open === 0 ? 2 : 0;
      G.groupId++;
    }
    return 40; } },
  { id: 'coins', w: 3, lvl: 1, fn: (b) => {
    const a = lanePick(), c = U.clamp(a + (Math.random() < 0.5 ? -1 : 1), 0, 2);
    for (let k = 0; k < 7; k++) addObj('coin', b + k * 4 * S, U.lerp(LANE_X[a], LANE_X[c], U.easeInOut(0, 1, k / 6)));
    return 28; } },
  { id: 'barrels', w: 2.5, lvl: 1, fn: (b) => {
    const l = lanePick(), x = LANE_X[l];
    addObj('barrel', b, x - 0.12); addObj('barrel', b, x + 0.12); addObj('barrel', b + 3 * S, x);
    G.groupId++;
    const l2 = (l + 1 + Math.floor(Math.random() * 2)) % 3;
    addObj('barrel', b + 12 * S, LANE_X[l2]);
    return 14; } },
  { id: 'works', w: 2, lvl: 2, fn: (b) => {
    const l = Math.random() < 0.5 ? 0 : 2, x = LANE_X[l], edge = l === 0 ? -1 : 1;
    [0, 3, 6].forEach((k, i) => addObj('cone', b + k * S, U.lerp(edge * 0.98, x + (x > 0 ? -0.2 : 0.2), (i + 1) / 3)));
    const on = Art.barrier(true), off = Art.barrier(false);
    for (let k = 9; k <= 21; k += 4) addObj('barrier', b + k * S, x, { sp: off, sp2: on, flash: true });
    if (G.level >= 4) addTraffic(b + 10 * S, 0);
    return 24; } },
  { id: 'ramp', w: 2, lvl: 2, fn: (b) => {
    const l = lanePick(), x = LANE_X[l];
    addObj('ramp', b, x);
    const nb = l === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
    G.groupId++;
    [l, nb].forEach((ll) => [-0.17, 0.17].forEach((o) => addObj('barrier', b + 24 * S, LANE_X[ll] + o, { sp: Art.barrier(false), sp2: Art.barrier(true), flash: true })));
    const sps = G.maxSpeed * 1.0 / S, vy = 2800;
    for (let k = 6; k <= 42; k += 6) {
      const tt = k / sps, hh = vy * tt - 0.5 * GRAVITY * tt * tt;
      if (hh > 150) addObj('coin', b + k * S, x, { air: hh });
    }
    return 30; } },
  { id: 'oil', w: 1.5, lvl: 3, fn: (b) => {
    const l = lanePick();
    addDecal('oil', b, LANE_X[l], 0.42, 4);
    const l2 = (l + 1 + Math.floor(Math.random() * 2)) % 3;
    addObj('cone', b + 2 * S, LANE_X[l2]);
    return 8; } },
  { id: 'pad', w: 1.6, lvl: 1, fn: (b) => {
    const l = lanePick();
    addDecal('pad', b, LANE_X[l], 0.42, 8);
    for (let k = 0; k < 5; k++) addObj('coin', b + (12 + k * 5) * S, LANE_X[l]);
    return 36; } },
  { id: 'jam', w: 2, lvl: 4, fn: (b) => {
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    order.forEach((l, i) => { G.groupId++; addTraffic(b + i * 10 * S, LANE_X[l]); });
    return 24; } },
  { id: 'heart', w: 1, lvl: 2, cond: () => G.P.lives < G.D.lives, fn: (b) => { addObj('heart', b, LANE_X[lanePick()]); return 4; } },
  { id: 'nitro', w: 1.2, lvl: 1, fn: (b) => { addObj('nitro', b, LANE_X[lanePick()]); return 4; } },
];

function spawnAhead() {
  const P = G.P;
  while (G.nextSpawn < P.dist + 230 * SEG_LEN) {
    const opts = PATTERNS.filter((p) => p.lvl <= G.level && p.id !== G.lastPattern && (!p.cond || p.cond()));
    const tot = opts.reduce((s, p) => s + p.w, 0);
    let v = Math.random() * tot, pat = opts[0];
    for (const p of opts) { if ((v -= p.w) <= 0) { pat = p; break; } }
    G.lastPattern = pat.id;
    G.groupId++;
    const used = pat.fn(G.nextSpawn);
    const segsPerSec = G.maxSpeed / SEG_LEN;
    const gapT = Math.max(0.55, 1.3 - 0.06 * (G.level - 1)) / G.D.density;
    G.nextSpawn += (used + gapT * segsPerSec) * SEG_LEN;
  }
}

function laneFree(lx, from, to, self) {
  for (const q of G.objs) {
    if (q === self || !q.solid || q.dead) continue;
    if (q.dist >= from && q.dist <= to && Math.abs(q.x - lx) < (q.w + self.w) / 2 + 0.03) return false;
  }
  return true;
}

function updateTraffic(dt) {
  const P = G.P;
  for (const o of G.objs) {
    if (o.knock) {
      o.knock.vy -= GRAVITY * dt; o.air += o.knock.vy * dt; o.x += o.knock.vx * dt; o.dist += o.knock.vz * dt;
      if (o.air < 0 && o.knock.vy < 0) o.dead = true;
      continue;
    }
    if (o.flash) o.flashOn = Math.floor(G.t * 3 + o.dist * 0.001) % 2 === 0;
    if (o.speed == null) continue;
    let blocker = null, bdz = Infinity;
    for (const q of G.objs) {
      if (q === o || !q.solid || q.dead) continue;
      const dz = q.dist - o.dist;
      if (dz > 0 && dz < 12 * SEG_LEN && dz < bdz && Math.abs(q.x - o.x) < (q.w + o.w) / 2 + 0.04) { blocker = q; bdz = dz; }
    }
    if (blocker && o.blinkT <= 0 && Math.abs(o.x - o.targetX) < 0.02) {
      let best = null;
      for (const lx of LANE_X) {
        if (Math.abs(lx - o.x) < 0.1) continue;
        if (laneFree(lx, o.dist - 4 * SEG_LEN, o.dist + 16 * SEG_LEN, o) && (best === null || Math.abs(lx - o.x) < Math.abs(best - o.x))) best = lx;
      }
      if (best !== null) { o.targetX = best; o.blink = Math.sign(best - o.x); o.blinkT = 0.25; }
    }
    if (blocker && bdz < 5 * SEG_LEN) o.speed = Math.min(o.speed, blocker.speed || 0);
    if (o.weave && !o.weaved) {
      const dz = o.dist - P.dist;
      if (dz < 30 * SEG_LEN && dz > 12 * SEG_LEN) {
        o.weaved = true;
        const li = LANE_X.findIndex((lx) => Math.abs(lx - o.x) < 0.1);
        const cands = [li - 1, li + 1].filter((k) => k >= 0 && k < 3 && laneFree(LANE_X[k], o.dist - 4 * SEG_LEN, o.dist + 10 * SEG_LEN, o));
        if (cands.length) { const k = U.pick(Math.random, cands); o.targetX = LANE_X[k]; o.blink = Math.sign(o.targetX - o.x); o.blinkT = 0.7; }
      }
    }
    if (o.blinkT > 0) o.blinkT -= dt;
    else o.x = U.approach(o.x, o.targetX, dt * 0.85);
    if (Math.abs(o.x - o.targetX) < 0.01 && o.blinkT <= 0) o.blink = 0;
    o.dist += o.speed * dt;
  }
}

function dodgeCollide() {
  const P = G.P;
  if (G.state !== 'race') return;
  for (const o of G.objs) {
    if (o.dead || o.marker || o.knock) continue;
    const zHit = (o.dist - o.len / 2) <= (P.dist + CAR_LEN / 2) && (o.dist + o.len / 2) >= (P.prevDist - CAR_LEN / 2);
    if (zHit && U.overlap(P.x, CAR_W, o.x, o.w)) hitObj(o);
    else if (!o.passed && o.dist + o.len / 2 < P.dist - CAR_LEN / 2) {
      o.passed = true;
      if (o.solid && !o.hit && !o.cleared) nearMiss(o);
    }
    if (G.state !== 'race') return;
  }
}

function hitObj(o) {
  const P = G.P;
  if (o.collect) {
    const ok = o.air > 0 ? (P.air > o.air - 300 && P.air < o.air + 350) : P.air < 260;
    if (!ok) return;
    o.dead = true;
    if (o.type === 'coin') { G.coins++; const pts = 10 * G.combo; G.score += pts; if (G.combo > 1) G.comboT = Math.max(G.comboT, 2); Sound.sfx.coin(); sparkle('#ffd23f'); popup(`+${pts}`, '#ffd23f'); }
    else if (o.type === 'nitro') { P.nitro = Math.min(1, P.nitro + 0.4); Sound.sfx.nitro(); sparkle('#5ccaff'); popup('+NITRO', '#5ccaff'); }
    else if (o.type === 'heart') { P.lives = Math.min(G.D.lives, P.lives + 1); Sound.sfx.heart(); sparkle('#ff5a7a'); popup('+1 LIFE', '#ff5a7a', true); }
    return;
  }
  if (o.type === 'ramp') {
    if (!o.used && P.air <= 0) {
      o.used = true; P.vy = 2800; P.air = 1; G.jumps++;
      Sound.sfx.jump(); popup('JUMP!', '#ffd23f', true);
    }
    return;
  }
  if (o.hit || o.cleared) return;
  if (P.air > o.h * 0.8) {
    if (!G.groupSeen.has('air' + o.group)) {
      G.groupSeen.add('air' + o.group);
      const pts = 100 * G.combo; G.score += pts; G.combo = Math.min(9, G.combo + 1); G.comboT = 3.5;
      popup(`BIG AIR! +${pts}`, '#3df07a', true); Sound.sfx.nearMiss();
    }
    o.cleared = true;
    return;
  }
  if (P.invT > 0) { if (o.light) knock(o); return; }
  o.hit = true;
  if (o.light) knock(o);
  if (o.speed != null) { P.speed = Math.min(P.speed, o.speed * 0.7); o.speed *= 1.15; }
  else P.speed *= 0.35;
  loseLife();
}

function knock(o) {
  const P = G.P;
  o.hit = true;
  o.knock = { vy: 1600 + Math.random() * 900, vx: (o.x >= P.x ? 1 : -1) * (0.8 + Math.random()), vz: P.speed * 0.9 };
  Sound.sfx.knock();
}

function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ } }

function loseLife() {
  const P = G.P;
  buzz(120);
  P.lives--; P.invT = 1.8; P.nitroOn = false;
  G.combo = 1; G.comboT = 0;
  G.shake = 1.1;
  Sound.sfx.crash(); sparks();
  if (P.lives <= 0) { gameOver(); return; }
  popup(P.lives === 1 ? 'LAST LIFE!' : 'OUCH!', '#ff5a5a', true);
}

function nearMiss(o) {
  const P = G.P;
  const gap = Math.abs(P.x - o.x) - (CAR_W + o.w) / 2;
  if (gap > 0.13 || P.speed < G.maxSpeed * 0.45 || P.air > 120 || P.invT > 0) return;
  if (G.groupSeen.has(o.group)) return;
  G.groupSeen.add(o.group);
  G.combo = Math.min(9, G.combo + 1); G.comboT = 3.5; G.nearMisses++;
  const pts = 50 * G.combo; G.score += pts;
  P.nitro = Math.min(1, P.nitro + 0.12);
  popup(`NEAR MISS +${pts}`, '#5ccaff'); Sound.sfx.nearMiss();
}

// ------------------------------------------------------------------ the end
function finish() {
  const P = G.P;
  P.finished = true;
  P.nitroOn = false;
  G.state = 'done'; G.doneT = 0; G.resultShown = false;
  Sound.sfx.finish();
  const before = Store.totalStars();
  let res;
  if (G.mode === 'race') {
    const place = 1 + G.ai.filter((a) => a.finished).length;
    P.place = place;
    const stars = place === 1 ? 3 : place === 2 ? 2 : place === 3 ? 1 : 0;
    const key = recordKey('race', G.trackIdx, G.diff);
    const isBest = saveRecord(key, stars, place, (a, b) => a < b);
    say(place === 1 ? 'YOU WIN!' : 'FINISH!', U.ordinal(place) + ' place', place === 1 ? '#ffd23f' : '#ffffff', 3);
    const order = [{ name: 'You', you: true, t: G.raceT }].concat(G.ai.filter((a) => a.finished).map((a) => ({ name: a.name, t: a.finishT, color: a.color })));
    order.sort((a, b) => a.t - b.t);
    const rest = G.ai.filter((a) => !a.finished).sort((a, b) => b.dist - a.dist).map((a) => ({ name: a.name, color: a.color }));
    res = {
      mode: 'race', stars, isBest,
      title: place === 1 ? 'YOU WIN!' : `${U.ordinal(place)} PLACE`,
      sub: place === 1 ? 'Fastest on the track!' : place <= 3 ? 'On the podium!' : 'So close — go again!',
      standings: order.concat(rest),
      lines: [['Race time', U.fmtTime(G.raceT)], ['Best lap', U.fmtTime(Math.min(...G.lapTimes))]],
    };
  } else {
    const time = G.raceT;
    const par = trialPar();
    const stars = time <= par[2] ? 3 : time <= par[1] ? 2 : time <= par[0] ? 1 : 0;
    const key = recordKey('trial', G.trackIdx, G.diff);
    const prev = (Store.data.records[key] || {}).best;
    const isBest = saveRecord(key, stars, time, (a, b) => a < b);
    if (isBest) {
      Store.data.ghosts[ghostKey()] = { d: G.ghostRec, t: time };
      Store.save();
    }
    say(isBest ? 'NEW RECORD!' : 'FINISH!', U.fmtTime(time), isBest ? '#3df07a' : '#ffffff', 3);
    const medal = ['No medal', 'Bronze', 'Silver', 'Gold'][stars];
    res = {
      mode: 'trial', stars, isBest,
      title: stars ? `${medal.toUpperCase()}!` : 'FINISHED',
      sub: isBest ? (prev != null ? `New record — ${(prev - time).toFixed(2)}s faster!` : 'First record set — now beat your ghost!') : `Best: ${U.fmtTime(prev)}`,
      lines: [['Time', U.fmtTime(time)]].concat(G.lapTimes.map((t, i) => [`Lap ${i + 1}`, U.fmtTime(t)]))
        .concat([['Gold / Silver / Bronze', par.slice().reverse().map((p) => U.fmtTime(p)).join('  ·  ')]]),
      next: stars < 3 ? `Gold time: ${U.fmtTime(par[2])}` : null,
    };
  }
  res.unlocked = unlocksBetween(before, Store.totalStars());
  G.result = res;
}

function gameOver() {
  const P = G.P;
  P.finished = true;
  G.state = 'done'; G.doneT = 0; G.resultShown = false;
  Sound.sfx.lose();
  say('GAME OVER', null, '#ff5a5a', 3);
  const score = Math.floor(G.score);
  const th = G.D.dodgeStars;
  const stars = score >= th[2] ? 3 : score >= th[1] ? 2 : score >= th[0] ? 1 : 0;
  const before = Store.totalStars();
  const key = recordKey('dodge', G.trackIdx, G.diff);
  const prev = (Store.data.records[key] || {}).best;
  const isBest = saveRecord(key, stars, score, (a, b) => a > b);
  G.result = {
    mode: 'dodge', stars, isBest,
    title: isBest ? 'NEW HIGH SCORE!' : 'GAME OVER',
    sub: isBest ? (prev != null ? `Beat your best by ${score - prev}!` : 'First score on the board!') : `Best: ${prev}`,
    big: score.toLocaleString(),
    lines: [['Distance', `${Math.floor(G.metres).toLocaleString()} m`], ['Coins', G.coins], ['Near misses', G.nearMisses], ['Reached', `Level ${G.level}`]],
    next: stars < 3 ? `${th[stars].toLocaleString()} points for ${'★'.repeat(stars + 1)}` : null,
    unlocked: unlocksBetween(before, Store.totalStars()),
  };
}

function saveRecord(key, stars, value, better) {
  const rec = Store.data.records[key] || { stars: 0, best: null };
  const isBest = rec.best == null || better(value, rec.best);
  if (isBest) rec.best = value;
  rec.stars = Math.max(rec.stars || 0, stars);
  Store.data.records[key] = rec;
  Store.save();
  return isBest;
}

function unlocksBetween(a, b) {
  return PAINTS.filter((p) => p.stars > a && p.stars <= b).map((p) => p.name + ' paint')
    .concat(BODIES.filter((p) => p.stars > a && p.stars <= b).map((p) => p.name + ' car'));
}

// ------------------------------------------------------------------ sound of the engine
function engine(ctrl) {
  if (!Sound.ready) return;
  const P = G.P;
  const on = G.state === 'race' || G.state === 'countdown' || G.state === 'done';
  let rpm, load;
  if (G.state === 'countdown') {
    if (ctrl.gas || ctrl.nitro) { rpm = 0.75 + Math.random() * 0.08; load = 1; } else { rpm = 0.12; load = 0.1; }
  } else {
    const sp = P.speed / BASE_MAX;
    const g = Math.min(5, Math.floor(sp * 5.2));
    rpm = 0.2 + (sp * 5.2 - g) * 0.7 + g * 0.03;
    load = ctrl.gas || G.autoGas ? 1 : 0.2;
  }
  let screech = G.state === 'race' ? U.clamp((P.drift - 1.1) / 1.4, 0, 1) : 0;
  if (P.braking && P.speed > G.maxSpeed * 0.5) screech = Math.max(screech, 0.6);
  if (P.air > 0) screech = 0;
  Sound.engineUpdate(rpm, load, P.nitroOn || P.boostT > 0, P.offroad && P.speed > 500, screech, on && !Sound.muted);
}

// ------------------------------------------------------------------ drawing
function buildItems() {
  const m = G.items; m.clear();
  const L = G.track.length, N = G.track.segs.length, P = G.P;
  const camZ = P.dist - PLAYER_Z;
  const add = (dist, it) => {
    if (U.mod(dist - camZ, L) > DRAW_DIST * SEG_LEN) return;
    const z = U.mod(dist, L);
    const idx = Math.floor(z / SEG_LEN) % N;
    it.percent = (z % SEG_LEN) / SEG_LEN;
    let arr = m.get(idx);
    if (!arr) m.set(idx, (arr = []));
    arr.push(it);
  };
  for (const a of G.ai) add(a.dist, { x: a.x, sp: a.braking ? a.brakeSprite : a.sprite, shadow: true });
  if (G.mode === 'trial' && G.ghost) {
    const g = ghostAt(G.state === 'countdown' ? 0 : G.raceT);
    if (g && Math.abs(wrapDz(g.dist - P.dist)) > 30) add(g.dist, { x: g.x, sp: G.ghostSprite, alpha: 0.6 });
  }
  if ((G.mode === 'race' || G.mode === 'trial') && G.state !== 'done') {
    const can = Art.nitroCan();
    for (const pk of G.track.pickups) {
      const d = pk.seg * SEG_LEN;
      const absD = P.dist + U.mod(d - P.dist, L);
      if (pk.lap === Math.floor(absD / L)) continue;
      add(d, { x: pk.x, sp: can, lift: 90 + Math.sin(G.t * 4 + pk.seg) * 40 });
    }
  }
  if (G.mode === 'dodge') {
    for (const o of G.objs) {
      if (o.dead || o.marker || !o.sp) continue;
      const it = { x: o.x, sp: o.flash && o.flashOn ? o.sp2 : o.sp, lift: o.air };
      if (o.type === 'coin') { it.scaleX = 0.2 + Math.abs(Math.cos(G.t * 5 + o.dist * 0.002)) * 0.8; it.lift = (o.air || 0) + 60 + Math.sin(G.t * 5 + o.dist) * 20; }
      else if (o.type === 'nitro' || o.type === 'heart') it.lift = 90 + Math.sin(G.t * 4 + o.dist) * 40;
      else if (o.speed != null) { it.shadow = true; it.blink = o.blink && Math.floor(G.t * 6) % 2 === 0 ? o.blink : 0; }
      add(o.dist, it);
    }
  }
}

function render(dt) {
  if (!G.track || !G.P) return;
  const P = G.P;
  buildItems();
  const frames = G.car.frames;
  const fr = frames.length > 1 ? frames[Math.floor(G.t * 8) % frames.length] : frames[0];
  const speedPct = P.speed / G.maxSpeed;
  const view = {
    track: G.track, camZ: P.dist - PLAYER_Z, playerX: P.x, bgOff: G.bgOff, items: G.items, shake: G.shake,
    car: {
      sprite: P.braking ? fr[1] : fr[0], steer: P.steerVis, air: P.air,
      bounce: (Math.random() - 0.5) * Math.min(1, speedPct) * (P.offroad ? 5 : 1.2),
      spin: P.spinT > 0 ? Math.sin(P.spinT * 22) * 0.4 : 0,
      alpha: P.invT > 0 ? (Math.floor(G.t * 12) % 2 ? 0.35 : 1) : 1,
      flame: P.nitroOn ? 1 : P.boostT > 0 ? 0.8 : 0, flameColor: P.nitroOn ? 'blue' : 'orange',
      exX: G.car.exX, exY: G.car.exY,
    },
  };
  R.renderWorld(view);

  const boosting = P.nitroOn || P.boostT > 0;
  R.speedLines(boosting ? 1 : U.clamp((speedPct - 0.93) * 8, 0, 0.6), G.t);
  if (P.nitroOn) R.nitroVignette(1);
  if (G.track.themeId === 'snow') R.snow(dt, Math.min(1.3, speedPct));
  const cs = R.carScreen;
  if (cs && G.state !== 'paused') {
    if (P.offroad && P.speed > G.maxSpeed * 0.2) R.emit(cs.x + (Math.random() - 0.5) * cs.w, cs.ground, 2, { color: G.track.theme.dust, vx: 1.5, vy: 0.8, life: 0.5, size: 1.4, spread: 0 });
    if (G.state === 'race' && P.drift > 1.6 && P.air <= 0) R.emit(cs.x + (Math.random() < 0.5 ? -1 : 1) * cs.w * 0.38, cs.ground, 1, { color: 'rgba(230,230,230,0.6)', vx: 1, vy: 0.5, life: 0.5, size: 1.6, grav: -0.2 });
  }
  R.drawParticles(dt);

  if (G.state !== 'menu') drawHud();
}

// ------------------------------------------------------------------ HUD
function drawHud() {
  const u = R.u, w = R.w, h = R.h, P = G.P, c = R.ctx;
  const pad = u * 2;
  const pw = u * 26;

  // left panel
  if (G.mode === 'race') {
    const pw2 = u * 30;
    R.panel(pad, pad, pw2, u * 13);
    const pos = racePos();
    R.text(String(pos), pad + u * 2, pad + u * 7, u * 10, '#ffd23f', 'left');
    c.font = `${Math.round(u * 10)}px ${FONT}`;
    const pwid = c.measureText(String(pos)).width;
    R.text(U.ordinal(pos).replace(/\d+/, ''), pad + u * 2.6 + pwid, pad + u * 4.6, u * 3.4, '#ffd23f', 'left');
    R.text(`/${G.ai.length + 1}`, pad + u * 2.6 + pwid, pad + u * 9, u * 3, '#ffffff', 'left');
    R.text('LAP', pad + pw2 - u * 2, pad + u * 3.2, u * 2.2, '#c8cbe0', 'right');
    R.text(`${U.clamp(P.lap + 1, 1, laps())}/${laps()}`, pad + pw2 - u * 2, pad + u * 6.8, u * 4.2, '#ffffff', 'right');
    R.text(U.fmtTime(G.raceT), pad + pw2 - u * 2, pad + u * 10.5, u * 2.6, '#ffffff', 'right');
    drawMinimap(pad, pad + u * 14.5, u * 16);
  } else if (G.mode === 'trial') {
    const pw2 = u * 30;
    R.panel(pad, pad, pw2, u * 19.5);
    R.text(U.fmtTime(G.raceT), pad + u * 2, pad + u * 4.8, u * 5.4, '#ffffff', 'left');
    R.text(`LAP ${U.clamp(P.lap + 1, 1, laps())}/${laps()}`, pad + u * 2, pad + u * 9.6, u * 3, '#ffd23f', 'left');
    const best = (Store.data.records[recordKey('trial', G.trackIdx, G.diff)] || {}).best;
    if (G.lapDelta && G.t - G.lapDelta.t < 6) {
      const d = G.lapDelta.v;
      R.text(`${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}s`, pad + pw2 - u * 2, pad + u * 9.6, u * 3, d <= 0 ? '#3df07a' : '#ff6a6a', 'right');
    }
    R.text(best != null ? `YOUR BEST ${U.fmtTime(best)}` : 'NO GHOST YET', pad + u * 2, pad + u * 16.6, u * 2.3, '#a8ecff', 'left');
    const par = trialPar();
    const medalCols = ['#d08a4a', '#c9d3de', '#ffd23f'], medalNames = ['BRONZE', 'SILVER', 'GOLD'];
    const mi = G.raceT <= par[2] ? 2 : G.raceT <= par[1] ? 1 : G.raceT <= par[0] ? 0 : -1;
    if (mi >= 0) {
      c.fillStyle = medalCols[mi]; c.beginPath(); c.arc(pad + u * 3.2, pad + u * 13.2, u * 1.1, 0, Math.PI * 2); c.fill();
      R.text(`${medalNames[mi]}  ${U.fmtTime(par[mi])}`, pad + u * 5, pad + u * 13.2, u * 2.4, medalCols[mi], 'left');
    } else R.text('no medal this time', pad + u * 2, pad + u * 13.2, u * 2.4, '#ff9a9a', 'left');
    drawMinimap(pad, pad + u * 21, u * 16);
  } else {
    R.panel(pad, pad, pw, u * 16.5);
    R.text(Math.floor(G.score).toLocaleString(), pad + u * 2, pad + u * 5.4, u * 6, '#ffd23f', 'left');
    const hs = Art.heart();
    for (let i = 0; i < G.D.lives; i++) {
      c.globalAlpha = i < P.lives ? 1 : 0.22;
      c.drawImage(hs.img, pad + u * 2 + i * u * 4.1, pad + u * 8.2, u * 3.6, u * 3.3);
    }
    c.globalAlpha = 1;
    if (G.dodgeBest) R.text(G.score > G.dodgeBest ? 'NEW BEST!' : `BEST ${G.dodgeBest.toLocaleString()}`, pad + pw - u * 2, pad + u * 5.4, u * 2.3, G.score > G.dodgeBest ? '#3df07a' : '#a8ecff', 'right');
    R.text(`${Math.floor(G.metres).toLocaleString()} m`, pad + u * 2, pad + u * 14, u * 2.8, '#ffffff', 'left');
    R.text(`LEVEL ${G.level}`, pad + pw - u * 2, pad + u * 14, u * 2.8, '#a8ecff', 'right');
    if (G.combo > 1) {
      const cx = pad + pw + u * 6, cy = pad + u * 6;
      c.fillStyle = 'rgba(10,12,40,0.6)'; c.beginPath(); c.arc(cx, cy, u * 4.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ff5fb3'; c.lineWidth = u * 0.8; c.beginPath(); c.arc(cx, cy, u * 4.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * U.clamp(G.comboT / 3.5, 0, 1)); c.stroke();
      R.text(`×${G.combo}`, cx, cy + u * 0.2, u * 4, '#ffffff', 'center');
    }
  }

  // right panel: speed + nitro
  const rw = u * 24, rx = w - pad - rw;
  R.panel(rx, pad, rw, u * 13.5);
  const kmh = Math.round((P.speed / BASE_MAX) * CONFIG.topKmh);
  R.text(String(kmh), rx + rw - u * 8.5, pad + u * 5.6, u * 7, (P.nitroOn || P.boostT > 0) ? '#5ccaff' : '#ffffff', 'right');
  R.text('km/h', rx + rw - u * 2, pad + u * 6.4, u * 2.6, '#c8cbe0', 'right');
  const bx = rx + u * 2, by = pad + u * 9.2, bw = rw - u * 4, bh = u * 2.6;
  c.fillStyle = 'rgba(255,255,255,0.15)'; Art.rr(c, bx, by, bw, bh, bh / 2); c.fill();
  if (P.nitro > 0.01) {
    const full = P.nitro > 0.98 && Math.floor(G.t * 4) % 2 === 0;
    const g = c.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#1f7bff'); g.addColorStop(1, full ? '#ffffff' : '#5ce1ff');
    c.fillStyle = g; Art.rr(c, bx, by, Math.max(bh, bw * P.nitro), bh, bh / 2); c.fill();
  }
  R.text(P.drafting ? 'SLIPSTREAM' : 'NITRO', bx + bw / 2, by + bh / 2 + u * 0.1, u * 1.9, '#ffffff', 'center', { strokeW: 0.25 });
  UI.setNitroFill(P.nitro, P.nitroOn);

  // countdown
  if (G.state === 'countdown') {
    const n = Math.ceil(G.cd);
    const f = 1 - (G.cd - Math.floor(G.cd));
    const scale = 1 + (1 - Math.min(1, f * 3)) * 0.5;
    const txt = n > 3 ? 'READY' : String(n);
    R.text(txt, w / 2, h * 0.27, u * (n > 3 ? 9 : 16) * scale, n > 3 ? '#ffffff' : '#ffd23f', 'center', { strokeW: 0.14 });
    const tip = G.mode === 'dodge' ? 'Dodge everything · grab coins · near misses build your combo' :
      G.mode === 'trial' ? (G.ghost ? 'Beat your ghost car!' : 'Set a time — your ghost will race you next go') : 'Overtake all 5 cars to win';
    R.text(tip, w / 2, h * 0.52, u * 2.8, '#ffffff', 'center');
    R.text(G.autoGas ? 'Tap NITRO right on GO for a turbo start!' : 'Press GAS right on GO for a turbo start!', w / 2, h * 0.58, u * 2.4, '#a8ecff', 'center');
  }

  // big message
  if (G.msg) {
    const m = G.msg, a = U.clamp(Math.min(m.t * 6, (m.dur - m.t) * 3), 0, 1);
    const s = 1 + Math.max(0, 0.25 - m.t) * 1.6;
    c.globalAlpha = a;
    R.text(m.text, w / 2, h * 0.3, u * 8 * s, m.color, 'center', { strokeW: 0.14 });
    if (m.sub) R.text(m.sub, w / 2, h * 0.3 + u * 7, u * 3.4, '#ffffff', 'center');
    c.globalAlpha = 1;
  }
  // small popups over the car
  const cs = R.carScreen;
  if (cs) {
    const n = G.popups.length;
    G.popups.forEach((p, i) => {
      c.globalAlpha = U.clamp((1.1 - p.t) * 3, 0, 1);
      R.text(p.text, w / 2, cs.y - cs.h * 1.2 - p.t * u * 6 - (n - 1 - i) * u * 4.6, u * (p.big ? 4.2 : 3.2), p.color, 'center');
    });
    c.globalAlpha = 1;
  }
}

function drawMinimap(x, y, size) {
  const c = R.ctx, u = R.u, map = G.track.map, n = map.length;
  const bw = map[0][2], bh = map[0][3];
  const s = size * 0.82, ox = x + (size - bw * s) / 2 + u * 0.6, oy = y + (size - bh * s) / 2;
  R.panel(x, y, size + u * 1.2, size, 0.4);
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = u * 0.55; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i < n; i += 4) { const p = map[i]; i === 0 ? c.moveTo(ox + p[0] * s, oy + p[1] * s) : c.lineTo(ox + p[0] * s, oy + p[1] * s); }
  c.closePath(); c.stroke();
  const dot = (dist, col, r) => {
    const p = map[Math.floor(U.mod(dist, G.track.length) / SEG_LEN) % n];
    c.fillStyle = col; c.beginPath(); c.arc(ox + p[0] * s, oy + p[1] * s, r, 0, Math.PI * 2); c.fill();
  };
  const sp = map[0];
  c.fillStyle = '#ffd23f'; c.fillRect(ox + sp[0] * s - u * 0.6, oy + sp[1] * s - u * 0.6, u * 1.2, u * 1.2);
  if (G.mode === 'trial' && G.ghost) { const g = ghostAt(G.raceT); if (g) dot(g.dist, 'rgba(168,236,255,0.8)', u * 0.8); }
  for (const a of G.ai) dot(a.dist, a.color, u * 0.8);
  c.strokeStyle = '#000'; c.lineWidth = u * 0.3;
  dot(G.P.dist, '#ffffff', u * 1.1);
}

// ------------------------------------------------------------------ controls (pause etc.)
function pauseGame() {
  if (G.state !== 'race' && G.state !== 'countdown') return;
  G.pausedFrom = G.state; G.state = 'paused';
  Sound.engineUpdate(0, 0, false, false, 0, false);
  UI.showPause();
}
function resumeGame() {
  if (G.state !== 'paused') return;
  G.state = G.pausedFrom || 'race';
  UI.hidePause();
}

// ------------------------------------------------------------------ main loop
let lastT = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 8) { update(STEP); acc -= STEP; steps++; }
  if (steps === 8) acc = 0;
  render(dt);
  requestAnimationFrame(frame);
}
