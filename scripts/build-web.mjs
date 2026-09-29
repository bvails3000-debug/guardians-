// Copies the web app into www/ — the folder Capacitor packages into the iOS and Android apps.
// Usage: npm run build
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}www`;
const ENTRIES = ['index.html', 'privacy.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const entry of ENTRIES) await cp(`${root}${entry}`, `${out}/${entry}`, { recursive: true });
console.log(`Web app copied to www/ (${ENTRIES.length} entries)`);
