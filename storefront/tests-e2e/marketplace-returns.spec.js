// Milestone 8 — returns end to end: a delivered two-line parcel, the
// customer's "Report a problem" form (two lines, two photos), then the
// seller accepting and confirming the item came back (stock goes back up).
// Like marketplace-orders.spec.js, the seller side is driven against the
// real API with the seeded owner token. Requires e2e-seed.js first.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const seed = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '.seed-output.json'), 'utf8'));
const API = 'http://localhost:5002/api';

const VIEWPORTS = {
  mobile: { width: 360, height: 800 },
  desktop: { width: 1440, height: 900 },
};

const PHOTOS = [
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4oaGBFTEMLQkAgl1GAXRgBQ4AAAAASUVORK5CYII=',
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPQ0DiBFTEMLQkAMl1GAcPxKOUAAAAASUVORK5CYII=',
].map((b64, i) => ({ name: `problem-${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }));

// Seller 2 is not POS-connected, so receiving a return restocks the listing.
const sellerHeaders = { Authorization: `Bearer ${seed.seller2OwnerToken}`, 'X-Seller-Id': seed.seller2Id };
const customerHeaders = { Authorization: `Bearer ${seed.accessToken}` };

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

async function sellerStock(request, listingId) {
  const res = await request.get(`${API}/seller/listings/${listingId}`, { headers: sellerHeaders });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.listing ?? body).stock;
}

// Places a seller-2 order for listings C (x2) and D (x1) through the real
// checkout UI, then walks the parcel to delivered via the seller API.
async function placeDeliveredOrder(page, request) {
  await page.addInitScript(({ a, b }) => {
    localStorage.setItem('storefrontCart', JSON.stringify([
      { _id: a, name: 'E2E Seller 2 Test Part', selling_price: 950, stock_quantity: 99, qty: 2 },
      { _id: b, name: 'E2E Seller 2 Return Part', selling_price: 450, stock_quantity: 99, qty: 1 },
    ]));
  }, { a: seed.listingCId, b: seed.listingDId });
  await loginAsSeedCustomer(page);

  await page.goto('/checkout');
  await page.getByRole('button', { name: /continue to review/i }).click();
  await page.getByRole('checkbox').check();
  const placed = page.waitForResponse((r) => r.url().endsWith('/api/customer/orders') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /place order/i }).click();
  expect((await placed).ok(), 'place-order API call should succeed').toBeTruthy();
  await expect(page).toHaveURL(/\/order-success\/APX-\d{4}-\d{5}/);
  const orderNumber = page.url().match(/APX-\d{4}-\d{5}/)[0];

  const orderRes = await request.get(`${API}/customer/orders/${orderNumber}`, { headers: customerHeaders });
  expect(orderRes.ok()).toBeTruthy();
  const parcel = (await orderRes.json()).sellerOrders.find((so) => (so.seller?._id ?? so.seller) === seed.seller2Id);
  expect(parcel, 'seller 2 parcel should exist').toBeTruthy();

  for (const [action, extra] of [['confirm'], ['pack'], ['ship', { courier: 'Transexpress', trackingNumber: `TX-RET-${Date.now()}` }], ['deliver']]) {
    const res = await request.post(`${API}/seller/orders/${parcel._id}/transition`, { headers: sellerHeaders, data: { action, ...extra } });
    expect(res.ok(), `seller ${action} should succeed`).toBeTruthy();
  }
  return { orderNumber, sellerOrderId: parcel._id };
}

async function latestReturnFor(request, sellerOrderId) {
  const res = await request.get(`${API}/customer/returns`, { headers: customerHeaders });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).returns
    .filter((r) => String(r.sellerOrder) === String(sellerOrderId))
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
}

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`returns — ${vpName} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('customer reports a problem on 2 lines with 2 photos; seller accepts and confirms receipt', async ({ page, request }) => {
      const { orderNumber, sellerOrderId } = await placeDeliveredOrder(page, request);
      const stockBefore = await sellerStock(request, seed.listingCId);

      await page.goto('/orders');
      const card = page.locator('.glass-card', { hasText: orderNumber });
      await card.getByRole('button', { name: /report a problem/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('E2E Seller 2 Test Part')).toBeVisible();
      const qtySelects = dialog.locator('select').filter({ has: page.locator('option[value="1"]') });
      await expect(qtySelects).toHaveCount(2);
      await qtySelects.nth(0).selectOption('2');
      await qtySelects.nth(1).selectOption('1');
      await dialog.locator('select').last().selectOption('damaged');
      await dialog.locator('textarea').fill('One part arrived cracked; the other box was crushed.');
      await dialog.locator('input[type="file"]').setInputFiles(PHOTOS);
      await expect(dialog.getByText(/2 photo/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-return-form.png`, fullPage: true });

      const sent = page.waitForResponse((r) => r.url().endsWith('/api/customer/returns') && r.request().method() === 'POST');
      await dialog.getByRole('button', { name: /send request/i }).click();
      expect((await sent).status(), 'return request should be created').toBe(201);
      await expect(dialog).toBeHidden();
      await expect(card.getByText('Return: Waiting for seller')).toBeVisible();

      const rr = await latestReturnFor(request, sellerOrderId);
      expect(rr.lines).toHaveLength(2);
      expect(rr.photos ?? rr.photoCount).toBeTruthy();

      const accept = await request.post(`${API}/seller/returns/${rr._id}/respond`, { headers: sellerHeaders, data: { accept: true } });
      expect(accept.ok(), 'seller accept should succeed').toBeTruthy();
      await page.reload();
      await expect(card.getByText(/Return: Accepted/)).toBeVisible();

      const received = await request.post(`${API}/seller/returns/${rr._id}/received`, { headers: sellerHeaders, data: {} });
      expect(received.ok(), 'seller received should succeed').toBeTruthy();
      await page.reload();
      await expect(card.getByText(/Return: Item received/)).toBeVisible();
      expect(await sellerStock(request, seed.listingCId)).toBe(stockBefore + 2);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-return-received.png`, fullPage: true });
    });
  });
}

test.describe('returns — language spot checks (mobile)', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  for (const lang of ['si', 'ta']) {
    test(`${lang}: report-a-problem form renders without overflow`, async ({ page, request }) => {
      // Checkout runs in English (its button names are what the helper
      // clicks); the language switch applies from the orders page on.
      const { orderNumber } = await placeDeliveredOrder(page, request);
      await page.evaluate((l) => localStorage.setItem('storefrontLanguage', l), lang);
      await page.goto('/orders');
      const card = page.locator('.glass-card', { hasText: orderNumber });
      await card.locator('button.btn-secondary').last().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('select').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const dialogOverflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(dialogOverflow, 'dialog content should not overflow').toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests-e2e/screenshots/${lang}-return-form.png`, fullPage: true });
    });
  }
});
