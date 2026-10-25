# SmartPantry AI — Next.js + JavaScript + Tailwind CSS + Supabase

A responsive hackathon MVP for grocery product lookup, household inventory, batch expiry tracking, simple retail stock/sales events, donation offers, and a credit/rewards ledger.

## Stack
- Next.js 15 App Router + JavaScript
- React 19
- Tailwind CSS 3
- Supabase Auth + PostgreSQL + Row Level Security
- Open Food Facts API for barcode product lookup
- Zod validation and PostgreSQL RPCs for atomic inventory/credit updates

## What is implemented
- Responsive landing page and account signup/login using Supabase Auth.
- Account type selection: household, grocery retailer, donation organization.
- User-scoped inventory batches with quantity, unit, expiry date, unit cost.
- Barcode lookup via server API route; manual entry remains available.
- Record consume, sale, or waste events; stock changes are atomic in PostgreSQL.
- Donation offers with explicit `offered` status. Creating an offer does not reduce stock and does not award credits.
- Credit wallet balance and demo reward redemption using a transaction-safe database function.
- RLS policies for private user data.
- Server-side validation, safe external API timeout, environment-variable template, and no service-role key in browser code.

## Important scope notes
This is a runnable MVP baseline, not a guarantee of bug-free production deployment. Before a real public launch, conduct security review, automated tests, accessibility checks, load testing, database backup/recovery drills, and a privacy/legal review.

- Donation recipient verification/admin approval is not implemented as a public UI. Donation credits are intentionally **not** automatically granted. Add a trusted organization/admin workflow before awarding donation credits.
- Retailer billing is represented by recording a `sale` inventory event. A full POS system (tax rules, receipts, payment processing, refunds, hardware integration) is not included.
- Product lookup data can be incomplete or wrong. Verify package labels. A barcode does not encode the expiry date.
- Waste deductions are a simple configurable demo rule, not a production policy. It asks for a reason and attempts to exempt safety-related reasons. For production, replace free-text inference with an explicit reason category and an appeal/correction workflow.
- Demo reward names are placeholders. Do not promise coupons or financial value until real partners define terms.
- The product nutrition score, OCR receipts, AI meal suggestions, retailer product catalog verification, and live donation logistics are not implemented in this first code bundle.
- No sensitive health profile is stored by this MVP.

## Prerequisites
- Node.js 20 LTS or newer
- npm
- A Supabase project

## Setup
1. Extract the ZIP.
2. In the project folder, install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local`.
4. In Supabase Dashboard → Project Settings → API, copy the project URL and publishable/anon key into `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```
   Never put a service-role key in a `NEXT_PUBLIC_` variable or commit it.
5. In Supabase Dashboard → SQL Editor, run `supabase/schema.sql` once on a new project.
6. In Supabase Authentication → URL Configuration, set the local Site URL to `http://localhost:3000`. Add your deployed URL to allowed redirect/site URLs when deploying.
7. For easy local testing, turn off email confirmation only in a disposable development project. For production, keep email confirmation enabled and configure SMTP.
8. Start the app:
   ```bash
   npm run dev
   ```
9. Visit `http://localhost:3000`, create an account, confirm the email if required, then log in.

## Build and deployment
```bash
npm run build
npm run start
```
Deploy to a supported Node.js host such as Vercel. Add the two public Supabase environment variables in the host's environment settings. Run database schema changes intentionally and back up production data before migrations.

## Supabase security checklist
- RLS is enabled on all user-owned tables.
- Policies scope data to `auth.uid()`.
- Database functions are `SECURITY INVOKER`, not elevated service-role actions.
- Never trust client-supplied `user_id`; server actions derive it from the authenticated session.
- Restrict Supabase Auth sign-up/rate limits and configure CAPTCHA if exposed to abuse.
- Review whether users may self-select `retailer` or `organization` before production. For real verified partners, use an approval workflow and server-controlled role changes.
- Configure production CORS, logging, monitoring, backups, and incident response.

## Smoke test checklist
- [ ] Signup, email confirmation, login and logout work.
- [ ] Unauthenticated users cannot open `/dashboard`.
- [ ] One user cannot read another user's inventory, events, credits or donations.
- [ ] Add batch with and without expiry date.
- [ ] Invalid barcode and missing product record show a helpful message.
- [ ] Barcode lookup can prefill product name; manual editing remains possible.
- [ ] Consume/sale/waste event decreases stock exactly once.
- [ ] Quantity greater than available stock is rejected.
- [ ] Waste event without a reason is rejected.
- [ ] Safety-related discard reason does not incur the demo penalty.
- [ ] Donation offer is visible with `offered` status and does not deduct inventory.
- [ ] Reward redemption fails if balance is insufficient.
- [ ] Layout works at narrow mobile width and desktop width.

## Project layout
```text
app/
  api/products/[barcode]/route.js
  dashboard/
    actions.js
    dashboard-client.js
    inventory-form.js
    page.js
    product-lookup.js
  login/page.js
  signup/page.js
  globals.css
  layout.js
  page.js
components/
lib/supabase/
supabase/schema.sql
```

## Product QR and personalized health-fit flow

The dashboard now supports two identification paths:

- **Fresh/unlabelled items:** a signed-in grocery owner registers the product in the `pantry_products` table. The app creates a unique QR code pointing to `/pantry/<product-uuid>`. Customers can scan that QR with their phone camera to open the public product page.
- **Packaged products:** enter the manufacturer barcode in Product scanner. The server looks up Open Food Facts and shows available ingredients/allergen information plus a health-fit assessment. Missing barcodes can be handled by owner registration instead.
- **Health fit:** both paths use the same explainable assessment component. For owner-registered fresh foods, the initial score is a category-based estimate. For packaged foods, the current implementation uses available product category and notes. It does **not** claim verified nutrient calculations or diagnose conditions. A production-grade nutrient score should calculate from normalized nutrient values and use AI only to explain evidence, with missing data clearly marked.

After updating an existing deployment, run the complete `supabase/schema.sql` in Supabase SQL Editor (or apply the added `pantry_products` table/policies/grants as a migration). Install the added dependency with `npm install`; then run `npm run dev`. QR generation uses `qrcode.react`.

### Limitations to address before production

- Barcode lookup currently accepts typed barcode digits; add a camera barcode scanner library for in-app camera capture if required. Product QR codes work with the phone's native camera.
- Health fit is an MVP rules-based estimate, not a medical recommendation. Do not use the score for clinical decisions or to rule out allergens.
- Open Food Facts nutrition fields can be incomplete. A future iteration should normalize per-100g values, calculate a documented deterministic nutrition score, and then use an AI model for personalized plain-language explanations.
- Owner product registration currently assumes the signed-in account is authorized to act as a grocery owner. Production should verify retailer accounts before allowing public product registration.

## Role-specific dashboards (updated)

After sign-in, `/dashboard` routes each user to their own dashboard:

- `/household/dashboard` — household pantry, product lookup, expiry reminders, and recent activity.
- `/retailer/dashboard` — grocery-owner product registration, QR catalogue, and packaged barcode lookup.
- `/organization/dashboard` — available surplus-food offers and donation request history.
- `/admin/dashboard` — platform counts and the retailer/organization verification queue.

The role pages and server actions check the authenticated profile on the server. Household accounts are verified automatically; retailer and organization accounts start as **pending** and must be approved by an administrator. Admins cannot register themselves through the signup form.

### Database setup for the role dashboards

- For a brand-new Supabase project, run `supabase/schema.sql` once.
- If you already ran an earlier version of the SmartPantry schema, back up the database and run `supabase/role_dashboard_migration.sql` in the Supabase SQL Editor. Do not rerun the original non-idempotent schema over existing tables.
- To appoint the first administrator, use the Supabase SQL Editor as the trusted project owner and replace the email below:

```sql
update public.profiles
set account_type = 'admin', is_verified = true, updated_at = now()
where id = (select id from auth.users where email = 'admin@example.com');
```

Only do this for an account whose identity you have verified. The admin dashboard can approve retailer and organization accounts after that initial bootstrap.

### Production-readiness note

The project has role-separated routes, server-side role checks, and database RLS policies, but a ZIP alone cannot be described as fully production-verified until the migration is applied to your actual Supabase project, environment variables are configured, and the production build and role-specific integration tests pass. Donation collection/fulfillment, organization identity checks, monitoring, backups, and health-score validation still need operational setup before a public launch.
