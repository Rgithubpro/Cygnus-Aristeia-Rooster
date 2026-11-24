# Configuration and deployment

This app is a Vite-built browser frontend backed by Supabase and deployed as Cloudflare Worker static assets. Set frontend values at build time; Vite includes every `VITE_*` value used by the app in the browser bundle.

## Project layout and runtime boundaries

The codebase is deliberately split into a few clear runtime areas:

- `src/` contains the student and class-admin app, the main shell and the class experience.
- `src/root/` contains the Root organizer experience, which is loaded only when the browser path starts with `/root`.
- `supabase/schema.sql` defines the database schema, RLS rules and the Postgres functions the browser app calls.
- `supabase/migratie-v*.sql` contains the ordered migration files that build on the base schema.
- `supabase/functions/push/index.ts` is the Supabase Edge Function responsible for Web Push reminders and manual notifications.
- `wrangler.jsonc` configures the Cloudflare Worker that serves the built frontend assets.

The database does not rely on direct table access as the normal app path. The schema is designed so the browser calls RPC functions through the Supabase REST API instead of reading and writing tables directly. The Root and student/admin flows also use different authentication patterns, which is why the code keeps separate Root helpers alongside the standard class-session calls.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full project map and the role-by-role data flow.

## Frontend environment variables

Copy the example file for local development:

```bash
cp .env.example .env
```

Set these values in `.env`:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL, such as `https://your-project.supabase.co`. |
| `VITE_SUPABASE_KEY` | Yes | Supabase publishable key, or the legacy anon key. Both are public client keys. |
| `VITE_VAPID_PUBLIC_KEY` | Optional | Public VAPID key for browser push subscriptions. Set this when enabling push notifications. |
| `VITE_WIKI_URL` | Optional | URL linked from the app to its wiki or documentation. |
| `VITE_GA_MEASUREMENT_ID` | Optional | Google Analytics 4 measurement ID, in the form `G-...`. |

The Supabase URL and key are required for app data and sign-in. If they are missing, the app treats itself as unconfigured. Restart `npm run dev` after changing local environment values. For a build, set the values before running `npm run build`.

### Public values and secrets

Everything prefixed with `VITE_` is public. Do not put a Supabase service-role key, passwords, access tokens, the private VAPID key or any other secret in `.env`, Cloudflare build variables or frontend source. The Supabase publishable/anon key is intended for browsers; database access is constrained by the SQL functions, grants and storage policies in this project, not by hiding that key.

Store server-side credentials in Supabase Edge Function secrets or another appropriate secret store. The push function uses `CRON_SECRET`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` server-side; never expose these to the frontend. The public VAPID key belongs in `VITE_VAPID_PUBLIC_KEY` and also in the Edge Function's `VAPID_PUBLIC_KEY` secret.

## Supabase setup

Use a Supabase project for the environment. For a **new** project, run `supabase/setup.sql` once in the Supabase SQL Editor. It contains the complete database setup (it is `schema.sql` and `migratie-v3.sql` to `migratie-v7.sql` in order). For an **existing** project, only run the `migratie-vN.sql` files you have not run yet, in order, and deploy the matching app code. Do not run `supabase/reset.sql` on a real or populated project: it is a destructive reset script for an older scaffold. `supabase/seed-demo.sql` is optional test data (run it after `setup.sql`); do not leave demo classes in a live event. See [README.md](./README.md#start-an-event) for the demo login passwords and cleanup command.

Configure Supabase Auth as follows:

- Leave **Allow new users to sign up** **on**, and keep **Confirm email** on under the Email provider. Anonymous sign-ins count as sign-ups: with sign-ups off, class admins cannot upload pictures (the auth log shows `signup_disabled`). This is safe because a new account can do nothing by itself: every table is locked, Root needs an entry made by `maak_root`, and uploads need an admin class session.
- Turn **Allow anonymous sign-ins** on. The app uses anonymous Auth only to authorize class-admin image uploads; class logins themselves use the app's own database-backed class sessions.
- Add the Root organizer as a Supabase Auth user (with a strong password). Then run `select public.maak_root('you@example.com');` in the SQL Editor using that user's email. Open `/root` and enable two-factor authentication under **Veiligheid**.

The SQL setup creates the app's tables, functions and storage configuration. Keep the Supabase project URL and client key in the frontend configuration; do not use a service-role key in the app.

## Push notifications (optional)

Push needs a matching VAPID key pair and a deployed Supabase Edge Function:

1. Generate a key pair with `npx web-push generate-vapid-keys` (the `web-push` command may need to be run using an available installation of that tool).
2. Set the public key as `VITE_VAPID_PUBLIC_KEY` before building the frontend.
3. Deploy the function with the Supabase CLI: `supabase functions deploy push --no-verify-jwt`. Its name must be exactly `push` in lowercase. The repository's `supabase/config.toml` disables gateway JWT verification because the function performs its own authorization.
4. In Supabase Edge Function secrets, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for example `mailto:admin@example.com`) and a long random `CRON_SECRET`. The function also uses the Supabase-provided `SUPABASE_URL` and `SUPABASE_DB_URL`.
5. In `supabase/cron.sql`, replace `JOUW-PROJECT` and `JOUW-CRON-GEHEIM` with the project reference and the same `CRON_SECRET`, then run the file in the SQL Editor. The reminder job runs every minute from 04:00 through 22:59 UTC. The file also schedules automatic cleanup and removal of old cron logs. Automatic deletion 14 days after the event only takes place when this cleanup job is installed and an event end date is set in Root.

Push delivery is server-side. The browser only needs the public VAPID key to register a subscription. Test delivery from the app's **Meldingen** page. On iPhone, notifications require the installed home-screen app.

## Google Analytics (optional)

Set `VITE_GA_MEASUREMENT_ID` to a valid GA4 measurement ID (`G-...`) to enable the consent prompt. The analytics script loads only after the user opts in; an empty or invalid ID keeps analytics disabled. The app sends page/tab and class-admin-section usage events with a class slug and role, but not student names, IDs, session tokens or roster details. A class slug may still identify a class, and Google may collect technical browser/device data. Get the school's privacy approval before enabling analytics, especially when students are minors. Users can change their choice in **Instellingen → Privacy en gebruiksstatistieken**.

## Cloudflare Workers

`wrangler.jsonc` configures the Worker name, the `dist/` static-assets directory and single-page-app fallback. For local builds, run the commands from the repository root:

```bash
npm run build
npx wrangler versions upload
npx wrangler deploy
```

The build produces `dist/`. Wrangler preview creates a Cloudflare preview deployment; it is not the local Vite preview server. Wrangler deploy publishes the built assets to the configured Worker and does not run the Vite build first. Both Wrangler commands need Cloudflare authentication. The optional `npm run deploy` script runs the build and deploys in one step.

For Cloudflare Workers Builds, use these commands:

- **Build:** `npm run build`
- **Preview:** `npx wrangler versions upload`
- **Deploy:** `npx wrangler deploy`

Configure the frontend `VITE_*` values as build variables for every environment that needs them (production and previews). Those values are compiled into that environment's client bundle. Build before previewing or deploying; the direct Wrangler commands do not run the Vite build. Keep secrets out of build variables.

## Keeping a Supabase free project active

The optional `.github/workflows/keep-alive.yml` workflow calls `start_info` every three days. To use it, add repository secrets named `SUPABASE_URL` and `SUPABASE_KEY` (the project URL and public client key). GitHub may disable scheduled workflows after prolonged repository inactivity, so check the Actions page periodically.

## References

- [README.md](./README.md) — project overview and quick start
- [ARCHITECTURE.md](./ARCHITECTURE.md) — project structure and runtime boundaries
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contributor workflow
- [LICENSE](./LICENSE) — MIT License


## Texts, name and branding

- **All texts** shown in the app are in `src/teksten.js`. Edit the text on the right of each line. `APP_NAAM` at the top is the app name (also used for the page title and the installed app name). After adding a new text in the code, run `npm run teksten:sync`; `npm run teksten:check` verifies the file is complete.
- **Notification texts** are in the `TEKSTEN` block at the top of `supabase/functions/push/index.ts` (that function is deployed separately).
- **Logo and icons**: replace `public/favicon.svg`, `public/apple-touch-icon.png` and `public/icons/*`. The header mark is `src/Mark.jsx` with its data in `src/marks.js`. Each class can still set its own logo and app icon in the app.
- **Default colours** are the CSS variables at the top of `src/styles.css`.
- **Hosting names**: change `name` in `wrangler.jsonc` and `package.json` when you copy the project.
- **Wiki link**: set `VITE_WIKI_URL` to show the help link for class admins; leave it empty to hide it.
