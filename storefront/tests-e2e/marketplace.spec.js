// Milestone 5 Part E — dev-only Playwright smoke pass over marketplace
// mode. Run against a throwaway dev server (playwright.config.js, port
// 5199), never the standing 5174 one. Requires apexora_dev to have the
// seed data from `node ../marketplace-backend/scripts/e2e-seed.js` run
// first (two published listings + a test customer).
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const seed = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '.seed-output.json'), 'utf8'));

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

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${vpName} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('home: hero, vehicle picker, categories, latest listings render without overflow', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /shop by vehicle/i })).toBeVisible();
      await expect(page.getByText('Bajaj RE Brake Shoe Set')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-home.png`, fullPage: true });
    });

    test('category page: filters/facets render, vehicle filter bar works', async ({ page }) => {
      await page.goto('/category/vehicle-parts-three-wheel');
      await expect(page.getByText(/Bajaj RE Brake Shoe Set|Bosch Spark Plug/).first()).toBeVisible();
      // On mobile, facets sit behind a "Filters" drawer button — not a bug,
      // just the narrow-viewport layout — so open it before asserting.
      const filtersButton = page.getByRole('button', { name: 'Filters' });
      if (await filtersButton.isVisible()) await filtersButton.click();
      // Follow-up #1 — real bug: the price facet label showed cents
      // formatted as rupees ("Rs. 100,000.00" for a Rs. 1,000 bucket).
      // Seed data is Rs. 1,850 and Rs. 4,200, both in the Rs. 1,000–5,000
      // bucket — the label must show THAT, never a 100x-inflated range.
      await expect(page.getByText(/Rs\.\s*1,000\.00\s*–\s*Rs\.\s*5,000\.00/)).toBeVisible();
      await expect(page.getByText(/Rs\.\s*100,000\.00/)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-category.png`, fullPage: true });
    });

    test('search page: q= returns results', async ({ page }) => {
      await page.goto('/search?q=Brake+Shoe');
      await expect(page.getByText('Bajaj RE Brake Shoe Set')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-search.png`, fullPage: true });
    });

    test('product detail: fitment badge shows "Fits your vehicle" once a matching vehicle is selected', async ({ page }) => {
      await page.goto('/search?q=Brake+Shoe');
      await page.getByText('Bajaj RE Brake Shoe Set').click();
      await expect(page.getByRole('heading', { name: 'Bajaj RE Brake Shoe Set' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-product-no-vehicle.png`, fullPage: true });

      await page.evaluate((v) => {
        localStorage.setItem('storefrontSelectedVehicle', JSON.stringify({ makeId: v.makeId, makeName: v.makeName, modelName: v.modelName, year: 2015 }));
      }, seed);
      await page.reload();
      await expect(page.getByText(/fits your vehicle/i)).toBeVisible();
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-product-fits-vehicle.png`, fullPage: true });
    });

    test('store page renders seller info and their listings', async ({ page }) => {
      await page.goto('/store/mudiyanse-auto-solutions');
      await expect(page.getByRole('heading', { name: 'Mudiyanse Auto Solutions', level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-store.png`, fullPage: true });
    });

    test('register: fills the form and reaches the OTP step', async ({ page }) => {
      await page.goto('/register');
      await page.getByPlaceholder('Full Name').fill('Playwright Tester');
      await page.getByPlaceholder('Email Address').fill(`playwright-${Date.now()}@test.apexora`);
      await page.getByPlaceholder(/phone number/i).fill('0771112222');
      await page.getByPlaceholder('Secure Password').fill('PlaywrightPass123!');
      await expectNoHorizontalOverflow(page);
      await page.getByRole('button', { name: /create account/i }).click();
      await expect(page.getByPlaceholder('123456')).toBeVisible({ timeout: 10000 });
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-register-otp-step.png`, fullPage: true });
    });

    test('my account: addresses tab renders for a logged-in customer', async ({ page }) => {
      await loginAsSeedCustomer(page);
      await page.goto('/account');
      await page.getByRole('button', { name: /addresses/i }).click();
      await page.getByRole('button', { name: /add new address/i }).click();
      await expect(page.getByPlaceholder('Address line 1')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-my-account-addresses.png`, fullPage: true });
    });

    test('cart -> checkout shows the "coming soon — order on WhatsApp" message', async ({ page }) => {
      await loginAsSeedCustomer(page);
      await page.goto('/search?q=Brake+Shoe');
      // The search results page shows product CARDS, whose add button is
      // just labeled "Add" (product.json's card.add) — "Add to cart" is
      // the product DETAIL page's own, longer label.
      await page.getByRole('button', { name: 'Add', exact: true }).first().click();
      await page.goto('/checkout');
      await expect(page.getByText(/coming soon/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /order on whatsapp/i })).toHaveAttribute('href', /wa\.me/);
      await expectNoHorizontalOverflow(page);
      // The page's own 0.4s fade-in (index.css's .animate-fade, shared
      // with every other page) is still visible this soon after a fast
      // client-side navigation — wait it out so the screenshot shows the
      // page at rest, not mid-transition.
      await page.waitForTimeout(500);
      await page.screenshot({ path: `tests-e2e/screenshots/${vpName}-checkout-coming-soon.png`, fullPage: true });
    });
  });
}

test.describe('dark mode + language spot checks (desktop)', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('dark mode: home page renders without overflow', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('storeTheme', 'dark'));
    await page.goto('/');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'tests-e2e/screenshots/dark-home.png', fullPage: true });
  });

  test('Sinhala: category page renders without overflow or obviously clipped text', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('storefrontLanguage', 'si'));
    await page.goto('/category/vehicle-parts-three-wheel');
    await expect(page.getByText(/Bajaj RE Brake Shoe Set|Bosch Spark Plug/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'tests-e2e/screenshots/si-category.png', fullPage: true });
  });

  test('Tamil: product detail page renders without overflow or obviously clipped text', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('storefrontLanguage', 'ta'));
    await page.goto('/search?q=Brake+Shoe');
    await expect(page.getByText('Bajaj RE Brake Shoe Set')).toBeVisible();
    await page.screenshot({ path: 'tests-e2e/screenshots/ta-search.png', fullPage: true });
    await expectNoHorizontalOverflow(page);
  });
});
