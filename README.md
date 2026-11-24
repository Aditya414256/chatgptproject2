# FindMedicine

A medicine ordering web app — place orders for pickup or home delivery from nearby pharmacies.

> **College project. Not for real medical use.**

---

## Demo Accounts

All accounts use password: **`Test1234!`**

| Email | Role | Store |
|---|---|---|
| `customer@findmedicine.test` | Customer | — |
| `store1@findmedicine.test` | Store Owner | Shirpur Medical Store |
| `store2@findmedicine.test` | Store Owner | HealthPlus Pharmacy |
| `store3@findmedicine.test` | Store Owner | Apollo Pharmacy Shirpur |
| `store4@findmedicine.test` | Store Owner | Lifeline Medicals |

---

## Setup

### 1. Prerequisites

- Node.js 22.12+
- A Supabase project (already configured: `ilumcvjseevbpkgtscth`)

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase URL and anon key (find them in your Supabase project → Settings → API).

### 3. Install Dependencies

```bash
npm install
```

### 4. Apply Database Migrations

**Option A — Supabase CLI (requires `supabase login`):**
```bash
npx supabase link --project-ref ilumcvjseevbpkgtscth
npx supabase db push
```
If asked for your database password, type it in the terminal.

**Option B — Supabase SQL Editor (paste manually):**
1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/ilumcvjseevbpkgtscth/sql/new)
2. Paste and run `supabase/migrations/00001_schema.sql`
3. Run `supabase/migrations/00002_prescription_access.sql`.
4. Use `supabase/seed.sql` only for a fresh demo database; preserve existing accounts and inventory.

### 5. Create Demo Users (if seed didn't create them)

The seed tries to insert into `auth.users` directly. If that fails (expected on hosted Supabase), create each user manually:

1. Go to Supabase Dashboard → Authentication → Users → Add user
2. For each user, set **User Metadata** (raw_user_meta_data) like:
   ```json
   {"full_name": "Demo Customer", "phone": "9876500005", "role": "customer"}
   ```
3. The `handle_new_user` trigger creates the profile row automatically.
4. After creating store-owner users, link them to their stores:
   ```sql
   UPDATE public.stores SET owner_id = '<user-uuid>' WHERE name = 'Shirpur Medical Store';
   ```

### 6. Run the App

```bash
npm run dev
```
Opens at [http://localhost:5173](http://localhost:5173)

---

## Testing the Notification Flow (Two Browser Windows)

1. Open **Window 1** (normal): Log in as `store1@findmedicine.test`
   - Click **Enable alerts** on the dashboard
   - Keep this tab open

2. Open **Window 2** (incognito): Log in as `customer@findmedicine.test`
   - Add any medicine to cart → Choose fulfilment → Select Shirpur Medical Store → Place order

3. Watch **Window 1**: A toast notification appears in real time, the unread badge increments, and a browser notification fires (if permission granted).

---

## Running Playwright Tests

```bash
# Install browsers once:
npx playwright install chromium

# Run all tests:
npx playwright test

# Run with UI:
npx playwright test --ui
```

> Tests require the app to be running (`npm run dev`) and `.env` to have valid credentials.

---

## Project Structure

```
src/
├── config/
│   ├── brand.ts          ← Product name (rename here)
│   └── constants.ts
├── components/
│   ├── layout/           ← AppLayout, Footer
│   └── ui/               ← Button, Card, Badge, Input, etc.
├── features/
│   ├── auth/             ← Login, Signup, AuthProvider, ProtectedRoute
│   ├── catalog/          ← Medicine catalog
│   ├── cart/             ← Cart state and page
│   ├── orders/           ← Fulfilment, store selection, prescription, review, tracking
│   └── store-dashboard/  ← Dashboard, order detail, inventory, store setup
├── lib/
│   ├── supabase.ts       ← Typed Supabase client
│   └── utils.ts
└── types/
    └── database.ts       ← Full TypeScript DB types
supabase/
├── migrations/
│   └── 00001_schema.sql  ← Full schema + RLS + RPC functions + pg_cron
└── seed.sql              ← Medicines, stores, inventory, demo users
tests/
└── e2e/                  ← Playwright tests
```

---

## Tech Stack

- **React 19 + TypeScript + Vite** — Frontend
- **Tailwind CSS v4** — Styling with custom design tokens
- **Supabase** — Auth, Postgres, RLS, Realtime, Storage
- **TanStack Query** — Data fetching and caching
- **React Router v7** — Navigation
- **Zod** — Form validation
- **lucide-react** — Icons
- **Playwright** — End-to-end tests
