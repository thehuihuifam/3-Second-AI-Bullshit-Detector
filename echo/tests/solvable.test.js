/* ECHO — 헤드리스 검증 스크립트 (node tests/solvable.test.js)
   각 레벨을 '의도한 해법' 입력 스크립트로 실제 시뮬레이션해
   에코 생성 · 문 타이밍 · 발판 탑승 · 동시도달 클리어가 실제로 동작하는지 확인한다. */
'use strict';

global.window = global;
require('../levels.js');
require('../engine.js');

var LEVELS = global.ECHO_LEVELS;
var ENGINE = global.ECHO_ENGINE;

function walkTo(x) {
  return { right: true, until: function (s) { return s.attempt.player.x >= x; }, max: 20 };
}
function walkToL(x) {
  return { left: true, until: function (s) { return s.attempt.player.x <= x; }, max: 20 };
}
function wait(sec) {
  return { dur: sec };
}
function jumpTo(x) {
  return { right: true, jump: true, until: function (s) { return s.attempt.player.grounded && s.attempt.player.x >= x; }, max: 4 };
}
function hopUp() {
  return { jump: true, dur: 0.30 };
}
function landOnEcho() {
  return { until: function (s) { return s.attempt.player.onEcho; }, max: 2 };
}
function ride() {
  return { until: function (s) { return s.attempt.player.grounded && s.attempt.player.y < 300; }, max: 8 };
}
function pushThrough(x) {
  return { right: true, until: function (s) { return s.attempt.player.x >= x; }, max: 12 };
}

function runScript(session, script, maxSec) {
  var idx = 0;
  var cmdTime = 0;
  var steps = Math.round((maxSec || 30) / ENGINE.DT);
  for (var i = 0; i < steps; i++) {
    var a = session.attempt;
    if (a.cleared) return 'cleared';
    if (a.dead) return 'dead(cmd' + idx + ')';
    var cmd = script[Math.min(idx, script.length - 1)];
    session.update({ left: !!cmd.left, right: !!cmd.right, jump: !!cmd.jump });
    cmdTime += ENGINE.DT;
    var advance = false;
    if (cmd.until && cmd.until(session)) advance = true;
    if (!advance && cmd.dur != null && cmdTime >= cmd.dur) advance = true;
    if (!advance && cmd.max != null && cmdTime > cmd.max) advance = true;
    if (advance) { idx += 1; cmdTime = 0; }
  }
  return 'timeout(cmd' + idx + ')';
}

var PLANS = {
  1: [
    [walkTo(680), jumpTo(720), walkTo(840), wait(0.6)],
    [walkTo(680), jumpTo(720), walkTo(840), wait(0.6)]
  ],
  2: [
    [walkTo(250), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 370 && s.attempt.player.grounded; }, max: 4 },
      walkTo(455), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 500 && s.attempt.player.grounded; }, max: 4 },
      walkTo(640), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 745 && s.attempt.player.grounded; }, max: 4 },
      walkTo(838), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 880 && s.attempt.player.grounded; }, max: 4 },
      walkTo(950), wait(0.6)],
    [walkTo(250), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 370 && s.attempt.player.grounded; }, max: 4 },
      walkTo(455), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 500 && s.attempt.player.grounded; }, max: 4 },
      walkTo(640), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 745 && s.attempt.player.grounded; }, max: 4 },
      walkTo(838), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 880 && s.attempt.player.grounded; }, max: 4 },
      walkTo(950), wait(0.6)]
  ],
  3: [
    [walkTo(838), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 880 && s.attempt.player.grounded; }, max: 4 }, walkTo(950), wait(0.6)],
    [walkTo(838), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 880 && s.attempt.player.grounded; }, max: 4 }, walkTo(950), wait(0.6)]
  ],
  4: [
    [walkTo(360), wait(1.2)],
    [walkTo(360), wait(1.4), walkTo(805), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 860 && s.attempt.player.grounded; }, max: 4 }, walkTo(900), wait(0.8)],
    [walkTo(805), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 860 && s.attempt.player.grounded; }, max: 4 }, walkTo(900), wait(0.8)]
  ],
  5: [
    [walkTo(200), wait(1.2)],
    [walkTo(200), wait(3.2), walkTo(970), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1010 && s.attempt.player.grounded; }, max: 4 }, walkTo(1080), wait(0.8)],
    [walkTo(970), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1010 && s.attempt.player.grounded; }, max: 4 }, walkTo(1080), wait(0.8)]
  ],
  6: [
    [walkTo(415), wait(1.0)],
    [walkTo(405), hopUp(), landOnEcho(), hopUp(), { right: true, until: function (s) { return s.attempt.player.grounded && s.attempt.player.y < 300; }, max: 4 }, walkTo(900), wait(0.8)],
    [{ right: true, jump: true, dur: 0.30 }, { right: true, until: function (s) { return s.attempt.player.onEcho; }, max: 2 }, ride(), walkTo(900), wait(0.8)]
  ],
  7: [
    [walkTo(360), wait(1.2)],
    [walkTo(360), wait(1.2), walkTo(810), wait(1.2)],
    [walkTo(410), pushThrough(470), walkTo(860), pushThrough(920), walkTo(1125),
      { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1180 && s.attempt.player.grounded; }, max: 4 }, walkTo(1240), wait(0.8)],
    [walkTo(410), pushThrough(470), walkTo(860), pushThrough(920), walkTo(1125),
      { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1180 && s.attempt.player.grounded; }, max: 4 }, walkTo(1240), wait(0.8)]
  ],
  8: [
    [walkTo(455), wait(1.2)],
    [walkTo(230),
      { right: true, jump: true, dur: 0.26 }, { right: true, until: function (s) { return s.attempt.player.grounded && s.attempt.player.y <= 356; }, max: 2 }, wait(0.12),
      { right: true, jump: true, dur: 0.26 }, { right: true, until: function (s) { return s.attempt.player.grounded && s.attempt.player.y <= 324; }, max: 2 }, wait(0.12),
      { right: true, jump: true, dur: 0.26 }, { right: true, until: function (s) { return s.attempt.player.grounded && s.attempt.player.y <= 260; }, max: 2 },
      walkTo(455), wait(1.4), walkTo(790), walkTo(1125),
      { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1180 && s.attempt.player.grounded; }, max: 4 }, walkTo(1240), wait(0.8)],
    [walkTo(680), pushThrough(760), walkTo(1125), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1180 && s.attempt.player.grounded; }, max: 4 }, walkTo(1240), wait(0.8)]
  ],
  9: [
    [walkTo(230), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 370 && s.attempt.player.grounded; }, max: 4 }, walkTo(520), wait(1.2)],
    [walkTo(230), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 370 && s.attempt.player.grounded; }, max: 4 },
      walkTo(520), wait(1.6), walkTo(840), wait(1.6)],
    [walkTo(230), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 370 && s.attempt.player.grounded; }, max: 4 },
      walkTo(690), pushThrough(760), walkTo(950), pushThrough(1010), walkTo(1030),
      { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1075 && s.attempt.player.grounded; }, max: 4 }, walkTo(1140), wait(0.8)],
    [walkTo(230), { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 370 && s.attempt.player.grounded; }, max: 4 },
      walkTo(690), pushThrough(760), walkTo(950), pushThrough(1010), walkTo(1030),
      { right: true, jump: true, until: function (s) { return s.attempt.player.x >= 1075 && s.attempt.player.grounded; }, max: 4 }, walkTo(1140), wait(0.8)]
  ],
  10: [
    [walkTo(200), wait(1.2)],
    [walkTo(200), wait(1.4), walkTo(920), wait(1.0)],
    [walkTo(200), wait(1.4), walkTo(915),
      { until: function (s) { return s.attempt.echo.x >= 900; }, max: 8 },
      hopUp(), landOnEcho(), hopUp(),
      { right: true, until: function (s) { return s.attempt.player.grounded && s.attempt.player.y < 300; }, max: 4 },
      walkTo(1150), wait(0.8)],
    [walkTo(280), pushThrough(360), walkTo(690),
      { until: function (s) { return s.attempt.echo.x >= s.attempt.player.x - 8; }, max: 10 },
      { right: true, jump: true, dur: 0.30 },
      { right: true, until: function (s) { return s.attempt.player.onEcho; }, max: 2 },
      ride(), walkTo(1150), wait(0.8)]
    ]
};

/* ---------- 메카닉 단위 검증 ---------- */

function assert(ok, label) {
  if (!ok) { failures += 1; console.log('FAIL  ' + label); }
  else console.log('PASS  ' + label);
}

// Q2: 두 번째 시도에서 에코가 직전 시도의 경로를 프레임 단위로 그대로 재현하는가
(function () {
  var session = ENGINE.createSession(LEVELS[0]);
  session.startAttempt(false);
  for (var i = 0; i < 240; i++) {
    session.update({ left: false, right: i < 150, jump: i % 37 === 0 });
  }
  var recorded = session.attempt.recording.slice();
  session.startAttempt(true);
  var maxDiff = 0;
  for (var k = 0; k < 200; k++) {
    session.update({ left: false, right: false, jump: false });
    var e = session.attempt.echo;
    var f = recorded[k];
    maxDiff = Math.max(maxDiff, Math.abs(e.x - f.x), Math.abs(e.y - f.y));
  }
  assert(session.attempt.echo.active, 'Q2 에코 생성: 두 번째 시도에 에코가 등장한다');
  assert(maxDiff < 0.001, 'Q2 경로 재현: 에코 위치가 직전 기록과 프레임 단위로 일치한다 (오차 ' + maxDiff.toFixed(6) + 'px)');
})();

// Q3: 에코 없이(첫 시도) 목표에 닿아도 클리어되지 않는가
(function () {
  var def = LEVELS[0];
  var world = ENGINE.parseLevel(def);
  var session = ENGINE.createSession(def);
  session.startAttempt(false);
  session.attempt.player.x = world.goal.x + world.goal.w / 2 - ENGINE.CFG.width / 2;
  session.attempt.player.y = world.goal.y + world.goal.h - ENGINE.CFG.height;
  for (var i = 0; i < 120; i++) {
    session.update({ left: false, right: false, jump: false });
    session.attempt.player.x = world.goal.x + world.goal.w / 2 - ENGINE.CFG.width / 2;
    session.attempt.player.y = world.goal.y + world.goal.h - ENGINE.CFG.height;
  }
  assert(session.attempt.playerInGoal === true, 'Q3 목표 진입 판정: 플레이어가 목표 안에 들어간다');
  assert(session.attempt.cleared === false, 'Q3 단독 클리어 차단: 에코 없이는 절대 클리어되지 않는다');
  var needsEcho = false;
  for (var k = 0; k < session.events.length; k++) {
    if (session.events[k].type === 'needsEcho') needsEcho = true;
  }
  assert(needsEcho, 'Q3 안내 이벤트: 혼자서는 안 된다는 needsEcho 이벤트가 발화된다');
})();

// Q3: 에코와 동시에 들어갔을 때만 클리어되는가
(function () {
  var def = LEVELS[0];
  var world = ENGINE.parseLevel(def);
  var session = ENGINE.createSession(def);
  session.startAttempt(false);
  var goalX = world.goal.x + world.goal.w / 2 - ENGINE.CFG.width / 2;
  var goalY = world.goal.y + world.goal.h - ENGINE.CFG.height;
  session.attempt.player.x = goalX;
  session.attempt.player.y = goalY;
  for (var i = 0; i < 60; i++) {
    session.update({ left: false, right: false, jump: false });
    session.attempt.player.x = goalX;
    session.attempt.player.y = goalY;
  }
  session.startAttempt(true);
  for (var j = 0; j < 120; j++) {
    session.attempt.player.x = goalX;
    session.attempt.player.y = goalY;
    session.update({ left: false, right: false, jump: false });
  }
  assert(session.attempt.echoInGoal === true, 'Q3 에코 목표 진입: 직전 시도를 재현한 에코도 목표에 들어간다');
  assert(session.attempt.cleared === true, 'Q3 동시 도달 클리어: 둘 다 들어간 순간 클리어된다');
  assert(session.events.filter(function (e) { return e.type === 'clear'; }).length === 1, 'Q3 클리어 1회 트리거: clear 이벤트는 단 한 번만 발화된다');
})();

// Q5: 모든 레벨이 시작/목표를 갖고 있고 스위치·문이 짝을 이루는가
(function () {
  var ok = true;
  for (var i = 0; i < LEVELS.length; i++) {
    var world = ENGINE.parseLevel(LEVELS[i]);
    if (!world.goal || world.goal.w <= 0) ok = false;
    for (var g = 0; g < world.groups.length; g++) {
      var group = world.groups[g];
      if (group.plates.length && !group.doors.length) ok = false;
      if (group.doors.length && !group.plates.length) ok = false;
    }
  }
  assert(ok, 'Q5 레벨 데이터 무결성: 10개 레벨 전부 목표를 갖고 스위치·문이 짝을 이룬다');
})();

// Q6: 코요테 타임과 점프 버퍼가 실제로 동작하는가
(function () {
  var session = ENGINE.createSession(LEVELS[0]);
  session.startAttempt(false);
  for (var i = 0; i < 30; i++) session.update({ left: false, right: false, jump: false });
  // 공중으로 띄운 뒤(착지 불가) 점프 입력을 넣어도 버퍼가 남아 있는지 확인
  session.attempt.player.y -= 60;
  session.attempt.player.grounded = false;
  session.attempt.player.coyote = 0;
  session.update({ left: false, right: false, jump: true });
  var buffered = session.attempt.player.buffer > 0;
  session.attempt.player.grounded = true;
  session.update({ left: false, right: false, jump: false });
  var jumpedFromBuffer = session.attempt.player.vy < -100;
  for (var k = 0; k < 90; k++) session.update({ left: false, right: false, jump: false });
  var coyote = session.attempt.player.grounded && session.attempt.player.coyote > 0;
  assert(buffered, 'Q6 점프 버퍼: 공중에서 누른 점프가 버퍼에 저장된다');
  assert(jumpedFromBuffer, 'Q6 점프 버퍼: 착지 프레임에 버퍼가 터지며 점프가 실행된다');
  assert(coyote, 'Q6 코요테 타임: 지상에 서 있는 동안 코요테 타이머가 채워진다');
})();

console.log('');

var failures = 0;
for (var i = 0; i < LEVELS.length; i++) {
  var def = LEVELS[i];
  var plan = PLANS[def.id];
  var session = ENGINE.createSession(def);
  session.startAttempt(false);
  var result = 'no-plan';
  var detail = [];
  for (var k = 0; k < plan.length; k++) {
    result = runScript(session, plan[k], 40);
    detail.push('시도' + (k + 1) + ':' + result);
    if (result === 'cleared') break;
    session.startAttempt(true);
  }
  var ok = result === 'cleared';
  if (!ok) failures += 1;
  console.log(
    (ok ? 'PASS' : 'FAIL') + '  Lv.' + (def.id < 10 ? '0' : '') + def.id + ' ' + def.name +
    '  → ' + result + '   [' + detail.join(' | ') + ']'
  );
}

console.log('');
console.log(failures === 0 ? 'ALL LEVELS CLEARABLE: ' + LEVELS.length + '/' + LEVELS.length : 'FAILURES: ' + failures);
process.exit(failures === 0 ? 0 : 1);
