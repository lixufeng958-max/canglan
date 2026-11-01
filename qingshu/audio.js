/* 情书 — 背景乐与音效，全部用 Web Audio 现场合成
 * 背景乐：慢板（72 拍），D 大调 I–vi–IV–V 一类的温柔进行；竖琴式分解和弦打底，
 * 柔和的弦乐垫衬着，长笛般的旋律随机挑选乐句轻轻吹过。音效：出牌、出局、得心、胜利。 */
(function (root) {
"use strict";
let ctx = null, master, musicBus, sfxBus, verb, started = false, timer = null, noiseBuf = null;
const pref = k => { try { return localStorage.getItem("qs.audio." + k) !== "0"; } catch { return true; } };
const setPref = (k, v) => { try { localStorage.setItem("qs.audio." + k, v ? "1" : "0"); } catch {} };
let musicOn = pref("music"), sfxOn = pref("sfx");

const A4 = 440;
const hz = n => A4 * Math.pow(2, (n - 69) / 12); // MIDI 音号 → 频率
function init(offline) {
  if (ctx && !offline) return;
  const AC = root.AudioContext || root.webkitAudioContext; if (!AC && !offline) return;
  ctx = offline || new AC(); noiseBuf = null;
  master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? .5 : 0; musicBus.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? .7 : 0; sfxBus.connect(comp);
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
  verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = .4; verb.connect(wet); wet.connect(comp);
}
function unlockIOS() {
  try {
    const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" }))); a.loop = true; a.setAttribute("playsinline", ""); a.volume = .01; a.play().catch(() => {});
  } catch {}
}
function start() { init(); if (!ctx) return; if (ctx.state === "suspended") ctx.resume(); if (started) return; started = true; unlockIOS(); nextT = ctx.currentTime + .3; timer = setInterval(schedule, 150); }
function out(node, toVerb, bus) { node.connect(bus || musicBus); if (toVerb) node.connect(verb); }

/* ---------- 乐器 ---------- */
// 竖琴：清亮的拨弦，泛音快速衰减
function harp(t, f, vel = .4, dur = 2.4, bus) {
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = .8;
  lp.frequency.setValueAtTime(Math.min(9000, f * 10), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.5), t + dur * .7);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .28, t + .005); g.gain.exponentialRampToValueAtTime(vel * .06, t + .5); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
  for (const [m, ty, a] of [[1, "triangle", 1], [2, "sine", .3], [3, "sine", .08]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty; og.gain.value = a; o.frequency.value = f * m; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + .05); }
  lp.connect(g); out(g, true, bus);
}
// 弦乐垫：几支略微走音的锯齿波叠在一起，低通压得很暗，慢慢起慢慢落
function pad(t, notes, dur, vel = .12) {
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = .6;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + dur * .35); g.gain.setValueAtTime(vel, t + dur * .75); g.gain.linearRampToValueAtTime(0, t + dur + .3);
  for (const n of notes) for (const det of [-6, 5]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sawtooth"; o.detune.value = det; o.frequency.value = hz(n); og.gain.value = .25 / notes.length; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + .4); }
  lp.connect(g); out(g, true);
}
// 长笛：正弦 + 一点点二次泛音，慢颤音，气声起音
function flute(t, f, dur, vel = .3, prev) {
  const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = "sine"; o2.type = "sine"; o2.frequency.value = f * 2; g2.gain.value = .12;
  if (prev) { o.frequency.setValueAtTime(prev, t); o.frequency.exponentialRampToValueAtTime(f, t + .06); } else o.frequency.value = f;
  lfo.frequency.value = 4.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .009, t + Math.min(.6, dur * .5)); lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .2, t + .12); g.gain.setValueAtTime(vel * .18, t + Math.max(.14, dur - .15)); g.gain.linearRampToValueAtTime(0, t + dur + .08);
  o.connect(g); o2.connect(g2); g2.connect(g); out(g, true); o.start(t); o2.start(t); lfo.start(t); o.stop(t + dur + .2); o2.stop(t + dur + .2); lfo.stop(t + dur + .2);
  const n = noise(.4), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 3;
  ng.gain.setValueAtTime(vel * .03, t); ng.gain.exponentialRampToValueAtTime(.0005, t + .3); n.connect(bp); bp.connect(ng); out(ng, true); n.start(t); n.stop(t + .4);
}
// 钟琴：音效用
function bell(t, f, vel = .4, bus) {
  for (const [m, a, d] of [[1, 1, 2.2], [2.76, .35, 1.2], [5.4, .12, .6]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f * m; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .25 * a, t + .01); g.gain.exponentialRampToValueAtTime(.0004, t + d); o.connect(g); out(g, true, bus); o.start(t); o.stop(t + d + .05); }
}
function noise(dur) { if (!noiseBuf) { const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = dur > 2; return s; }

/* ---------- 作曲 ---------- */
const BPM = 72, BEAT = 60 / BPM;
// 和弦进行（D 大调）：每小节一个和弦，8 小节一圈。音号：D4=62
const PROG = [[62, 66, 69], [59, 62, 66], [67, 71, 74], [69, 73, 76], [62, 66, 69], [55, 59, 62], [67, 71, 74], [69, 73, 76]];
const BASS = [50, 47, 43, 45, 50, 43, 43, 45];
// 旋律乐句（相对 D 大调音阶的度数，时值以拍为单位），每句 2 小节
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const deg = (d, oct = 0) => 74 + oct * 12 + SCALE[((d % 7) + 7) % 7] + Math.floor(d / 7) * 12;
const PHRASES = [
  [[4, 1.5], [5, .5], [4, 1], [2, 1], [0, 2], [1, 1], [2, 1]],
  [[2, 1], [4, 1], [5, 1.5], [4, .5], [2, 2], [-1, 1], [0, 1]],
  [[7, 2], [5, 1], [4, 1], [2, 1.5], [4, .5], [0, 2]],
  [[0, 1], [2, 1], [4, 1], [7, 1], [5, 2], [4, 1], [2, 1]],
  [[4, 3], [2, 1], [1, 1], [0, 1], [-3, 2]]
];
let nextT = 0, beat = 0, phrase = null, pIdx = 0, pLeft = 0, prevHz = 0, horizon = null, rest = 0;
function schedule() {
  if (!ctx || !musicOn) { if (ctx) nextT = Math.max(nextT, ctx.currentTime + .1); return; }
  while (nextT < (horizon != null ? horizon : ctx.currentTime + .6)) {
    const t = nextT, bar = Math.floor(beat / 4) % 8, b = beat % 4, chord = PROG[bar];
    if (b === 0) { pad(t, chord.map(n => n - 12), BEAT * 4, .1); harp(t, hz(BASS[bar]), .45, 3.2); }
    // 竖琴分解：每拍两下，走上去再走下来
    const arp = [chord[0], chord[1], chord[2], chord[1] + 12, chord[2], chord[1], chord[0] + 12, chord[2]];
    harp(t, hz(arp[b * 2]), .32, 1.8); harp(t + BEAT / 2, hz(arp[b * 2 + 1]), .24, 1.6);
    // 旋律：每两小节一句，偶尔休息一句
    if (b === 0 && bar % 2 === 0) { if (rest > 0) { rest--; phrase = null; } else { phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]; pIdx = 0; pLeft = 0; if (Math.random() < .3) rest = 1; } }
    if (phrase && pLeft <= 0 && pIdx < phrase.length) { const [d, len] = phrase[pIdx++]; const f = hz(deg(d)); flute(t, f, len * BEAT * .95, .32, prevHz); prevHz = f; pLeft = len; }
    pLeft -= 1; nextT += BEAT; beat++;
  }
}

/* ---------- 音效 ---------- */
const SFX = {
  tap: t => harp(t, hz(86), .18, .4, sfxBus),
  play: t => { harp(t, hz(74), .4, 1.2, sfxBus); harp(t + .08, hz(81), .3, 1.4, sfxBus); },
  secret: t => { bell(t, hz(86), .3, sfxBus); bell(t + .15, hz(93), .25, sfxBus); },
  out: t => { harp(t, hz(62), .5, 1.6, sfxBus); harp(t + .18, hz(58), .5, 2, sfxBus); },
  heart: t => { [74, 78, 81, 86].forEach((n, i) => bell(t + i * .1, hz(n), .35, sfxBus)); },
  win: t => { [62, 66, 69, 74, 78, 81, 86].forEach((n, i) => harp(t + i * .11, hz(n), .45, 2.6, sfxBus)); bell(t + .9, hz(86), .4, sfxBus); },
  lose: t => { harp(t, hz(69), .4, 2, sfxBus); harp(t + .3, hz(65), .4, 2.2, sfxBus); harp(t + .6, hz(62), .4, 2.6, sfxBus); }
};
let lastSfx = {};
function play(name) { if (!ctx || !sfxOn || !SFX[name]) return; const now = ctx.currentTime; if (lastSfx[name] && now - lastSfx[name] < .2) return; lastSfx[name] = now; try { SFX[name](now + .01); } catch {} }
function setMusic(on) { musicOn = on; setPref("music", on); if (musicBus) musicBus.gain.setTargetAtTime(on ? .5 : 0, ctx.currentTime, .4); if (on) start(); }
function setSfx(on) { sfxOn = on; setPref("sfx", on); if (sfxBus) sfxBus.gain.setTargetAtTime(on ? .7 : 0, ctx.currentTime, .1); }
const kick = () => { start(); };
root.addEventListener("pointerdown", kick, true); root.addEventListener("touchend", kick, true);
document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (started) ctx.resume(); });
async function renderOffline(sec) {
  const live = ctx, sr = 44100, off = new OfflineAudioContext(2, sr * sec, sr);
  init(off); musicBus.gain.value = .5; beat = 0; nextT = .05; phrase = null; horizon = sec; const mo = musicOn; musicOn = true;
  schedule(); horizon = null; musicOn = mo;
  const buf = await off.startRendering(); ctx = live; noiseBuf = null; return buf;
}
root.QSAudio = { renderOffline, start, play, setMusic, setSfx, get music() { return musicOn; }, get sfx() { return sfxOn; } };
})(window);
