# Contributing

Thanks for helping improve Cygnus Aristeia Rooster.

## Purpose of this repository

This project is a full-stack school event app built with:

- React for the front-end app
- Vite for local development and build tooling
- Cloudflare Workers for deployment of the front-end assets
- Supabase for database, auth, storage, and edge functions

The repo is meant to be a collaborative, reusable project for event organizers and class admins.

## Repository structure

This repo is kept fairly simple:

- `README.md` — overview and quick start
- `CONFIGURATION.md` — environment configuration and deployment
- `CONTRIBUTING.md` — contributor workflow and expectations
- `LICENSE` — MIT license
- `src/` — application code
- `public/` — static assets and icons
- `supabase/` — database schema, migrations, and edge function code
- `.env.example` — template for local environment variables

## Local setup

### 1. Clone or fork the repo

Use your own branch and pull-request flow as usual.

### 2. Install dependencies

```bash
npm install
```

### 3. Copy the environment example file

```bash
cp .env.example .env
```

### 4. Fill in the variables

Add the required values for your local environment, especially your own Supabase project.

### 5. Run the app

```bash
npm run dev
```

### 6. Verify the app builds

Before opening a pull request, make sure the app still builds:

```bash
npm run build
```

## Branch workflow

Use a feature branch or fix branch for your changes instead of committing directly to `development` unless the repository owner explicitly wants direct updates.

Good branch names:

- `feature/rooster-fixes`
- `fix/push-notification-config`
- `chore/docs-cleanup`

## Coding expectations

- Keep changes focused and easy to review.
- Prefer readable, maintainable code and clear naming.
- Follow the existing Dutch naming patterns if working in UI text or labels that match the project’s current language.
- Keep environment-specific values out of committed source files.
- Do not commit secrets, private tokens, or personal data.

## Security expectations

Do not commit:

- Supabase service-role keys
- private VAPID keys
- API tokens or passwords
- real event data or user data
- local `.env` files

Use environment variables only for values that are intended to be public in the browser, and keep secret values in server-side secret stores.

## Pull request checklist

Before opening a PR, make sure:

- the branch is based on the correct target branch
- the app builds successfully
- the configuration changes are documented
- no secrets or personal data are included
- the change is focused and explained clearly

## Documentation updates

When you change setup, config, or deployment behavior, update the relevant docs in:

- `README.md`
- `CONFIGURATION.md`
- `CONTRIBUTING.md`

This helps keep the repo understandable for future contributors and other deployments.

## Questions and collaboration

If you are unsure about a setup step, architecture choice, or environment-related issue, open a discussion or issue before making a large change. It is better to clarify before committing a broad refactor.

## License

By contributing, you agree that your changes will be made available under the project’s MIT license as described in `LICENSE`.
