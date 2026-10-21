// Regression test for GET /api/integration/products (routes/
// integrationRoutes.js, middleware/integrationAuth.js) — Milestone 4's
// read-only POS product feed for the Apexora marketplace. Runs only
// against the isolated storefront_dev database (via loadDevEnv()'s
// guard); every product created here is real dev test data, never
// production, and nothing this script does ever writes to the POS DB.
// Run with: node test-integration-api.js
const { spawn } = require('child_process');
const mongoose = require('mongoose');
require('./scripts/lib/loadDevEnv')();

const DEV_MONGO_URI = process.env.MONGO_URI;
const DEV_KEY = process.env.INTEGRATION_API_KEY;
if (!DEV_KEY) {
  console.error('❌ INTEGRATION_API_KEY is not set in .env.development — nothing to test against.');
  process.exit(1);
}

const PORT = 5096;
const api = (p, opts) => fetch(`http://localhost:${PORT}/api${p}`, opts);

function startServer(extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(PORT), MONGO_URI: DEV_MONGO_URI, NODE_ENV: 'development', GOOGLE_CLIENT_ID: '', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Server did not start:\n' + out)); }, 8000);
    (async () => {
      for (let i = 0; i < 40; i += 1) {
        try { if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) { clearTimeout(timeout); resolve(child); return; } } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 200));
      }
      clearTimeout(timeout); child.kill(); reject(new Error('Server did not become healthy:\n' + out));
    })();
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
    setTimeout(resolve, 2000); // don't hang the script if the process is slow to exit
  });
}

const findings = [];
function report(label, ok, detail) {
  console.log(`${ok ? '🟢 OK' : '🔴 FAIL'} — ${label}${detail ? '\n    ' + detail : ''}`);
  if (!ok) findings.push(label);
}

// A handful of real dev products so the field-whitelist / pagination /
// updatedSince checks have something to actually check against.
async function seedTestProducts() {
  const conn = await mongoose.createConnection(DEV_MONGO_URI).asPromise();
  const Product = require('./models/Product');
  const model = conn.model('Product', Product.schema);
  await model.deleteMany({ sku_code: { $regex: /^INTEGTEST/ } });

  const now = Date.now();
  const docs = [];
  for (let i = 1; i <= 3; i++) {
    docs.push({
      sku_code: `INTEGTEST${i}`,
      name: `Integration Test Product ${i}`,
      brand: 'TestBrand',
      category: 'Toys',
      sub_category: 'Test',
      buying_price: 100,
      selling_price: 200 + i,
      stock_quantity: 10 + i,
      unit: 'Units',
      is_active: true,
    });
  }
  const created = await model.insertMany(docs);
  // Stagger updatedAt so updatedSince has something meaningful to filter
  // on. { timestamps: false } is required here — the schema's own
  // timestamps:true option otherwise re-stamps updatedAt to "now" on
  // every update, silently overwriting the backdated value being set.
  await model.updateOne({ _id: created[0]._id }, { $set: { updatedAt: new Date(now - 10 * 60 * 1000) } }, { timestamps: false });
  await model.updateOne({ _id: created[1]._id }, { $set: { updatedAt: new Date(now - 5 * 60 * 1000) } }, { timestamps: false });
  await model.updateOne({ _id: created[2]._id }, { $set: { updatedAt: new Date(now) } }, { timestamps: false });

  await conn.close();
  return created;
}

async function cleanupTestProducts() {
  const conn = await mongoose.createConnection(DEV_MONGO_URI).asPromise();
  const Product = require('./models/Product');
  const model = conn.model('Product', Product.schema);
  await model.deleteMany({ sku_code: { $regex: /^INTEGTEST/ } });
  await conn.close();
}

async function main() {
  console.log('========== Part 0: missing INTEGRATION_API_KEY -> 503 ==========');
  {
    const server = await startServer({ INTEGRATION_API_KEY: '' });
    try {
      const res = await api('/integration/products', { headers: { 'X-Integration-Key': DEV_KEY } });
      report('missing env var returns 503 (route never runs)', res.status === 503, `got ${res.status}`);
    } finally {
      await stopServer(server);
    }
  }

  await seedTestProducts();
  const server = await startServer({ INTEGRATION_API_KEY: DEV_KEY });

  try {
    console.log('\n========== Part 1: auth ==========');
    {
      const res = await api('/integration/products');
      report('no key -> 401', res.status === 401, `got ${res.status}`);
    }
    {
      const res = await api('/integration/products', { headers: { 'X-Integration-Key': 'definitely-the-wrong-key' } });
      report('wrong key -> 401', res.status === 401, `got ${res.status}`);
    }
    {
      const res = await api('/integration/products', { headers: { 'X-Integration-Key': DEV_KEY } });
      report('correct key -> 200', res.status === 200, `got ${res.status}`);
    }

    console.log('\n========== Part 2: field whitelist (buying_price must never appear) ==========');
    {
      // Scoped to just-created products via updatedSince, rather than a
      // plain limit — storefront_dev already has real dev products, and
      // the route sorts updatedAt ascending, so a fixed limit could push
      // freshly-created (most-recent) rows past the page boundary.
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const res = await api(`/integration/products?updatedSince=${encodeURIComponent(since)}&limit=200`, { headers: { 'X-Integration-Key': DEV_KEY } });
      const body = await res.json();
      const sample = (body.products || []).find((p) => p.sku_code?.startsWith('INTEGTEST'));
      const hasBuyingPrice = sample && Object.prototype.hasOwnProperty.call(sample, 'buying_price');
      report('response never includes buying_price', !hasBuyingPrice);
      const expectedKeys = ['id', 'sku_code', 'name', 'brand', 'category', 'sub_category', 'selling_price', 'stock_quantity', 'unit', 'updatedAt', 'active'].sort();
      const actualKeys = sample ? Object.keys(sample).sort() : [];
      report('response shape is exactly the whitelisted fields', JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), `got: ${actualKeys.join(', ')}`);
      report('selling_price is converted to integer cents', sample?.selling_price === 20100 || sample?.selling_price === 20200 || sample?.selling_price === 20300, `sample selling_price=${sample?.selling_price}`);
    }

    console.log('\n========== Part 3: pagination cap (max 200) ==========');
    {
      const res = await api('/integration/products?limit=99999', { headers: { 'X-Integration-Key': DEV_KEY } });
      const body = await res.json();
      report('limit=99999 is capped, not honored literally', body.products.length <= 200, `got ${body.products.length} back`);
    }

    console.log('\n========== Part 4: updatedSince ==========');
    {
      const cutoff = new Date(Date.now() - 7 * 60 * 1000).toISOString(); // between products 1 and 2
      const res = await api(`/integration/products?updatedSince=${encodeURIComponent(cutoff)}&limit=50`, { headers: { 'X-Integration-Key': DEV_KEY } });
      const body = await res.json();
      const skus = (body.products || []).map((p) => p.sku_code);
      const gotOld = skus.includes('INTEGTEST1');
      const gotNew = skus.includes('INTEGTEST2') && skus.includes('INTEGTEST3');
      report('updatedSince excludes products updated before the cutoff', !gotOld, `skus returned: ${skus.filter((s) => s.startsWith('INTEGTEST')).join(', ')}`);
      report('updatedSince includes products updated at/after the cutoff', gotNew);
    }
    {
      const res = await api('/integration/products?updatedSince=not-a-date', { headers: { 'X-Integration-Key': DEV_KEY } });
      report('an invalid updatedSince is rejected with 400, not silently ignored', res.status === 400, `got ${res.status}`);
    }

    console.log(`\n${findings.length} issue(s) found:`);
    findings.forEach((f) => console.log('  - ' + f));
  } finally {
    await stopServer(server);
    await cleanupTestProducts();
  }

  if (findings.length > 0) process.exit(1);
}

main().catch((err) => { console.error('❌ Test harness error:', err.message); process.exit(1); });
