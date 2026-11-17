# Security Policy

This repository contains the Cygnus Aristeia Rooster application: a Dutch-language school event planner and schedule app built with React/Vite, backed by Supabase Postgres, and deployed as static assets via Cloudflare Workers. The app manages class schedules, student/admin sessions, passwords, event content, standings, push notification subscriptions, and Root organizer access.

Because this project is used in a school environment and can involve minors, security and privacy are important. The app intentionally keeps most data access behind Supabase RPC functions and Row Level Security (RLS), with separate class-session and Root-auth flows.

## Supported versions and deployment status

This repository does not currently publish a formal security support matrix for multiple release branches. In practice, the project should be treated as follows:

- The current `main` branch is the supported development baseline.
- Production deployments should be based on a reviewed, tagged release or a tested commit that has passed a build and configuration review.
- Demo or test data must never be left in a production environment.

## Security model in this project

The implementation uses a few important security boundaries:

- Frontend: browser-only React app compiled to static assets.
- Supabase: database, Auth, RLS, RPC functions, storage, and the push-notification Edge Function.
- Cloudflare Worker: hosts the built frontend and provides SPA routing.

Relevant project files and boundaries:

- `src/` holds the student/admin UI and client-side session logic.
- `src/root/` holds the organizer-only Root interface.
- `supabase/schema.sql` and the migration files define the database, RLS rules, and RPC functions.
- `supabase/functions/push/index.ts` handles push notification delivery and uses server-side secrets.
- `wrangler.jsonc` configures the Cloudflare Worker deployment.

## Sensitive data and secret handling

The following must not be stored in the repository, frontend build variables, or browser bundles:

- Supabase service-role keys
- database passwords or secrets
- private VAPID keys
- Root admin credentials in source or config files
- session tokens or password hashes outside the secure database layer

Important repository practices:

- Only the public Supabase client key and public VAPID key should be exposed to the browser.
- Secret values belong in Supabase Edge Function secrets, environment variables for the deployment environment, or a dedicated secret store.
- `.env` files and generated build outputs must not contain production secrets.
- Any demo classes or test accounts must be removed before real use.

## Security responsibilities for contributors

When making code changes, contributors should:

- validate that database access goes through RPC functions/RLS and not direct table access where the schema expects controlled access;
- keep Root-only actions isolated from the class/student UI;
- avoid introducing client-side access to privileged secrets or service-role capabilities;
- treat all user-provided input as untrusted and validate it before use;
- ensure any push-notification or external integration uses server-side configuration and authorization checks;
- test changes in a non-production environment before deploying to production.

## Reporting a vulnerability

Please report security issues privately and responsibly.

Preferred method:

- Use the repository's GitHub Security Advisories page: https://github.com/Rgithubpro/Cygnus-Aristeia-Rooster/security/advisories

If private reporting is not available through the GitHub UI, contact the repository maintainer through the GitHub profile associated with this repository and request a private disclosure channel.

When reporting, please include:

- a clear description of the issue;
- the affected area of the app or deployment;
- the steps to reproduce the issue;
- the security impact;
- any proof of concept or suggested fix if available.

Please do not open a public issue for a suspected security vulnerability. Please do not disclose the issue publicly until it has been reviewed and a fix or mitigation has been agreed.

## Response expectations

The project maintainers will aim to:

- acknowledge valid reports promptly;
- triage the issue for severity and impact;
- coordinate a fix or mitigation in a timely manner;
- provide an update to the reporter when a patch is ready or when additional information is needed.

This project is small and intentionally focused on a specific operational context, so response time will depend on maintainer availability and deployment schedule.

## Notes for production use

Before exposing the app to real users, ensure the following are set correctly:

- Supabase project is configured with the intended auth model and RLS policies.
- Root organizer access is limited to trusted users and MFA is enabled where configured.
- Demo/test data is removed from production.
- Push notification secrets are stored in Supabase or another server-side secret store only.
- Cloudflare and Supabase configuration are reviewed and production-safe.
- Environment variables are not exposed in the browser bundle.

If you are unsure whether a configuration is safe for production, treat it as not ready for deployment.
