# Configuration and deployment

This project reads front-end configuration values from Vite environment variables. That keeps deployment-specific values out of the source code and makes it easier to use the repo with different projects or environments.

## Important rule

Only put values in `VITE_*` variables when they are meant to be visible in the browser. That includes public Supabase values and a public VAPID key.

Never put:

- a Supabase service-role key
- a VAPID private key
- passwords
- tokens that should not be exposed to users
- any secret or private credential into the front-end build

Those belong in server-side secrets, such as Supabase Edge Function secrets or Cloudflare secrets.

## Local development

### 1. Copy the example file

```bash
cp .env.example .env
```

### 2. Fill in the values

Edit `.env` and set the values for your local environment.

Example:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_publishable_or_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VITE_WIKI_URL=https://github.com/your-user/your-repo/wiki
VITE_GA_MEASUREMENT_ID=
```

### 3. Restart the dev server after edits

If you change any environment variables, restart the Vite dev server so the app picks up the new values.

```bash
npm run dev
```

## Cloudflare Workers Builds

For Cloudflare deployments, set the same variables as build variables in the Cloudflare project or environment settings.

Use these keys:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_WIKI_URL`
- `VITE_GA_MEASUREMENT_ID`

These values are embedded into the browser bundle by Vite, so they are public by design. That is correct for public app settings, but not for secrets.

## What each variable is for

### `VITE_SUPABASE_URL`

The base URL of the Supabase project, for example:

```text
https://ijkfnntmrkqkoqymbixo.supabase.co
```

### `VITE_SUPABASE_KEY`

The Supabase anon or publishable key used by the front-end. This is a public value in the browser and is used to call public RPC endpoints and the storage APIs that are allowed for the app.

Do not use a service-role key here.

### `VITE_VAPID_PUBLIC_KEY`

The public VAPID key used by the browser to register push subscriptions. This is safe to expose in the front-end.

The private VAPID key must stay in a server-side location, such as Supabase Edge Function secrets.

### `VITE_WIKI_URL`

The URL to the project wiki or docs. This is optional and is only used for links in the app.

### `VITE_GA_MEASUREMENT_ID`

Optional Google Analytics measurement ID. If empty or invalid, analytics stays disabled and no tracking script is loaded.

## Supabase setup notes

This app expects a Supabase project where:

- Auth is configured for the app’s intended login flow
- the project contains the SQL schema and migrations from this repo
- public keys and project URLs are supplied through configuration
- any sensitive push, cron, or admin functionality remains protected by server-side secrets

## Push notifications

Push notifications are optional but recommended for student-facing reminders.

The browser uses the public VAPID key to request a push subscription. The actual push delivery is handled server-side, and the private key should be stored in secret storage, not in the client build.

## Check that the app sees the config

After setting variables, confirm the app loads correctly:

```bash
npm run build
```

If the required public Supabase config is missing, the app will behave as unconfigured and parts of the app may not work.

## Security reminder

Frontend environment variables are not a secure secret storage mechanism. Use them only for data that is meant to be public in the browser. Keep all truly secret configuration in a proper secret store.

## Common setup flow

1. Create or choose your Supabase project.
2. Copy `.env.example` to `.env`.
3. Fill in your public config values.
4. Run the app locally.
5. Add the same variables as Cloudflare build variables for production or preview builds.
6. Keep private secrets out of the repo and out of the browser bundle.

## Additional references

- `README.md` for the project overview and quick start
- `CONTRIBUTING.md` for contributor expectations and workflow
- `LICENSE` for legal terms
