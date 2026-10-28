#!/usr/bin/env node
// Copies tokens.css (the single source of truth) into storefront/ and
// console/ so both apps' built CSS bundles always match — Vite can't
// import a file from outside its own project root, so an actual file
// copy (not a symlink) is what "npm run sync:tokens" does. Run this
// after any edit to tokens.css, before `npm run build`/`npm run dev`
// pick up the change.
//
// Usage: node design-tokens/sync-tokens.mjs
//   (or `npm run sync:tokens` from inside storefront/ or console/ —
//   both package.json scripts point back at this same file)
import { copyFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, 'tokens.css');
const targets = [
  join(here, '..', 'storefront', 'src', 'design-tokens.css'),
  join(here, '..', 'console', 'src', 'design-tokens.css'),
];

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`synced tokens.css -> ${target}`);
}
