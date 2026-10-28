# Apexora — Next Project Plan

Last updated: 2026-10-28

## 1. Where the project stands today

### Built and committed (Milestones 0–7)
| Milestone | What it delivered |
|---|---|
| M0 | Accounts, JWT + OTP login, roles, append-only audit log |
| M1A/1B | Admin dashboard, seller applications, Seller Center, staff, bank (step-up), "view as seller" |
| M2 | Category tree, attributes, commission rates, vehicle makes/models |
| M3 | 7-step listing wizard, photo pipeline, automatic checks, review queue, public listings API |
| Hardening 1 | Audit masking, rate limits, `.lean()` queries, indexes, cache |
| M4 | POS integration (read-only) and Seller 1 import/sync |
| M5 | Marketplace storefront mode (category/search/product/store pages), price facet, trust copy |
| M6 | COD checkout, orders (customer/seller/admin), stock reservations, delivery fees, auto-cancel |
| M7 | Ledger, commission, COD remittance reconciliation, weekly payout runs, hold-days safety |

Backend: 234 tests passing. Playwright: 23/23. Lighthouse accessibility: 100.

### Done but not committed
- Design refresh "Obsidian & Champagne" (`design-tokens/`, both apps' `index.css`, fonts, wordmark, PWA icons).
- Footer heading-level fix (`storefront/src/components/layout/footer.jsx`).

### Still placeholders ("Coming soon" pages)
- Admin: Returns & Disputes, Customers, Content
- Seller: Returns, Performance

### Known gaps blocking a real launch
1. **OTP / notifications are not delivered.** Codes are printed with `console.log` in `marketplace-backend/controllers/authController.js`. No email or SMS provider exists.
2. **Media is stored on local disk** (`marketplace-backend/services/storage.js`). This breaks on any host with ephemeral disk and doesn't scale.
3. **Image processing runs inside the HTTP request** (`services/imageProcessing.js`).
4. **The live storefront still runs in POS mode** (`storefront/.env.production` → `VITE_DATA_SOURCE=pos`).
5. **No CI pipeline**: no automatic tests, lint, or `npm audit` on push.
6. **Remittance import is CSV-only.** XLSX was dropped because the `xlsx` package has unpatched CVEs.

---

## 2. Step 0 — Housekeeping (½–1 day, do first)

1. **Commit the design refresh** in small, reviewable commits:
   - `design-tokens/` + sync script
   - storefront theme (CSS, fonts, wordmark, icons, My Account tab fix, footer headings)
   - console theme (CSS, fonts, `loadFonts.js`, layout area classes)
2. **Fix the mismatched milestone numbers.** `console/src/components/layout/navConfig.js` / `sellerNavConfig.js` still mark Orders (6) and Finance (7) as coming soon. `App.jsx` passes different numbers (3, 4, 5) to `ComingSoonPage`. Remove the markers for built pages and use one numbering scheme, matching this plan.
3. **Replace `update.md`** with a current status file, or delete it and keep this plan as the source of truth.
4. **Small fixes:**
   - The 4 pre-existing storefront lint errors (react-refresh "only export components").
   - The slow admin Overview / seller Home dashboards (~5–7 s). Profile the aggregations, add indexes or cache them.
   - The flaky Playwright multi-seller mobile order test. Make it deterministic, e.g. wait for the order API response rather than for timing.
   - Kill stale `nodemon` processes, and document a clean dev start in `README.md`.

**Done when:** the working tree is clean, lint has zero errors, and Playwright passes 3 runs in a row.

---

## 3. Milestone 8 — Returns & Disputes

**Why:** orders are live in marketplace mode. Customers need a way to report problems, and money must be reversed correctly in the ledger.

### Backend (`marketplace-backend/`)
1. **Model `ReturnRequest`**: `sellerOrderId`, lines + quantities, reason (enum: wrong item, damaged, not as described, missing part, other), customer note, photos (reuse the media pipeline), status, timeline, and resolution (refund amount in cents, who pays return shipping).
2. **Status machine:** `requested → seller_accepted | seller_rejected → (escalated) → admin_decided → item_returned → refunded | closed`. Use the same atomic conditional-update "claim" pattern as `services/orderCreation.js`.
3. **Eligibility rules:** only delivered orders; within the category return window (reuse `services/categoryRules.js`); one open request per line; quantity ≤ delivered quantity.
4. **Seller response deadline** (e.g. 3 days, configurable in `PlatformSettings`). A background job auto-escalates to admin when it passes, following the same pattern as `orderAutoCancel.js`.
5. **Ledger effects** (`services/ledger.js`, append-only, integer cents):
   - Refund → debit the seller's sale amount and reverse the commission proportionally.
   - Return shipping → charge the party chosen in the decision.
   - If the order was already paid out → negative balance carried into the next payout run (never edit old entries).
6. **COD reality:** refunds go out by bank transfer or cash. Record the refund method plus a reference, and require step-up for an admin marking a refund as paid.
7. **Notifications:** new types `return.requested / accepted / rejected / escalated / decided / refunded`.
8. **Tests:** eligibility, window expiry, the state machine, concurrent accept/reject, ledger reversal math (rounding), paid-out → negative carry-over, and permissions (seller A can't see seller B's returns).

### Console
- **Seller → Returns:** list with status tabs; detail page with photos, accept/reject with reason, and a "received item" confirmation.
- **Admin → Returns & Disputes:** queue sorted by oldest escalated; detail page with the full timeline and a decision form (refund amount, who pays shipping); step-up modal for "mark refunded".

### Storefront
- "Report a problem" on delivered orders in My Orders: reason, photos, quantity.
- Return status shown on the order detail page.
- Update `/returns` copy to match the real flow (en/si/ta).

**Done when:** a customer can report a problem, the seller and admin can resolve it, the ledger and payouts reflect the refund, and all of this is tested.

---

## 4. Milestone 9 — Real email & SMS delivery

**Why:** no real user can log in safely until OTP codes actually arrive. Sellers also need to hear about new orders.

1. **Delivery interface** `services/messaging.js` with `sendEmail()` and `sendSms()`, plus pluggable providers:
   - Email: a transactional provider (e.g. Resend, Amazon SES, or Brevo), chosen on price and deliverability in Sri Lanka.
   - SMS: a Sri Lankan gateway (e.g. Notify.lk, Dialog, or Text.lk). Sinhala/Tamil SMS needs Unicode support; check the per-message cost.
   - A `console` provider for dev/test, which keeps today's behavior.
2. **OTP:**
   - Send via SMS when a phone number exists, else email.
   - Keep `debugOtpCode` in test only.
   - Add a resend cooldown and per-user daily caps on top of the existing auth rate limits.
3. **Outbox pattern:** write a `MessageOutbox` document in the same transaction as the business change. A worker sends it with retries and backoff and records the provider response. That way a provider outage never breaks checkout.
4. **Templates per language** (en/si/ta), stored with the locales:
   - OTP
   - order placed (customer + seller)
   - order shipped / delivered
   - payout paid / failed
   - return updates (from M8)
5. **User preferences:** a seller can choose email/SMS per notification group. OTP and security messages can't be turned off.
6. **Admin view:** a simple "Message log" page (status, provider id, retry) for support.
7. **Tests:** provider faked; outbox retry; no OTP code ever in API responses outside test; templates render in all 3 languages.

**Done when:** login OTP and order notifications arrive on a real phone and inbox in staging.

---

## 5. Milestone 10 — Customers, Content, Seller Performance

### Admin → Customers
- Search by name / email / phone; customer detail with orders, returns, addresses (masked), and account status.
- Actions: deactivate/reactivate (audited, reason required) and resend verification. No password viewing ever.

### Admin → Content
- `ContentBlock` / `Banner` models: homepage banners (image, link, start/end dates, language), announcement bar, and editable info pages (About, Delivery, Returns, Terms, Privacy) per language.
- Storefront reads these through a public cached endpoint, falling back to today's hard-coded copy when nothing is published.
- Draft → published, with preview; every publish is written to the audit log.

### Seller → Performance
- KPIs: sales (cents), orders, average order value, cancellation rate, return rate, on-time dispatch rate, top listings, and views (only if tracking is added).
- Date range filter (7/30/90 days). Pre-aggregate daily into a `SellerDailyStats` collection with a nightly job, so the page stays fast (avoids the dashboard slowness noted in Step 0).
- Charts follow the design tokens and work in light/dark mode.

**Done when:** none of the "Coming soon" placeholders are left.

---

## 6. Milestone 11 — Production infrastructure & Hardening pass 2

1. **Object storage + CDN** for media: implement an S3-compatible provider behind `services/storage.js` (e.g. Cloudflare R2 or AWS S3), plus a migration script for existing files.
2. **Background job queue** for image processing and messaging (BullMQ + Redis), so uploads return fast.
3. **CI (GitHub Actions)** on every push/PR:
   - backend tests, lint for all apps, storefront + console builds
   - `npm audit --omit=dev` (fail on high)
   - Playwright smoke run
4. **Secrets:** move from plain `.env` files to the hosting platform's secret store; rotate JWT and encryption keys; document key rotation.
5. **Observability:** structured logs (request id), error tracking (e.g. Sentry), uptime checks on `/health`, and alerts for failed payout runs and an outbox backlog.
6. **Backups:** enable Atlas scheduled backups; do a restore drill once and write it down.
7. **Security review:** run `/security-review` on the branch. Then check:
   - CSRF/cookie settings, CORS allow-list for production domains
   - a body-size limit set explicitly on `express.json()`
   - pagination caps on every list endpoint
8. **Load test** checkout and category browsing (e.g. k6). Target p95 < 500 ms at the expected launch traffic.
9. **Deploy:** marketplace-backend and console to production hosts (staging first), with custom domains (`apexora.lk`, `console.apexora.lk`, `api.apexora.lk`) and HTTPS.

**Done when:** staging mirrors production, CI is green, there is a working backup, and the alerts fire in a drill.

---

## 7. Milestone 12 — Launch: cutover from POS mode to marketplace mode

1. **Data readiness:** run a full POS → marketplace sync for Seller 1 (Mudiyanse). Spot-check prices, stock, photos, and categories.
2. **Staging rehearsal:** build the storefront with `VITE_DATA_SOURCE=marketplace`, run Playwright and Lighthouse, and do a manual order end to end (order → dispatch → delivery → COD remittance → payout).
3. **Pilot:** onboard 2–3 friendly sellers through the real application flow.
4. **Cutover day:**
   - flip `storefront/.env.production` to `marketplace` and set `VITE_MARKETPLACE_API_URL` / `VITE_CONSOLE_URL`
   - deploy and watch errors for 24 h
5. **Rollback plan:** flipping back to `pos` must restore the old behavior. Rehearse it on staging before launch.
6. **After launch:** a weekly review of orders, returns, payouts, and support messages for the first month.

**Done when:** real customers order from multiple sellers on apexora.lk and payouts complete.

---

## 8. Later (after launch, ordered by likely value)
1. **Online payments** (PayHere or another local card gateway), alongside COD. The ledger already supports it; this adds a payment-capture step and a refunds API.
2. **Ratings & reviews** for products and sellers (verified-purchase only, with moderation).
3. **Better search:** typo tolerance, Sinhala/Tamil transliteration, vehicle-fitment filter ("fits my car" using saved customer vehicles).
4. **Promotions:** seller coupons and platform campaigns, with ledger handling for who funds the discount.
5. **Courier API integration** (Transexpress tracking/booking), instead of manual tracking numbers.
6. **XLSX remittance import**, once a safe parser is chosen (e.g. `exceljs`), or keep CSV only.
7. **Seller mobile experience:** PWA push notifications for new orders.
8. **POS side:** deploy the redesigned receipt layout (`print-agent`) to the shop PC.

---

## 9. Suggested order and rough effort

| Step | Effort (focused days) | Blocking launch? |
|---|---|---|
| Step 0 Housekeeping | 0.5–1 | Yes (clean base) |
| M8 Returns & Disputes | 4–6 | Yes |
| M9 Email & SMS | 3–4 | Yes |
| M10 Customers / Content / Performance | 4–6 | Partly (Content nice-to-have) |
| M11 Infra & Hardening 2 | 4–7 | Yes |
| M12 Cutover | 2–3 + 1 month of watching | — |

Each milestone follows the same rhythm used so far: spec → build → tests + lint + Playwright → follow-up round → commit.
