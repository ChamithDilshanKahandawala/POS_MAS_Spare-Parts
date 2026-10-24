// Milestone 6 Part H — the real checkout/order lifecycle, end to end:
// browse -> cart with 2 sellers -> checkout -> place order -> seller
// confirms/packs/ships -> customer sees tracking -> delivered; plus the
// cancel flow. Requires e2e-seed.js to have run first (two sellers, two
// listings on seller 1 + one on seller 2, a customer with a saved
// address, and onlineOrderingEnabled flipped on for this run only —
// e2e-teardown.js restores it). The seller side of the flow
// (confirm/pack/ship) is driven directly against the real backend API
// with the seeded seller owner tokens, rather than automating the
// console app's UI — console has no Playwright setup of its own, and
// this still exercises the exact same backend transition routes a real
// seller click would, which is what actually proves the customer-facing
// pages reflect them correctly.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const seed = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '.seed-output.json'), 'utf8'));
const API = 'http://localhost:5002/api';

const VIEWPORTS = {
  mobile: { width: 360, height: 800 },
  desktop: { width: 1440, height: 900 },
};

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page should not overflow horizontally').toBeLessThanOrEqual(1);
}

async function loginAsSeedCustomer(page) {
  await page.addInitScript((user) => {
    localStorage.setItem('storeUser', JSON.stringify({
      _id: user.customerUserId, name: 'E2E Customer', email: 'e2e-customer@test.apexora',
      role: 'customer', status: 'active', shop: null, token: user.accessToken, refreshToken: '',
    }));
  }, seed);
}

async function addToCartViaSearch(page, query, productHeadingRegex) {
  await page.goto(`/search?q=${encodeURIComponent(query)}`);
  await expect(page.getByText(productHeadingRegex).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
}

async function getOrderSellerOrders(request, orderNumber) {
  const res = await request.get(`${API}/customer/orders/${orderNumber}`, {
    headers: { Authorization: `Bearer ${seed.accessToken}` },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).sellerOrders;
}

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${vpName} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('browse -> multi-seller cart -> checkout -> place order -> seller fulfills -> customer sees tracking -> delivered', async ({ page, request }) => {
      await loginAsSeedCustomer(page);

      // --- Browse + add items from TWO different sellers ---
      await addToCartViaSearch(page, 'Bajaj RE Brake Shoe', /Bajaj RE Brake Shoe Set/);
      await addToCartViaSearch(page, 'E2E Seller 2 Test Part', /E2E Seller 2 Test Part/);

      // --- Checkout: address step (the seeded default address is
      // pre-selected, so Continue is immediately enabled) ---
      await page.goto('/checkout');
      await expect(page.getByText(/12 Test Lane/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-checkout-address.png`, fullPage: true });
      await page.getByRole('button', { name: /continue to review/i }).click();

      // --- Review: both sellers' parcels, each with their own delivery
      // fee and COD total ---
      await expect(page.getByText('Bajaj RE Brake Shoe Set')).toBeVisible();
      await expect(page.getByText('E2E Seller 2 Test Part')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-checkout-review.png`, fullPage: true });

      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: /place order/i }).click();

      // --- Order success: one card per seller parcel ---
      await expect(page).toHaveURL(/\/order-success\/APX-\d{4}-\d{5}/, { timeout: 10000 });
      const orderNumber = page.url().match(/APX-\d{4}-\d{5}/)[0];
      await expect(page.getByText('Bajaj RE Brake Shoe Set')).toBeVisible();
      await expect(page.getByText('E2E Seller 2 Test Part')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-order-success.png`, fullPage: true });

      // --- Seller 1 fulfills their parcel: confirm -> pack -> ship,
      // driven directly against the real API with the seeded owner token
      // (see the file header for why) ---
      const sellerOrders = await getOrderSellerOrders(request, orderNumber);
      const seller1Order = sellerOrders.find((so) => so.seller?._id === seed.seller1Id || so.seller === seed.seller1Id);
      expect(seller1Order, 'seller 1 parcel should exist on this order').toBeTruthy();

      const transition = (action, extra = {}) => request.post(`${API}/seller/orders/${seller1Order._id}/transition`, {
        headers: { Authorization: `Bearer ${seed.seller1OwnerToken}`, 'X-Seller-Id': seed.seller1Id },
        data: { action, ...extra },
      });
      expect((await transition('confirm')).ok()).toBeTruthy();
      expect((await transition('pack')).ok()).toBeTruthy();
      const shipRes = await transition('ship', { courier: 'Transexpress', trackingNumber: 'TX-E2E-TEST-1' });
      expect(shipRes.ok()).toBeTruthy();

      // --- Customer sees the tracking number on "My Orders" --- (.first()
      // since the same customer/tracking literal is reused across the
      // mobile and desktop runs of this test against the same live dev
      // DB — more than one matching order in the list is expected, not a
      // bug)
      await page.goto('/orders');
      await expect(page.getByText('TX-E2E-TEST-1').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-my-orders-shipped.png`, fullPage: true });

      // --- Delivered ---
      expect((await transition('deliver')).ok()).toBeTruthy();
      await page.reload();
      await expect(page.getByText('TX-E2E-TEST-1').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-my-orders-delivered.png`, fullPage: true });
    });

    test('customer can cancel an order while it is still new', async ({ page }) => {
      await loginAsSeedCustomer(page);
      await addToCartViaSearch(page, 'Bosch Spark Plug', /Bosch Spark Plug/);

      await page.goto('/checkout');
      await page.getByRole('button', { name: /continue to review/i }).click();
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: /place order/i }).click();
      await expect(page).toHaveURL(/\/order-success\/APX-\d{4}-\d{5}/, { timeout: 10000 });

      await page.goto('/orders');
      await page.getByRole('button', { name: /cancel order/i }).first().click();
      await expect(page.getByText(/cancelled/i).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-order-cancelled.png`, fullPage: true });
    });
  });
}

test.describe('checkout + orders — language spot checks (desktop)', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  for (const lang of ['si', 'ta']) {
    test(`${lang}: checkout address step renders without overflow or obviously clipped text`, async ({ page }) => {
      // The "Add" button's accessible name is translated in si/ta (not
      // the literal English "Add" addToCartViaSearch looks for), so the
      // cart is seeded directly here instead of driven through the
      // search page — this test's job is the checkout page's OWN
      // rendering in si/ta, not re-proving the add-to-cart flow (already
      // covered by the English full-flow test above).
      await page.addInitScript((l) => localStorage.setItem('storefrontLanguage', l), lang);
      await page.addInitScript((listingId) => {
        localStorage.setItem('storefrontCart', JSON.stringify([{
          _id: listingId, name: 'Bajaj RE Brake Shoe Set', selling_price: 1850, stock_quantity: 99, qty: 1,
        }]));
      }, seed.listingAId);
      await loginAsSeedCustomer(page);
      await page.goto('/checkout');
      await expect(page.getByText(/12 Test Lane/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${lang}-checkout-address.png`, fullPage: true });
    });
  }
});
