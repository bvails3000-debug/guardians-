// Branch themes. Each theme has a dark and a light palette; the app picks the one matching the
// phone's appearance setting. Colours are applied as CSS custom properties on <html>.
//
// The emblems are simple generic symbols drawn for this app (star, anchor, wings…), not official
// insignia — app stores reject apps that look like official military products.

export const THEMES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    emblem: '<path d="M12 2 4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    stripe: ['#5b6b2f', '#c8b273'],
    dark: { bg: '#11150f', bg2: '#181e15', card: '#1d2419', card2: '#252e20', line: '#34402c', text: '#eef0e8', muted: '#a3ab96', accent: '#c8b273', accentInk: '#1a1a12' },
    light: { bg: '#f3f2ec', bg2: '#e9e8df', card: '#ffffff', card2: '#f4f3ec', line: '#d9d7cb', text: '#1b1f17', muted: '#616a57', accent: '#5b6b2f', accentInk: '#ffffff' },
  },
  army: {
    id: 'army',
    name: 'Army',
    emblem: '<path d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"/>',
    stripe: ['#111111', '#ffcc01', '#111111'],
    dark: { bg: '#0f0f0e', bg2: '#171715', card: '#1c1c19', card2: '#26261f', line: '#3a3a30', text: '#f2f0e6', muted: '#b3ae9a', accent: '#ffcc01', accentInk: '#111111' },
    light: { bg: '#f5f3ea', bg2: '#ebe8db', card: '#ffffff', card2: '#f3f0e3', line: '#d9d4bf', text: '#161512', muted: '#5f5a48', accent: '#7a5c00', accentInk: '#ffffff' },
  },
  marines: {
    id: 'marines',
    name: 'Marine Corps',
    emblem: '<path d="M4 7l8 4 8-4"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>',
    stripe: ['#a51c1c', '#ffc72c', '#a51c1c'],
    dark: { bg: '#140b0b', bg2: '#1c1010', card: '#231415', card2: '#2e1a1b', line: '#4a2a2b', text: '#f6ecea', muted: '#c4a9a6', accent: '#ffc72c', accentInk: '#4a0808' },
    light: { bg: '#fbf5f2', bg2: '#f2e7e3', card: '#ffffff', card2: '#faf1ee', line: '#e5d2cd', text: '#1e0f0f', muted: '#6a4f4c', accent: '#a51c1c', accentInk: '#ffffff' },
  },
  navy: {
    id: 'navy',
    name: 'Navy',
    emblem: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M8 11h8"/><path d="M5 14c0 4 3 7 7 7s7-3 7-7"/>',
    stripe: ['#0b2a5b', '#f0c24a', '#0b2a5b'],
    dark: { bg: '#08101f', bg2: '#0d182d', card: '#111e38', card2: '#182a4a', line: '#2a3d62', text: '#eef2fa', muted: '#a6b3cc', accent: '#f0c24a', accentInk: '#0b1a33' },
    light: { bg: '#eef2f8', bg2: '#e2e8f2', card: '#ffffff', card2: '#f1f4fa', line: '#cfd8e6', text: '#0b1426', muted: '#4e5b73', accent: '#0b2a5b', accentInk: '#ffffff' },
  },
  airforce: {
    id: 'airforce',
    name: 'Air Force',
    emblem: '<path d="M12 6v12"/><path d="M12 9 2 13l1 2 9-2 9 2 1-2z"/><path d="M9 19l3-1 3 1"/>',
    stripe: ['#00308f', '#a7a9ac', '#00308f'],
    dark: { bg: '#081226', bg2: '#0c1a36', card: '#102043', card2: '#172c57', line: '#28406f', text: '#eef3ff', muted: '#a8b8d8', accent: '#8fb3ff', accentInk: '#061230' },
    light: { bg: '#eef3fb', bg2: '#e1e9f6', card: '#ffffff', card2: '#f0f4fb', line: '#cbd7ea', text: '#0a1430', muted: '#4c5a78', accent: '#00308f', accentInk: '#ffffff' },
  },
  spaceforce: {
    id: 'spaceforce',
    name: 'Space Force',
    emblem: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-25 12 12)"/><path d="M19 4.5l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z"/>',
    stripe: ['#1c2841', '#c3cad6', '#1c2841'],
    dark: { bg: '#06070b', bg2: '#0c0e15', card: '#11141d', card2: '#191d29', line: '#2b3142', text: '#eef0f5', muted: '#a4abbb', accent: '#c3cad6', accentInk: '#0a0d16' },
    light: { bg: '#f1f2f5', bg2: '#e5e7ec', card: '#ffffff', card2: '#f2f3f6', line: '#d3d7df', text: '#0c0f18', muted: '#535a69', accent: '#1c2841', accentInk: '#ffffff' },
  },
  coastguard: {
    id: 'coastguard',
    name: 'Coast Guard',
    emblem: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
    stripe: ['#c8102e', '#ffffff', '#003087'],
    dark: { bg: '#0a1220', bg2: '#0f1a2e', card: '#13213a', card2: '#1b2d4c', line: '#2d4368', text: '#f1f5fb', muted: '#a9b6cc', accent: '#ff7a8a', accentInk: '#2a0008' },
    light: { bg: '#f3f6fa', bg2: '#e6ecf4', card: '#ffffff', card2: '#f2f5fa', line: '#d1dae7', text: '#0b1526', muted: '#4d5a70', accent: '#c8102e', accentInk: '#ffffff' },
  },
};

export const THEME_IDS = Object.keys(THEMES);

/** Which theme to show: 'auto' follows the user's branch (falling back to Classic). */
export function resolveTheme(state) {
  const choice = state?.settings?.theme || 'auto';
  if (choice !== 'auto' && THEMES[choice]) return THEMES[choice];
  return THEMES[state?.profile?.branch] || THEMES.classic;
}

export function emblemSvg(theme, size = 28) {
  return `<svg class="emblem" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${theme.emblem}</svg>`;
}

const VAR_NAMES = { bg: '--bg', bg2: '--bg-2', card: '--card', card2: '--card-2', line: '--line', text: '--text', muted: '--muted', accent: '--accent', accentInk: '--accent-ink' };

let media = null;
let current = null;

/** Apply a theme to the page, following the system light/dark setting (and its changes). */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  current = theme;
  const root = document.documentElement;
  const dark = !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
  const palette = dark ? theme.dark : theme.light;
  for (const [k, v] of Object.entries(palette)) root.style.setProperty(VAR_NAMES[k], v);
  const stops = theme.stripe;
  root.style.setProperty('--stripe', `linear-gradient(90deg, ${stops.map((c, i) => `${c} ${Math.round((i / stops.length) * 100)}% ${Math.round(((i + 1) / stops.length) * 100)}%`).join(', ')})`);
  root.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.bg);
  if (!media && window.matchMedia) {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', () => current && applyTheme(current));
  }
}
