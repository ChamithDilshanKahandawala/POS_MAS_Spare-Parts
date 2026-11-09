// CI gate: `npm audit --omit=dev` must show no high/critical issue except the
// packages listed in .github/audit-allowlist.json for this app — each entry
// needs a reason and an expiry date, after which it fails again.
// Usage (from an app folder): node ../.github/scripts/audit-check.mjs <app>
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = process.argv[2];
const here = path.dirname(fileURLToPath(import.meta.url));
const allowlist = JSON.parse(readFileSync(path.join(here, '..', 'audit-allowlist.json'), 'utf8'))[app] || {};
const today = new Date().toISOString().slice(0, 10);

let report;
try {
  report = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (err) {
  report = err.stdout; // npm audit exits non-zero when it finds anything
}
const vulns = Object.values(JSON.parse(report).vulnerabilities || {});
const serious = vulns.filter((v) => v.severity === 'high' || v.severity === 'critical');

const failures = [];
for (const v of serious) {
  const entry = allowlist[v.name];
  if (!entry) failures.push(`${v.severity.toUpperCase()} ${v.name} ${v.range}`);
  else if (entry.until < today) failures.push(`${v.name}: allowlist entry expired on ${entry.until} (${entry.reason})`);
  else console.log(`allowed until ${entry.until}: ${v.name} — ${entry.reason}`);
}

if (failures.length) {
  console.error(`npm audit (${app}): ${failures.length} high/critical issue(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`npm audit (${app}): no unallowed high/critical issues (${vulns.length} lower-severity or allowed).`);
