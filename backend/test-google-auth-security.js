// Regression test for the Google-auth fix in controllers/authController.js.
// Spawns the real server (never against production — always the dev
// database from backend/.env.development) with controlled env vars per
// scenario, and hits the real /api/auth/google route over HTTP with a
// forged (unsigned) token. Run with: node test-google-auth-security.js
//
// Scenarios:
//   A. NODE_ENV=production, no GOOGLE_CLIENT_ID -> must fail closed (503),
//      never decode the token at all.
//   B. NODE_ENV=development, no GOOGLE_CLIENT_ID, forged token carries the
//      seeded dev admin's email -> must be rejected (403), proving Google
//      sign-in can no longer be used to log into a staff/admin account.
//   C. Same dev-decode path, forged token carries a brand-new email -> must
//      still succeed (200) as a new customer account, proving the fix
//      didn't break the legitimate customer Google-signup flow.
const { spawn } = require('child_process');
require('./scripts/lib/loadDevEnv')();

const DEV_MONGO_URI = process.env.MONGO_URI;
const DEV_JWT_SECRET = process.env.JWT_SECRET;

function fakeGoogleToken(payloadObj) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64url({ alg: 'RS256', typ: 'JWT' });
  const payload = b64url(payloadObj);
  const signature = Buffer.from('not-a-real-signature-nobody-checks-this').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: {
        ...process.env,
        PORT: String(port),
        MONGO_URI: DEV_MONGO_URI,
        JWT_SECRET: DEV_JWT_SECRET,
        GOOGLE_CLIENT_ID: '',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Server did not start in time:\n' + out)); }, 8000);

    (async () => {
      for (let i = 0; i < 40; i += 1) {
        try {
          const res = await fetch(`http://localhost:${port}/api/health`);
          if (res.ok) { clearTimeout(timeout); resolve(child); return; }
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 200));
      }
      clearTimeout(timeout);
      child.kill();
      reject(new Error('Server did not become healthy in time:\n' + out));
    })();
  });
}

async function stopServer(child) {
  child.kill();
  await new Promise((r) => setTimeout(r, 300));
}

async function postGoogle(port, token) {
  const res = await fetch(`http://localhost:${port}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures += 1;
}

async function main() {
  // --- A: production, no GOOGLE_CLIENT_ID -> fail closed ---
  {
    const port = 5097;
    const server = await startServer(port, { NODE_ENV: 'production' });
    const forged = fakeGoogleToken({ email: 'dev.admin@mas.test', name: 'Attacker', email_verified: true });
    const { status, body } = await postGoogle(port, forged);
    check('A. Production + no GOOGLE_CLIENT_ID returns 503 (fail closed)', status === 503, `got ${status} ${JSON.stringify(body)}`);
    check('A. Response never includes a session token', !body.token);
    await stopServer(server);
  }

  // --- B: dev decode path, forged token impersonates the seeded admin ---
  {
    const port = 5098;
    const server = await startServer(port, { NODE_ENV: 'development' });
    const forged = fakeGoogleToken({ email: 'dev.admin@mas.test', name: 'Attacker' });
    const { status, body } = await postGoogle(port, forged);
    check('B. Forged token for an existing admin email is rejected (403)', status === 403, `got ${status} ${JSON.stringify(body)}`);
    check('B. Response never includes a session token', !body.token);
    await stopServer(server);
  }

  // --- C: dev decode path, brand-new email -> legitimate customer signup still works ---
  {
    const port = 5099;
    const server = await startServer(port, { NODE_ENV: 'development' });
    const newEmail = `security-test-${Date.now()}@example.com`;
    const forged = fakeGoogleToken({ email: newEmail, name: 'New Customer' });
    const { status, body } = await postGoogle(port, forged);
    check('C. New customer via dev-mode Google decode still succeeds (200)', status === 200, `got ${status} ${JSON.stringify(body)}`);
    check('C. New account is role=customer', body.role === 'customer', `got role=${body.role}`);
    await stopServer(server);
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ Test harness error:', err.message); process.exit(1); });
