// Security test for GET /api/sales/my-orders/:id (the order-success page's
// endpoint). Spawns the real server against the dev database only (refuses
// to run otherwise — see the storefront_dev check below), places one real
// order as dev.customer, then checks: owner sees it (200), a different
// customer does not (404, not 403 — no enumeration signal), logged-out
// gets 401, and a malformed id gets 404 (not the CastError-shaped 500 that
// getProductById has elsewhere in this codebase).
// Run with: node test-order-success-security.js
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.development') });

const DEV_MONGO_URI = process.env.MONGO_URI;
const DEV_JWT_SECRET = process.env.JWT_SECRET;
if (!DEV_MONGO_URI || !DEV_MONGO_URI.includes('storefront_dev')) {
  console.error('❌ Refusing to run: backend/.env.development did not resolve to the storefront_dev database. Aborting.');
  process.exit(1);
}

const PORT = 5096;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(PORT), MONGO_URI: DEV_MONGO_URI, JWT_SECRET: DEV_JWT_SECRET, NODE_ENV: 'development', GOOGLE_CLIENT_ID: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Server did not start in time:\n' + out)); }, 8000);
    (async () => {
      for (let i = 0; i < 40; i += 1) {
        try {
          const res = await fetch(`http://localhost:${PORT}/api/health`);
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

const api = (p, opts) => fetch(`http://localhost:${PORT}/api${p}`, opts);

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures += 1;
}

async function login(email, password) {
  const res = await api('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await res.json();
  return body.token;
}

async function main() {
  const server = await startServer();
  try {
    // dev.customer (seeded by seed-dev.js) places a real order.
    const ownerToken = await login('dev.customer@mas.test', 'DevCustomer123!');
    if (!ownerToken) throw new Error('dev.customer login failed — is storefront_dev seeded? run npm run seed:dev -- --yes first');

    const productsRes = await api('/products?limit=1');
    const { products } = await productsRes.json();
    const product = products[0];

    const saleRes = await api('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        items: [{ product_id: product._id, quantity: 1, discount: 0 }],
        payment_method: 'Cash', sale_source: 'online',
        customer_name: 'Security Test', shipping_address: '1 Test Rd, Colombo, Colombo',
        customer_phone: '0771234567',
      }),
    });
    const sale = await saleRes.json();
    check('Setup: order placed successfully', saleRes.status === 201 && !!sale._id, `status=${saleRes.status}`);

    // A second, different customer account.
    const otherEmail = `security-test-other-${Date.now()}@example.com`;
    await api('/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Other Customer', email: otherEmail, password: 'OtherPass123!', role: 'customer' }),
    });
    const otherToken = await login(otherEmail, 'OtherPass123!');
    check('Setup: second customer account created', !!otherToken);

    // A — owner gets 200 with customer-safe fields only.
    {
      const res = await api(`/sales/my-orders/${sale._id}`, { headers: { Authorization: `Bearer ${ownerToken}` } });
      const body = await res.json();
      check('Owner GETs their own order -> 200', res.status === 200, `status=${res.status}`);
      check('Response has no cost/profit fields', body.total_cost === undefined && body.total_profit === undefined && (body.items || []).every((i) => i.buying_price === undefined && i.line_profit === undefined));
      check('Response has no staff/internal fields', body.cashier === undefined && body.cashier_name === undefined && body.notes === undefined && body.idempotency_key === undefined);
    }

    // B — a different customer gets 404, not 403.
    {
      const res = await api(`/sales/my-orders/${sale._id}`, { headers: { Authorization: `Bearer ${otherToken}` } });
      check('Different customer GETs someone else\'s order -> 404 (not 403)', res.status === 404, `status=${res.status}`);
    }

    // C — logged-out gets 401.
    {
      const res = await api(`/sales/my-orders/${sale._id}`);
      check('Logged-out request -> 401', res.status === 401, `status=${res.status}`);
    }

    // D — malformed id gets 404, not a 500 CastError.
    {
      const res = await api('/sales/my-orders/not-a-valid-objectid', { headers: { Authorization: `Bearer ${ownerToken}` } });
      check('Malformed id -> 404 (not a 500 CastError)', res.status === 404, `status=${res.status}`);
    }

    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  } finally {
    server.kill();
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ Test harness error:', err.message); process.exit(1); });
