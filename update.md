# Apexora Marketplace — Project Status

Last updated: 2026-10-21

This covers **Apexora**, the marketplace platform (`marketplace-backend/` + `console/`) — the admin dashboard, seller accounts/seller center, and the catalog/listings e-commerce platform underneath it. It is a separate codebase from the existing POS system (`backend/`, `frontend/`, `storefront/`, `print-agent/`), which is not covered here.

Dev stack: Express 4 + Mongoose 7 + MongoDB Atlas (`apexora_dev`), React console (admin + seller, one app, role-routed), zod validation on every route, JWT access/refresh with two-step OTP login.

---

## 1. What's built

### Milestone 0 — Foundations
- User accounts, JWT access/refresh auth, two-step OTP login
- Sellers, seller staff (`seller_owner` / `seller_staff`), platform staff (`platform_owner` / `platform_staff`)
- Append-only `AuditLog` — every admin/seller write is recorded
- Role-based access control throughout; `ownerOnly` gating where relevant

### Milestone 1A/1B — Admin dashboard + Seller Center core
- Seller applications: submit, review, request-info, approve (creates the Seller + owner invite), reject
- Invite accept flow (seller staff, platform staff)
- Seller detail (admin): profile, commission override, staff, bank, activity
- Seller Center: store profile, staff management, bank account (with step-up re-auth before any change), activity log, notifications, home checklist
- "View as seller" — read-only impersonation for admin support, enforced server-side (never just hidden in the UI)
- Platform staff management, audit log viewer (with CSV export), platform settings

### Milestone 2 — Catalog
- Category tree (up to 3 levels), attribute schema per category (with inheritance — nullable-sentinel pattern), return policy, regulated/review-required flags, commission rate (bps) with seller-level override
- Vehicle makes/models for fitment-based categories
- Seller-facing "Categories & fees" page (effective commission, read-only)

### Milestone 3 — Listings
- 7-step seller listing wizard: category → basics → category-specific fields → photos → price/stock/shipping → returns & warranty → preview
- Autosave with retry/backoff (3s/10s/30s), localStorage backup, "unsaved changes" warning on navigating away, photo upload with its own timeout + progress bar
- Photo pipeline: magic-byte validation, EXIF/GPS stripped, 3 sizes × 2 formats (WebP + JPEG), 24h cleanup for unattached uploads
- Automatic listing checks (required fields, image count, prohibited keywords in English **and** Sinhala, Sri Lankan phone number detection, price/stock sanity, regulated-category expiry dates)
- Review workflow: seller-probation (first N listings, default 20), category `reviewRequired`/`regulated`, seller-level `reviewExempt` (owner-only, audited)
- Revisions: price/stock/hide-show apply instantly; content edits on a *published* listing go to a pending revision if review applies; category change always forces review
- Admin review queue (oldest-first, filterable) with live-vs-proposed diff for revisions, approve/reject-with-reasons/suspend/reinstate
- Public read API for listings (visibility rules enforced server-side, never relies on denormalized flags)
- Seller Products page: status tabs, inline price/stock edit, hide/show, duplicate, delete draft

### Test infrastructure
- `npm test` runs against a local in-memory MongoDB (`mongodb-memory-server`, replica set, so transactions work) — fast (~30s) and fully offline after the first binary download, instead of the old ~5-7 minute Atlas-backed run
- Guard rails refuse to run tests against anything but the local in-memory instance (no accidental Atlas/production hits)
- **137 tests passing** as of this write-up

### Recent POS-side work (explicit one-off exceptions, not part of Apexora)
- Bulk JSON import for POS inventory (admin-only, `/api/products/import-json`), with a per-item results view
- Receipt layout redesign in `print-agent` (industry-standard aligned item rows, inverted TOTAL bar) — not yet deployed to the shop PC

---

## 2. What's NOT built yet

Straight from the nav config's own `comingSoonMilestone` markers — these routes exist and render a "coming soon" placeholder, nothing more:

| Area | Side | Target milestone |
|---|---|---|
| Orders | Admin | M3 (flagged, not built) |
| Returns & Disputes | Admin | M3 (flagged, not built) |
| Finance (payouts, commission ledger) | Admin | M4 |
| Customers | Admin | M4 |
| Content (CMS pages, banners) | Admin | M5 |
| Orders | Seller | M6 |
| Finance (payout history, balance) | Seller | M7 |
| Returns | Seller | M8 |
| Performance (analytics) | Seller | M4 |

Beyond those placeholders, some things don't exist **at all** yet, not even as a stub:

- **No checkout, cart, or payment flow.** The public API only *reads* listings — there is no way for a customer to actually buy anything yet. This is the biggest gap before Apexora can take real orders.
- **No customer-facing storefront frontend.** The public listings API exists, but nothing renders it for shoppers — no product pages, search UI, or cart.
- **No customer accounts.** The `User` model only covers sellers and platform staff; there's no shopper signup/login.
- **No real OTP delivery.** Login OTP codes are currently `console.log`'d (and returned directly in the API response in non-production builds for dev/test convenience) — there is no actual SMS/email provider wired in. This has to be fixed before any real user logs in.
- **No email/SMS notifications.** `Notification` documents are created in-app only; nothing is ever emailed or texted to a seller or admin.
- **No payment/payout integration** (KOKO, bank transfer, card gateway, etc.) — commission math exists, but nothing actually moves money.

---

## 3. Security — what's in place, what needs work

**In place:**
- JWT access/refresh with separate secrets; two-step OTP login
- zod `.strict()` validation on every request body — unknown fields are rejected, not silently dropped
- Append-only audit log on every admin/seller write, with before/after snapshots
- Role-based access control enforced server-side on every route (never just hidden in the UI)
- "View as seller" is read-only at the middleware level — confirmed by tests that it 403s on every write route
- Step-up re-authentication required before any bank account change
- Upload validation: magic-byte file-type checks (not just file extension), size caps, EXIF/GPS stripped from photos
- `helmet()` on all responses; CORS restricted to an explicit allow-list
- Rate limiting on auth endpoints (login/OTP/refresh)
- Test infrastructure refuses to run against anything but a local database — no accidental production/Atlas writes from a test run

**Needs attention before this handles real traffic:**
1. **No general API rate limiting.** Only `/auth/*` is rate-limited. Every other admin and seller write route (listing creation, category edits, media uploads) can be hit as fast as a client wants. Worth adding a moderate per-IP/per-user limiter on write routes at minimum.
2. **OTP delivery is not real yet** (see above) — this is a security gap, not just a feature gap: right now, "logging in" relies on trusting whoever can read the server console or the dev-mode API response.
3. **No explicit request body size limit.** `express.json()` is used with no `limit` option, so it's on Express's default (100kb). That's fine for today's payloads but should be an explicit, intentional number rather than whatever the default happens to be.
4. **Secrets live in plain `.env` files.** Fine at this stage, but before this handles real seller/customer data at scale, move to a proper secrets manager (even just restricting who has filesystem access to the deploy target) rather than plaintext files sitting next to the code.
5. **No dependency vulnerability scanning noted** — worth adding `npm audit` (or Dependabot/Snyk) to a CI step, since none of this has been checked for known-vulnerable packages during this build.
6. **No automated secret-scrubbing check on logs.** `logAction`/audit entries store full before/after snapshots — worth confirming bank account numbers and any other sensitive fields are masked in what actually gets written to the audit log and app logs, not just in API responses.

---

## 4. Speed / performance — what needs work

Nothing here is on fire at current (near-zero) traffic, but these are the concrete things worth fixing before real load:

1. **No query in the entire backend uses `.lean()`.** Every read — list endpoints, detail pages, the admin review queue — hydrates full Mongoose documents (with all their getters/setters/virtuals) even though the response is just going to be serialized to JSON. This is the single easiest performance win available: add `.lean()` to every read-only query.
2. **Very few indexes** — only 10 `.index()` calls across all models. The listing search/filter paths (category, status, seller) and the public catalog browse path are the ones most likely to need composite indexes as data grows; worth an explicit audit once there's real data volume to test against.
3. **No caching layer.** Categories and vehicle makes change rarely but are read constantly (every wizard step, every listing check) — a simple in-memory cache (or Redis, if this scales past one process) would cut a lot of repeated DB round-trips for data that's nearly static.
4. **Image processing runs synchronously in the request.** Each photo upload does magic-byte validation + 3 sizes × 2 formats via `sharp`, all inline in the HTTP request/response cycle. Fine at today's scale; will need to move to a background job queue (e.g. Bull/BullMQ) before upload volume grows, so a slow image doesn't hold an HTTP connection open.
5. **Media is served from local disk via Express**, not a CDN. Works for dev; will need object storage + a CDN (S3 + CloudFront, or equivalent) before this serves real traffic, both for speed and so the app server isn't also acting as a file server.
6. **No consistent pagination cap verified across every list endpoint** — worth a pass to confirm every list route has both a sane default page size and a hard max, so a client can't request an unbounded result set.

---

## 5. Suggested next steps

In rough priority order, assuming the next phase is "make this actually sellable":

1. **Real OTP delivery** (email or SMS) — blocks any real user from logging in safely.
2. **Checkout + payment flow** — nothing can actually be bought yet; this is the core of being "an e-commerce platform" rather than a listings catalog.
3. **Customer accounts + the storefront frontend** — without these, there's no one for sellers to sell to.
4. **Orders (both admin and seller sides)** — once checkout exists, these become necessary immediately.
5. **Finance/payouts** — sellers will want to see what they're owed as soon as the first sale happens.
6. **The security and performance items above** — ideally folded into the above work as it's built, not bolted on afterward.

Everything in this document reflects the actual state of the code as of this write-up, not plans or intentions — "done" means tested and working; "not built" means the route either doesn't exist or renders a placeholder.
