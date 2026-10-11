// Security audit + regression test for the customer-privilege-escalation
// fixes (routes/saleRoutes.js, routes/productRoutes.js,
// controllers/saleController.js). Every 🔴 from the original audit must now
// be 🟢, and every POS staff/admin regression check must also be 🟢 — a fix
// that silently changed staff behaviour would show up here. Runs only
// against the isolated storefront_dev database; every sale/user created is
// real dev test data, never production.
// Run with: node test-customer-privilege-security.js
const { spawn } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '.env.development') });

const DEV_MONGO_URI = process.env.MONGO_URI;
const DEV_JWT_SECRET = process.env.JWT_SECRET;
if (!DEV_MONGO_URI || !DEV_MONGO_URI.includes('storefront_dev')) {
  console.error('❌ Refusing to run: backend/.env.development did not resolve to the storefront_dev database. Aborting.');
  process.exit(1);
}

const PORT = 5095;
const api = (p, opts) => fetch(`http://localhost:${PORT}/api${p}`, opts);

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

const findings = [];
function report(label, verdict, detail) {
  console.log(`${verdict ? '🔴 VULNERABLE' : '🟢 safe'} — ${label}${detail ? '\n    ' + detail : ''}`);
  if (verdict) findings.push(label);
}

async function login(email, password) {
  const res = await api('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await res.json();
  return body.token;
}

// seed-dev.js only creates 'admin' and 'customer' logins — staffOnly's
// whole point is that it also admits plain 'staff', distinct from
// adminOnly. Inserted directly (active, approved) rather than through the
// public register flow, which always creates a 'staff' account as
// pending/inactive until a real admin approves it.
async function createActiveStaffAccount() {
  const conn = await mongoose.createConnection(DEV_MONGO_URI).asPromise();
  const User = conn.model('User', new mongoose.Schema({
    name: String, email: String, password: String, role: String, status: String, isActive: Boolean, shop: String,
  }, { collection: 'users' }));
  const email = `test-staff-${Date.now()}@example.com`;
  const password = 'TestStaff123!';
  await User.create({
    name: 'Test Staff', email, password: await bcrypt.hash(password, 10),
    role: 'staff', status: 'active', isActive: true, shop: 'Main Branch',
  });
  await conn.close();
  return { email, password };
}

async function main() {
  const server = await startServer();
  try {
    const customerToken = await login('dev.customer@mas.test', 'DevCustomer123!');
    if (!customerToken) throw new Error('dev.customer login failed — run npm run seed:dev -- --yes first');
    const adminToken = await login('dev.admin@mas.test', 'DevAdmin123!');
    const staffCreds = await createActiveStaffAccount();
    const staffToken = await login(staffCreds.email, staffCreds.password);
    const authHeader = (t) => ({ Authorization: `Bearer ${t}` });

    console.log('\n========== Q1 fix: analytics/summary + low-stock/alerts now staffOnly ==========');

    // /api/sales/analytics/summary — customer must now be blocked.
    {
      const res = await api('/sales/analytics/summary?period=alltime', { headers: authHeader(customerToken) });
      report('GET /api/sales/analytics/summary — customer is now blocked (403)', res.status !== 403, `status=${res.status}`);
    }
    // ...and staff/admin (the actual POS users of this endpoint — see
    // frontend/src/pages/DashboardPage.jsx + AnalyticsPage.jsx) still get it.
    {
      const resStaff = await api('/sales/analytics/summary?period=alltime', { headers: authHeader(staffToken) });
      const bodyStaff = await resStaff.json();
      report('REGRESSION: staff role still gets 200 from analytics/summary', !(resStaff.status === 200 && bodyStaff.summary), `status=${resStaff.status}`);
      const resAdmin = await api('/sales/analytics/summary?period=alltime', { headers: authHeader(adminToken) });
      const bodyAdmin = await resAdmin.json();
      report('REGRESSION: admin role still gets 200 from analytics/summary', !(resAdmin.status === 200 && bodyAdmin.summary), `status=${resAdmin.status}`);
    }

    // /api/products/low-stock/alerts — customer must now be blocked.
    {
      const res = await api('/products/low-stock/alerts', { headers: authHeader(customerToken) });
      report('GET /api/products/low-stock/alerts — customer is now blocked (403)', res.status !== 403, `status=${res.status}`);
    }
    // ...and staff/admin (frontend/src/pages/AlertsPage.jsx + DashboardPage.jsx) still get it, same shape.
    {
      const resStaff = await api('/products/low-stock/alerts', { headers: authHeader(staffToken) });
      const bodyStaff = await resStaff.json();
      report('REGRESSION: staff role still gets 200 from low-stock/alerts, same array shape', !(resStaff.status === 200 && Array.isArray(bodyStaff)), `status=${resStaff.status}, isArray=${Array.isArray(bodyStaff)}`);
      const resAdmin = await api('/products/low-stock/alerts', { headers: authHeader(adminToken) });
      const bodyAdmin = await resAdmin.json();
      report('REGRESSION: admin role still gets 200 from low-stock/alerts, same array shape', !(resAdmin.status === 200 && Array.isArray(bodyAdmin)), `status=${resAdmin.status}, isArray=${Array.isArray(bodyAdmin)}`);
    }

    // /api/auth/me — sanity check this one is self-scoped (expected safe, unchanged)
    {
      const res = await api('/auth/me', { headers: authHeader(customerToken) });
      const body = await res.json();
      report('GET /api/auth/me — leaks more than the caller\'s own profile', res.status === 200 && body.role !== 'customer', `role=${body.role}`);
    }

    // /api/sales/my-orders and /my-orders/:id already proven scoped+safe in
    // the previous task's security test (test-order-success-security.js) —
    // not re-proven here.

    console.log('\n========== Q2 fix: createSale no longer trusts discount from a customer ==========');

    const productsRes = await api('/products?limit=5');
    const { products } = await productsRes.json();
    const product = products.find((p) => p.stock_quantity > 5);
    const realPrice = product.selling_price;

    // Inflated per-item discount -> now forced to 0 for a customer order.
    {
      const hugeDiscount = realPrice + 10000;
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(customerToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: hugeDiscount }],
          payment_method: 'Cash', sale_source: 'online',
          customer_name: 'Tamper Test', shipping_address: '1 Test Rd, Colombo, Colombo', customer_phone: '0771234567',
        }),
      });
      const body = await res.json();
      report(
        `Per-item discount (Rs.${hugeDiscount}, more than the Rs.${realPrice} price) still drives the total negative`,
        !(res.status === 201 && body.total_amount === realPrice),
        `status=${res.status}, total_amount=${body.total_amount} (expected ${realPrice}, discount ignored)`
      );
    }

    // Bill-level total_discount -> now forced to 0 for a customer order.
    {
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(customerToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: 0 }],
          total_discount: 999999,
          payment_method: 'Cash', sale_source: 'online',
          customer_name: 'Tamper Test', shipping_address: '1 Test Rd, Colombo, Colombo', customer_phone: '0771234567',
        }),
      });
      const body = await res.json();
      report(
        'Bill-level total_discount still drives the total negative for a customer',
        !(res.status === 201 && body.total_amount === realPrice && body.total_discount === 0),
        `status=${res.status}, total_amount=${body.total_amount}, total_discount=${body.total_discount} (expected ${realPrice} / 0, discount ignored)`
      );
    }

    // REGRESSION: staff must still get their discount honored exactly as before.
    {
      const staffDiscount = 50;
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: staffDiscount }],
          total_discount: 20,
          payment_method: 'Cash', sale_source: 'shop',
        }),
      });
      const body = await res.json();
      const expectedTotal = realPrice - staffDiscount - 20;
      report(
        'REGRESSION: a staff POS sale\'s discount is no longer honored',
        !(res.status === 201 && body.total_amount === expectedTotal && body.total_discount === 20),
        `status=${res.status}, total_amount=${body.total_amount} (expected ${expectedTotal}), total_discount=${body.total_discount} (expected 20)`
      );
    }

    // Negative quantity -> does it add stock instead of removing it?
    {
      const beforeRes = await api(`/products/${product._id}`);
      const before = await beforeRes.json();
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(customerToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: -3, discount: 0 }],
          payment_method: 'Cash', sale_source: 'online',
          customer_name: 'Tamper Test', shipping_address: '1 Test Rd, Colombo, Colombo', customer_phone: '0771234567',
        }),
      });
      const afterRes = await api(`/products/${product._id}`);
      const after = await afterRes.json();
      const body = await res.json().catch(() => ({}));
      report(
        'Negative quantity is accepted and/or leaves stock mutated after rollback',
        res.status === 201 || after.stock_quantity !== before.stock_quantity,
        `status=${res.status}, message=${body.message}, stock before=${before.stock_quantity} after=${after.stock_quantity}`
      );
    }

    // Spoofed customer id in the request body.
    {
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(customerToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: 0 }],
          customer: '000000000000000000000001',
          payment_method: 'Cash', sale_source: 'online',
          customer_name: 'Tamper Test', shipping_address: '1 Test Rd, Colombo, Colombo', customer_phone: '0771234567',
        }),
      });
      const body = await res.json();
      report(
        'A spoofed `customer` id in the body is honored instead of the authenticated user',
        body.customer && body.customer !== undefined && String(body.customer) === '000000000000000000000001',
        `status=${res.status}, returned customer field=${JSON.stringify(body.customer)} (expect it to be absent/stripped from the customer-facing response, and to actually equal the logged-in user server-side)`
      );
    }

    console.log('\n========== Q3 fix: order_status / payment tampering ==========');

    // Baseline: online order, no tracking_number -> forced Pending (unchanged by this fix).
    {
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(customerToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: 0 }],
          payment_method: 'Cash', sale_source: 'online',
          customer_name: 'Tamper Test', shipping_address: '1 Test Rd, Colombo, Colombo', customer_phone: '0771234567',
        }),
      });
      const body = await res.json();
      report('A normal online order is NOT forced to Pending', body.order_status !== 'Pending', `order_status=${body.order_status}`);
    }

    // Customer supplies their own tracking_number -> now ignored.
    {
      const fakeTracking = `FAKE-${Date.now()}`;
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(customerToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: 0 }],
          tracking_number: fakeTracking,
          payment_method: 'Cash', sale_source: 'online',
          customer_name: 'Tamper Test', shipping_address: '1 Test Rd, Colombo, Colombo', customer_phone: '0771234567',
        }),
      });
      const body = await res.json();
      report(
        'Customer can still self-assign a tracking_number and jump their own order to "Shipped"',
        !(res.status === 201 && body.order_status === 'Pending' && body.tracking_number === ''),
        `status=${res.status}, order_status=${body.order_status} (expected Pending), tracking_number="${body.tracking_number}" (expected "")`
      );
    }

    // REGRESSION: staff-logged WhatsApp order with a real tracking number must still work exactly as before.
    {
      const realTracking = `REAL-${Date.now()}`;
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: 0 }],
          tracking_number: realTracking,
          payment_method: 'Cash', sale_source: 'whatsapp',
          customer_name: 'Staff Logged Order', shipping_address: '1 Test Rd', customer_phone: '0771234567',
        }),
      });
      const body = await res.json();
      report(
        'REGRESSION: a staff-logged WhatsApp sale\'s tracking_number / Delivered status is no longer honored',
        !(res.status === 201 && body.order_status === 'Delivered' && body.tracking_number === realTracking),
        `status=${res.status}, order_status=${body.order_status} (expected Delivered), tracking_number=${body.tracking_number} (expected ${realTracking})`
      );
    }

    // Customer sets payment_method/paid_amount -> now forced to Cash / 0.
    {
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(customerToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: 0 }],
          payment_method: 'Online',
          paid_amount: 999999,
          sale_source: 'online',
          customer_name: 'Tamper Test', shipping_address: '1 Test Rd, Colombo, Colombo', customer_phone: '0771234567',
        }),
      });
      const body = await res.json();
      report(
        'Customer can still set payment_method="Online" and an arbitrary paid_amount',
        !(res.status === 201 && body.payment_method === 'Cash' && body.paid_amount === 0),
        `status=${res.status}, payment_method=${body.payment_method} (expected Cash), paid_amount=${body.paid_amount} (expected 0)`
      );
    }

    // REGRESSION: staff POS sale with a real Card payment + paid_amount must still work exactly as before.
    {
      const res = await api('/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({
          items: [{ product_id: product._id, quantity: 1, discount: 0 }],
          payment_method: 'Card',
          paid_amount: realPrice,
          sale_source: 'shop',
        }),
      });
      const body = await res.json();
      report(
        'REGRESSION: a staff POS sale\'s payment_method/paid_amount is no longer honored',
        !(res.status === 201 && body.payment_method === 'Card' && body.paid_amount === realPrice),
        `status=${res.status}, payment_method=${body.payment_method} (expected Card), paid_amount=${body.paid_amount} (expected ${realPrice})`
      );
    }

    console.log('\n========== Part B: registration — role/status/isActive from the body ==========');

    // A raw API caller tries to self-register as admin.
    {
      const email = `priv-test-admin-${Date.now()}@example.com`;
      const res = await api('/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Priv Test', email, password: 'PrivTest123!', role: 'admin', status: 'active', isActive: true }),
      });
      const body = await res.json();
      // The register endpoint is shared: the storefront sends role:'customer'
      // explicitly; the POS admin app's own "Staff Enrollment" page
      // (frontend/src/pages/RegisterPage.jsx) sends NO role at all, by
      // design, to self-request a 'staff' account pending admin approval.
      // So the safe claim isn't "always customer" (that would break staff
      // enrollment) — it's "never admin/super_admin, and never active
      // without approval", which is what this checks.
      const conn = await mongoose.createConnection(DEV_MONGO_URI).asPromise();
      const User = conn.model('UserCheck', new mongoose.Schema({}, { strict: false, collection: 'users' }));
      const created = await User.findOne({ email });
      await conn.close();
      report(
        'POST /api/auth/register honors a client-supplied role=admin/status=active/isActive=true',
        created && (created.role === 'admin' || created.status === 'active' || created.isActive === true),
        `register response status=${res.status}, stored doc: role=${created?.role}, status=${created?.status}, isActive=${created?.isActive}`
      );
    }

    console.log('\n========== Part C: product-returning routes a customer can reach — buying_price never included ==========');

    {
      const res = await api('/products?limit=5', { headers: authHeader(customerToken) });
      const body = await res.json();
      const leaks = (body.products || []).some((p) => p.buying_price !== undefined);
      report('GET /api/products leaks buying_price to a customer', leaks, `checked ${body.products?.length} products`);
    }
    {
      const res = await api(`/products/${product._id}`, { headers: authHeader(customerToken) });
      const body = await res.json();
      report('GET /api/products/:id leaks buying_price to a customer', body.buying_price !== undefined);
    }
    {
      const res = await api('/products/search?q=a', { headers: authHeader(customerToken) });
      const body = await res.json();
      const leaks = (body.products || []).some((p) => p.buying_price !== undefined);
      report('GET /api/products/search leaks buying_price to a customer', leaks, `checked ${body.products?.length} products`);
    }
    {
      // my-orders items also return product cost fields? (already fixed
      // last task, re-checked here for completeness of this audit)
      const res = await api('/sales/my-orders', { headers: authHeader(customerToken) });
      const body = await res.json();
      const leaks = (body || []).some((o) => (o.items || []).some((i) => i.buying_price !== undefined || i.line_profit !== undefined));
      report('GET /api/sales/my-orders leaks item cost/profit fields to a customer', leaks);
    }

    console.log(`\n${findings.length} issue(s) confirmed:`);
    findings.forEach((f) => console.log('  - ' + f));
  } finally {
    server.kill();
  }
}

main().catch((err) => { console.error('❌ Test harness error:', err.message); process.exit(1); });
