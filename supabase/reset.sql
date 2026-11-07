-- ONLY if you ran the earlier scaffold (v1) and want to start the database clean.
-- Deletes all Aristeia tables and every function in the public schema, then run schema.sql.
drop table if exists public.upload_rechten, public.herinneringen, public.push_abonnementen, public.punten, public.berichten,
  public.dag_berichten, public.deelnames, public.activiteiten, public.inlogpogingen, public.sessies,
  public.leerlingen, public.klas_wachtwoorden, public.klassen, public.instellingen, public.root_gebruikers cascade;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as f from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute 'drop function if exists ' || r.f || ' cascade';
  end loop;
end $$;
