# Cygnus Aristeia Rooster

A mobile-first PWA for a school event where teams and classes compete in a two-day schedule and ranking system.

## Project overview

This app is designed for a school event where:

- students log in with a class password and view their own schedule or the whole class schedule
- class admins manage students, activities, announcements, notifications, branding, and class content
- root/admin users manage the event setup, classes, dates, rankings, templates, and global messages
- the app works as an installable PWA and can send push notifications before activities begin

## Tech stack

- React + Vite
- PWA support for installable mobile usage
- Cloudflare Workers for static hosting and deployment
- Supabase for Postgres, Auth, Storage, and Edge Functions

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

Copy the example environment configuration and fill in the values for your own project:

```bash
cp .env.example .env
```

### 3. Fill in your local values

Edit `.env` and set the values for your local or test environment. Use your own Supabase project URL and publishable key, and add a VAPID public key if push notifications are enabled.

### 4. Run the app locally

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

## Documentation

This repository is organized into a few focused docs:

- `CONFIGURATION.md` — environment variables, Cloudflare build variables, Supabase setup, and deployment notes
- `CONTRIBUTING.md` — contributor workflow, setup, and PR expectations
- `LICENSE` — MIT licensing terms

## Deployment notes

For deployed environments, do not put private secrets in the frontend build. Use public build variables for values that are intentionally exposed to browsers, and keep private credentials in proper server-side secret stores.

See `CONFIGURATION.md` for the full setup and deployment guidance.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
