-- Reminders 5 minutes before an activity + automatic cleanup after the event.
-- Run this in the SQL Editor AFTER deploying the "push" Edge Function.
-- Replace the two placeholders below. DO NOT commit the real values to GitHub.
--   JOUW-PROJECT      = your project reference (https://JOUW-PROJECT.supabase.co)
--   JOUW-CRON-GEHEIM  = the same value you set as secret CRON_SECRET for the function

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- every minute between 04:00 and 22:59 UTC
select cron.schedule('klassenstrijd-herinneringen', '* 4-22 * * *', $$
  select net.http_post(
    url := 'https://JOUW-PROJECT.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'JOUW-CRON-GEHEIM'),
    body := '{"actie":"herinneringen"}'::jsonb
  );
$$);

-- daily: removes personal data 14 days after the "einde evenement" date set by Root
select cron.schedule('klassenstrijd-opruimen', '15 3 * * *', $$ select public._auto_opruimen(); $$);

-- keeps the cron log small (otherwise it grows by ~1000 rows per day)
select cron.schedule('klassenstrijd-cronlog-opruimen', '30 3 * * *', $$ delete from cron.job_run_details where end_time < now() - interval '2 days' $$);

-- To stop the reminders after the event:
--   select cron.unschedule('klassenstrijd-herinneringen');
