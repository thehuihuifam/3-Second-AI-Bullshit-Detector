/* ECHO — WebAudio 합성 사운드 (외부 파일 없음) */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;

  function ensure() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.45;
        master.connect(ctx.destination);
      } catch (err) {
        ctx = null;
        return null;
      }
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  function tone(opts) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (opts.delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to && opts.to !== opts.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + opts.dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  function noise(dur, vol, cutoff, delay) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buffer = c.createBuffer(1, len, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff || 1200;
    var gain = c.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  var api = {
    unlock: function () { ensure(); },
    setMuted: function (value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : 0.45;
      return muted;
    },
    isMuted: function () { return muted; },
    jump: function () {
      tone({ freq: 380, to: 660, dur: 0.13, type: 'square', vol: 0.075 });
      noise(0.05, 0.03, 2600);
    },
    land: function () {
      tone({ freq: 170, to: 90, dur: 0.09, type: 'sine', vol: 0.09 });
      noise(0.07, 0.055, 900);
    },
    death: function () {
      tone({ freq: 300, to: 70, dur: 0.34, type: 'sawtooth', vol: 0.085 });
      noise(0.22, 0.06, 700);
    },
    plate: function (on) {
      tone({ freq: on ? 520 : 330, to: on ? 780 : 220, dur: 0.08, type: 'triangle', vol: 0.06 });
    },
    door: function (open) {
      tone({ freq: open ? 240 : 420, to: open ? 480 : 200, dur: 0.16, type: 'triangle', vol: 0.05 });
    },
    echo: function () {
      tone({ freq: 900, to: 1400, dur: 0.22, type: 'sine', vol: 0.045 });
    },
    click: function () {
      tone({ freq: 620, to: 820, dur: 0.06, type: 'square', vol: 0.05 });
    },
    clear: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (var i = 0; i < notes.length; i++) {
        tone({ freq: notes[i], dur: 0.55, type: 'sine', vol: 0.11, delay: i * 0.075 });
        tone({ freq: notes[i] * 2, dur: 0.3, type: 'triangle', vol: 0.035, delay: i * 0.075 });
      }
      noise(0.35, 0.03, 5200, 0.02);
    },
    fail: function () {
      tone({ freq: 220, to: 160, dur: 0.16, type: 'triangle', vol: 0.06 });
    }
  };

  global.ECHO_AUDIO = api;
})(window);
