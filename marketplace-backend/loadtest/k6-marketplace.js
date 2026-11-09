// k6 load test — category browsing, search, listing detail and checkout
// preview (never places real orders). Target: p95 < 500 ms, < 1% errors.
//
//   k6 run loadtest/k6-marketplace.js \
//     -e BASE_URL=https://api-staging.apexora.lk \
//     -e CUSTOMER_TOKENS=tok1,tok2,... -e ADDRESS_IDS=addr1,addr2,... \
//     -e LISTING_IDS=id1,id2,id3 -e CATEGORY_IDS=cat1,cat2
//
// Run it against staging, never production. Customer routes allow 120 writes
// per user per 15 minutes, so pass one token (and its matching address id)
// per expected concurrent shopper; virtual users rotate through them.
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5002';
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
const TOKENS = list(__ENV.CUSTOMER_TOKENS);
const ADDRESSES = list(__ENV.ADDRESS_IDS);
const LISTINGS = list(__ENV.LISTING_IDS);
const CATEGORIES = list(__ENV.CATEGORY_IDS);
const SEARCHES = ['brake', 'filter', 'spark plug', 'bajaj', 'oil', 'clutch'];

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus', exec: 'browse', startVUs: 0,
      stages: [{ duration: '1m', target: 40 }, { duration: '3m', target: 40 }, { duration: '30s', target: 0 }],
    },
    checkout: {
      executor: 'ramping-vus', exec: 'checkout', startVUs: 0,
      stages: [{ duration: '1m', target: Math.max(1, TOKENS.length) }, { duration: '3m', target: Math.max(1, TOKENS.length) }, { duration: '30s', target: 0 }],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{flow:browse}': ['p(95)<500'],
    'http_req_duration{flow:checkout}': ['p(95)<500'],
  },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ok = (res, name) => check(res, { [`${name} 200`]: (r) => r.status === 200 });

export function browse() {
  const tags = { flow: 'browse' };
  group('browse', () => {
    ok(http.get(`${BASE}/api/public/catalog/categories`, { tags }), 'categories');
    if (CATEGORIES.length) ok(http.get(`${BASE}/api/public/listings?category=${pick(CATEGORIES)}&sort=newest`, { tags }), 'category page');
    ok(http.get(`${BASE}/api/public/listings?q=${encodeURIComponent(pick(SEARCHES))}`, { tags }), 'search');
    if (LISTINGS.length) {
      const id = pick(LISTINGS);
      ok(http.get(`${BASE}/api/public/listings/${id}`, { tags }), 'listing detail');
      ok(http.get(`${BASE}/api/public/listings/${id}/related`, { tags }), 'related');
    }
  });
  sleep(1 + Math.random() * 2);
}

export function checkout() {
  if (!TOKENS.length || !LISTINGS.length) { sleep(5); return; }
  const i = (__VU - 1) % TOKENS.length;
  const tags = { flow: 'checkout' };
  const body = JSON.stringify({ addressId: ADDRESSES[i], items: [{ listingId: pick(LISTINGS), qty: 1 }] });
  const res = http.post(`${BASE}/api/customer/checkout/preview`, body, {
    tags, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKENS[i]}` },
  });
  ok(res, 'checkout preview');
  sleep(8 + Math.random() * 4); // stays under the 120 writes / 15 min per-user limit
}
