import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, THEME_IDS, resolveTheme } from '../js/themes.js';
import { BRANCHES } from '../js/data/tests.js';

// WCAG 2.x relative luminance and contrast ratio.
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test('every branch has a theme, plus Classic', () => {
  for (const b of Object.keys(BRANCHES)) assert.ok(THEMES[b], b);
  assert.ok(THEMES.classic);
});

test('theme text is readable (WCAG AA 4.5:1) in dark and light mode', () => {
  const failures = [];
  for (const id of THEME_IDS) {
    for (const mode of ['dark', 'light']) {
      const p = THEMES[id][mode];
      const checks = [
        ['text on bg', p.text, p.bg],
        ['text on card', p.text, p.card],
        ['text on card-2', p.text, p.card2],
        ['muted on card', p.muted, p.card],
        ['muted on bg', p.muted, p.bg],
        ['accent on card', p.accent, p.card],
        ['accent on bg', p.accent, p.bg],
        ['button label on accent', p.accentInk, p.accent],
      ];
      for (const [what, fg, bg] of checks) {
        const c = contrast(fg, bg);
        if (c < 4.5) failures.push(`${id}/${mode} ${what}: ${c.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('auto theme follows the branch; explicit choice wins; bad values fall back', () => {
  assert.equal(resolveTheme({ profile: { branch: 'airforce' }, settings: { theme: 'auto' } }).id, 'airforce');
  assert.equal(resolveTheme({ profile: { branch: 'airforce' } }).id, 'airforce');
  assert.equal(resolveTheme({ profile: { branch: 'airforce' }, settings: { theme: 'navy' } }).id, 'navy');
  assert.equal(resolveTheme({ profile: {}, settings: { theme: 'auto' } }).id, 'classic');
  assert.equal(resolveTheme({ profile: { branch: 'army' }, settings: { theme: 'nope' } }).id, 'army');
});
