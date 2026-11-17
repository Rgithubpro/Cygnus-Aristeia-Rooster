# Aristeia

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
   `supabase/migratie-v3.sql` (customization), `supabase/migratie-v4.sql` (robustness), `supabase/migratie-v5.sql` (leagues + customization), `supabase/migratie-v6.sql` (places-based standings, app icons), `supabase/migratie-v7.sql` (more colours, example roosters), then (for testing)
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
7. **Cloudflare Workers Builds:** build `npm run build`, deploy `npx wrangler deploy`. Supabase values are in `src/config.js`.
8. **Optional Google Analytics (GA4):**
   1. In Google Analytics, create a property and a **Web** data stream for the deployed app. Copy the Measurement ID
      from the stream; it looks like `G-XXXXXXXXXX`.
   2. In Cloudflare Workers Builds, add `VITE_GA_MEASUREMENT_ID` with that ID as a **build variable** for the
      production deployment (and for any preview environment where you want to test). Rebuild and deploy. For local
      testing, you can instead put `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in `.env.local`; never commit that file.
      Without a valid ID, analytics stays disabled and users do not see a consent prompt.
   3. On first use, a small cookie and analytics banner explains the choice and links to the full in-app privacy notice.
      The banner asks whoever is using that browser on that device before Google’s script can load. If they decline,
      no analytics script is loaded. The choice is stored on that device, not attached to an account, and can be
      changed later in **Instellingen → Privacy en gebruiksstatistieken**.
   4. Before relying on the reports, register the event parameters as custom dimensions in GA4. In the GA4 property,
      open **Admin → Data display → Custom definitions → Create custom dimension** (the exact menu labels can vary):
      - Dimension name: `Class`; scope: **Event**; event parameter: `class_slug`.
      - Dimension name: `User role`; scope: **Event**; event parameter: `user_role`.
      - Dimension name: `Admin page`; scope: **Event**; event parameter: `admin_page`.
      Save each dimension. These dimensions apply to events received after creation; they do not fill in past
      reports. New GA4 custom dimensions can take 24–48 hours to appear in standard reports. You can often inspect
      recent events sooner in **Reports → Realtime** or **Admin/Reports → DebugView** while testing.
   5. **See which app pages are used most:** open **Reports → Engagement → Pages and screens**. The app sends one
      `page_view` when a user opens or switches to an app tab. The synthetic page paths are `/app/rooster`,
      `/app/info`, `/app/stand`, `/app/pagina`, and `/app/beheer`; the page title is `Aristeia | <tab>`. These are
      app-internal labels, not actual URLs, so class slugs and other route details are not exposed in the URL.
      Compare **Views** to see which tabs are most visited.
   6. **Break page usage down by class or role:** open **Explore → Free form**, add `Page path`, `Class`, and
      `User role` as dimensions, and add **Views** (or **Event count**) as a metric. Put `Page path` in Rows and
      `Class` or `User role` in Columns or Filters. Filter `Event name` to `page_view` if the table also includes
      other events.
   7. **See which admin sections are used:** in that exploration, filter **Event name** to `admin_page_view` and
      use `Admin page` and `Class` as dimensions. The admin section values are `activiteiten`, `leerlingen`,
      `dagberichten`, `info`, `meldingen`, and `klas`. Compare **Event count** to see which sections are opened
      most often. These are aggregate usage reports; GA does not identify a person by their name.
   8. **Data sent by this app:** after consent, `page_view` includes `page_title`, synthetic `page_location`,
      synthetic `page_path`, an empty `page_referrer`, `class_slug`, and `user_role`. `admin_page_view` includes
      `admin_page`, `class_slug`, and `user_role`. The app does not send names, student IDs, session tokens,
      roster details, or actual class routes. GA may still process its own technical browser/device data, so this is
      not anonymous in the strict sense. A class slug may itself identify a class; confirm that sharing it with
      Google is acceptable, or use non-identifying class codes instead.
   9. **Privacy approval:** check with the school’s privacy contact that GA4, the consent prompt, and the data
      sharing are appropriate before enabling this, especially because students may be minors. Do not send names or
      other directly identifying personal data to Google Analytics.

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

## Help for class admins

The wiki (https://github.com/Rgithubpro/Cygnus-Aristeia-Rooster/wiki) is linked from the first-time welcome popup and from a notice at the top of Beheer.

## Leagues and standings

Create leagues in `/root` (Stand) and assign classes to them. Enter a place per class per day (shared places allowed, points
optional). Day 1 shows the places, day 2 also the total points. Per-game points can still be entered and converted to places.
Root can force the Stand tab on for every class.

## Class customization

Class admins customize everything under Beheer, tab "Uiterlijk": name, slogan, logo, banner, mascot, colour palette or own colours,
fonts, shapes, header and card styles, what is shown, background pattern, emoji strip/rain, tabs and a free-form class page.
The app previews changes live. The class logo and colours also theme the login link, notifications and (best effort) the installed
app icon: install the app after opening your class link.

## Installing with the class icon

An installed app keeps the icon it was installed with; a website cannot change it afterwards. So install from the class link or QR
code (`/k/<klas>`): when the class has an app icon, the app is installed with that icon and name. An app that was installed with the
swan icon shows a hint after login on how to reinstall it with the class icon.

## Example roosters

In `/root` (Sjablonen) the organisers make example roosters, for all classes or chosen classes. Class admins see them at the top of
Beheer, Activiteiten, copy the parts they want (optionally with their whole class added) and then only adjust and add students.

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
- Optional GA4 is loaded only after a user's explicit opt-in and only on the student-facing app; it records the class
  slug, role, general tab views, and (for class admins) admin-section views. It never sends names, student IDs, session
  tokens, rosters, or class routes. Do not send personal data to Google Analytics; users can withdraw consent in
  Instellingen, which stops further analytics events. Google may process technical browser data and set analytics
  cookies while consent is enabled. If `VITE_GA_MEASUREMENT_ID` is unset or invalid, no analytics script is loaded.
  Personal data is removed with one button, or automatically 14 days after the end date.

## License

MIT
