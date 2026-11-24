# FindMedicine · neighbourhood pharmacy counter

An original React and TypeScript college project with a pine-green storefront, collection-slip graphics, searchable medicine catalogue and a pharmacy order desk.

## Start the browser demo

Install Node 22.12 or later, then run:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Click **Customer counter** in one tab. In a second normal tab on the same origin, click **Pharmacy workspace**. Each tab keeps its own role. Use pincode **425405** and select **Riverbend Pharmacy** to send an order to the demo owner. The demo includes 16 medicines and four stores. Use invented details and sample files. Orders and stock are shared by tabs in the same browser profile. Reset the demo by clearing site data.

For pickup, prescription items show a carry-your-prescription reminder. Delivery asks for an address and, when necessary, a JPG, PNG or PDF. The owner can accept or reject orders, update inventory, and verify the customer's code at collection or delivery. Browser notifications require permission and an open tab. Demo expiry runs while the app is open.

## Separate Supabase project

Demo mode is the default, including when an older .env contains credentials. For a **new** hosted project, apply supabase/migrations/202611240001_counter.sql in its SQL Editor. This creates account profiles, a catalogue, stores, order policies, order functions, a private prescription bucket, Realtime publication membership and the expiry job. The hosted database uses email/password authentication; create a customer account and a store owner account from the signup form. In Inventory the owner must set a store address, pincode, prices and positive stock, then open the store. Use the seed script below to create demo stores and accounts.

Copy .env.example to .env.local, set VITE_BACKEND_MODE=supabase and enter only that project's VITE_SUPABASE_URL and client-side anon/publishable key. Restart Vite. The browser demo and hosted data are independent. The hosted migration has not been applied to a live project.

## Checks

```sh
npm run build
node --test tests/model.test.mjs
npx playwright install chromium
npm run test:e2e
```

College project. Not for real medical use.

### Hosted demo accounts

After applying the migration to your new demo project, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your terminal and run:

```sh
node --experimental-strip-types scripts/seed-demo.mjs
```

The script creates customer@findmedicine.test and store1@findmedicine.test through store4@findmedicine.test. Each new account's random password is printed once in that terminal. Save the passwords privately. Rerunning preserves existing accounts and store inventory. Use a normal browser window for the customer and a private window for the owner when testing hosted notifications. The browser-only demo uses the two role buttons and needs no passwords.
