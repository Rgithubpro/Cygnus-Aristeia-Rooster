# Aristeia Rooster

A mobile-first PWA that shows students their schedule for today and tomorrow.
The app itself is in Dutch.

This is the clean starting point: a static React site with PWA support, deployed
on Cloudflare. No backend yet.

## Develop

```bash
npm install
npm run dev
```

## Deploy (Cloudflare Workers Builds, connected to this GitHub repo)

| Setting        | Value                |
| -------------- | -------------------- |
| Build command  | `npm run build`      |
| Deploy command | `npx wrangler deploy`|
| Variables      | none needed (yet)    |

Every push to `main` builds and deploys. The "Status van de app" block on the
page shows the commit that is live.

## Secrets

Anything prefixed with `VITE_` ends up in the public JavaScript bundle, so only
put public values there (for example a Supabase anon key). Real secrets belong
in server-side places only (Supabase Edge Function secrets or Cloudflare Worker
secrets) and never in this repo.

## License

MIT
