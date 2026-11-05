-- Klassenstrijd v4: robustness. Run once in the SQL Editor (after migratie-v3.sql). Safe to run again.

-- 1. Indexes on foreign keys (faster deletes and lookups)
create index if not exists deelnames_leerling_id_idx on public.deelnames (leerling_id);
create index if not exists herinneringen_leerling_id_idx on public.herinneringen (leerling_id);
create index if not exists sessies_leerling_id_idx on public.sessies (leerling_id);
create index if not exists dag_berichten_klas_id_idx on public.dag_berichten (klas_id);
create index if not exists upload_rechten_klas_id_idx on public.upload_rechten (klas_id);

-- 2. Stronger password hashing for new passwords (bcrypt cost 8)
create or replace function public._maak_klas(p_naam text, p_slug text, p_lw text, p_bw text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if length(trim(coalesce(p_lw, ''))) < 6 or length(trim(coalesce(p_bw, ''))) < 6 then
    raise exception 'wachtwoord_te_kort';
  end if;
  if trim(p_lw) = trim(p_bw) then
    raise exception 'wachtwoorden_gelijk';
  end if;
  insert into public.klassen (naam, slug) values (trim(p_naam), lower(trim(p_slug))) returning id into v_id;
  insert into public.klas_wachtwoorden (klas_id, leerling_hash, beheer_hash)
  values (v_id, crypt(trim(p_lw), gen_salt('bf', 8)), crypt(trim(p_bw), gen_salt('bf', 8)));
  return v_id;
end $$;

create or replace function public.root_wachtwoorden_zetten(p_id uuid, p_lw text, p_bw text, p_sessies_beeindigen boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare w public.klas_wachtwoorden;
begin
  perform public._root();
  select * into w from public.klas_wachtwoorden where klas_id = p_id;
  if not found then raise exception 'niet_gevonden'; end if;
  if p_lw is not null and length(trim(p_lw)) < 6 then raise exception 'wachtwoord_te_kort'; end if;
  if p_bw is not null and length(trim(p_bw)) < 6 then raise exception 'wachtwoord_te_kort'; end if;
  if p_lw is not null and p_bw is not null and trim(p_lw) = trim(p_bw) then raise exception 'wachtwoorden_gelijk'; end if;
  if p_lw is not null and p_bw is null and w.beheer_hash = crypt(trim(p_lw), w.beheer_hash) then raise exception 'wachtwoorden_gelijk'; end if;
  if p_bw is not null and p_lw is null and w.leerling_hash = crypt(trim(p_bw), w.leerling_hash) then raise exception 'wachtwoorden_gelijk'; end if;
  update public.klas_wachtwoorden set
    leerling_hash = case when p_lw is null then leerling_hash else crypt(trim(p_lw), gen_salt('bf', 8)) end,
    beheer_hash = case when p_bw is null then beheer_hash else crypt(trim(p_bw), gen_salt('bf', 8)) end
   where klas_id = p_id;
  if coalesce(p_sessies_beeindigen, false) then
    delete from public.sessies where klas_id = p_id;
  end if;
  return json_build_object('ok', true);
end $$;

-- 3. Adding students: skip names that already exist in the class (or twice in the pasted list)
drop function if exists public._leerlingen_toevoegen(uuid, text);
create or replace function public._leerlingen_toevoegen(p_klas uuid, p_namen text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_max int; v_nu int; v_nieuw text[]; v_gevraagd int; n int;
begin
  select max_leerlingen into v_max from public.instellingen where id = 1;
  select count(*) into v_nu from public.leerlingen where klas_id = p_klas;
  select count(*) into v_gevraagd
    from unnest(string_to_array(replace(coalesce(p_namen, ''), E'\r', ''), E'\n')) as x where length(trim(x)) > 0;
  select coalesce(array_agg(q.naam), '{}') into v_nieuw from (
    select distinct on (lower(left(trim(x), 60))) left(trim(x), 60) as naam
      from unnest(string_to_array(replace(coalesce(p_namen, ''), E'\r', ''), E'\n')) as x
     where length(trim(x)) > 0
       and not exists (select 1 from public.leerlingen l where l.klas_id = p_klas and lower(l.naam) = lower(left(trim(x), 60)))
  ) q;
  if v_nu + coalesce(array_length(v_nieuw, 1), 0) > v_max then
    raise exception 'limiet_leerlingen';
  end if;
  insert into public.leerlingen (klas_id, naam) select p_klas, unnest(v_nieuw);
  get diagnostics n = row_count;
  perform public._bump_klas(p_klas);
  return json_build_object('toegevoegd', n, 'overgeslagen', v_gevraagd - n);
end $$;

create or replace function public.leerlingen_toevoegen(p_token text, p_namen text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  return public._leerlingen_toevoegen(s.klas_id, p_namen);
end $$;

create or replace function public.root_leerlingen_toevoegen(p_klas uuid, p_namen text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return public._leerlingen_toevoegen(p_klas, p_namen);
end $$;

-- 4. Cron: reminders also early in the morning, and keep the cron log from growing forever
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule => '* 4-22 * * *') from cron.job where jobname = 'klassenstrijd-herinneringen';
    perform cron.schedule('klassenstrijd-cronlog-opruimen', '30 3 * * *',
      $job$ delete from cron.job_run_details where end_time < now() - interval '2 days' $job$);
  end if;
end $$;

-- 5. Permissions for (re)created functions
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as f, p.proname as naam from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
  loop
    if r.naam like E'\\_%' or r.naam = 'maak_root' then
      execute format('revoke all on function %s from public, anon, authenticated', r.f);
    elsif r.naam like E'root\\_%' then
      execute format('revoke all on function %s from public, anon', r.f);
      execute format('grant execute on function %s to authenticated', r.f);
    else
      execute format('grant execute on function %s to anon, authenticated', r.f);
    end if;
  end loop;
end $$;
