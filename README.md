# Klassenstrijd

A mobile-first PWA for a two-day school event where classes compete.
The app is in Dutch. Class admins build the programme for their own class
(activities, times, locations, who takes part). Students log in with a class
password, pick their name and see their own rooster, classmates' roosters and
announcements.

Stack: React + Vite + vite-plugin-pwa, Cloudflare Workers (static assets), Supabase (Postgres).

## 1. Database (Supabase, once)

1. Create a project in region **Frankfurt (eu-central-1)**.
2. SQL Editor: run `supabase/schema.sql`, then `supabase/seed-demo.sql` (a demo class).
3. Project Settings, API: copy the **Project URL** and the **anon / publishable key**
   into `src/config.js`. Both are public values and safe to commit.

## 2. Run and deploy

```bash
npm install
npm run dev
```

Cloudflare Workers Builds: build command `npm run build`, deploy command `npx wrangler deploy`.
No build variables needed.

## 3. Try it

Open `/k/demo`. Passwords for the demo class:

| Role     | Password        |
| -------- | --------------- |
| Leerling | `leerling-demo` |
| Beheer   | `beheer-demo`   |

Log in as Beheer, add an activity, tick students, then log in as a leerling in a
second browser to see it appear (within a minute).

Delete the demo class before real use: `delete from public.klassen where slug = 'demo';`

## 4. Create a real class (SQL Editor)

```sql
select public.maak_klas('4G1', '4g1', 'blauwe-vos-27', 'rode-uil-54');
-- naam, slug (used in /k/4g1), leerlingwachtwoord, beheerderswachtwoord
```

## How access works

No table can be read directly (RLS on, no policies). The app only calls the
functions in `schema.sql`, which check a session token that is created by a
correct class password. Admins can only change their own class. Failed logins
are rate limited per class.

## Keep the free Supabase project awake

`.github/workflows/keep-alive.yml` pings the database every 3 days. Add repository
secrets `SUPABASE_URL` and `SUPABASE_KEY`. GitHub disables scheduled workflows after
60 days without repo activity, so push something now and then.

## Not built yet

Root panel (global announcements, results reveal), event dates, push notifications,
per-class QR code sheet, conflict warnings for overlapping activities.

## License

MIT
