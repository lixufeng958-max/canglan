/* 余烬·尸潮 — 声音：全部现场合成（无音频文件）。音效 + 阴暗氛围乐（随尸群数量变紧张） */
(function () {
"use strict";
const A = YJ.Audio = { on: true };
try { A.on = localStorage.getItem("yj.snd") !== "0"; } catch {}
let ac = null, master = null, sfx = null, mus = null, noiseBuf = null, mood = "", tens = 0, tensT = 0, timer = null, step = 0, nextT = 0, drone = null;
const lastAt = {};
function boot() {
  if (ac) return true; const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
  ac = new C(); master = ac.createGain(); master.gain.value = A.on ? 1 : 0;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; master.connect(comp); comp.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = .8; sfx.connect(master); mus = ac.createGain(); mus.gain.value = .5; mus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
const unlock = () => { if (!boot()) return; if (ac.state !== "running") ac.resume().catch(() => {}); if (!timer) { nextT = ac.currentTime + .1; timer = setInterval(sched, 120); } };
["pointerdown", "touchstart", "keydown", "click"].forEach(e => addEventListener(e, unlock, { passive: true, capture: true }));
A.set = v => { A.on = v; try { localStorage.setItem("yj.snd", v ? "1" : "0"); } catch {} if (master) master.gain.setTargetAtTime(v ? 1 : 0, ac.currentTime, .05); };

function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(o) { // {type,f,f2,a,d,v,t,dest}
  const t = (o.t || ac.currentTime), os = ac.createOscillator(), g = ac.createGain(); os.type = o.type || "sine"; os.frequency.setValueAtTime(o.f, t); if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.a || .005) + o.d);
  env(g, t, o.a || .005, o.v, o.d); os.connect(g); g.connect(o.dest || sfx); os.start(t); os.stop(t + (o.a || .005) + o.d + .05);
}
function noise(o) { // {ft,f,f2,q,a,d,v,t}
  const t = (o.t || ac.currentTime), s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; s.loop = true; fl.type = o.ft || "lowpass"; fl.frequency.setValueAtTime(o.f, t); if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t + (o.a || .003) + o.d); fl.Q.value = o.q || .7;
  env(g, t, o.a || .003, o.v, o.d); s.connect(fl); fl.connect(g); g.connect(o.dest || sfx); s.start(t, Math.random()); s.stop(t + (o.a || .003) + o.d + .05);
}
const gun = (v, body, crack, len) => { noise({ f: crack, f2: 300, d: len, v: v * .9 }); noise({ ft: "highpass", f: 2500, d: len * .4, v: v * .4 }); tone({ type: "triangle", f: body, f2: body * .3, d: len * .8, v: v * .7 }); };
const SND = {
  pistol: v => gun(v * .5, 180, 3200, .11), smg: v => gun(v * .38, 220, 4200, .07), rifle: v => gun(v * .5, 150, 3600, .1),
  shotgun: v => { gun(v * .8, 90, 2200, .26); noise({ f: 700, f2: 120, d: .3, v: v * .5 }); }, sniper: v => { gun(v * .9, 110, 5000, .2); noise({ f: 1500, f2: 200, d: .55, v: v * .35 }); },
  launcher: v => { tone({ type: "sine", f: 240, f2: 70, d: .22, v: v * .7 }); noise({ f: 900, f2: 200, d: .2, v: v * .4 }); },
  flame: v => noise({ ft: "bandpass", f: 900, f2: 500, q: .5, a: .03, d: .16, v: v * .22 }),
  boom: v => { noise({ f: 1400, f2: 50, d: .75, v: v }); tone({ type: "sine", f: 95, f2: 28, d: .6, v: v }); noise({ ft: "highpass", f: 3000, d: .12, v: v * .5 }); },
  reload: v => { noise({ ft: "bandpass", f: 2600, q: 5, d: .04, v: v * .5 }); noise({ ft: "bandpass", f: 1500, q: 5, d: .06, v: v * .6, t: ac.currentTime + .13 }); },
  dash: v => noise({ ft: "bandpass", f: 500, f2: 2200, q: 1, a: .04, d: .16, v: v * .35 }),
  throw: v => noise({ ft: "bandpass", f: 1800, f2: 600, q: 2, a: .03, d: .14, v: v * .25 }),
  heal: v => [523, 659, 784].forEach((f, i) => tone({ f, d: .22, v: v * .22, t: ac.currentTime + i * .07 })),
  pick: v => { tone({ type: "triangle", f: 880, d: .06, v: v * .2 }); tone({ type: "triangle", f: 1320, d: .09, v: v * .2, t: ac.currentTime + .05 }); },
  rare: v => [659, 880, 1109, 1319].forEach((f, i) => tone({ type: "triangle", f, d: .35, v: v * .22, t: ac.currentTime + i * .06 })),
  key: v => [784, 988].forEach((f, i) => tone({ type: "square", f, d: .14, v: v * .12, t: ac.currentTime + i * .1 })),
  gen: v => { tone({ type: "sawtooth", f: 40, f2: 110, a: .5, d: .5, v: v * .3 }); noise({ f: 300, f2: 900, a: .5, d: .4, v: v * .2 }); },
  level: v => [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: "triangle", f, d: .3, v: v * .25, t: ac.currentTime + i * .07 })),
  win: v => [392, 494, 587, 784, 587, 784, 988].forEach((f, i) => tone({ type: "triangle", f, d: .5, v: v * .25, t: ac.currentTime + i * .13 })),
  equip: v => { noise({ ft: "bandpass", f: 1800, q: 4, d: .05, v: v * .5 }); tone({ type: "triangle", f: 300, d: .08, v: v * .3 }); },
  ui: v => tone({ type: "triangle", f: 620, d: .04, v: v * .14 }), type: v => tone({ type: "square", f: 1500 + Math.random() * 300, d: .012, v: v * .12 }),
  radio: v => { noise({ ft: "bandpass", f: 2400, q: 3, d: .09, v: v * .3 }); tone({ type: "square", f: 1200, d: .05, v: v * .1, t: ac.currentTime + .09 }); },
  zap: v => { noise({ ft: "highpass", f: 4000, d: .1, v: v * .4 }); tone({ type: "sawtooth", f: 1800, f2: 200, d: .12, v: v * .2 }); },
  hurt: v => { tone({ type: "sawtooth", f: 180, f2: 70, d: .16, v: v * .45 }); noise({ f: 900, d: .08, v: v * .4 }); },
  dead: v => { tone({ type: "sawtooth", f: 220, f2: 35, d: 1.3, v: v * .5 }); noise({ f: 500, f2: 60, d: 1.2, v: v * .4 }); },
  die: v => { noise({ ft: "bandpass", f: 700, f2: 180, q: 1.2, d: .16, v: v * .5 }); tone({ type: "sawtooth", f: 130 + Math.random() * 50, f2: 55, d: .2, v: v * .25 }); },
  spit: v => noise({ ft: "bandpass", f: 1400, f2: 400, q: 3, d: .14, v: v * .4 }),
  groan: v => growl(v * .35, 85 + Math.random() * 40, .7), horde: v => { for (let i = 0; i < 4; i++) growl(v * .4, 70 + i * 22, 1.5, i * .14); noise({ f: 200, f2: 80, a: .4, d: 1.4, v: v * .5 }); },
  roar: v => { growl(v * .9, 52, 1.7); growl(v * .7, 79, 1.5, .05); noise({ ft: "bandpass", f: 500, f2: 150, q: .8, a: .15, d: 1.4, v: v * .6 }); }
};
function growl(v, f, d, dl = 0) { const t = ac.currentTime + dl, os = ac.createOscillator(), lf = ac.createOscillator(), lg = ac.createGain(), fl = ac.createBiquadFilter(), g = ac.createGain(); os.type = "sawtooth"; os.frequency.setValueAtTime(f * 1.2, t); os.frequency.exponentialRampToValueAtTime(f * .7, t + d); lf.frequency.value = 23 + Math.random() * 12; lg.gain.value = f * .25; lf.connect(lg); lg.connect(os.frequency); fl.type = "bandpass"; fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(260, t + d); fl.Q.value = 1.4; env(g, t, d * .25, v, d * .75); os.connect(fl); fl.connect(g); g.connect(sfx); os.start(t); lf.start(t); os.stop(t + d + .1); lf.stop(t + d + .1); }
const GAP = { smg: .05, rifle: .06, flame: .09, die: .05, pick: .05, type: .04, groan: 1.2, hurt: .12, pistol: .05, zap: .08, boom: .06, spit: .1 };
A.play = function (name, vol = 1) { if (!A.on || !ac || ac.state !== "running") return; const f = SND[name]; if (!f) return; const now = ac.currentTime; if (now - (lastAt[name] || -9) < (GAP[name] || .02)) return; lastAt[name] = now; try { f(vol); } catch {} };

/* ---------- 氛围乐 ---------- */
const MOODS = { title: { root: 49, bpm: 60, pad: 1, bell: 1 }, cut: { root: 55, bpm: 56, pad: 1, bell: 1 }, safe: { root: 65.4, bpm: 64, pad: 1, bell: 1, warm: 1 }, play: { root: 46.2, bpm: 96, pad: 1, pulse: 1 } };
A.mood = function (m) { mood = m; step = 0; if (ac) setDrone(); };
A.tension = function (n) { tensT = Math.min(1, n / 14); };
function setDrone() {
  if (!ac) return; const M = MOODS[mood]; if (drone) { const d = drone; d.g.gain.setTargetAtTime(0, ac.currentTime, .6); setTimeout(() => d.os.forEach(o => { try { o.stop(); } catch {} }), 3000); drone = null; }
  if (!M) return; const g = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 260; g.gain.value = 0; g.gain.setTargetAtTime(.2, ac.currentTime, 1.5); fl.connect(g); g.connect(mus);
  const os = [1, 1.498, 2.005].map((m, i) => { const o = ac.createOscillator(); o.type = i ? "triangle" : "sawtooth"; o.frequency.value = M.root * m; o.detune.value = (i - 1) * 7; const og = ac.createGain(); og.gain.value = [.5, .22, .16][i]; o.connect(og); og.connect(fl); o.start(); return o; });
  drone = { g, fl, os };
}
const MINOR = [0, 3, 7, 10, 12, 15, 7, 3], WARM = [0, 4, 7, 11, 12, 7, 4, 2];
function sched() {
  if (!ac || ac.state !== "running") return; const M = MOODS[mood]; if (!M) return; if (!drone) setDrone();
  tens += (tensT - tens) * .08; if (drone) drone.fl.frequency.setTargetAtTime(240 + tens * 500, ac.currentTime, .4);
  const spb = 60 / M.bpm / 2; if (nextT < ac.currentTime) nextT = ac.currentTime + .05;
  while (nextT < ac.currentTime + .3) {
    const t = nextT, s = step++;
    if (M.bell && s % 4 === 0) { const sc = M.warm ? WARM : MINOR, f = M.root * 4 * Math.pow(2, sc[(s / 4 * 3 + (s >> 5)) % 8] / 12); tone({ f, d: 2.2, a: .02, v: .09, t, dest: mus }); tone({ f: f * 2.01, d: 1.2, a: .02, v: .025, t, dest: mus }); }
    if (M.pulse) {
      if (s % 8 === 0 || (tens > .35 && s % 8 === 3) || (tens > .7 && s % 8 === 6)) tone({ f: 70, f2: 34, d: .28, v: .32 + tens * .25, t, dest: mus });
      if (tens > .2 && s % 2 === 1) noise({ ft: "highpass", f: 6500, d: .03, v: .03 + tens * .05, t, dest: mus });
      if (tens > .5 && s % 8 === 4) noise({ ft: "bandpass", f: 1700, q: 1, d: .12, v: .12 * tens, t, dest: mus });
      if (tens > .15) { const f = M.root * 2 * Math.pow(2, [0, 0, 3, 0, 0, 5, 3, 1][s % 8] / 12); tone({ type: "sawtooth", f, d: spb * .8, v: .05 + tens * .07, t, dest: drone ? drone.fl : mus }); }
      if (s % 32 === 20) tone({ f: M.root * 8 * Math.pow(2, [3, 7, 10, 1][(s >> 5) % 4] / 12), d: 2.5, a: .4, v: .035, t, dest: mus });
    }
    nextT += spb;
  }
}
A.renderCheck = () => !!ac && ac.state;
})();
