# Project status

- Original customer catalogue, pickup/delivery checkout, local file uploads, order tracking, pharmacy inventory and notifications implemented.
- Single-browser demo supports two role-specific tabs, 16 medicines and four stores.
- Local TypeScript/production build and five model tests passed.
- New hosted database unavailable: Supabase free organization limit. No live migration, hosted demo users or cross-device test completed.
- Four Playwright scenarios passed against the production build: prescription pickup with live owner alert and handover, prescription delivery with file viewing, concurrent last-unit reservation, and normal pickup expiry with stock restoration.
- Rejected-to-completed transitions were tested in the model suite. Database placement, rejection and stock restoration were exercised locally using PostgreSQL emulation; hosted Auth, Storage, Realtime and pg_cron remain unverified.
- Hosted seed script included for one customer and four pharmacy owners. No hosted demo credentials were issued.
