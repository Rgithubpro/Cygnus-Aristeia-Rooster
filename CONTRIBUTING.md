# Contributing

Thanks for contributing to Aristeia. The repository contains a React/Vite PWA, Supabase database schema and migrations, a Supabase push Edge Function, and Cloudflare Worker deployment configuration.

## Repository map

The project is organized around a few clear responsibilities:

- `src/` — the main student and class-admin app UI, session handling, schedule pages and settings
- `src/root/` — the Root organizer interface, used when browsing to `/root`
- `src/editor/` — class appearance and page/editor components
- `supabase/schema.sql` — base database schema, security model and app functions
- `supabase/migratie-v*.sql` — schema upgrades; preserve order when making database changes
- `supabase/functions/push/index.ts` — Web Push notifications and reminder scheduling logic
- `wrangler.jsonc` — Cloudflare Worker deployment config

For the runtime architecture and role model, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Local workflow

Use Node.js 22 (see `.node-version`) and npm:

```bash
npm install
cp .env.example .env
```

Set the required Supabase URL and public client key in `.env` as described in [CONFIGURATION.md](./CONFIGURATION.md). Start the local app with:

```bash
npm run dev
```

Before submitting a change, run the production build:

```bash
npm run build
```

There is currently no test or lint script in `package.json`. If a change affects the UI or an integration, also verify that behavior directly in the relevant local or test environment.

## Changes and pull requests

- Work on a focused branch and target `development` unless the maintainer specifies another branch.
- Keep changes readable and consistent with existing patterns. UI copy is Dutch; retain the app's language and terminology when editing user-facing text.
- Explain the problem and behavior change in the pull request. Include steps to verify user-visible changes.
- Update the relevant documentation when changing setup, environment variables, Supabase schema or migrations, push behavior, or deployment.
- For database changes, preserve the existing migration sequence and document any required Supabase dashboard or secret changes. Do not edit an already-applied migration to deliver a new change; add a subsequent migration.

## Data and credentials

Never commit `.env` files, secrets, real student/class data, or production database exports. In particular, keep Supabase service-role keys, private VAPID keys, cron secrets and passwords out of frontend code and `VITE_*` variables. Only browser-safe public configuration belongs in the Vite build. See [CONFIGURATION.md](./CONFIGURATION.md) for the distinction and setup instructions.

## Before submitting

- [ ] The change is focused and its behavior is described.
- [ ] `npm run build` succeeds.
- [ ] Relevant setup, configuration and deployment docs are updated.
- [ ] No secrets or real personal/event data are included.
- [ ] Any database migration is ordered and safe for the intended upgrade path.

## License

The project is distributed under the MIT License in [LICENSE](./LICENSE). By submitting a contribution, you agree that it may be distributed under that license.


## Texts

Add user-visible text with `txt('...')` and run `npm run teksten:sync` so it appears in `src/teksten.js`. Run `npm run teksten:check` before committing. Never hard-code text in a component.
