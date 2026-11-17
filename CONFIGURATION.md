# App configuration

The frontend reads its deployment-specific settings from Vite environment variables. This keeps project-specific values out of `src/config.js` and lets each deployment use its own backend.

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in the values for your own Supabase project and, if enabled, push notifications.
3. Run `npm run dev`. Restart the dev server after changing environment values.

## Cloudflare Workers Builds

Add the same variables below as **build variables** for each Cloudflare environment (production and any previews that need them), then rebuild and deploy. These are frontend settings, not secrets: Vite embeds `VITE_*` values in the generated JavaScript, where visitors can inspect them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_KEY` | Yes | Supabase anon/publishable key (not a service-role key) |
| `VITE_VAPID_PUBLIC_KEY` | No | Public VAPID key for push notifications |
| `VITE_WIKI_URL` | No | Help/wiki link |
| `VITE_GA_MEASUREMENT_ID` | No | GA4 measurement ID; analytics remains disabled if unset or invalid |

Do not use a Supabase service-role key, VAPID private key, passwords, or other private credentials as frontend build variables. Keep those in server-side secret storage (for example, Supabase Edge Function secrets). The VAPID public key is safe to expose; its private counterpart is not.

If the required Supabase variables are missing, the app treats the backend as unconfigured. Push notification functionality is disabled when the public VAPID key is missing.
