/* ECHO — 렌더링 · 입력 · UI · 루프 */
(function () {
  'use strict';

  var LEVELS = window.ECHO_LEVELS;
  var ENGINE = window.ECHO_ENGINE;
  var AUDIO = window.ECHO_AUDIO;
  var TILE = ENGINE.TILE;
  var CFG = ENGINE.CFG;
  var STORE_KEY = 'echo_level_progress';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('stage');

  var dom = {
    hud: document.getElementById('hud'),
    hudLevel: document.getElementById('hudLevel'),
    hudName: document.getElementById('hudName'),
    hudHint: document.getElementById('hudHint'),
    hudAttempts: document.getElementById('hudAttempts'),
    echoTag: document.getElementById('echoTag'),
    echoState: document.getElementById('echoState'),
    title: document.getElementById('title'),
    titleStart: document.getElementById('titleStart'),
    titleLevels: document.getElementById('titleLevels'),
    select: document.getElementById('select'),
    selectGrid: document.getElementById('selectGrid'),
    selectBack: document.getElementById('selectBack'),
    card: document.getElementById('card'),
    cardTitle: document.getElementById('cardTitle'),
    cardSub: document.getElementById('cardSub'),
    cardNext: document.getElementById('cardNext'),
    cardRetry: document.getElementById('cardRetry'),
    cardLevels: document.getElementById('cardLevels'),
    pad: document.getElementById('pad'),
    btnRetry: document.getElementById('btnRetry'),
    btnLevels: document.getElementById('btnLevels'),
    btnSound: document.getElementById('btnSound')
  };

  var view = { w: 960, h: 540 };
  var dpr = 1;
  var camera = { x: 0, y: 0, shake: 0, zoom: 1, zoomTarget: 1 };
  var particles = [];
  var floaters = [];
  var flash = 0;
  var vis = { squash: 0, stretch: 0, goalPulse: 0, clearGlow: 0 };
  var trail = [];

  var state = 'title';
  var session = null;
  var levelIndex = 0;
  var accumulator = 0;
  var lastTime = 0;
  var clearShown = false;
  var idleTime = 0;

  var keyInput = { left: false, right: false, jump: false };
  var padInput = { left: false, right: false, jump: false };

  var progress = loadProgress();

  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return { cleared: [] };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.cleared)) return { cleared: [] };
      return { cleared: parsed.cleared.filter(function (n) { return typeof n === 'number'; }) };
    } catch (err) {
      return { cleared: [] };
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(progress));
    } catch (err) {
      /* 저장 실패는 게임 진행을 막지 않는다 */
    }
  }

  function isCleared(index) { return progress.cleared.indexOf(index) >= 0; }

  function isUnlocked(index) {
    return index === 0 || isCleared(index - 1);
  }

  function markCleared(index) {
    if (!isCleared(index)) {
      progress.cleared.push(index);
      saveProgress();
    }
  }

  /* ---------------- 레벨 / 세션 ---------------- */

  function startLevel(index) {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    session = ENGINE.createSession(LEVELS[levelIndex]);
    session.startAttempt(false);
    particles.length = 0;
    floaters.length = 0;
    trail.length = 0;
    camera.shake = 0;
    camera.zoom = 1;
    camera.zoomTarget = 1;
    flash = 0;
    clearShown = false;
    accumulator = 0;
    vis.clearGlow = 0;
    snapCamera();
    dom.hudLevel.textContent = 'LV ' + pad2(session.def.id);
    dom.hudName.textContent = session.def.name;
    dom.hudHint.textContent = session.def.hint;
    updateAttemptLabel();
    setScreen('playing');
  }

  function retry() {
    AUDIO.click();
    if (state !== 'playing' && state !== 'clearing' && state !== 'cleared') return;
    session.startAttempt(true);
    particles.length = 0;
    floaters.length = 0;
    trail.length = 0;
    vis.clearGlow = 0;
    camera.shake = 0;
    camera.zoomTarget = 1;
    clearShown = false;
    setScreen('playing');
    updateAttemptLabel();
  }

  function nextLevel() {
    AUDIO.click();
    if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
    else openSelect();
  }

  function setScreen(next) {
    state = next;
    dom.title.hidden = next !== 'title';
    dom.select.hidden = next !== 'select';
    dom.hud.hidden = !(next === 'playing' || next === 'clearing' || next === 'cleared');
    dom.card.hidden = next !== 'cleared';
    dom.pad.hidden = !useTouch();
  }

  function openSelect() {
    buildSelectGrid();
    setScreen('select');
  }

  function buildSelectGrid() {
    dom.selectGrid.innerHTML = '';
    for (var i = 0; i < LEVELS.length; i++) {
      (function (index) {
        var def = LEVELS[index];
        var unlocked = isUnlocked(index);
        var cleared = isCleared(index);
        var card = document.createElement('button');
        card.className = 'lv' + (cleared ? ' done' : '') + (unlocked ? '' : ' locked');
        card.type = 'button';
        card.disabled = !unlocked;
        var no = document.createElement('span');
        no.className = 'lv-no';
        no.textContent = 'Lv.' + pad2(def.id);
        var name = document.createElement('span');
        name.className = 'lv-name';
        name.textContent = unlocked ? def.name : '잠김';
        var mark = document.createElement('span');
        mark.className = 'lv-mark';
        mark.textContent = cleared ? '★' : (unlocked ? '' : '🔒');
        card.appendChild(no);
        card.appendChild(name);
        card.appendChild(mark);
        card.addEventListener('click', function () {
          AUDIO.unlock();
          AUDIO.click();
          startLevel(index);
        });
        dom.selectGrid.appendChild(card);
      })(i);
    }
  }

  function updateAttemptLabel() {
    if (!session) return;
    dom.hudAttempts.textContent = '시도 ' + session.attempts;
    var active = session.attempt && session.attempt.echo.active;
    dom.echoState.textContent = active ? 'ECHO 재생 중' : 'ECHO 없음';
    dom.echoState.className = 'echo-state' + (active ? ' on' : '');
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* ---------------- 입력 ---------------- */

  function useTouch() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

  function currentInput() {
    return {
      left: keyInput.left || padInput.left,
      right: keyInput.right || padInput.right,
      jump: keyInput.jump || padInput.jump
    };
  }

  var KEY_LEFT = { ArrowLeft: 1, KeyA: 1 };
  var KEY_RIGHT = { ArrowRight: 1, KeyD: 1 };
  var KEY_JUMP = { Space: 1, KeyW: 1, ArrowUp: 1, KeyK: 1 };

  window.addEventListener('keydown', function (e) {
    if (KEY_LEFT[e.code]) { keyInput.left = true; e.preventDefault(); }
    if (KEY_RIGHT[e.code]) { keyInput.right = true; e.preventDefault(); }
    if (KEY_JUMP[e.code]) {
      if (!keyInput.jump) AUDIO.unlock();
      keyInput.jump = true;
      e.preventDefault();
    }
    if (e.code === 'KeyR') {
      if (state === 'playing' || state === 'clearing' || state === 'cleared') retry();
    }
    if (e.code === 'KeyL' || e.code === 'Escape') {
      if (state === 'playing' || state === 'clearing' || state === 'cleared') openSelect();
      else if (state === 'select' && session) setScreen('playing');
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (state === 'cleared') nextLevel();
      else if (state === 'title') { AUDIO.unlock(); startLevel(0); }
    }
  });

  window.addEventListener('keyup', function (e) {
    if (KEY_LEFT[e.code]) keyInput.left = false;
    if (KEY_RIGHT[e.code]) keyInput.right = false;
    if (KEY_JUMP[e.code]) keyInput.jump = false;
  });

  window.addEventListener('blur', function () {
    keyInput.left = keyInput.right = keyInput.jump = false;
  });

  Array.prototype.forEach.call(dom.pad.querySelectorAll('[data-key]'), function (btn) {
    var key = btn.getAttribute('data-key');
    function on(ev) {
      ev.preventDefault();
      AUDIO.unlock();
      padInput[key] = true;
      btn.classList.add('down');
    }
    function off(ev) {
      ev.preventDefault();
      padInput[key] = false;
      btn.classList.remove('down');
    }
    btn.addEventListener('touchstart', on, { passive: false });
    btn.addEventListener('touchend', off, { passive: false });
    btn.addEventListener('touchcancel', off, { passive: false });
    btn.addEventListener('mousedown', on);
    btn.addEventListener('mouseup', off);
    btn.addEventListener('mouseleave', off);
  });

  dom.titleStart.addEventListener('click', function () {
    AUDIO.unlock();
    AUDIO.click();
    var first = 0;
    for (var i = 0; i < LEVELS.length; i++) {
      if (isUnlocked(i) && !isCleared(i)) { first = i; break; }
      if (isUnlocked(i)) first = i;
    }
    startLevel(first);
  });
  dom.titleLevels.addEventListener('click', function () { AUDIO.unlock(); AUDIO.click(); openSelect(); });
  dom.selectBack.addEventListener('click', function () {
    AUDIO.click();
    if (session) setScreen(state === 'cleared' ? 'cleared' : 'playing');
    else setScreen('title');
  });
  dom.btnRetry.addEventListener('click', retry);
  dom.btnLevels.addEventListener('click', function () { AUDIO.click(); openSelect(); });
  dom.btnSound.addEventListener('click', function () {
    AUDIO.unlock();
    var muted = AUDIO.setMuted(!AUDIO.isMuted());
    dom.btnSound.textContent = muted ? '🔇' : '🔊';
    dom.btnSound.setAttribute('aria-pressed', muted ? 'false' : 'true');
    if (!muted) AUDIO.click();
  });
  dom.cardNext.addEventListener('click', nextLevel);
  dom.cardRetry.addEventListener('click', retry);
  dom.cardLevels.addEventListener('click', function () { AUDIO.click(); openSelect(); });

  /* ---------------- 이벤트 → 연출 ---------------- */

  function burst(x, y, count, opts) {
    opts = opts || {};
    for (var i = 0; i < count; i++) {
      if (particles.length > 160) break;
      var angle = opts.angle == null ? Math.random() * Math.PI * 2 : opts.angle + (Math.random() - 0.5) * (opts.spread || 1.2);
      var speed = (opts.speed || 90) * (0.35 + Math.random() * 0.9);
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (opts.lift || 0),
        life: (opts.life || 0.5) * (0.6 + Math.random() * 0.7),
        age: 0,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
        color: opts.color || '#ffd39b',
        gravity: opts.gravity == null ? 420 : opts.gravity,
        drag: opts.drag == null ? 1.4 : opts.drag,
        kind: opts.kind || 'dot'
      });
    }
  }

  function drainEvents() {
    var events = session.events;
    while (events.length) {
      var e = events.shift();
      if (e.type === 'jump') {
        AUDIO.jump();
        vis.stretch = 1;
        burst(e.x, e.y, 6, { color: '#ffd9a8', speed: 70, life: 0.32, size: 2.6, angle: Math.PI / 2, spread: 2.2, gravity: 240 });
      } else if (e.type === 'land') {
        AUDIO.land();
        vis.squash = 1;
        camera.shake = Math.max(camera.shake, 1.4);
        burst(e.x, e.y, 8, { color: '#cfe6ff', speed: 110, life: 0.34, size: 2.4, angle: -Math.PI / 2, spread: 2.6, gravity: 260 });
      } else if (e.type === 'death') {
        AUDIO.death();
        camera.shake = 6;
        flash = Math.max(flash, 0.18);
        burst(e.x, e.y, 18, { color: '#ff7a8a', speed: 180, life: 0.5, size: 3.2, gravity: 520 });
        burst(e.x, e.y, 8, { color: '#ffd6a5', speed: 120, life: 0.6, size: 2.2, gravity: 300 });
      } else if (e.type === 'plate') {
        AUDIO.plate(e.on);
        burst(e.x, e.y - 6, 5, { color: e.on ? '#8ff0ff' : '#8fa0c0', speed: 60, life: 0.3, size: 2, gravity: 60 });
      } else if (e.type === 'needsEcho') {
        pushFloater('혼자서는 클리어되지 않습니다', '#9fe8ff');
      } else if (e.type === 'clear') {
        AUDIO.clear();
        camera.shake = 4;
        camera.zoomTarget = 1.045;
        flash = Math.max(flash, 0.35);
        vis.clearGlow = 1;
        burst(e.x, e.y, 26, { color: '#8ff0ff', speed: 210, life: 0.8, size: 3, gravity: 120, drag: 1.0 });
        burst(e.x, e.y, 18, { color: '#ffd479', speed: 150, life: 0.9, size: 2.6, gravity: 160, drag: 0.9 });
        particles.push({
          x: e.x, y: e.y, vx: 0, vy: 0, life: 0.7, age: 0, size: 10,
          color: '#9ff2ff', gravity: 0, drag: 0, kind: 'ring'
        });
        particles.push({
          x: e.x, y: e.y, vx: 0, vy: 0, life: 1.0, age: 0, size: 10,
          color: '#ffe3a8', gravity: 0, drag: 0, kind: 'ring'
        });
        AUDIO.echo();
      }
    }
  }

  function pushFloater(text, color) {
    floaters.push({ text: text, color: color, life: 2.2, age: 0 });
  }

  /* ---------------- 카메라 ---------------- */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function cameraTarget() {
    var world = session.world;
    var p = session.attempt.player;
    var tx;
    var ty;
    if (world.pixelWidth <= view.w) tx = (world.pixelWidth - view.w) / 2;
    else tx = clamp(p.x + CFG.width / 2 - view.w / 2, 0, world.pixelWidth - view.w);
    if (world.pixelHeight <= view.h) ty = (world.pixelHeight - view.h) / 2;
    else ty = clamp(p.y + CFG.height / 2 - view.h / 2, 0, world.pixelHeight - view.h);
    return { x: tx, y: ty };
  }

  function updateCamera(dt) {
    var t = cameraTarget();
    var k = 1 - Math.pow(0.0015, dt);
    camera.x += (t.x - camera.x) * k;
    camera.y += (t.y - camera.y) * k;
    camera.shake = Math.max(0, camera.shake - dt * 14);
    camera.zoom += (camera.zoomTarget - camera.zoom) * (1 - Math.pow(0.004, dt));
  }

  function snapCamera() {
    var t = cameraTarget();
    camera.x = t.x;
    camera.y = t.y;
  }

  /* ---------------- 파티클 ---------------- */

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      if (p.kind !== 'ring') {
        p.vy += p.gravity * dt;
        var d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    for (var j = floaters.length - 1; j >= 0; j--) {
      floaters[j].age += dt;
      if (floaters[j].age >= floaters[j].life) floaters.splice(j, 1);
    }
  }

  /* ---------------- 렌더 ---------------- */

  function roundRect(x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function drawBackground(world) {
    var g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, '#0e1420');
    g.addColorStop(1, '#151d2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
    return g;
  }

  function drawWorldTiles(world) {
    var left = Math.max(0, Math.floor(camera.x / TILE) - 1);
    var right = Math.min(world.w - 1, Math.ceil((camera.x + view.w) / TILE) + 1);
    var top = Math.max(0, Math.floor(camera.y / TILE) - 1);
    var bottom = Math.min(world.h - 1, Math.ceil((camera.y + view.h) / TILE) + 1);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#223052';
    for (var gy = top; gy <= bottom; gy++) {
      for (var gx = left; gx <= right; gx++) {
        if ((gx + gy) % 2 === 0) ctx.fillRect(gx * TILE + 15, gy * TILE + 15, 2, 2);
      }
    }
    ctx.restore();

    for (var r = top; r <= bottom; r++) {
      for (var c = left; c <= right; c++) {
        var idx = r * world.w + c;
        var t = world.tiles[idx];
        var x = c * TILE;
        var y = r * TILE;
        if (t === ENGINE.T.SOLID) {
          var openTop = r === 0 || world.tiles[idx - world.w] !== ENGINE.T.SOLID;
          ctx.fillStyle = '#28324a';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          ctx.fillRect(x, y, TILE, TILE * 0.5);
          if (openTop) {
            ctx.fillStyle = '#4b5b83';
            ctx.fillRect(x, y, TILE, 3);
          }
          ctx.strokeStyle = 'rgba(10,14,22,0.55)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        } else if (t === ENGINE.T.START) {
          ctx.fillStyle = 'rgba(255,180,84,0.10)';
          ctx.fillRect(x, y + TILE - 6, TILE, 6);
        }
      }
    }
  }

  function drawSpikes(world) {
    for (var i = 0; i < world.hazards.length; i++) {
      var hz = world.hazards[i];
      var x = hz.c * TILE;
      var y = hz.r * TILE;
      ctx.fillStyle = '#3a2030';
      ctx.fillRect(x, y + TILE - 6, TILE, 6);
      ctx.fillStyle = '#ff5f74';
      for (var k = 0; k < 3; k++) {
        var bx = x + k * (TILE / 3);
        ctx.beginPath();
        ctx.moveTo(bx, y + TILE);
        ctx.lineTo(bx + TILE / 6, y + 8);
        ctx.lineTo(bx + TILE / 3, y + TILE);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,160,170,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + TILE - 5);
      ctx.lineTo(x + TILE, y + TILE - 5);
      ctx.stroke();
    }
  }

  function drawPlates(world) {
    for (var i = 0; i < world.groups.length; i++) {
      var g = world.groups[i];
      for (var k = 0; k < g.plates.length; k++) {
        var pl = g.plates[k];
        var x = pl.c * TILE;
        var y = pl.r * TILE;
        var sink = g.pressed ? 5 : 0;
        ctx.fillStyle = '#232c42';
        ctx.fillRect(x + 3, y + TILE - 10, TILE - 6, 10);
        ctx.fillStyle = g.mode === 'latch' ? (g.latched ? '#ffcf7a' : '#8d7b5c') : (g.pressed ? '#8ff0ff' : '#6b7a99');
        roundRect(x + 2, y + TILE - 13 + sink, TILE - 4, 8, 3);
        ctx.fill();
        ctx.strokeStyle = g.mode === 'latch' ? 'rgba(255,207,122,0.6)' : 'rgba(143,240,255,0.6)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (g.mode === 'latch') {
          ctx.fillStyle = 'rgba(255,207,122,0.85)';
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('LATCH', x + TILE / 2, y + 12);
        } else if (g.pressed) {
          ctx.fillStyle = 'rgba(143,240,255,0.9)';
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('HOLD', x + TILE / 2, y + 12);
        }
      }
    }
  }

  function drawDoors(world) {
    for (var i = 0; i < world.groups.length; i++) {
      var g = world.groups[i];
      if (!g.doors.length) continue;
      var amount = g.anim == null ? (g.open ? 1 : 0) : g.anim;
      for (var k = 0; k < g.doors.length; k++) {
        var d = g.doors[k];
        var x = d.c * TILE;
        var y = d.r * TILE;
        ctx.fillStyle = '#1b2233';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(90,110,150,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);

        var slide = amount * (TILE - 2);
        ctx.save();
        ctx.globalAlpha = 1 - amount * 0.75;
        ctx.fillStyle = g.mode === 'latch' ? '#c79a4f' : '#5b7fb5';
        roundRect(x + 1, y + 1 - slide, TILE - 2, TILE - 2, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = g.open ? 'rgba(143,240,255,0.9)' : 'rgba(255,120,140,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + TILE - 2.5);
        ctx.lineTo(x + TILE - 3, y + TILE - 2.5);
        ctx.stroke();
        if (g.open) {
          ctx.save();
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(idleTime * 6);
          ctx.fillStyle = '#8ff0ff';
          ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          ctx.restore();
        }
      }
    }
  }

  function drawGoal(world, attempt) {
    var g = world.goal;
    var both = attempt.playerInGoal && attempt.echoInGoal;
    var pulse = 0.5 + 0.5 * Math.sin(idleTime * (both ? 8 : 3));
    ctx.save();
    var glow = ctx.createRadialGradient(g.x + g.w / 2, g.y + g.h / 2, 4, g.x + g.w / 2, g.y + g.h / 2, Math.max(g.w, g.h) * 1.1);
    glow.addColorStop(0, both ? 'rgba(255,226,150,0.55)' : 'rgba(143,240,255,0.30)');
    glow.addColorStop(1, 'rgba(143,240,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(g.x - 40, g.y - 40, g.w + 80, g.h + 80);

    ctx.strokeStyle = both ? '#ffe2a0' : '#8ff0ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -idleTime * 26;
    roundRect(g.x + 3, g.y + 3 + (both ? 0 : pulse * 2), g.w - 6, g.h - 6, 8);
    ctx.stroke();
    ctx.setLineDash([]);

    var cx = g.x + g.w / 2;
    var baseY = g.y + g.h - 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.lineTo(cx, g.y + 6);
    ctx.stroke();
    ctx.fillStyle = both ? '#ffe2a0' : '#8ff0ff';
    ctx.beginPath();
    ctx.moveTo(cx, g.y + 6);
    ctx.lineTo(cx + 14 - pulse * 2, g.y + 11);
    ctx.lineTo(cx, g.y + 17);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function bodyPath(x, y, scaleX, scaleY) {
    var w = CFG.width;
    var h = CFG.height;
    var cx = x + w / 2;
    var by = y + h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-cx, -by);
    roundRect(x, y, w, h, 7);
    ctx.restore();
  }

  function drawBody(x, y, dir, opts) {
    var w = CFG.width;
    var h = CFG.height;
    var scaleX = opts.scaleX || 1;
    var scaleY = opts.scaleY || 1;
    var cx = x + w / 2;
    var by = y + h;

    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-cx, -by);

    if (opts.glow) {
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = opts.blur || 14;
    }
    ctx.fillStyle = opts.fill;
    roundRect(x, y, w, h, 7);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = opts.lineWidth || 2;
    ctx.strokeStyle = opts.stroke;
    roundRect(x, y, w, h, 7);
    ctx.stroke();

    ctx.fillStyle = opts.eye || '#0d1220';
    var ex = dir > 0 ? x + w * 0.62 : x + w * 0.38;
    var ey = y + h * 0.38;
    ctx.beginPath();
    ctx.arc(ex - 2.5, ey, 1.9, 0, Math.PI * 2);
    ctx.arc(ex + 2.5, ey, 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = opts.band || 'rgba(255,255,255,0.22)';
    roundRect(x + 3, y + h * 0.68, w - 6, 4, 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEcho(world, attempt) {
    var e = attempt.echo;
    if (!e.active) return;
    var path = e.path;
    var i = Math.min(attempt.step, path.length - 1);
    for (var k = 3; k >= 1; k--) {
      var idx = i - k * 3;
      if (idx < 0) continue;
      var f = path[idx];
      var alpha = 0.10 - k * 0.02;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawBody(f.x, f.y, f.f, {
        fill: '#7fe9ff',
        stroke: 'rgba(127,233,255,0.5)',
        eye: 'rgba(10,30,40,0.5)',
        band: 'rgba(127,233,255,0.15)',
        lineWidth: 1
      });
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = e.done ? 0.6 : 0.82;
    drawBody(e.x, e.y, e.dir, {
      fill: 'rgba(120,225,255,0.26)',
      stroke: '#8ff2ff',
      glow: 'rgba(120,225,255,0.55)',
      blur: 16,
      eye: 'rgba(220,255,255,0.65)',
      band: 'rgba(143,240,255,0.30)',
      lineWidth: 2
    });
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'rgba(143,240,255,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    roundRect(e.x - 1.5, e.y - 1.5, CFG.width + 3, CFG.height + 3, 9);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawPlayer(attempt) {
    var p = attempt.player;
    if (!p.alive) return;
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      var a = (i + 1) / trail.length;
      ctx.save();
      ctx.globalAlpha = 0.16 * a;
      drawBody(t.x, t.y, t.f, { fill: '#ffb454', stroke: 'rgba(255,180,84,0.5)', eye: 'rgba(0,0,0,0)', band: 'rgba(255,255,255,0.1)', lineWidth: 1 });
      ctx.restore();
    }
    var scaleX = 1 + vis.squash * 0.22 - vis.stretch * 0.14;
    var scaleY = 1 - vis.squash * 0.24 + vis.stretch * 0.18;
    drawBody(p.x, p.y, p.dir, {
      fill: '#ffb454',
      stroke: '#ffd9a0',
      glow: 'rgba(255,180,84,0.45)',
      blur: 14,
      eye: '#3a2410',
      band: 'rgba(255,255,255,0.28)',
      lineWidth: 2,
      scaleX: scaleX,
      scaleY: scaleY
    });
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var t = p.age / p.life;
      var alpha = Math.max(0, 1 - t);
      ctx.save();
      if (p.kind === 'ring') {
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 + t * 70, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();

    if (!session) return;
    var world = session.world;
    var attempt = session.attempt;

    var shakeX = 0;
    var shakeY = 0;
    if (camera.shake > 0.01) {
      shakeX = (Math.random() - 0.5) * camera.shake;
      shakeY = (Math.random() - 0.5) * camera.shake;
    }

    ctx.save();
    ctx.translate(view.w / 2, view.h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-view.w / 2, -view.h / 2);
    ctx.translate(shakeX, shakeY);
    ctx.translate(-camera.x, -camera.y);

    drawWorldTiles(world);
    drawGoal(world, attempt);
    drawPlates(world);
    drawDoors(world);
    drawSpikes(world);
    drawEcho(world, attempt);
    drawPlayer(attempt);
    drawParticles();

    ctx.restore();

    if (vis.clearGlow > 0.01) {
      ctx.save();
      ctx.globalAlpha = vis.clearGlow * 0.35;
      var grd = ctx.createRadialGradient(view.w / 2, view.h / 2, 10, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.7);
      grd.addColorStop(0, 'rgba(255,235,190,0.9)');
      grd.addColorStop(1, 'rgba(255,235,190,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.restore();
    }

    if (flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.restore();
    }

    var vignette = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.35, view.w / 2, view.h / 2, view.h * 0.9);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, view.w, view.h);

    if (floaters.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '600 15px Inter, system-ui, sans-serif';
      for (var i = 0; i < floaters.length; i++) {
        var f = floaters[i];
        var t = f.age / f.life;
        ctx.globalAlpha = Math.min(1, (1 - t) * 2);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, view.w / 2, view.h * 0.30 - i * 22 - t * 10);
      }
      ctx.restore();
    }
  }

  /* ---------------- 루프 ---------------- */

  function updatePlaying(dt) {
    accumulator += dt;
    var steps = 0;
    while (accumulator >= ENGINE.DT && steps < 5) {
      accumulator -= ENGINE.DT;
      steps += 1;
      session.update(currentInput());
      drainEvents();
      if (session.attempt.cleared || session.attempt.dead) {
        accumulator = 0;
        break;
      }
    }
    if (steps >= 5) accumulator = 0;

    var a = session.attempt;
    trail.push({ x: a.player.x, y: a.player.y, f: a.player.dir });
    if (trail.length > 5) trail.shift();

    if (a.cleared && state === 'playing') {
      setScreen('clearing');
      markCleared(levelIndex);
    }
    if (state === 'clearing' && a.clearTimer <= 0) showClearCard();

    dom.echoTag.hidden = !(a.playerInGoal && !a.echo.active && !a.cleared);
    updateAttemptLabel();
  }

  function showClearCard() {
    if (clearShown) return;
    clearShown = true;
    var last = levelIndex + 1 >= LEVELS.length;
    dom.cardTitle.textContent = last ? 'ALL LEVELS CLEARED!' : 'LEVEL CLEARED';
    dom.cardSub.textContent = 'Lv.' + pad2(session.def.id) + ' · ' + session.def.name + ' · 시도 ' + session.attempts + '회';
    dom.cardNext.textContent = last ? '레벨 선택' : '다음 레벨 ▸';
    setScreen('cleared');
    camera.zoomTarget = 1;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    var dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) dt = 0.05;
    idleTime += dt;

    vis.squash = Math.max(0, vis.squash - dt * 7);
    vis.stretch = Math.max(0, vis.stretch - dt * 6);
    flash = Math.max(0, flash - dt * 2.6);
    vis.clearGlow = Math.max(0, vis.clearGlow - dt * 1.1);

    if (state === 'playing' || state === 'clearing') {
      updatePlaying(dt);
      updateCamera(dt);
    } else if (state === 'cleared') {
      updateCamera(dt);
    } else {
      idleTime += 0;
    }
    updateParticles(dt);
    render();
  }

  /* ---------------- 크기 ---------------- */

  function resize() {
    var rect = stage.getBoundingClientRect();
    view.w = Math.max(320, Math.round(rect.width));
    view.h = Math.max(240, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (session) snapCamera();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  resize();
  session = ENGINE.createSession(LEVELS[0]);
  session.startAttempt(false);
  snapCamera();
  dom.hudLevel.textContent = 'LV ' + pad2(session.def.id);
  dom.hudName.textContent = session.def.name;
  dom.hudHint.textContent = session.def.hint;
  dom.btnSound.textContent = '🔊';
  setScreen('title');
  requestAnimationFrame(frame);
})();
