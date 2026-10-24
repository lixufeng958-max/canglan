/* 声音：全部用 Web Audio 现场合成，不需要下载任何音频文件
 * 背景乐：五声音阶（宫商角徵羽）的古琴拨弦 + 箫声长音 + 低音持续音；开战后加入战鼓，决战时鼓点更急
 * 音效：发牌、交战、攻城、天时、警报、训练、出兵 */
(function (root) {
"use strict";
let ctx = null, master, musicBus, sfxBus, verb, started = false, timer = null;
const pref = k => { try { return localStorage.getItem("lz.audio." + k) !== "0"; } catch { return true; } };
const setPref = (k, v) => { try { localStorage.setItem("lz.audio." + k, v ? "1" : "0"); } catch {} };
let musicOn = pref("music"), sfxOn = pref("sfx"), phase = "menu";

// 羽调式五声音阶（A C D E G），听起来更苍凉、更有杀气
const BASE = 110; // A2
const PENTA = [0, 3, 5, 7, 10];
const noteHz = deg => { const o = Math.floor(deg / 5), i = ((deg % 5) + 5) % 5; return BASE * Math.pow(2, o + PENTA[i] / 12); };

function init(offline) {
  if (ctx && !offline) return;
  const AC = root.AudioContext || root.webkitAudioContext; if (!AC && !offline) return;
  ctx = offline || new AC(); noiseBuf = null;
  master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? .55 : 0; musicBus.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? .8 : 0; sfxBus.connect(comp);
  // 混响：程序生成的衰减噪声脉冲
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = .32; verb.connect(wet); wet.connect(comp);
}
// iOS：先播一段无声音频，让网页声音不受静音键影响，并在用户手势里解锁
function unlockIOS() {
  try {
    const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" }))); a.loop = true; a.setAttribute("playsinline", ""); a.volume = .01; a.play().catch(() => {});
  } catch {}
}
function start() {
  init(); if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  if (started) return; started = true; unlockIOS();
  nextT = ctx.currentTime + .2; timer = setInterval(schedule, 120);
}

/* ---------- 乐器 ---------- */
function out(node, toVerb, bus) { node.connect(bus || musicBus); if (toVerb) node.connect(verb); }
// 古琴：拨弦（三角波 + 泛音 + 起音时的轻微滑音 + 渐闭的低通）
function qin(t, hz, vel = .5, dur = 2.6, bus) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 1.2;
  f.frequency.setValueAtTime(Math.min(6000, hz * 14), t); f.frequency.exponentialRampToValueAtTime(Math.max(300, hz * 2.2), t + dur * .6);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .32, t + .006); g.gain.exponentialRampToValueAtTime(vel * .09, t + .35); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  for (const [mul, type, amp] of [[1, "triangle", 1], [2, "sine", .35], [3, "sine", .12]]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; og.gain.value = amp;
    o.frequency.setValueAtTime(hz * mul * 1.012, t); o.frequency.exponentialRampToValueAtTime(hz * mul, t + .08);
    o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + .05);
  }
  f.connect(g); out(g, true, bus);
}
// 箫：气声长音（正弦 + 颤音 + 少量气息噪声）
function xiao(t, hz, dur, vel = .25) {
  const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = "sine"; o.frequency.value = hz; lfo.frequency.value = 5.2; lg.gain.value = hz * .006; lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .16, t + .35); g.gain.setValueAtTime(vel * .16, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); out(g, true); o.start(t); lfo.start(t); o.stop(t + dur + .1); lfo.stop(t + dur + .1);
  const n = noise(dur), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = "bandpass"; bp.frequency.value = hz * 2; bp.Q.value = 2;
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vel * .025, t + .3); ng.gain.linearRampToValueAtTime(0, t + dur);
  n.connect(bp); bp.connect(ng); out(ng, true); n.start(t);
}
// 持续低音
function drone(t, hz, dur) {
  for (const [m, a] of [[1, .05], [1.5, .025]]) { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = "sawtooth"; o.frequency.value = hz * m; f.type = "lowpass"; f.frequency.value = 260;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(f); f.connect(g); out(g, false); o.start(t); o.stop(t + dur + .1); }
}
let noiseBuf = null;
function noise(dur) { if (!noiseBuf) { const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = dur > 2; return s; }
// 战鼓
function drum(t, vel = .6, bus, hz = 62) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
  o.frequency.setValueAtTime(hz * 2.2, t); o.frequency.exponentialRampToValueAtTime(hz, t + .12);
  g.gain.setValueAtTime(vel * .9, t); g.gain.exponentialRampToValueAtTime(.001, t + .55);
  o.connect(g); out(g, true, bus); o.start(t); o.stop(t + .6);
  const n = noise(.2), f = ctx.createBiquadFilter(), ng = ctx.createGain(); f.type = "lowpass"; f.frequency.value = 900;
  ng.gain.setValueAtTime(vel * .35, t); ng.gain.exponentialRampToValueAtTime(.001, t + .14); n.connect(f); f.connect(ng); out(ng, false, bus); n.start(t); n.stop(t + .2);
}
// 锣：不谐和泛音，长尾
function gong(t, vel = .5, bus) {
  for (const [m, a, d] of [[1, 1, 3.5], [1.47, .6, 2.8], [2.09, .45, 2.2], [2.56, .3, 1.6], [3.18, .2, 1.2]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(110 * m * 1.03, t); o.frequency.exponentialRampToValueAtTime(110 * m, t + .4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .16 * a, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + d);
    o.connect(g); out(g, true, bus); o.start(t); o.stop(t + d + .05);
  }
}
// 木鱼/梆子
function wood(t, vel = .5, hz = 900, bus) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(hz * .7, t + .08);
  g.gain.setValueAtTime(vel * .4, t); g.gain.exponentialRampToValueAtTime(.001, t + .12); o.connect(g); out(g, false, bus); o.start(t); o.stop(t + .15);
}
// 金属碰撞
function clash(t, vel = .5, bus) {
  const n = noise(.4), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 3;
  g.gain.setValueAtTime(vel * .5, t); g.gain.exponentialRampToValueAtTime(.001, t + .28); n.connect(f); f.connect(g); out(g, true, bus); n.start(t); n.stop(t + .35);
  for (const hz of [1870, 2630]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "square"; o.frequency.value = hz; og.gain.setValueAtTime(vel * .03, t); og.gain.exponentialRampToValueAtTime(.0005, t + .25); o.connect(og); out(og, true, bus); o.start(t); o.stop(t + .3); }
}

/* ---------- 更多乐器 ---------- */
// 号角 / 唢呐：两支略微走音的锯齿波 + 共振峰滤波 + 延迟颤音 + 滑音
function horn(t, hz, dur, vel = .5, prevHz) {
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2600, t + .08); lp.frequency.linearRampToValueAtTime(1900, t + dur);
  pk.type = "peaking"; pk.frequency.value = 1150; pk.Q.value = 1.4; pk.gain.value = 7;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .11, t + .05); g.gain.setValueAtTime(vel * .1, t + Math.max(.06, dur - .09)); g.gain.linearRampToValueAtTime(0, t + dur + .05);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * .012, t + Math.min(.5, dur * .6)); lfo.connect(lg);
  for (const det of [-7, 6]) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.detune.value = det;
    if (prevHz) { o.frequency.setValueAtTime(prevHz, t); o.frequency.exponentialRampToValueAtTime(hz, t + .07); } else { o.frequency.setValueAtTime(hz * .97, t); o.frequency.exponentialRampToValueAtTime(hz, t + .05); }
    lg.connect(o.frequency); o.connect(lp); o.start(t); o.stop(t + dur + .1);
  }
  lp.connect(pk); pk.connect(g); out(g, true); lfo.start(t); lfo.stop(t + dur + .1);
}
// 琵琶轮指：同一个音快速连弹（《十面埋伏》那种紧张感）
function pipa(t, hz, dur, vel = .45) {
  const step = .062; let k = 0;
  for (let x = 0; x < dur - .02; x += step, k++) qin(t + x, hz, vel * (k === 0 ? 1 : .55 + .1 * Math.sin(k)), .35);
}
// 低音弦：短促有力的八分音符
function bass(t, hz, dur, vel = .5) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 3;
  f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(260, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * .2, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  for (const [m, ty] of [[1, "sawtooth"], [.5, "square"]]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = hz * m; const og = ctx.createGain(); og.gain.value = m === 1 ? 1 : .45; o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + .02); }
  f.connect(g); out(g, false);
}
// 小鼓 / 拍板
function snare(t, vel = .4) {
  const n = noise(.2), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = .9;
  g.gain.setValueAtTime(vel * .45, t); g.gain.exponentialRampToValueAtTime(.001, t + .13); n.connect(f); f.connect(g); out(g, true); n.start(t); n.stop(t + .16);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(160, t + .06); og.gain.setValueAtTime(vel * .25, t); og.gain.exponentialRampToValueAtTime(.001, t + .08); o.connect(og); out(og, false); o.start(t); o.stop(t + .1);
}
// 铙钹
function cymbal(t, vel = .35) {
  const n = noise(2.4), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "highpass"; f.frequency.value = 5200;
  g.gain.setValueAtTime(vel * .3, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.8); n.connect(f); f.connect(g); out(g, true); n.start(t); n.stop(t + 2);
}

/* ---------- 作曲：战鼓开路，号角领奏，低音弦推进 ----------
 以十六分音符为步长排程；乐句是预先写好的两小节动机，随机组合、移调 */
const TEMPO = { menu: 96, dev: 104, war: 120, final: 138 };
// 两小节旋律（音级, 时值[十六分]），每句共 32 步
const PHRASES = [
  [[5, 4], [5, 2], [7, 2], [8, 6], [7, 2], [5, 4], [4, 4], [5, 8]],
  [[8, 2], [7, 2], [5, 4], [7, 4], [8, 4], [10, 8], [8, 8]],
  [[5, 6], [4, 2], [2, 4], [4, 4], [5, 4], [7, 4], [5, 8]],
  [[10, 4], [8, 4], [7, 2], [8, 2], [7, 4], [5, 4], [4, 4], [5, 8]],
  [[7, 4], [5, 4], [4, 4], [2, 4], [4, 8], [0, 8]],
  [[5, 2], [5, 2], [5, 2], [7, 2], [8, 4], [7, 4], [10, 6], [8, 2], [7, 8]]
];
const ROOTS = [0, 0, -1, -2, 0, 0, -3, -1]; // 每小节低音根音（音级），A A G E A A D G
// 战鼓谱：每小节 16 步，数字为力度
const KICK = {
  menu:  [1, 0, 0, 0, 0, 0, .6, 0, .9, 0, 0, 0, 0, 0, .5, 0],
  dev:   [1, 0, 0, 0, 0, 0, .5, 0, .9, 0, .5, 0, 0, 0, 0, 0],
  war:   [1, 0, 0, .4, 0, 0, .7, 0, .9, 0, 0, .6, 0, 0, .7, 0],
  final: [1, 0, .5, 0, .8, 0, .6, 0, 1, 0, .5, .5, .8, 0, .6, .6]
};
let horizon = null, nextT = 0, step = 0, phrase = null, pIdx = 0, pLeft = 0, prevHz = 0, curNote = null;
function schedule() {
  if (!ctx || !musicOn) { if (ctx) nextT = Math.max(nextT, ctx.currentTime + .1); return; }
  while (nextT < (horizon != null ? horizon : ctx.currentTime + .5)) {
    const bpm = TEMPO[phase] || 100, st = 60 / bpm / 4, t = nextT, s16 = step % 16, bar = Math.floor(step / 16), war = phase === "war" || phase === "final";
    // 鼓
    const kv = (KICK[phase] || KICK.menu)[s16];
    if (kv) drum(t, kv * (war ? .75 : .6), null, s16 % 8 === 0 ? 55 : 82);
    if (war && (s16 === 4 || s16 === 12)) snare(t, .45);
    if (phase === "final" && bar % 4 === 3 && s16 >= 8) snare(t, .2 + (s16 - 8) * .04);
    if (phase === "dev" && s16 === 12 && bar % 2) snare(t, .25);
    if (s16 === 0 && bar % 4 === 0 && war) cymbal(t, phase === "final" ? .45 : .3);
    if (s16 === 0 && bar % 8 === 0 && (phase === "final" || phase === "menu")) gong(t, .28);
    // 低音弦：八分音符推进（发育期每拍一下）
    const rootDeg = ROOTS[bar % 8];
    if ((war && s16 % 2 === 0) || (!war && s16 % 4 === 0)) { const oct = s16 % 8 === 6 && war ? 5 : 0; bass(t, noteHz(rootDeg + oct), st * (war ? 1.8 : 3.4), s16 % 4 === 0 ? .6 : .4); }
    // 旋律：每两小节一句；第 7、8 小节（每 8 小节的尾巴）留给鼓
    if (s16 === 0 && bar % 2 === 0) { const rest = bar % 8 === 6 && phase !== "final"; phrase = rest ? null : PHRASES[Math.floor(Math.random() * PHRASES.length)]; pIdx = 0; pLeft = 0; }
    if (phrase && pLeft <= 0 && pIdx < phrase.length) {
      const [d, len] = phrase[pIdx++], hz = noteHz(d + 5 + (phase === "final" && bar % 4 >= 2 ? 0 : 0)); pLeft = len; const dur = len * st;
      if (war) { horn(t, hz, dur * .92, phase === "final" ? .62 : .5, prevHz); if (phase === "final") horn(t, hz / 2, dur * .92, .25); if (len >= 6) pipa(t, hz * 2, dur * .9, .18); }
      else if (phase === "dev") { pipa(t, hz, dur * .95, .4); if (len >= 8) horn(t, hz / 2, dur, .22); }
      else { horn(t, hz, dur * .92, .4, prevHz); }
      prevHz = hz;
    }
    pLeft--;
    nextT += st; step++;
  }
}

/* ---------- 音效 ---------- */
const SFX = {
  tap: t => wood(t, .25, 1300, sfxBus),
  deal: t => { qin(t, noteHz(12), .5, 1.2, sfxBus); qin(t + .09, noteHz(14), .45, 1.4, sfxBus); },
  rare: t => { qin(t, noteHz(10), .5, 1.6, sfxBus); qin(t + .08, noteHz(12), .5, 1.6, sfxBus); qin(t + .16, noteHz(15), .55, 2.2, sfxBus); gong(t, .25, sfxBus); },
  order: t => { drum(t, .45, sfxBus, 80); drum(t + .16, .35, sfxBus, 80); },
  battle: t => { drum(t, .7, sfxBus); clash(t + .05, .55, sfxBus); clash(t + .32, .4, sfxBus); drum(t + .3, .5, sfxBus); },
  capture: t => { gong(t, .55, sfxBus); drum(t, .5, sfxBus); },
  lose: t => { gong(t, .5, sfxBus); qin(t + .1, noteHz(2), .5, 2, sfxBus); qin(t + .4, noteHz(0), .5, 2.4, sfxBus); },
  omen: t => { gong(t, .6, sfxBus); qin(t + .5, noteHz(9), .4, 2, sfxBus); qin(t + .75, noteHz(12), .4, 2.4, sfxBus); },
  alert: t => { wood(t, .5, 1000, sfxBus); wood(t + .13, .5, 1000, sfxBus); wood(t + .26, .5, 1000, sfxBus); },
  train: t => { clash(t, .35, sfxBus); drum(t + .05, .4, sfxBus, 90); },
  volley: t => { for (let i = 0; i < 6; i++) { const n = noise(.2), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "highpass"; f.frequency.value = 2500; g.gain.setValueAtTime(.12, t + i * .05); g.gain.exponentialRampToValueAtTime(.001, t + i * .05 + .12); n.connect(f); f.connect(g); out(g, false, sfxBus); n.start(t + i * .05); n.stop(t + i * .05 + .15); } },
  phase: t => { gong(t, .6, sfxBus); drum(t + .2, .6, sfxBus); drum(t + .6, .6, sfxBus); drum(t + 1, .7, sfxBus); },
  win: t => { [0, 2, 4, 7, 9, 12].forEach((d, i) => qin(t + i * .14, noteHz(d + 5), .5, 2.5, sfxBus)); gong(t + .9, .5, sfxBus); }
};
let lastSfx = {};
function play(name) {
  if (!ctx || !sfxOn || !SFX[name]) return;
  const now = ctx.currentTime; if (lastSfx[name] && now - lastSfx[name] < .25) return; lastSfx[name] = now;
  try { SFX[name](now + .01); } catch {}
}
function setPhase(p) { if (p !== phase) { phase = p; } }
function setMusic(on) { musicOn = on; setPref("music", on); if (musicBus) musicBus.gain.setTargetAtTime(on ? .55 : 0, ctx.currentTime, .3); if (on) start(); }
function setSfx(on) { sfxOn = on; setPref("sfx", on); if (sfxBus) sfxBus.gain.setTargetAtTime(on ? .8 : 0, ctx.currentTime, .1); }
// 第一次触摸时启动（浏览器要求声音必须由用户操作开启）
const kick = () => { start(); };
root.addEventListener("pointerdown", kick, true);
root.addEventListener("touchend", kick, true);
document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (started) ctx.resume(); });
// 测试用：离线渲染一段背景乐
async function renderOffline(sec, ph) {
  const live = ctx, sr = 44100, off = new OfflineAudioContext(2, sr * sec, sr);
  init(off); musicBus.gain.value = .55; phase = ph; step = 0; nextT = .05; phrase = null; horizon = sec; const mo = musicOn; musicOn = true;
  schedule(); horizon = null; musicOn = mo;
  const buf = await off.startRendering(); ctx = live; noiseBuf = null; return buf;
}
root.LZAudio = { renderOffline, start, play, setPhase, setMusic, setSfx, get music() { return musicOn; }, get sfx() { return sfxOn; } };
})(window);
