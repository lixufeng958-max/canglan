/* 网络层：Firebase 联机 / 本机单人 两种实现，接口相同 */
(function (root) {
"use strict";
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const COLORS = root.LZ.COLORS;
const code4 = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const BOT_NAMES = ["铁壁侯", "苍狼王", "赤霄君", "云中客", "白鹿公", "玄甲将", "风行者", "霜月姬"];

/* ================= 本机模式 ================= */
function LocalNet() {
  this.mode = "local"; this.user = null; this.rooms = {}; this.evs = {}; this.subs = {};
  const flush = () => { if (this.saveT) { clearTimeout(this.saveT); this.saveT = null; Object.keys(this.rooms).forEach(c => this.persist(c)); } };
  if (typeof addEventListener === "function") { addEventListener("pagehide", flush); addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); }); }
}
LocalNet.prototype.init = async function () {
  const name = (() => { try { return localStorage.getItem("lz.localName"); } catch { return null; } })() || "我";
  this.user = { uid: "local-me", name };
  try { const s = JSON.parse(localStorage.getItem("lz.localGame")); if (s && s.room) { this.rooms[s.room.code] = s.room; this.evs[s.room.code] = s.evs; } } catch {}
};
LocalNet.prototype.onAuth = function (cb) { cb(this.user); };
LocalNet.prototype.serverNow = () => Date.now();
LocalNet.prototype.profile = async function () { try { return JSON.parse(localStorage.getItem("lz.localProfile")) || { name: this.user.name, games: 0, wins: 0, xp: 0 }; } catch { return { name: this.user.name, games: 0, wins: 0, xp: 0 }; } };
LocalNet.prototype.saveProfile = async function (p) { const cur = await this.profile(); const n = { ...cur, ...p }; try { localStorage.setItem("lz.localProfile", JSON.stringify(n)); if (p.name) localStorage.setItem("lz.localName", p.name); } catch {} if (p.name) this.user.name = p.name; };
LocalNet.prototype.persist = function (code) { try { localStorage.setItem("lz.localGame", JSON.stringify({ room: this.rooms[code], evs: this.evs[code] })); } catch {} };
LocalNet.prototype.createRoom = async function (settings) {
  const code = "SOLO";
  this.rooms[code] = { code, host: this.user.uid, status: "lobby", settings, players: [{ id: this.user.uid, name: this.user.name, color: COLORS[0], bot: false }], seed: (Math.random() * 2 ** 31) | 0 };
  this.evs[code] = []; this.persist(code); return code;
};
LocalNet.prototype.joinRoom = async function (code) { if (!this.rooms[code]) throw new Error("房间不存在"); return this.rooms[code]; };
LocalNet.prototype.lastRoom = async function () { const r = Object.values(this.rooms).find(r => r.status === "playing"); return r ? r.code : null; };
LocalNet.prototype.watchRoom = function (code, cb) { (this.subs["r" + code] ||= []).push(cb); setTimeout(() => cb(this.rooms[code]), 0); return () => { this.subs["r" + code] = this.subs["r" + code].filter(x => x !== cb); }; };
LocalNet.prototype.emitRoom = function (code) { (this.subs["r" + code] || []).forEach(cb => cb(this.rooms[code])); this.persist(code); };
LocalNet.prototype.updateRoom = async function (code, fn) { const r = this.rooms[code]; fn(r); this.emitRoom(code); };
LocalNet.prototype.startRoom = async function (code) { const r = this.rooms[code]; r.status = "playing"; r.startAt = Date.now() + 3000; this.emitRoom(code); };
LocalNet.prototype.endRoom = async function (code, result) { const r = this.rooms[code]; if (!r) return; r.status = "ended"; r.result = result; this.emitRoom(code); try { localStorage.removeItem("lz.localGame"); } catch {} };
LocalNet.prototype.watchEvents = function (code, cb) { (this.subs["e" + code] ||= []).push(cb); setTimeout(() => cb(this.evs[code] || []), 0); return () => { this.subs["e" + code] = this.subs["e" + code].filter(x => x !== cb); }; };
LocalNet.prototype.sendEvent = async function (code, ev) {
  const e = { id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), ...ev };
  this.evs[code].push(e);
  // 存盘放到空闲时做，别每条指令都卡一下
  if (!this.saveT) this.saveT = setTimeout(() => { this.saveT = null; this.persist(code); }, 3000);
  (this.subs["e" + code] || []).forEach(cb => cb(this.evs[code]));
};
LocalNet.prototype.signOut = async function () {};

/* ================= Firebase 模式 ================= */
function FireNet(config) { this.mode = "firebase"; this.config = config; this.user = null; this.offset = 0; }
FireNet.prototype.init = async function () {
  const [app, auth, fs] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")]);
  this.A = auth; this.F = fs;
  this.app = app.initializeApp(this.config);
  this.auth = auth.getAuth(this.app);
  this.db = fs.getFirestore(this.app);
};
FireNet.prototype.onAuth = function (cb) {
  this.A.onAuthStateChanged(this.auth, async u => {
    if (!u) { this.user = null; return cb(null); }
    this.user = { uid: u.uid, name: u.displayName || (u.email || "").split("@")[0] };
    await this.syncClock().catch(() => {});
    cb(this.user);
  });
};
FireNet.prototype.syncClock = async function () {
  const { doc, setDoc, getDoc, serverTimestamp } = this.F, ref = doc(this.db, "users", this.user.uid);
  const t0 = Date.now();
  await setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true });
  const s = await getDoc(ref); const t1 = Date.now();
  const st = s.data().lastSeen; if (st) this.offset = st.toMillis() - (t0 + t1) / 2;
};
FireNet.prototype.serverNow = function () { return Date.now() + this.offset; };
const fbErr = e => {
  const m = { "auth/invalid-email": "邮箱格式不对", "auth/missing-password": "请输入密码", "auth/weak-password": "密码至少 6 位", "auth/email-already-in-use": "这个邮箱已经注册过了，直接登录吧",
    "auth/invalid-credential": "邮箱或密码不对", "auth/wrong-password": "邮箱或密码不对", "auth/user-not-found": "没有这个账号，先注册", "auth/too-many-requests": "尝试太频繁，稍后再试", "auth/network-request-failed": "网络连不上", "permission-denied": "没有权限（检查 Firestore 规则）" };
  return new Error(m[e.code] || e.message || String(e));
};
FireNet.prototype.signIn = async function (email, pw) { try { await this.A.signInWithEmailAndPassword(this.auth, email, pw); } catch (e) { throw fbErr(e); } };
FireNet.prototype.signUp = async function (email, pw, name) {
  try {
    const c = await this.A.createUserWithEmailAndPassword(this.auth, email, pw);
    await this.A.updateProfile(c.user, { displayName: name });
    this.user = { uid: c.user.uid, name };
    await this.F.setDoc(this.F.doc(this.db, "users", c.user.uid), { name, games: 0, wins: 0, xp: 0 }, { merge: true });
  } catch (e) { throw fbErr(e); }
};
FireNet.prototype.signOut = async function () { await this.A.signOut(this.auth); };
FireNet.prototype.profile = async function () { const s = await this.F.getDoc(this.F.doc(this.db, "users", this.user.uid)); return { games: 0, wins: 0, xp: 0, name: this.user.name, ...(s.exists() ? s.data() : {}) }; };
FireNet.prototype.saveProfile = async function (p) {
  await this.F.setDoc(this.F.doc(this.db, "users", this.user.uid), p, { merge: true });
  if (p.name) { this.user.name = p.name; await this.A.updateProfile(this.auth.currentUser, { displayName: p.name }).catch(() => {}); }
};
FireNet.prototype.createRoom = async function (settings) {
  const { doc, runTransaction, serverTimestamp } = this.F;
  for (let k = 0; k < 6; k++) {
    const code = code4(), ref = doc(this.db, "rooms", code);
    const ok = await runTransaction(this.db, async tx => {
      const s = await tx.get(ref);
      if (s.exists() && s.data().status !== "ended") return false;
      tx.set(ref, { code, host: this.user.uid, status: "lobby", settings, created: serverTimestamp(), seed: (Math.random() * 2 ** 31) | 0,
        players: [{ id: this.user.uid, name: this.user.name, color: COLORS[0], bot: false }] });
      return true;
    });
    if (ok) { await this.saveProfile({ room: code }); return code; }
  }
  throw new Error("创建房间失败，请重试");
};
FireNet.prototype.joinRoom = async function (code) {
  code = code.toUpperCase().trim();
  const { doc, runTransaction } = this.F, ref = doc(this.db, "rooms", code);
  try {
    const room = await runTransaction(this.db, async tx => {
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error("没有这个房间号");
      const r = s.data();
      if (r.players.some(p => p.id === this.user.uid)) return r;
      if (r.status !== "lobby") throw new Error("这局已经开始了");
      if (r.players.length >= 6) throw new Error("房间已满（最多 6 人）");
      const used = r.players.map(p => p.color);
      const players = [...r.players, { id: this.user.uid, name: this.user.name, color: COLORS.find(c => !used.includes(c)), bot: false }];
      tx.update(ref, { players });
      return { ...r, players };
    });
    await this.saveProfile({ room: code });
    return room;
  } catch (e) { throw e.code ? fbErr(e) : e; }
};
FireNet.prototype.lastRoom = async function () {
  const p = await this.profile(); if (!p.room) return null;
  const s = await this.F.getDoc(this.F.doc(this.db, "rooms", p.room));
  return s.exists() && s.data().status !== "ended" ? p.room : null;
};
const roomData = s => { if (!s.exists()) return null; const d = s.data({ serverTimestamps: "estimate" }); if (d.startAt && d.startAt.toMillis) d.startAt = d.startAt.toMillis() + 5000; return d; };
FireNet.prototype.watchRoom = function (code, cb) { return this.F.onSnapshot(this.F.doc(this.db, "rooms", code), s => cb(roomData(s)), e => console.warn(e)); };
FireNet.prototype.updateRoom = async function (code, fn) {
  const { doc, runTransaction } = this.F, ref = doc(this.db, "rooms", code);
  await runTransaction(this.db, async tx => { const s = await tx.get(ref); const r = s.data(); const before = JSON.stringify(r.players); fn(r); const upd = { settings: r.settings }; if (JSON.stringify(r.players) !== before) upd.players = r.players; if (r.next) upd.next = r.next; tx.update(ref, upd); });
};
FireNet.prototype.startRoom = async function (code) { await this.F.updateDoc(this.F.doc(this.db, "rooms", code), { status: "playing", startAt: this.F.serverTimestamp() }); };
FireNet.prototype.endRoom = async function (code, result) { await this.F.updateDoc(this.F.doc(this.db, "rooms", code), { status: "ended", result }).catch(() => {}); };
FireNet.prototype.watchEvents = function (code, cb) {
  const { collection, query, orderBy, onSnapshot } = this.F;
  return onSnapshot(query(collection(this.db, "rooms", code, "events"), orderBy("ts")), { includeMetadataChanges: true }, snap => {
    // 自己刚发、服务器还没确认的指令：用校准过的本地时间，马上进入推演
    cb(snap.docs.map(d => { const x = d.data({ serverTimestamps: "estimate" }); return { id: d.id, by: x.by, type: x.type, a: x.a, cid: x.cid, ts: x.ts && !d.metadata.hasPendingWrites ? x.ts.toMillis() : x.cts }; }));
  }, e => console.warn(e));
};
FireNet.prototype.sendEvent = async function (code, ev) {
  const { collection, addDoc, serverTimestamp } = this.F;
  await addDoc(collection(this.db, "rooms", code, "events"), { by: ev.by, type: ev.type, a: JSON.parse(JSON.stringify(ev.a || {})), ts: serverTimestamp(), cts: this.serverNow(), cid: ev.cid || null });
};

root.LZNet = { LocalNet, FireNet, BOT_NAMES };
})(typeof window !== "undefined" ? window : globalThis);
