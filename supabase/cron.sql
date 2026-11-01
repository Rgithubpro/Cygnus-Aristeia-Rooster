-- Reminders 5 minutes before an activity + automatic cleanup after the event.
-- Run this in the SQL Editor AFTER deploying the "push" Edge Function.
-- Replace the two placeholders below. DO NOT commit the real values to GitHub.
--   JOUW-PROJECT      = your project reference (https://JOUW-PROJECT.supabase.co)
--   JOUW-CRON-GEHEIM  = the same value you set as secret CRON_SECRET for the function

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- every minute between 06:00 and 21:59 UTC
select cron.schedule('klassenstrijd-herinneringen', '* 6-21 * * *', $$
  select net.http_post(
    url := 'https://JOUW-PROJECT.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'JOUW-CRON-GEHEIM'),
    body := '{"actie":"herinneringen"}'::jsonb
  );
$$);

-- daily: removes personal data 14 days after the "einde evenement" date set by Root
select cron.schedule('klassenstrijd-opruimen', '15 3 * * *', $$ select public._auto_opruimen(); $$);

-- To stop the reminders after the event:
--   select cron.unschedule('klassenstrijd-herinneringen');
