# Klassenstrijd

A mobile-first PWA (Dutch UI) for a two-day school event where classes compete.

- **Leerlingen:** log in with the class password, pick their name, see their own rooster (or the whole class), day messages,
  "Nu bezig", info/news with images, the ranking (once revealed), print their rooster, and get a notification 5 minutes before each activity.
- **Klassenbeheerders** (second class password): manage their own class: students, activities with participants (with overlap
  warnings, own emoji), day messages, personal info per student, announcements with pictures, push messages to their class,
  and the class look: display name, slogan, accent colour, emoji and logo (Beheer, tab "Uiterlijk").
- **Root** (`/root`, real login + optional 2FA): create classes and passwords, QR codes, programme items for everyone,
  global info with images, scores and the "reveal ranking" switch, push to everyone, event dates, system banner, cleanup.

Stack: React + Vite + vite-plugin-pwa, Cloudflare Workers (static assets), Supabase (Postgres, Auth, Storage, Edge Function).

## Setup (once)

1. **Supabase project** in region Frankfurt. Authentication, Sign In / Providers: **turn off "Allow new users to sign up"**
   (only you need an account).
2. **SQL Editor:** if you ran the earlier scaffold, run `supabase/reset.sql` first. Then run `supabase/schema.sql`, then
   `supabase/migratie-v3.sql` (customization), `supabase/migratie-v4.sql` (robustness), then (for testing)
   `supabase/seed-demo.sql`.
   Also turn ON Authentication, Sign In / Providers, "Allow anonymous sign-ins": class admins use it only to get permission
   to upload pictures into their own class folder (new sign-ups by email stay off).
3. **`src/config.js`:** Project URL and anon/publishable key (public values, safe to commit).
4. **Root account:** Authentication, Users, "Add user" (your email + a strong password, auto-confirm).
   Then in the SQL Editor: `select public.maak_root('jij@example.com');`
   Open `/root`, log in, and set up 2FA under "Veiligheid".
5. **Push notifications (optional but recommended):**
   - `npx web-push generate-vapid-keys`. Put the **public** key in `src/config.js` (`VAPID_PUBLIEKE_SLEUTEL`).
   - Deploy the function: `supabase functions deploy push --no-verify-jwt` (or create it in the dashboard from
     `supabase/functions/push/index.ts` and switch "Verify JWT" off). **The function name must be exactly `push` in
     lowercase**: names are case-sensitive, and a function called `Push` makes every call and every cron run return 404.
   - Function secrets (Edge Functions, Secrets): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@example.com`),
     `CRON_SECRET` (any long random string).
   - Run `supabase/cron.sql` in the SQL Editor after replacing the two placeholders (do not commit the real values).
6. **Keep-alive:** GitHub repo secrets `SUPABASE_URL` and `SUPABASE_KEY`. `.github/workflows/keep-alive.yml` pings the database every
   3 days so the free project never pauses. GitHub disables scheduled workflows after 60 days without repo activity.
7. **Cloudflare Workers Builds:** build `npm run build`, deploy `npx wrangler deploy`. No variables needed.

## Check that notifications work

Log in on a phone (on iPhone: first "Zet op beginscherm" and open the app from the home screen), pick your name,
open "Meldingen", turn them on and press "Stuur een testmelding". The result tells you how many devices were reached.
Server side, `select status_code, content from net._http_response order by created desc limit 5;` should show 200 every minute.

## Try it

Open `/k/demo` (leerling `leerling-demo`, beheer `beheer-demo`; second class `/k/demo2`). Delete the demo classes before real use:
`delete from public.klassen where slug in ('demo','demo2');`

## Real use

Log in at `/root`, create the classes (readable passwords are generated, shown once), set the two dates under Instellingen,
print the QR codes, add the programme under Programma. Give each class its beheerderswachtwoord personally.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Page says "Bijna klaar" | `src/config.js` still has the placeholders. |
| Notifications do not arrive | Use "Meldingen, Stuur een testmelding". Check that the Edge Function is named `push` (lowercase) and that `select status_code, content from net._http_response order by created desc limit 5;` shows 200. On iPhone the app must be opened from the home screen. |
| Everything fails to load, login says "Er ging iets mis" | The free Supabase project may be paused (no activity for 7 days). Restore it in the dashboard and make sure the keep-alive secrets are set. |
| Class is locked ("Te veel pogingen") | Wait 10 minutes, or clear it: `delete from public.inlogpogingen where klas_id = (select id from public.klassen where slug = 'xyz');` |
| Lost your 2FA phone | In the SQL Editor: `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'jij@example.com');` then log in and set up 2FA again. |
| Rotate the cron secret | Set a new `CRON_SECRET` in the function secrets, then `select cron.unschedule('klassenstrijd-herinneringen');` and run `supabase/cron.sql` again with the new value. |
| Stop reminders after the event | `select cron.unschedule('klassenstrijd-herinneringen');` |

New app versions are applied automatically, but never while someone is typing or has a window open. A small bar
offers "Nu vernieuwen" in the meantime.

## Security model

- No table can be read or written directly (RLS on, no policies, privileges revoked). The public key can only call the functions.
- Class passwords are bcrypt hashes checked in the database; failed logins are rate limited per class; sessions are random tokens
  (only a hash is stored), expire (3 days or the end date), and can be ended per class.
- Admins can only change their own class; Root functions require a real Supabase login (+ 2FA once enabled).
- Hard caps on students/activities per class; text length limits in the database.
- Pictures: Root may upload anywhere; a class admin only into their own class folder (max 150 pictures), enforced by the
  storage policy, with the admin's class session as proof.
- All text is rendered as plain text. No HTML, no embed code. Links ask for confirmation. Images can only be uploaded by Root.
- The ranking is only returned for days Root made visible. Push can only be sent by Root or by an admin to their own class.
- No third-party analytics. Personal data is removed with one button, or automatically 14 days after the end date.

## License

MIT
