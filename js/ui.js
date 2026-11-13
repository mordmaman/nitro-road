// Menus, garage, results, pause screen, touch buttons and keyboard — then it starts everything.

const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const MODES = {
    race: { icon: '🏁', name: 'Race', blurb: 'Beat 5 computer cars over 3 laps' },
    trial: { icon: '⏱️', name: 'Time Trial', blurb: 'Race your own ghost for gold' },
    dodge: { icon: '🚧', name: 'Dodge Run', blurb: 'Swerve, jump & collect — how far?' },
  };
  let sel = { mode: 'race', track: 0, diff: 'medium' };
  let touchMode = false;

  // ---------------------------------------------------------------- menu
  function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  function bestText(mode, rec) {
    if (!rec || rec.best == null) return 'Not raced yet';
    if (mode === 'race') return 'Best: ' + U.ordinal(rec.best);
    if (mode === 'trial') return 'Best: ' + U.fmtTime(rec.best);
    return 'Best: ' + rec.best.toLocaleString();
  }

  function renderMenu() {
    const recs = Store.data.records;
    document.querySelectorAll('#modeList .mode').forEach((b) => {
      const m = b.dataset.mode;
      b.classList.toggle('on', m === sel.mode);
      let s = 0;
      for (const k in recs) if (k.startsWith(m + '|')) s += recs[k].stars || 0;
      b.querySelector('.mstars').textContent = `★ ${s}/36`;
    });
    const list = $('trackList');
    list.innerHTML = '';
    TRACK_DEFS.forEach((t, i) => {
      const th = THEMES[t.theme];
      const rec = recs[recordKey(sel.mode, i, sel.diff)];
      const b = document.createElement('button');
      b.className = 'track' + (i === sel.track ? ' on' : '');
      b.innerHTML = `<span class="sw" style="background:${th.swatch}"></span><span class="tinfo"><b>${th.name}</b><span class="stars">${starStr(rec ? rec.stars : 0)}</span><small>${bestText(sel.mode, rec)}</small></span>`;
      b.addEventListener('click', () => { Sound.init(); Sound.sfx.click(); sel.track = i; saveSel(); renderMenu(); if (G.state === 'menu') startDemo(i); });
      list.appendChild(b);
    });
    document.querySelectorAll('#diffSeg button').forEach((b) => b.classList.toggle('on', b.dataset.diff === sel.diff));
    $('starTotal').textContent = Store.totalStars();
    $('autoGas').checked = G.autoGas;
    $('modeBlurb').textContent = MODES[sel.mode].blurb;
  }

  function saveSel() { Store.data.last = sel; Store.save(); }

  function showMenu() {
    hideAll();
    $('menu').classList.remove('hidden');
    $('hudBtns').classList.add('menu');
    showTouch(false);
    renderMenu();
  }

  function hideAll() {
    ['menu', 'garage', 'results', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  }

  function toMenu() {
    hideAll();
    startDemo(sel.track);
    showMenu();
  }

  function blurBtn() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }

  function go() {
    blurBtn();
    Sound.init();
    Sound.sfx.click();
    hideAll();
    $('hudBtns').classList.remove('menu');
    showTouch(touchMode);
    tryFullscreen();
    startGame(sel.mode, sel.track, sel.diff);
  }

  function tryFullscreen() {
    if (!touchMode) return;
    const standalone = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone || document.fullscreenElement) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el);
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
    } catch (e) { /* not allowed */ }
  }

  // ---------------------------------------------------------------- garage
  function showGarage() {
    hideAll();
    $('garage').classList.remove('hidden');
    renderGarage();
  }

  function renderGarage() {
    const total = Store.totalStars();
    const pg = $('paintGrid');
    pg.innerHTML = '';
    PAINTS.forEach((p) => {
      const b = document.createElement('button');
      const locked = total < p.stars;
      b.className = 'paint' + (Store.data.paint === p.id ? ' on' : '') + (locked ? ' locked' : '');
      b.title = p.name;
      b.style.background = p.color === 'rainbow' ? 'conic-gradient(#ff4d4d,#ffd23f,#3ddc57,#18c6c6,#1f7bff,#8f4bff,#ff5fb3,#ff4d4d)' : p.color;
      b.innerHTML = locked ? `<span class="lock">🔒<small>${p.stars}★</small></span>` : '';
      b.addEventListener('click', () => {
        if (locked) { flashNote(`Earn ${p.stars} stars to unlock ${p.name}`); return; }
        Sound.sfx.click(); Store.data.paint = p.id; Store.save(); buildCarSprites(); renderGarage();
      });
      pg.appendChild(b);
    });
    const bg = $('bodyGrid');
    bg.innerHTML = '';
    BODIES.forEach((p) => {
      const locked = total < p.stars;
      const b = document.createElement('button');
      b.className = 'body' + (Store.data.body === p.id ? ' on' : '') + (locked ? ' locked' : '');
      b.innerHTML = locked ? `🔒 ${p.name} <small>${p.stars}★</small>` : p.name;
      b.addEventListener('click', () => {
        if (locked) { flashNote(`Earn ${p.stars} stars to unlock the ${p.name}`); return; }
        Sound.sfx.click(); Store.data.body = p.id; Store.save(); buildCarSprites(); renderGarage();
      });
      bg.appendChild(b);
    });
    const next = PAINTS.concat(BODIES).filter((p) => p.stars > total).sort((a, b) => a.stars - b.stars)[0];
    $('garageNote').textContent = next ? `★ ${total} stars — ${next.stars - total} more to unlock ${next.name}` : `★ ${total} stars — everything unlocked!`;
    drawGaragePreview();
  }

  function drawGaragePreview() {
    const cv = $('garageCar');
    const r = Math.min(window.devicePixelRatio || 1, 2);
    const cw = cv.clientWidth || 260, ch = cv.clientHeight || 150;
    cv.width = cw * r; cv.height = ch * r;
    const c = cv.getContext('2d');
    c.scale(r, r);
    const g = c.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#1b1f4a'); g.addColorStop(0.6, '#2c2f6a'); g.addColorStop(0.6, '#4a4d60'); g.addColorStop(1, '#2b2d3a');
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 4; i++) c.fillRect(cw / 2 - 3, ch * 0.62 + i * ch * 0.1, 6, ch * 0.05);
    const fr = G.car.frames[0][0];
    const w = cw * 0.62, h = w * fr.aspect;
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(cw / 2, ch * 0.92, w * 0.52, w * 0.06, 0, 0, Math.PI * 2); c.fill();
    c.drawImage(fr.img, (cw - w) / 2, ch * 0.92 - h, w, h);
  }

  let noteT = null;
  function flashNote(text) {
    const n = $('garageNote');
    n.textContent = text; n.classList.add('warn');
    clearTimeout(noteT);
    noteT = setTimeout(() => { n.classList.remove('warn'); renderGarage(); }, 1800);
  }

  // ---------------------------------------------------------------- results
  function showResults(res) {
    hideAll();
    showTouch(false);
    $('hudBtns').classList.add('menu');
    const box = $('results');
    box.classList.remove('hidden');
    $('resTitle').textContent = res.title;
    $('resSub').textContent = res.sub || '';
    $('resBig').textContent = res.big || '';
    $('resBig').classList.toggle('hidden', !res.big);
    const st = $('resStars');
    st.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'rstar';
      s.textContent = '★';
      st.appendChild(s);
      if (i < res.stars) setTimeout(() => { s.classList.add('on'); Sound.sfx.star(i); }, 350 + i * 320);
    }
    const lines = $('resLines');
    lines.innerHTML = '';
    if (res.standings) {
      res.standings.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'row' + (r.you ? ' you' : '');
        row.innerHTML = `<span><i class="dot" style="background:${r.you ? currentPaintCss() : r.color}"></i>${U.ordinal(i + 1)} &nbsp;${r.name}</span><b>${r.t != null ? U.fmtTime(r.t) : '—'}</b>`;
        lines.appendChild(row);
      });
    }
    (res.lines || []).forEach(([a, b]) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>${a}</span><b>${b}</b>`;
      lines.appendChild(row);
    });
    $('resNext').textContent = res.next || '';
    const un = $('resUnlock');
    if (res.unlocked && res.unlocked.length) {
      un.innerHTML = res.unlocked.map((u) => `🔓 New: <b>${u}</b>`).join('<br>') + '<br><small>Pick it in the Garage</small>';
      un.classList.remove('hidden');
      setTimeout(() => Sound.sfx.unlock(), 1400);
    } else un.classList.add('hidden');
    $('nextTrackBtn').classList.toggle('hidden', sel.track >= TRACK_DEFS.length - 1 || res.stars === 0);
    setTimeout(() => $('againBtn').focus(), 50);
  }

  function currentPaintCss() {
    const p = PAINTS.find((x) => x.id === Store.data.paint) || PAINTS[0];
    return p.color === 'rainbow' ? 'linear-gradient(90deg,#ff4d4d,#ffd23f,#3ddc57,#1f7bff,#ff5fb3)' : p.color;
  }

  // ---------------------------------------------------------------- pause
  function showPause() { showTouch(false); $('pause').classList.remove('hidden'); }
  function hidePause() { blurBtn(); $('pause').classList.add('hidden'); showTouch(touchMode); }

  // ---------------------------------------------------------------- touch controls
  function showTouch(on) {
    $('touch').classList.toggle('hidden', !on);
    $('tGas').classList.toggle('hidden', G.autoGas);
  }

  function setNitroFill(v, on) {
    const el = $('tNitro');
    if (!el || $('touch').classList.contains('hidden')) return;
    el.style.setProperty('--fill', Math.round(v * 100) + '%');
    el.classList.toggle('active', on);
    el.classList.toggle('ready', v > 0.08);
  }

  function bindTouch() {
    [['tLeft', 'left'], ['tRight', 'right'], ['tGas', 'gas'], ['tBrake', 'brake'], ['tNitro', 'nitro']].forEach(([id, key]) => {
      const el = $(id);
      const down = (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* fine without capture */ }
        Input.touch[key] = true; el.classList.add('down');
        if (key === 'gas' || key === 'nitro') Input.gasEdge = G.t;
      };
      const up = () => { Input.touch[key] = false; el.classList.remove('down'); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    });
    document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('#touch')) e.preventDefault(); });
  }

  // ---------------------------------------------------------------- keyboard
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
    Space: 'nitro', ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro',
  };
  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      const playing = G.state === 'race' || G.state === 'countdown' || G.state === 'done';
      if (k) {
        if (playing) e.preventDefault();
        if (!Input.keys[k] && (k === 'gas' || k === 'nitro')) Input.gasEdge = G.t;
        Input.keys[k] = true;
        if (touchMode && playing) { touchMode = false; showTouch(false); }
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (G.state === 'paused') resumeGame(); else if (playing) pauseGame();
        else if (!$('garage').classList.contains('hidden')) showMenu();
      }
      if (e.code === 'KeyM') toggleMute();
      if ((e.code === 'Enter' || e.code === 'KeyR') && !$('results').classList.contains('hidden')) { e.preventDefault(); go(); }
      if (e.code === 'Enter' && !$('menu').classList.contains('hidden') && document.activeElement && document.activeElement.tagName !== 'BUTTON') go();
    });
    window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) Input.keys[k] = false; });
    window.addEventListener('blur', () => { for (const k in Input.keys) Input.keys[k] = false; });
  }

  function toggleMute() {
    Sound.init();
    Sound.setMuted(!Sound.muted);
    Store.data.settings.muted = Sound.muted; Store.save();
    $('muteBtn').textContent = Sound.muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- start-up
  function init() {
    Store.load();
    const last = Store.data.last || {};
    sel = {
      mode: MODES[last.mode] ? last.mode : 'race',
      track: last.track >= 0 && last.track < TRACK_DEFS.length ? last.track : 0,
      diff: DIFFICULTY[last.diff] ? last.diff : 'medium',
    };
    touchMode = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
    G.autoGas = Store.data.settings.autoGas != null ? Store.data.settings.autoGas : touchMode;
    if (Store.data.settings.muted) { Sound.setMuted(true); $('muteBtn').textContent = '🔇'; }
    window.addEventListener('touchstart', () => { touchMode = true; }, { passive: true });

    document.querySelectorAll('#modeList .mode').forEach((b) => b.addEventListener('click', () => { Sound.init(); Sound.sfx.click(); sel.mode = b.dataset.mode; saveSel(); renderMenu(); }));
    document.querySelectorAll('#diffSeg button').forEach((b) => b.addEventListener('click', () => { Sound.init(); Sound.sfx.click(); sel.diff = b.dataset.diff; saveSel(); renderMenu(); }));
    $('autoGas').addEventListener('change', (e) => { G.autoGas = e.target.checked; Store.data.settings.autoGas = G.autoGas; Store.save(); });
    $('goBtn').addEventListener('click', go);
    $('garageBtn').addEventListener('click', () => { Sound.init(); Sound.sfx.click(); showGarage(); });
    $('garageDone').addEventListener('click', () => { Sound.sfx.click(); showMenu(); });
    $('againBtn').addEventListener('click', go);
    $('nextTrackBtn').addEventListener('click', () => { sel.track = Math.min(TRACK_DEFS.length - 1, sel.track + 1); saveSel(); go(); });
    $('resMenuBtn').addEventListener('click', () => { Sound.sfx.click(); toMenu(); });
    $('resumeBtn').addEventListener('click', resumeGame);
    $('restartBtn').addEventListener('click', () => { $('pause').classList.add('hidden'); go(); });
    $('quitBtn').addEventListener('click', toMenu);
    $('pauseBtn').addEventListener('click', () => { blurBtn(); if (G.state === 'paused') resumeGame(); else pauseGame(); });
    $('muteBtn').addEventListener('click', () => { blurBtn(); toggleMute(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); lastT = performance.now(); });
    window.addEventListener('resize', () => { R.resize(); if (!$('garage').classList.contains('hidden')) drawGaragePreview(); });
    bindTouch();
    bindKeys();

    R.init($('game'));

    const boot = () => {
      buildCarSprites();
      startDemo(sel.track);
      showMenu();
      $('loading').classList.add('hidden');
    };
    const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
    fontsReady.then(() => {
      if (document.fonts && document.fonts.load) return Promise.race([document.fonts.load(`20px 'Russo One'`), new Promise((r) => setTimeout(r, 1500))]);
    }).catch(() => {}).then(boot);
    requestAnimationFrame(frame);

    try {
      if ('serviceWorker' in navigator && (location.hostname.endsWith('github.io') || location.hostname === 'localhost')) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  const touchVisible = () => !$('touch').classList.contains('hidden');

  return { init, showResults, showPause, hidePause, setNitroFill, showMenu, touchVisible };
})();

UI.init();
