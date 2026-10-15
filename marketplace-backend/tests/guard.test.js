// The startup guard calls process.exit(1) when it refuses — calling it
// in-process would kill the test runner itself, so this spawns a real
// child process per scenario and asserts on its exit code, exactly like
// the manual proof already run by hand for backend/'s own loadDevEnv.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function runGuardCheck(mongoUri, extraEnv = {}) {
  return new Promise((resolve) => {
    // A tiny inline script that just requires config/db.js and calls
    // connectDB() — enough to trigger the guard without needing a real
    // reachable MongoDB host for the forbidden-name cases (the guard
    // runs its string check before ever opening a connection).
    const child = spawn('node', ['-e', "require('./config/db')();"], {
      cwd: ROOT,
      env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'development', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    // Forbidden-name cases exit almost instantly (no network attempt);
    // give the allowed case enough time for a real Atlas connection even
    // under elevated latency (5s was observed to be too tight on an
    // otherwise-healthy connection, failing the positive case with an
    // empty stdout rather than a real guard problem).
    setTimeout(() => { try { child.kill(); } catch { /* already exited */ } }, 15000);
  });
}

test('startup guard refuses sparepartspos', async () => {
  const { code, stderr } = await runGuardCheck('mongodb+srv://u:p@fake-cluster.mongodb.net/sparepartspos');
  assert.equal(code, 1);
  assert.match(stderr, /sparepartspos/);
  assert.match(stderr, /belongs to the POS system/);
});

test('startup guard refuses storefront_dev', async () => {
  const { code, stderr } = await runGuardCheck('mongodb+srv://u:p@fake-cluster.mongodb.net/storefront_dev');
  assert.equal(code, 1);
  assert.match(stderr, /storefront_dev/);
  assert.match(stderr, /belongs to the POS system/);
});

test('startup guard refuses an unrecognized database name outside production', async () => {
  const { code, stderr } = await runGuardCheck('mongodb+srv://u:p@fake-cluster.mongodb.net/some_other_db');
  assert.equal(code, 1);
  assert.match(stderr, /not the expected dev database/);
});

test('startup guard allows apexora_dev (real connection, proves the positive case works too)', async () => {
  const realUri = process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, '/apexora_dev$1');
  const { code, stdout } = await runGuardCheck(realUri);
  assert.equal(code, null, 'process should still be running (connected and awaiting, not exited) — killed by the test timeout, not by the guard');
  assert.match(stdout, /MongoDB connected — database: "apexora_dev"/);
});
