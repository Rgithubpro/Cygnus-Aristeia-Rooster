# Cygnus Aristeia Rooster

Cygnus Aristeia Rooster is a Dutch-language, mobile-first web app for organizing a two-day school event. It provides class schedules, activities, announcements, standings and optional push notifications. The app is installable as a Progressive Web App (PWA).

## What it does

- **Students** sign in through their class link and password, choose their name, and see their schedule, class information, announcements and any standings that have been revealed.
- **Class administrators** manage their own students, activities, class announcements, messages, notifications and class appearance.
- **Root organizers** use `/root` to manage classes, the event programme and dates, standings, templates, global announcements and app-wide settings. Root access uses a Supabase Auth account; two-factor authentication can be enabled in the app.

The application is a React and Vite frontend. Cloudflare Workers serves its built static assets; Supabase provides the Postgres database, Auth, Storage and the push-notification Edge Function.

## How the project is organized

This repo combines a browser app, a database schema and deployment configuration:

- `src/` — main student/admin interface and the app shell
- `src/root/` — the organizer-only Root interface available at `/root`
- `src/editor/` — editor components used for class appearance and page-building tools
- `supabase/schema.sql` — base database schema, RLS setup and the app functions that the frontend calls
- `supabase/migratie-v*.sql` — ordered database migration files
- `supabase/functions/push/index.ts` — Web Push Edge Function for reminders and manual notifications
- `public/` — static assets and icons
- `wrangler.jsonc` — Cloudflare Worker configuration

For a guided explanation of the runtime architecture, roles, database model and deployment boundaries, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Start an event

After completing the Supabase setup in [CONFIGURATION.md](./CONFIGURATION.md), open `/root`, create the classes, set the event dates and add the programme. Root can also set up leagues and standings, create reusable schedule templates, publish global information and print class QR codes. Share each class link and its student/admin passwords with that class privately; generated passwords are shown only when created.

For a test run, apply `supabase/seed-demo.sql` after the schema and migrations. It creates `/k/demo` and `/k/demo2`; the student/admin passwords are `leerling-demo` / `beheer-demo` and `leerling-demo2` / `beheer-demo2`, respectively. Remove the demo data before real use by running:

```sql
delete from public.klassen where slug in ('demo', 'demo2');
```

## Get started

You need Node.js 22 (the version in `.node-version`), npm and a Supabase project. Follow [CONFIGURATION.md](./CONFIGURATION.md) to create and configure Supabase before expecting the app's data and login features to work.

```bash
npm install
cp .env.example .env
```

Fill in at least `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` in `.env`, then start the local Vite development server:

```bash
npm run dev
```

## Build, preview and deploy

Set the frontend environment variables before building; Vite embeds them in the generated browser files.

```bash
npm run build
npx wrangler preview
npx wrangler deploy
```

`npm run build` creates the `dist/` assets configured in `wrangler.jsonc`. `npx wrangler preview` creates a Cloudflare preview deployment; it is not the local Vite preview server. `npx wrangler deploy` deploys the current build to the Worker configured by Wrangler. Both Wrangler commands require Cloudflare authentication. The `npm run deploy` convenience script also builds first and then deploys.

For Cloudflare Workers Builds, configure the `VITE_*` values as build variables in the Cloudflare dashboard. See [CONFIGURATION.md](./CONFIGURATION.md) for Supabase initialization, optional services, secrets and deployment details.

## Load testing

The repository includes a student load-test runner for isolated non-production environments. See [LOAD-TESTING.md](./LOAD-TESTING.md) for setup, safety requirements and usage.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — project structure, runtime architecture, auth model and deployment boundaries
- [CONFIGURATION.md](./CONFIGURATION.md) — Supabase setup, environment variables, push notifications, analytics and Cloudflare deployment
- [CONTRIBUTING.md](./CONTRIBUTING.md) — local workflow and contribution expectations
- [SECURITY.md](./SECURITY.md) — security model, reporting process and handling of sensitive data
- [LOAD-TESTING.md](./LOAD-TESTING.md) — safely running the student load test
- [LICENSE](./LICENSE) — MIT License

## License

This project is distributed under the MIT License. See [LICENSE](./LICENSE).
