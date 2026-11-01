/* 八种角色的徽记：SVG 线描，颜色跟随卡牌（currentColor） */
(function (root) {
const S = 'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"';
root.QSArt = {
  1: `<svg viewBox="0 0 64 64"><g ${S}><path d="M32 10l14 6v12c0 12-6 20-14 26-8-6-14-14-14-26V16z"/><path d="M32 22v18M24 30h16"/></g></svg>`,
  2: `<svg viewBox="0 0 64 64"><g ${S}><circle cx="32" cy="32" r="18"/><path d="M32 14c-8 6-8 30 0 36M32 14c8 6 8 30 0 36"/><circle cx="32" cy="32" r="4" fill="currentColor"/></g></svg>`,
  3: `<svg viewBox="0 0 64 64"><g ${S}><path d="M18 52V16l10 8 4-10 4 10 10-8v36z"/><path d="M24 40h16M24 46h16"/></g></svg>`,
  4: `<svg viewBox="0 0 64 64"><g ${S}><path d="M20 54c0-14 4-20 12-24 8 4 12 10 12 24z"/><circle cx="32" cy="20" r="8"/><path d="M26 30c-6 2-8 8-8 14M38 30c6 2 8 8 8 14"/></g></svg>`,
  5: `<svg viewBox="0 0 64 64"><g ${S}><path d="M14 44l6-24 12 12 12-12 6 24z"/><path d="M14 44h36v6H14z"/><circle cx="20" cy="18" r="2.5" fill="currentColor"/><circle cx="44" cy="18" r="2.5" fill="currentColor"/><circle cx="32" cy="28" r="2.5" fill="currentColor"/></g></svg>`,
  6: `<svg viewBox="0 0 64 64"><g ${S}><path d="M12 46l4-28 10 12 6-16 6 16 10-12 4 28z"/><path d="M12 46h40v6H12z"/><circle cx="32" cy="36" r="3" fill="currentColor"/></g></svg>`,
  7: `<svg viewBox="0 0 64 64"><g ${S}><path d="M32 54c-10-8-18-16-18-26a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 10-8 18-18 26z"/><path d="M22 14c4-4 8-6 10-6s6 2 10 6"/></g></svg>`,
  8: `<svg viewBox="0 0 64 64"><g ${S}><path d="M10 20l22 16 22-16v28H10z"/><path d="M10 20h44l-22 16z"/><path d="M10 48l16-14M54 48L38 34"/><path d="M32 10l3 5 5 1-4 4 1 5-5-3-5 3 1-5-4-4 5-1z" fill="currentColor"/></g></svg>`
};
})(window);
