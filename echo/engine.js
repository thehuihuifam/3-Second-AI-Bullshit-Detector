/* ECHO — 시뮬레이션 엔진 (렌더링/UI 비의존)
   고정 타임스텝(1/60)으로 물리와 에코 재생을同一 스텝으로 진행해
   재현 타이밍이 절대 어긋나지 않게 한다. */
(function (global) {
  'use strict';

  var TILE = 32;
  var DT = 1 / 60;

  var CFG = {
    gravity: 1800,
    maxFall: 900,
    speed: 185,
    accelGround: 2400,
    accelAir: 1500,
    frictionGround: 2900,
    frictionAir: 700,
    jumpVelocity: 548,
    jumpCut: 0.35,
    coyoteTime: 0.10,
    jumpBuffer: 0.12,
    width: 20,
    height: 28,
    spikeInset: 5,
    deathDelay: 0.42,
    clearDelay: 0.55,
    echoGrabUp: 14,
    echoGrabDown: 26,
    cornerAssist: 10
  };

  var T = { EMPTY: 0, SOLID: 1, SPIKE: 2, GOAL: 3, PLATE: 4, LATCH: 5, DOOR: 6, START: 7 };

  function parseLevel(def) {
    var w = def.w;
    var rows = [];
    for (var i = 0; i < def.rows.length; i++) {
      var raw = def.rows[i];
      var body = raw.length > w - 1 ? raw.slice(0, w - 1) : raw;
      while (body.length < w - 1) body += ' ';
      rows.push(body + '#');
    }
    var h = rows.length;
    var tiles = new Uint8Array(w * h);
    var groupOf = new Int8Array(w * h);
    for (var f = 0; f < groupOf.length; f++) groupOf[f] = -1;

    var groups = [];
    for (var g = 0; g < 4; g++) {
      groups.push({
        index: g,
        mode: g < 2 ? 'hold' : 'latch',
        plates: [],
        doors: [],
        open: false,
        latched: false,
        pressed: false,
        wasPressed: false
      });
    }

    var start = null;
    var goalTiles = [];
    var hazardTiles = [];

    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var ch = rows[r][c];
        var idx = r * w + c;
        if (ch === '#') {
          tiles[idx] = T.SOLID;
        } else if (ch === '^') {
          tiles[idx] = T.SPIKE;
          hazardTiles.push({ c: c, r: r });
        } else if (ch === 'G') {
          tiles[idx] = T.GOAL;
          goalTiles.push({ c: c, r: r });
        } else if (ch === 'S') {
          tiles[idx] = T.START;
          start = { c: c, r: r };
        } else if (ch === '1' || ch === '2' || ch === '3' || ch === '4') {
          var gi = ch.charCodeAt(0) - 49;
          tiles[idx] = gi < 2 ? T.PLATE : T.LATCH;
          groupOf[idx] = gi;
          groups[gi].plates.push({ c: c, r: r });
        } else if (ch === 'a' || ch === 'b' || ch === 'c' || ch === 'd') {
          var gj = ch.charCodeAt(0) - 97;
          tiles[idx] = T.DOOR;
          groupOf[idx] = gj;
          groups[gj].doors.push({ c: c, r: r });
        }
      }
    }

    if (!start) start = { c: 2, r: h - 2 };
    if (!goalTiles.length) goalTiles.push({ c: w - 3, r: h - 3 });

    var gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (var k = 0; k < goalTiles.length; k++) {
      var t = goalTiles[k];
      gx0 = Math.min(gx0, t.c * TILE);
      gy0 = Math.min(gy0, t.r * TILE);
      gx1 = Math.max(gx1, t.c * TILE + TILE);
      gy1 = Math.max(gy1, t.r * TILE + TILE);
    }

    return {
      def: def,
      w: w,
      h: h,
      rows: rows,
      tiles: tiles,
      groupOf: groupOf,
      groups: groups,
      hazards: hazardTiles,
      goal: { x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0 },
      spawn: {
        x: start.c * TILE + (TILE - CFG.width) / 2,
        y: (start.r + 1) * TILE - CFG.height
      },
      pixelWidth: w * TILE,
      pixelHeight: h * TILE
    };
  }

  function aabb(body) {
    return { x: body.x, y: body.y, w: CFG.width, h: CFG.height };
  }

  function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function bodyInRect(body, rect) {
    return overlaps(body.x, body.y, CFG.width, CFG.height, rect.x, rect.y, rect.w, rect.h);
  }

  function centerInRect(body, rect) {
    var cx = body.x + CFG.width / 2;
    var cy = body.y + CFG.height / 2;
    return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
  }

  function blocks(world, body, c, r) {
    if (c < 0 || c >= world.w) return true;
    if (r < 0) return true;
    if (r >= world.h) return false;
    var idx = r * world.w + c;
    var t = world.tiles[idx];
    if (t === T.SOLID) return true;
    if (t === T.DOOR) {
      var g = world.groups[world.groupOf[idx]];
      if (g && !g.open) {
        // 문은 '들어가는 것'만 막는다. 이미 겹쳐 있는 몸을 가두지 않는다.
        if (bodyInRect(body, { x: c * TILE, y: r * TILE, w: TILE, h: TILE })) return false;
        return true;
      }
      return false;
    }
    return false;
  }

  function moveX(world, p, dx) {
    if (dx === 0) return;
    p.x += dx;
    var c0 = Math.floor((p.x + 1) / TILE);
    var c1 = Math.floor((p.x + CFG.width - 1) / TILE);
    var r0 = Math.floor((p.y + 1) / TILE);
    var r1 = Math.floor((p.y + CFG.height - 1) / TILE);
    var lift = null;
    var liftAmount = Infinity;
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (!blocks(world, p, c, r)) continue;
        // 모서리 보정: 하강 중에 발끝이 턱에 살짝 걸리면 그 위로 올려준다(벽 타기 방지로 vy>=0 일 때만)
        var overlap = p.y + CFG.height - r * TILE;
        if (p.vy >= 0 && overlap > 0 && overlap <= CFG.cornerAssist && overlap < liftAmount) {
          liftAmount = overlap;
          lift = r * TILE - CFG.height;
          continue;
        }
        if (dx > 0) p.x = c * TILE - CFG.width;
        else p.x = (c + 1) * TILE;
        p.vx = 0;
        p.hitWall = true;
        return;
      }
    }
    if (lift !== null) p.y = lift;
  }

  function moveY(world, p, dy) {
    p.prevBottom = p.y + CFG.height;
    p.y += dy;
    var c0 = Math.floor((p.x + 1) / TILE);
    var c1 = Math.floor((p.x + CFG.width - 1) / TILE);
    var r0 = Math.floor((p.y + 1) / TILE);
    var r1 = Math.floor((p.y + CFG.height - 1) / TILE);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (!blocks(world, p, c, r)) continue;
        if (dy > 0) {
          p.y = r * TILE - CFG.height;
          p.vy = 0;
          p.grounded = true;
        } else {
          p.y = (r + 1) * TILE;
          p.vy = 0;
        }
        return;
      }
    }
  }

  // 프레임마다 중력으로 1px씩 떨어지며 grounded가 깜빡이는 것을 막는다.
  // (착지 이벤트가 초당 30회씩 발화되고 점프 판정이 흔들리는 문제의 근본 원인)
  function groundSnap(world, p) {
    if (p.grounded || p.vy < 0) return;
    var bottom = p.y + CFG.height;
    var r = Math.floor((bottom + 2) / TILE);
    var c0 = Math.floor((p.x + 1) / TILE);
    var c1 = Math.floor((p.x + CFG.width - 1) / TILE);
    for (var c = c0; c <= c1; c++) {
      if (blocks(world, p, c, r)) {
        p.y = r * TILE - CFG.height;
        p.vy = 0;
        p.grounded = true;
        return;
      }
    }
  }

  function hazardHit(world, p) {
    var inset = CFG.spikeInset;
    for (var i = 0; i < world.hazards.length; i++) {
      var hz = world.hazards[i];
      if (overlaps(
        p.x + inset, p.y + inset, CFG.width - inset * 2, CFG.height - inset,
        hz.c * TILE + 3, hz.r * TILE + 8, TILE - 6, TILE - 8
      )) return true;
    }
    return false;
  }

  function createSession(def) {
    var world = parseLevel(def);
    var session = {
      def: def,
      world: world,
      lastPath: null,
      attempts: 0,
      attempt: null,
      events: [],
      cleared: false
    };

    function emit(type, data) {
      var e = data || {};
      e.type = type;
      session.events.push(e);
    }

    function newAttempt() {
      var a = {
        step: 0,
        time: 0,
        player: {
          x: world.spawn.x,
          y: world.spawn.y,
          vx: 0,
          vy: 0,
          dir: 1,
          grounded: false,
          coyote: 0,
          buffer: 0,
          onEcho: false,
          prevBottom: world.spawn.y + CFG.height,
          hitWall: false,
          alive: true
        },
        echo: {
          active: false,
          path: null,
          x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0,
          dir: 1, grounded: false, done: false
        },
        recording: [],
        dead: false,
        deathTimer: 0,
        cleared: false,
        clearTimer: 0,
        playerInGoal: false,
        echoInGoal: false,
        needsEchoShown: false,
        prevJump: false
      };
      if (session.lastPath && session.lastPath.length > 3) {
        a.echo.active = true;
        a.echo.path = session.lastPath;
        a.echo.x = session.lastPath[0].x;
        a.echo.y = session.lastPath[0].y;
        a.echo.px = a.echo.x;
        a.echo.py = a.echo.y;
        a.echo.dir = session.lastPath[0].f || 1;
        a.echo.grounded = !!session.lastPath[0].g;
      }
      return a;
    }

    session.startAttempt = function (savePrevious) {
      var prev = session.attempt;
      if (savePrevious && prev && prev.recording.length > 3) session.lastPath = prev.recording;
      // 첫 시도 또는 실제 재시도일 때만 시도 수를 센다(중복 초기화로 숫자가 튀지 않게)
      if (savePrevious || session.attempts === 0) session.attempts += 1;
      session.cleared = false;
      session.attempt = newAttempt();
      for (var i = 0; i < world.groups.length; i++) {
        var g = world.groups[i];
        g.latched = false;
        g.open = false;
        g.pressed = false;
        g.wasPressed = false;
        g.anim = 0;
      }
    };

    function updateDoors(a) {
      var e = a.echo;
      for (var i = 0; i < world.groups.length; i++) {
        var g = world.groups[i];
        if (!g.plates.length && !g.doors.length) continue;
        var pressed = false;
        var hit = null;
        for (var k = 0; k < g.plates.length; k++) {
          var pl = g.plates[k];
          var rect = { x: pl.c * TILE, y: pl.r * TILE + 8, w: TILE, h: TILE - 8 };
          if (bodyInRect(a.player, rect)) { pressed = true; hit = pl; break; }
          if (e.active && bodyInRect(e, rect)) { pressed = true; hit = pl; break; }
        }
        g.wasPressed = g.pressed;
        g.pressed = pressed;
        if (pressed && !g.wasPressed) {
          emit('plate', { on: true, x: hit.c * TILE + TILE / 2, y: hit.r * TILE + TILE / 2 });
        } else if (!pressed && g.wasPressed) {
          emit('plate', { on: false, x: hit ? hit.c * TILE + TILE / 2 : 0, y: hit ? hit.r * TILE + TILE / 2 : 0 });
        }
        if (g.mode === 'latch') {
          if (pressed) g.latched = true;
          g.open = g.latched;
        } else {
          g.open = pressed;
        }
        var target = g.open ? 1 : 0;
        g.anim = g.anim == null ? target : g.anim + (target - g.anim) * 0.28;
      }
    }

    function kill(a, cause) {
      a.dead = true;
      a.deathTimer = CFG.deathDelay;
      a.player.alive = false;
      emit('death', {
        cause: cause,
        x: a.player.x + CFG.width / 2,
        y: a.player.y + CFG.height / 2
      });
    }

    function updatePlayer(a, input) {
      var p = a.player;
      var jumpHeld = !!input.jump;
      var jumpPressed = jumpHeld && !a.prevJump;
      a.prevJump = jumpHeld;

      if (jumpPressed) p.buffer = CFG.jumpBuffer;
      p.buffer = Math.max(0, p.buffer - DT);
      p.coyote = Math.max(0, p.coyote - DT);

      var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      var accel = p.grounded ? CFG.accelGround : CFG.accelAir;
      if (dir !== 0) {
        p.vx += dir * accel * DT;
        if (p.vx > CFG.speed) p.vx = CFG.speed;
        if (p.vx < -CFG.speed) p.vx = -CFG.speed;
        p.dir = dir;
      } else {
        var fr = (p.grounded ? CFG.frictionGround : CFG.frictionAir) * DT;
        if (Math.abs(p.vx) <= fr) p.vx = 0;
        else p.vx -= p.vx > 0 ? fr : -fr;
      }

      if (p.buffer > 0 && (p.grounded || p.coyote > 0)) {
        p.vy = -CFG.jumpVelocity;
        p.buffer = 0;
        p.coyote = 0;
        p.grounded = false;
        emit('jump', { x: p.x + CFG.width / 2, y: p.y + CFG.height });
      }
      if (!jumpHeld && p.vy < -CFG.jumpVelocity * CFG.jumpCut) {
        p.vy = -CFG.jumpVelocity * CFG.jumpCut;
      }

      p.vy += CFG.gravity * DT;
      if (p.vy > CFG.maxFall) p.vy = CFG.maxFall;

      // 에코를 밟고 있었다면 에코의 이동량만큼 먼저 실어 나른다.
      if (p.onEcho && a.echo.active) {
        p.x += a.echo.dx;
        p.y += a.echo.dy;
      }

      var wasGrounded = p.grounded;
      p.hitWall = false;
      moveX(world, p, p.vx * DT);
      p.grounded = false;
      moveY(world, p, p.vy * DT);
      groundSnap(world, p);

      // 에코는 '머리 위에서만' 밟을 수 있는 발판이다.
      var e = a.echo;
      if (e.active) {
        var overX = p.x + CFG.width > e.x + 2 && p.x < e.x + CFG.width - 2;
        var feet = p.y + CFG.height;
        var top = e.y;
        if (overX && p.vy >= -1 && p.prevBottom <= top + CFG.echoGrabUp && feet >= top - 2 && feet <= top + CFG.echoGrabDown) {
          p.y = top - CFG.height;
          p.vy = 0;
          p.grounded = true;
          p.onEcho = true;
        } else if (!overX || feet < top - 8 || feet > top + CFG.echoGrabDown) {
          p.onEcho = false;
        }
      } else {
        p.onEcho = false;
      }

      if (p.grounded) {
        p.coyote = CFG.coyoteTime;
        if (!wasGrounded) {
          emit('land', { x: p.x + CFG.width / 2, y: p.y + CFG.height });
        }
      }

      if (hazardHit(world, p)) kill(a, 'spike');
      else if (p.y > world.pixelHeight + 120) kill(a, 'fall');
    }

    session.update = function (input) {
      var a = session.attempt;
      if (!a) return;

      if (a.cleared) {
        a.clearTimer = Math.max(0, a.clearTimer - DT);
        return;
      }
      if (a.dead) {
        a.deathTimer -= DT;
        if (a.deathTimer <= 0) session.startAttempt(true);
        return;
      }

      var e = a.echo;
      if (e.active) {
        var i = Math.min(a.step, e.path.length - 1);
        var fr = e.path[i];
        e.px = e.x;
        e.py = e.y;
        e.x = fr.x;
        e.y = fr.y;
        e.dir = fr.f;
        e.grounded = !!fr.g;
        e.dx = e.x - e.px;
        e.dy = e.y - e.py;
        e.done = a.step >= e.path.length - 1;
        e.vy = e.dy / DT;
      }

      updateDoors(a);
      updatePlayer(a, input);
      if (a.dead) return;

      a.playerInGoal = centerInRect(a.player, world.goal);
      a.echoInGoal = e.active && centerInRect(e, world.goal);

      if (a.playerInGoal && !e.active && !a.needsEchoShown) {
        a.needsEchoShown = true;
        emit('needsEcho', {});
      }
      if (a.playerInGoal && a.echoInGoal && !a.cleared) {
        a.cleared = true;
        a.clearTimer = CFG.clearDelay;
        session.cleared = true;
        emit('clear', {
          x: world.goal.x + world.goal.w / 2,
          y: world.goal.y + world.goal.h / 2,
          attempts: session.attempts
        });
      }

      a.recording.push({
        x: a.player.x,
        y: a.player.y,
        f: a.player.dir,
        g: a.player.grounded ? 1 : 0
      });
      a.step += 1;
      a.time += DT;
    };

    session.startAttempt(false);
    return session;
  }

  global.ECHO_ENGINE = {
    TILE: TILE,
    DT: DT,
    CFG: CFG,
    T: T,
    parseLevel: parseLevel,
    createSession: createSession
  };
})(typeof window !== 'undefined' ? window : globalThis);
