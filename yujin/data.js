/* 余烬·尸潮 — 数据：武器、装备词条、天赋、敌人、关卡、剧情 */
window.YJ = { TILE: 40, VERSION: "余烬 v2 · 暗黑基地" };

YJ.RAR = [{ n: "普通", c: "#B9B9B9" }, { n: "精良", c: "#4FA3FF" }, { n: "稀有", c: "#FFD23F" }, { n: "传说", c: "#FF7A2F" }];
YJ.SLOTS = { weapon: "武器", armor: "护甲", boots: "靴子", charm: "饰品" };

/* 武器基底：dmg 单发伤害，rate 每秒发数，mag 弹匣，reload 换弹秒数，spread 散布(弧度)，speed 弹速，pellets 弹丸数 */
YJ.WEAPONS = {
  pistol:   { name: "手枪",     dmg: 17, rate: 4.2, mag: 12, reload: .9,  spread: .035, speed: 950, pellets: 1, pierce: 0, range: 560, kick: 2, w: 20 },
  smg:      { name: "冲锋枪",   dmg: 10, rate: 11,  mag: 34, reload: 1.3, spread: .09,  speed: 900, pellets: 1, pierce: 0, range: 480, kick: 1.5, w: 20 },
  shotgun:  { name: "霰弹枪",   dmg: 9,  rate: 1.4, mag: 6,  reload: 1.7, spread: .26,  speed: 820, pellets: 8, pierce: 0, range: 330, kick: 6, w: 18 },
  rifle:    { name: "突击步枪", dmg: 21, rate: 7,   mag: 30, reload: 1.5, spread: .045, speed: 1100, pellets: 1, pierce: 1, range: 640, kick: 2.5, w: 18 },
  sniper:   { name: "狙击枪",   dmg: 85, rate: 1.3, mag: 5,  reload: 1.9, spread: .005, speed: 1700, pellets: 1, pierce: 4, range: 900, kick: 7, w: 9 },
  flamer:   { name: "喷火器",   dmg: 5,  rate: 24,  mag: 90, reload: 2.2, spread: .2,   speed: 400, pellets: 1, pierce: 99, range: 200, kick: 0, flame: 1, w: 8 },
  launcher: { name: "榴弹发射器", dmg: 60, rate: 1.1, mag: 4, reload: 2.3, spread: .03,  speed: 560, pellets: 1, pierce: 0, range: 520, kick: 8, ex: 85, w: 7 }
};
YJ.GEAR = { armor: { name: "防弹衣", imp: { hp: 28, armor: 4 } }, boots: { name: "军靴", imp: { ms: 5 } }, charm: { name: "护符", imp: {} } };

/* 词条：k 属性，t 显示模板，a/b 数值范围（ilvl 越高越接近 b 并略有放大），s 可出现的部位，w 权重 */
YJ.AFFIX = [
  { k: "dmg", t: "伤害 +{}%", a: 6, b: 22, s: "weapon,charm", w: 10 },
  { k: "rate", t: "射速 +{}%", a: 5, b: 18, s: "weapon,charm", w: 9 },
  { k: "crit", t: "暴击率 +{}%", a: 3, b: 10, s: "weapon,charm", w: 8 },
  { k: "critd", t: "暴击伤害 +{}%", a: 12, b: 40, s: "weapon,charm", w: 6 },
  { k: "pierce", t: "穿透 +{}", a: 1, b: 2, s: "weapon", w: 3, flat: 1 },
  { k: "multi", t: "额外弹丸 +{}", a: 1, b: 1, s: "weapon", w: 2, flat: 1 },
  { k: "mag", t: "弹匣容量 +{}%", a: 12, b: 40, s: "weapon", w: 6 },
  { k: "reload", t: "换弹速度 +{}%", a: 10, b: 30, s: "weapon,charm", w: 6 },
  { k: "burn", t: "{}% 几率点燃", a: 8, b: 22, s: "weapon", w: 4 },
  { k: "shock", t: "{}% 几率电击连锁", a: 8, b: 20, s: "weapon", w: 4 },
  { k: "hp", t: "生命 +{}", a: 12, b: 45, s: "armor,boots,charm", w: 10, grow: 1 },
  { k: "regen", t: "每秒回复 {} 生命", a: 0.6, b: 2.2, s: "armor,charm", w: 5, dec: 1 },
  { k: "armor", t: "减伤 +{}%", a: 3, b: 9, s: "armor,boots", w: 7 },
  { k: "ms", t: "移动速度 +{}%", a: 4, b: 12, s: "boots,charm", w: 8 },
  { k: "lok", t: "击杀回复 {} 生命", a: 1, b: 4, s: "weapon,armor,charm", w: 5 },
  { k: "xp", t: "经验获取 +{}%", a: 6, b: 20, s: "charm,armor", w: 4 },
  { k: "mf", t: "掉落品质 +{}%", a: 8, b: 30, s: "charm,boots", w: 4 },
  { k: "gren", t: "手雷伤害 +{}%", a: 15, b: 50, s: "armor,charm", w: 4 },
  { k: "dash", t: "翻滚冷却 -{}%", a: 8, b: 25, s: "boots", w: 6 }
];
/* 传说特效 */
YJ.LEG = {
  boom:  { n: "殉爆", d: "被击杀的敌人会爆炸，伤及周围", s: "weapon" },
  chain: { n: "雷霆", d: "每次命中都有电弧跳向附近 2 个敌人", s: "weapon" },
  frost: { n: "霜噬", d: "命中使敌人减速 50%，持续 2 秒", s: "weapon" },
  vamp:  { n: "渴血", d: "击杀回复 3% 最大生命", s: "weapon" },
  nova:  { n: "震荡", d: "受到伤害时释放冲击波击退并伤害周围敌人", s: "armor" },
  haste: { n: "追猎", d: "击杀后 3 秒内移动速度 +25%", s: "boots" },
  fury:  { n: "狂怒", d: "生命低于 40% 时伤害 +35%", s: "charm" }
};
/* 天赋：每级 1 点，每项最多 5 级 */
YJ.TALENTS = [
  { k: "t_dmg", n: "火力压制", d: "伤害 +6%", st: { dmg: 6 }, ic: "✦" },
  { k: "t_rate", n: "快速扳机", d: "射速 +5%", st: { rate: 5 }, ic: "≫" },
  { k: "t_crit", n: "弱点识别", d: "暴击率 +3%，暴击伤害 +8%", st: { crit: 3, critd: 8 }, ic: "◎" },
  { k: "t_mag", n: "扩容弹匣", d: "弹匣 +10%，换弹 +6%", st: { mag: 10, reload: 6 }, ic: "▤" },
  { k: "t_hp", n: "强健体魄", d: "生命 +14", st: { hp: 14 }, ic: "♥" },
  { k: "t_armor", n: "战场硬汉", d: "减伤 +3%", st: { armor: 3 }, ic: "⛨" },
  { k: "t_regen", n: "战地急救", d: "每秒回复 0.5 生命", st: { regen: .5 }, ic: "✚" },
  { k: "t_lok", n: "嗜血", d: "击杀回复 1 生命", st: { lok: 1 }, ic: "☠" },
  { k: "t_ms", n: "轻装疾行", d: "移速 +3%，翻滚冷却 -5%", st: { ms: 3, dash: 5 }, ic: "➤" },
  { k: "t_gren", n: "爆破专家", d: "手雷伤害 +20%", st: { gren: 20 }, ic: "✹" },
  { k: "t_mf", n: "拾荒者", d: "掉落品质 +10%", st: { mf: 10 }, ic: "⚙" },
  { k: "t_xp", n: "幸存者直觉", d: "经验 +6%", st: { xp: 6 }, ic: "★" }
];

/* 敌人 */
YJ.ENEMY = {
  walker:  { name: "行尸", hp: 44, sp: 50, dmg: 10, r: 13, xp: 6, skin: "#6c7b68", cloth: ["#4a5258", "#544a42", "#3f4a3c", "#4d4a5c", "#5a5248"] },
  runner:  { name: "疯跑者", hp: 24, sp: 158, dmg: 8, r: 10, xp: 8, skin: "#98987f", cloth: ["#5a3530", "#34424e", "#3d3d36"] },
  crawler: { name: "爬行者", hp: 30, sp: 46, dmg: 14, r: 10, xp: 8, skin: "#5f6b5c", cloth: ["#30363a", "#3a322c"], ai: "leap" },
  spitter: { name: "喷吐者", hp: 40, sp: 40, dmg: 13, r: 13, xp: 11, skin: "#a3aa4c", cloth: ["#4a5230"], ai: "spit" },
  bloater: { name: "肥尸", hp: 150, sp: 38, dmg: 30, r: 24, xp: 16, skin: "#7f9a48", cloth: ["#4c4a34"], ai: "boom" },
  brute:   { name: "巨尸", hp: 420, sp: 56, dmg: 28, r: 27, xp: 50, skin: "#6a7566", cloth: ["#2b3036", "#343a2c"], ai: "slam" },
  elite:   { name: "护士长", hp: 1500, sp: 70, dmg: 28, r: 25, xp: 220, skin: "#9aa89c", cloth: ["#b9c4be"], ai: "charge", elite: 1, summon: 1 },
  boss:    { name: "零号", hp: 6800, sp: 78, dmg: 30, r: 36, xp: 800, skin: "#75687f", cloth: ["#c9c9cf"], ai: "boss", elite: 1 }
};

/* 关卡主题：地面/墙面颜色、黑暗程度、环境 */
YJ.THEMES = {
  street:   { floor: "#2b2f2d", floor2: "#313633", wall: "#3c423e", top: "#262a28", dark: .93, tint: "rgba(30,60,45,.10)", lamp: "#ffd9a0", acc: "#b8962a", pipe: "#4d5a50", rain: 1, prop: "barrier" },
  subway:   { floor: "#26292a", floor2: "#2c3031", wall: "#353b3d", top: "#1f2324", dark: .95, tint: "rgba(30,55,45,.10)", lamp: "#ffb060", acc: "#b8662a", pipe: "#5a4a3a", prop: "crate" },
  hospital: { floor: "#2f3a36", floor2: "#35413c", wall: "#46544d", top: "#28322e", dark: .94, tint: "rgba(40,90,70,.10)", lamp: "#c8ffe8", acc: "#8a2a22", pipe: "#5d6e64", flicker: 1, prop: "bed" },
  base:     { floor: "#2c322a", floor2: "#32392f", wall: "#3f4838", top: "#242a20", dark: .94, tint: "rgba(50,70,30,.10)", lamp: "#ffcf80", acc: "#b8962a", pipe: "#56603f", prop: "crate" },
  lab:      { floor: "#232d30", floor2: "#293437", wall: "#324045", top: "#1c2528", dark: .92, tint: "rgba(30,90,90,.10)", lamp: "#7fe8ff", acc: "#2a8a8a", pipe: "#48626a", prop: "tank" }
};

/* 五个关卡。obj：exit 直达出口 / collect 收集 n 个 / elite 击杀精英 / activate 启动 n 台 / boss */
YJ.LEVELS = [
  { name: "第一章 · 灰烬街区", theme: "street", size: 64, rooms: 12, rw: [8, 12], rh: [7, 10], cw: 3, dens: .085, lvl: 1,
    mix: { walker: 10, runner: 2, crawler: 2 }, horde: [32, 6], obj: { t: "exit" }, goal: "穿过老城区，找到地铁入口", exitName: "地铁入口",
    radio: { start: [["林夏", "老城区信号很差，长话短说：一路向东南，地铁口有绿色应急灯。"], ["陈默", "明白。街上动静不小。"]],
      mid: [["林夏", "小心，热成像显示有一群正朝你那边聚过来！"]], done: [["陈默", "看到地铁口了。"]] } },
  { name: "第二章 · 沉寂地铁", theme: "subway", size: 68, rooms: 15, rw: [6, 10], rh: [5, 8], cw: 2, dens: .1, lvl: 3,
    mix: { walker: 8, runner: 4, crawler: 4, spitter: 3 }, horde: [30, 7], obj: { t: "collect", n: 3, name: "保险丝" }, goal: "找到 3 个保险丝，给闸门通电", exitName: "站台闸门",
    radio: { start: [["林夏", "地铁断电了，闸门打不开。配电间的保险丝应该散落在各个站厅。"], ["陈默", "三个保险丝。交给我。"]],
      mid: [["陈默", "墙上有字……『军方封了出口，他们没打算让任何人出去』。"], ["林夏", "……先别想这些。继续找。"]], done: [["林夏", "电来了！闸门在最里面，快走！"]] } },
  { name: "第三章 · 临江医院", theme: "hospital", size: 70, rooms: 16, rw: [6, 10], rh: [5, 9], cw: 2, dens: .105, lvl: 5,
    mix: { walker: 8, runner: 5, crawler: 4, spitter: 3, bloater: 2 }, horde: [28, 8], obj: { t: "elite", name: "门禁卡" }, goal: "击杀「护士长」，取得周博士的门禁卡", exitName: "天台通道",
    radio: { start: [["林夏", "周博士的门禁卡在住院部。但那里有个……大家伙，幸存者叫它『护士长』。"], ["陈默", "听着就不好惹。"]],
      mid: [["陈默", "找到周博士的笔记：『零号样本外泄并非事故』……"], ["林夏", "什么意思？灰潮是……人为的？"]], done: [["陈默", "门禁卡到手。上面还沾着血。"]] } },
  { name: "第四章 · 铁幕基地", theme: "base", size: 72, rooms: 16, rw: [7, 11], rh: [6, 9], cw: 3, dens: .105, lvl: 7,
    mix: { walker: 8, runner: 6, crawler: 4, spitter: 3, bloater: 2, brute: 1 }, horde: [26, 9], obj: { t: "activate", n: 3, name: "发电机" }, goal: "启动 3 台发电机，为方舟电梯供电", exitName: "方舟电梯",
    radio: { start: [["林夏", "方舟的入口在军事基地地下。电梯需要三台发电机同时供电。"], ["林夏", "发电机一响，方圆一公里的东西都会过来。"], ["陈默", "那就让它们来。"]],
      mid: [["林夏", "还差一台！撑住！"]], done: [["林夏", "电梯通电了！陈默……不管下面有什么，活着回来。"]] } },
  { name: "终章 · 方舟 B3", theme: "lab", size: 50, rooms: 5, rw: [6, 9], rh: [6, 8], cw: 3, dens: .05, lvl: 9, arena: 1,
    mix: { walker: 5, runner: 5, crawler: 3, spitter: 2, bloater: 1 }, horde: [0, 0], obj: { t: "boss" }, goal: "击败「零号」，带走血清", exitName: "血清保险库",
    radio: { start: [["周博士", "欢迎来到方舟，陈先生。你妹妹常提起你。"], ["陈默", "周博士？小雨在哪！"], ["周博士", "她是最完美的培养源……而我，是进化的终点。"]],
      mid: [["零号", "感受到了吗……这才是人类的未来！"]], done: [["陈默", "结束了。"]] } }
];

/* 过场：bg 场景画面，lines [说话人, 台词] */
YJ.SCENES = {
  intro: [
    { bg: "city", lines: [["", "灰潮爆发，第 47 天。"], ["", "临江市八百万人，如今只剩游荡的躯壳，和躲在暗处数着子弹的我们。"]] },
    { bg: "room", lines: [["陈雨（录音）", "哥……如果你听到这条留言，说明通讯塔还撑着。"], ["陈雨（录音）", "血清在方舟研究所，地下三层。别来找我——去拿血清。"], ["陈默", "……四十七天了，小雨。我这就来。"]] },
    { bg: "city", lines: [["林夏", "这里是灯塔电台。陈默，听得到吗？"], ["林夏", "去方舟只有一条路：穿过老城区，走地铁。我会一直在频道里。"], ["陈默", "收到。出发。"]] }
  ],
  pre1: [{ bg: "subway", lines: [["", "地铁站的卷帘门半开着，里面漆黑一片。"], ["陈默", "灯塔，我进地铁了。"], ["林夏", "信号会变弱。记住：听见水声就停下，那些东西喜欢潮湿。"]] }],
  pre2: [{ bg: "hospital", lines: [["", "隧道尽头通向临江医院的地下停尸间。"], ["林夏", "周博士是方舟的首席研究员，灰潮第一天他就在这家医院失踪了。"], ["陈默", "他的门禁卡能打开方舟。"]] }],
  pre3: [{ bg: "base", lines: [["", "天台的索道通向江对岸——铁幕基地，军方最后的防线。"], ["", "如今，防线上只剩探照灯还在空转。"], ["陈默", "他们守了多久？"], ["林夏", "十九天。然后频道里就只剩下尖叫了。"]] }],
  pre4: [{ bg: "lab", lines: [["", "电梯下行。B1……B2……B3。"], ["", "门开了。培养舱一排排亮着冷光，里面的东西还在动。"], ["陈默", "小雨……"]] }],
  ending: [
    { bg: "lab", lines: [["", "零号倒下了。保险库的门缓缓打开。"], ["陈雨（录音）", "哥，对不起。我被感染的时候，血清还差最后一步——需要活体抗原。"], ["陈雨（录音）", "所以我把自己留在了这里。这一支，是用我换来的。带它出去。"], ["陈默", "…………"]] },
    { bg: "dawn", lines: [["林夏", "陈默？陈默！回答我！"], ["陈默", "灯塔，这里是陈默。"], ["陈默", "我拿到了。"]] },
    { bg: "dawn", lines: [["", "灰潮爆发，第 48 天。"], ["林夏", "这里是灯塔电台，向所有还活着的人广播——"], ["林夏", "我们有血清了。"], ["", "—— 余烬·尸潮  第一部 完 ——"]] }
  ]
};
YJ.FACE = { "陈默": "#5b7fa6", "林夏": "#c9844a", "周博士": "#8a6aa8", "零号": "#b03a5a", "陈雨（录音）": "#5aa88a" };
