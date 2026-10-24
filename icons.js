/* 卡牌图案：每张卡一幅水墨线描小图（SVG，48×48）。
 * 线条用 currentColor（墨色），点睛处用 var(--cc)（类别色）。 */
(function (root) {
"use strict";
const S = 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const F = 'fill="var(--cc)"';
const ICONS = {
  // 收益
  harvest: `<g ${S}><path d="M24 44V22"/><path d="M24 30c-5-1-8-5-8-10 4 0 7 3 8 7M24 24c5-1 8-5 8-10-4 0-7 3-8 7M24 36c-5-1-8-5-8-10 4 0 7 3 8 7M24 30c5-1 8-5 8-10-4 0-7 3-8 7"/></g><circle cx="24" cy="12" r="3.5" ${F}/>`,
  tax: `<g ${S}><circle cx="18" cy="26" r="9"/><circle cx="30" cy="22" r="9"/><path d="M9 40h30"/></g><rect x="14.5" y="22.5" width="7" height="7" ${F}/><rect x="26.5" y="18.5" width="7" height="7" fill="var(--paper,#F4ECD6)" stroke="currentColor" stroke-width="2"/>`,
  trade: `<g ${S}><path d="M24 8v30"/><path d="M10 16h28"/><path d="M10 16l-5 12h10zM38 16l-5 12h10z"/><path d="M16 42h16"/></g><circle cx="10" cy="30" r="2" ${F}/><circle cx="38" cy="30" r="2" ${F}/>`,
  mine: `<g ${S}><path d="M12 42L32 22"/><path d="M26 12c6-2 12 0 16 6-4-1-9 0-12 4"/><path d="M10 30l-4 10 10-4z"/></g><path d="M8 40l2-6 4 4z" ${F}/>`,
  settle: `<g ${S}><path d="M8 24L24 10l16 14"/><path d="M13 22v18h22V22"/><path d="M20 40V30h8v10"/></g><rect x="27" y="26" width="5" height="5" ${F}/>`,
  golden: `<g ${S}><circle cx="24" cy="26" r="8"/><path d="M24 8v5M42 26h-5M6 26h5M36.7 13.3l-3.5 3.5M11.3 13.3l3.5 3.5"/><path d="M6 42c6-4 12-4 18 0 6-4 12-4 18 0"/></g><circle cx="24" cy="26" r="4" ${F}/>`,
  // 辅助
  recruit: `<g ${S}><path d="M14 40V14l6-6 6 6v26"/><path d="M14 20h12"/><path d="M34 42V12"/><path d="M34 12l5 6-5 2-5-2z"/></g><circle cx="20" cy="26" r="2.5" ${F}/>`,
  pioneer: `<g ${S}><path d="M10 40c6-10 14-14 26-14"/><path d="M14 30l6 6"/><path d="M30 8v20"/><path d="M30 8l12 4-12 4"/></g><path d="M30 10l9 2-9 2z" ${F}/>`,
  swift: `<g ${S}><path d="M8 30c6-10 16-12 24-8l6-4-2 8c2 4 0 8-4 10"/><path d="M14 30l-4 10M20 32l-2 10M28 32l4 10"/><path d="M4 22h8M6 28h5M4 34h6"/></g><circle cx="34" cy="22" r="1.8" ${F}/>`,
  rally: `<g ${S}><path d="M14 44V6"/><path d="M14 8h22l-5 7 5 7H14"/><path d="M8 44h12"/></g><path d="M18 11h12l-3 4 3 4H18z" ${F}/>`,
  tame: `<g ${S}><path d="M10 32c0-9 6-14 14-14s14 5 14 14"/><path d="M10 32h28"/><path d="M14 40c2-3 5-4 10-4s8 1 10 4"/><path d="M8 20c4-8 10-10 16-10"/></g><circle cx="18" cy="26" r="2.2" ${F}/><circle cx="30" cy="26" r="2.2" ${F}/>`,
  heaven: `<g ${S}><path d="M10 20c0-6 5-10 11-9 2-5 10-6 13-1 6-1 10 4 8 9-1 3-4 4-7 4H16c-4 0-6-1-6-3z"/><path d="M24 24v18"/><path d="M18 36l6 6 6-6"/></g><path d="M20 28l4-5 4 5z" ${F}/>`,
  // 侦查
  scout: `<g ${S}><path d="M6 26c6-9 12-13 18-13s12 4 18 13c-6 9-12 13-18 13S12 35 6 26z"/><circle cx="24" cy="26" r="6"/></g><circle cx="24" cy="26" r="3" ${F}/>`,
  hawk: `<g ${S}><path d="M4 22c8-6 14-6 20 0 6-6 12-6 20 0"/><path d="M12 30c4-2 8-2 12 2 4-4 8-4 12-2"/><path d="M24 22v10"/><path d="M20 38l4 4 4-4"/></g><path d="M22 20l2-4 2 4z" ${F}/>`,
  spy: `<g ${S}><path d="M8 20c4-10 28-10 32 0-4 8-28 8-32 0z"/><path d="M14 20h5M29 20h5"/><path d="M10 34c8-6 20-6 28 0"/></g><circle cx="17" cy="20" r="2.4" ${F}/><circle cx="31" cy="20" r="2.4" ${F}/>`,
  // 防御
  wall: `<g ${S}><path d="M8 42V18h6v-6h6v6h8v-6h6v6h6v24"/><path d="M8 42h32"/><path d="M8 30h32"/><path d="M20 42v-8h8v8"/></g><rect x="22" y="22" width="4" height="4" ${F}/>`,
  ambush: `<g ${S}><path d="M6 40c4-8 8-10 12-8M42 40c-4-8-8-10-12-8"/><path d="M12 42c3-10 7-14 12-14s9 4 12 14"/><path d="M28 10l10 10"/><path d="M26 8l4-2 10 10-2 4z"/></g><path d="M22 16l4-4 4 4-4 4z" ${F}/>`,
  beacon: `<g ${S}><path d="M14 44l3-20h14l3 20"/><path d="M12 44h24"/><path d="M14 30h20"/><path d="M24 20c-5-3-6-8-2-13 0 4 2 6 4 6-1-3 0-6 3-8 0 5 5 7 3 12-1 2-3 3-5 3"/></g><path d="M24 18c-3-2-3-5 0-8 1 3 3 4 3 6-1 2-2 2-3 2z" ${F}/>`,
  // 攻击
  intercept: `<g ${S}><path d="M8 8l32 32M40 8L8 40"/><path d="M8 8l10 2-8 8zM40 8l-10 2 8 8zM8 40l10-2-8-8zM40 40l-10-2 8-8z"/></g><circle cx="24" cy="24" r="3.5" ${F}/>`,
  cavalry: `<g ${S}><path d="M10 40c0-10 4-16 12-18l6-8 2 2 4-4 2 6c4 2 6 6 6 12"/><path d="M14 40l2-8M30 40l-2-8M22 40v-8"/><path d="M8 14l6 6"/></g><circle cx="32" cy="18" r="1.8" ${F}/><path d="M26 22c-6 0-9 4-10 10" fill="none" stroke="var(--cc)" stroke-width="2.4" stroke-linecap="round"/>`,
  fire: `<g ${S}><path d="M24 44c-8 0-13-6-12-13 1-6 5-9 7-14 1 4 3 6 5 7 0-5 2-9 6-12 0 7 7 10 7 18 0 8-5 14-13 14z"/></g><path d="M24 42c-4 0-6-3-6-7 0-4 3-6 4-9 1 3 3 4 4 5 0-2 1-4 2-5 1 3 3 5 3 9 0 4-3 7-7 7z" ${F}/>`,
  subvert: `<g ${S}><path d="M14 42V12h20v10"/><path d="M14 20h20M14 28h12"/><path d="M28 36c2-6 8-8 14-4-2 6-8 8-14 4z"/><path d="M34 32l-8 10"/></g><path d="M30 35c1-3 5-4 8-2-1 3-5 4-8 2z" ${F}/>`,
  // 天灾
  flood: `<g ${S}><path d="M4 18c6-5 10-5 16 0s10 5 16 0 6-3 8-2"/><path d="M4 28c6-5 10-5 16 0s10 5 16 0 6-3 8-2"/><path d="M4 38c6-5 10-5 16 0s10 5 16 0 6-3 8-2"/></g><circle cx="12" cy="10" r="2" ${F}/><circle cx="20" cy="7" r="1.5" ${F}/>`,
  quake: `<g ${S}><path d="M4 32h10l4-10 6 20 6-16 4 8h10"/><path d="M8 42h32"/><path d="M14 14l4 4-2 4M30 10l-3 5 4 3"/></g><path d="M22 12l2-4 2 4-2 3z" ${F}/>`,
  plague: `<g ${S}><path d="M14 30c-2-10 4-18 10-18s12 8 10 18c-1 4-4 6-10 6s-9-2-10-6z"/><path d="M18 36v6M24 36v6M30 36v6"/></g><circle cx="19" cy="24" r="3" ${F}/><circle cx="29" cy="24" r="3" ${F}/><path d="M22 30h4l-2 3z" ${F}/>`,
  beasts: `<g ${S}><path d="M10 38c-4-6-2-14 4-16 2 4 4 6 8 6s6-2 8-6c6 2 8 10 4 16"/><path d="M12 38h24"/></g><path d="M14 22c-2-4-1-8 2-10 1 3 2 5 4 6zM34 22c2-4 1-8-2-10-1 3-2 5-4 6z" ${F}/><circle cx="19" cy="30" r="2" ${F}/><circle cx="29" cy="30" r="2" ${F}/>`,
  meteor: `<g ${S}><path d="M42 6L22 26"/><path d="M40 12L26 26M34 6L22 18"/><circle cx="18" cy="30" r="8"/><path d="M6 44c4-2 8-2 12 0"/></g><circle cx="18" cy="30" r="4" ${F}/>`,
  // 新增
  granary: `<g ${S}><path d="M10 42V20l14-10 14 10v22"/><path d="M6 42h36"/><path d="M16 42V30h16v12"/><path d="M10 26h28"/></g><rect x="20" y="33" width="8" height="9" ${F}/>`,
  march: `<g ${S}><path d="M14 40l6-16 6 6 4-10 6 20"/><path d="M4 18h10M4 26h8M4 34h6"/><path d="M30 10l8 2-6 5z"/></g><circle cx="20" cy="24" r="2" ${F}/><circle cx="30" cy="20" r="2" ${F}/>`,
  conscript: `<g ${S}><path d="M10 42V18l5-5 5 5v24M20 42V22l5-5 5 5v20M30 42V18l5-5 5 5v24"/><path d="M6 42h36"/><path d="M8 10h32"/></g><path d="M22 6l4 4-4 4-4-4z" ${F}/>`,
  patrol: `<g ${S}><path d="M8 38c0-8 4-14 10-16l4-6 2 2 4-4 2 6c4 2 6 6 6 12"/><path d="M12 38l2-6M30 38l-2-6"/><circle cx="36" cy="14" r="6"/><path d="M36 8v-4M42 14h4"/></g><circle cx="36" cy="14" r="2.5" ${F}/>`,
  rampart: `<g ${S}><path d="M6 42l6-16h24l6 16"/><path d="M4 42h40"/><path d="M12 26v-6h5v6M22 26v-6h5v6M31 26v-6h5v6"/><path d="M10 34h28"/></g><rect x="21" y="32" width="6" height="10" ${F}/>`,
  decoy: `<g ${S}><path d="M14 42V12"/><path d="M14 14h18l-4 6 4 6H14"/><path d="M30 42V22"/><path d="M30 24h12l-3 5 3 5H30" stroke-dasharray="3 3"/><path d="M8 42h28"/></g><path d="M17 17h10l-2 3 2 3H17z" ${F}/>`,
  raid: `<g ${S}><path d="M8 40l12-12M12 44l12-12"/><path d="M20 28l-6-6 4-4 6 6"/><path d="M26 10c6-2 12 2 14 8-6 2-12-2-14-8z"/><path d="M30 18l6 14"/></g><circle cx="36" cy="36" r="4" ${F}/><circle cx="28" cy="40" r="2.5" ${F}/>`,
  rumor: `<g ${S}><path d="M8 20c0-6 6-10 14-10s14 4 14 10-6 10-14 10l-6 6v-7c-5-2-8-5-8-9z"/><path d="M26 30c6 0 12 3 12 8s-4 7-8 7l-2 3v-4c-3-1-5-3-5-6"/></g><circle cx="16" cy="20" r="2" ${F}/><circle cx="22" cy="20" r="2" ${F}/><circle cx="28" cy="20" r="2" ${F}/>`,
  feast: `<g ${S}><path d="M10 30c0 8 6 12 14 12s14-4 14-12z"/><path d="M8 30h32"/><path d="M14 22l4-8M24 20v-10M34 22l-4-8"/><path d="M16 42h16"/></g><circle cx="18" cy="14" r="2.5" ${F}/><circle cx="24" cy="10" r="2.5" ${F}/><circle cx="30" cy="14" r="2.5" ${F}/>`,
  ironwall: `<g ${S}><path d="M8 42V14h32v28"/><path d="M4 42h40"/><path d="M8 14l4-6h24l4 6"/><path d="M8 24h32M8 34h32"/><path d="M18 14v10M28 24v10M18 34v8"/></g><rect x="20" y="4" width="8" height="6" ${F}/>`,
  stealth: `<g ${S}><path d="M10 40c0-12 6-20 14-20s14 8 14 20"/><path d="M8 40h32"/><path d="M16 22c0-6 3-10 8-10s8 4 8 10"/><path d="M4 30c4-4 8-4 12 0M32 30c4-4 8-4 12 0" stroke-dasharray="2 3"/></g><circle cx="20" cy="30" r="2" ${F}/><circle cx="28" cy="30" r="2" ${F}/>`,
  blockade: `<g ${S}><path d="M6 36c6-4 10-4 16 0s10 4 16 0"/><path d="M12 14l4 16M36 14l-4 16"/><path d="M14 18h20"/><path d="M8 8l32 32"/></g><rect x="20" y="20" width="8" height="8" ${F}/>`,
  storm: `<g ${S}><path d="M10 22c-4 0-6-3-6-6 0-4 3-7 7-7 1-5 5-7 9-7 5 0 8 3 9 7 5 0 9 3 9 7s-3 6-7 6z"/><path d="M12 30l-3 6M20 30l-3 6M28 30l-3 6M36 30l-3 6"/><path d="M16 40l-2 4M26 40l-2 4"/></g><path d="M28 24l-6 8h5l-3 8 8-10h-5z" ${F}/>`,
  dragon: `<g ${S}><path d="M6 30c4-10 10-14 18-12 6 2 8 8 14 6 4-1 6-5 6-10"/><path d="M8 34c6 2 12 2 16-2"/><path d="M34 14l6-6M38 14l4 2"/><path d="M14 20l-2-6M22 18l1-6"/></g><circle cx="36" cy="18" r="2.5" ${F}/><path d="M26 22c4-2 8 0 10 4-4 2-8 0-10-4z" ${F}/>`,
  locust: `<g ${S}><path d="M10 30c4-6 10-8 16-6 4 2 6 6 10 6"/><path d="M14 24c-2-6 0-10 4-12M22 22c0-6 3-9 7-10"/><path d="M12 36l-4 6M20 36l-2 8M30 34l4 8"/><path d="M34 26l8-4"/></g><circle cx="38" cy="28" r="2.5" ${F}/><circle cx="12" cy="16" r="2" ${F}/><circle cx="30" cy="8" r="2" ${F}/>`,
  mandate: `<g ${S}><path d="M24 6v8M14 10l4 6M34 10l-4 6"/><path d="M10 42V24h28v18"/><path d="M6 42h36"/><path d="M14 24l10-8 10 8"/></g><circle cx="24" cy="32" r="4" ${F}/><path d="M22 14l2-6 2 6z" ${F}/>`
};
root.LZIcons = ICONS;
root.LZIcon = k => ICONS[k] ? `<svg class="ci" viewBox="0 0 48 48" aria-hidden="true">${ICONS[k]}</svg>` : "";
})(window);
