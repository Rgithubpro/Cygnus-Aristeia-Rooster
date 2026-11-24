-- Aristeia: complete database setup for a NEW Supabase project.
-- Run this whole file once in the SQL Editor. It is the files below, in order:
--   schema.sql, migratie-v3.sql, migratie-v4.sql, migratie-v5.sql, migratie-v6.sql, migratie-v7.sql
-- Afterwards: create your Root user (Authentication > Users), then run  select public.maak_root('you@example.com');
-- For an EXISTING project, only run the migratie-vN.sql files you have not run yet (see CONFIGURATION.md).

-- ======================================================================
-- schema.sql
-- ======================================================================
-- Aristeia database (v2). Run once in the Supabase SQL Editor.
-- Principle: no table can be read or written directly. RLS is on with no policies,
-- table privileges are revoked, and the app only calls the functions below:
--   * students/admins: functions that check a class session token
--   * Root: functions that check a real Supabase Auth user (+ optional 2FA)

create extension if not exists pgcrypto with schema extensions;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ======================= tables =======================
create table public.instellingen (
  id int primary key default 1 check (id = 1),
  dag1 date,
  dag2 date,
  uitslag_tot_dag smallint not null default 0 check (uitslag_tot_dag between 0 and 2),
  banner_actief boolean not null default false,
  banner_titel text not null default '' check (length(banner_titel) <= 80),
  banner_tekst text not null default '' check (length(banner_tekst) <= 400),
  event_einde date,
  max_leerlingen int not null default 60 check (max_leerlingen between 1 and 500),
  max_activiteiten int not null default 100 check (max_activiteiten between 1 and 1000),
  versie bigint not null default 0
);
insert into public.instellingen (id) values (1);

create table public.klassen (
  id uuid primary key default gen_random_uuid(),
  naam text not null check (length(naam) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  versie bigint not null default 0
);

create table public.klas_wachtwoorden (
  klas_id uuid primary key references public.klassen on delete cascade,
  leerling_hash text not null,
  beheer_hash text not null
);

create table public.leerlingen (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid not null references public.klassen on delete cascade,
  naam text not null check (length(naam) between 1 and 60),
  rol_info text not null default '' check (length(rol_info) <= 300)
);
create index on public.leerlingen (klas_id);

create table public.sessies (
  token_hash text primary key,
  klas_id uuid not null references public.klassen on delete cascade,
  rol text not null check (rol in ('leerling', 'beheer')),
  leerling_id uuid references public.leerlingen on delete set null,
  aangemaakt timestamptz not null default now(),
  laatst_gezien timestamptz not null default now(),
  verloopt_op timestamptz not null
);
create index on public.sessies (klas_id);

create table public.inlogpogingen (
  id bigint generated always as identity primary key,
  klas_id uuid not null references public.klassen on delete cascade,
  tijdstip timestamptz not null default now()
);
create index on public.inlogpogingen (klas_id, tijdstip);

-- klas_id null = onderdeel voor iedereen (door Root gemaakt)
create table public.activiteiten (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid references public.klassen on delete cascade,
  titel text not null check (length(titel) between 1 and 80),
  dag smallint not null check (dag in (1, 2)),
  start time not null,
  eind time not null,
  locatie text not null default '' check (length(locatie) <= 80),
  omschrijving text not null default '' check (length(omschrijving) <= 500),
  kleur text not null default 'blauw' check (kleur in ('blauw', 'groen', 'amber', 'paars', 'koraal', 'grijs')),
  check (eind > start)
);
create index on public.activiteiten (klas_id);

create table public.deelnames (
  activiteit_id uuid not null references public.activiteiten on delete cascade,
  leerling_id uuid not null references public.leerlingen on delete cascade,
  primary key (activiteit_id, leerling_id)
);

create table public.dag_berichten (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid references public.klassen on delete cascade,
  dag smallint not null check (dag in (1, 2)),
  bericht text not null check (length(bericht) between 1 and 200)
);
create unique index on public.dag_berichten (coalesce(klas_id, '00000000-0000-0000-0000-000000000000'::uuid), dag);

-- klas_id null = voor iedereen
create table public.berichten (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid references public.klassen on delete cascade,
  titel text not null check (length(titel) between 1 and 80),
  tekst text not null default '' check (length(tekst) <= 2000),
  afbeelding_pad text check (afbeelding_pad ~ '^[a-zA-Z0-9._-]{1,100}$'),
  gepubliceerd boolean not null default true,
  aangemaakt timestamptz not null default now()
);
create index on public.berichten (klas_id);

create table public.punten (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid not null references public.klassen on delete cascade,
  dag smallint not null check (dag in (1, 2)),
  onderdeel text not null check (length(onderdeel) between 1 and 60),
  punten int not null check (punten between -1000 and 100000),
  unique (klas_id, dag, onderdeel)
);

create table public.push_abonnementen (
  id uuid primary key default gen_random_uuid(),
  leerling_id uuid not null references public.leerlingen on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  aangemaakt timestamptz not null default now()
);
create index on public.push_abonnementen (leerling_id);

create table public.herinneringen (
  activiteit_id uuid not null references public.activiteiten on delete cascade,
  leerling_id uuid not null references public.leerlingen on delete cascade,
  primary key (activiteit_id, leerling_id)
);

create table public.root_gebruikers (
  user_id uuid primary key references auth.users on delete cascade,
  aangemaakt timestamptz not null default now()
);

-- ======================= lock tables =======================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ======================= internal helpers =======================
create or replace function public._bump_klas(p_klas uuid) returns void
language sql security definer set search_path = public as
$$ update public.klassen set versie = versie + 1 where id = p_klas; $$;

create or replace function public._bump_globaal() returns void
language sql security definer set search_path = public as
$$ update public.instellingen set versie = versie + 1 where id = 1; $$;

create or replace function public._sessie(p_token text) returns public.sessies
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; h text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
begin
  select * into s from public.sessies where token_hash = h and verloopt_op > now();
  if not found then
    raise exception 'sessie_ongeldig' using errcode = '28000';
  end if;
  if s.laatst_gezien < now() - interval '5 minutes' then
    update public.sessies set laatst_gezien = now() where token_hash = h;
  end if;
  return s;
end $$;

create or replace function public._beheer(p_token text) returns public.sessies
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  if s.rol <> 'beheer' then
    raise exception 'geen_rechten' using errcode = '42501';
  end if;
  return s;
end $$;

-- Is this Supabase user a Root user? (2FA is required once a verified factor exists.)
create or replace function public._root_controle(p_uid uuid, p_aal text) returns boolean
language plpgsql security definer set search_path = public, auth as $$
begin
  if p_uid is null or not exists (select 1 from public.root_gebruikers where user_id = p_uid) then
    return false;
  end if;
  if exists (select 1 from auth.mfa_factors where user_id = p_uid and status = 'verified')
     and coalesce(p_aal, 'aal1') <> 'aal2' then
    return false;
  end if;
  return true;
end $$;

create or replace function public._root() returns uuid
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public._root_controle(auth.uid(), auth.jwt() ->> 'aal') then
    raise exception 'geen_rechten' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

-- Used by the storage policy (only Root may upload images).
create or replace function public.ben_root() returns boolean
language sql security definer set search_path = public, auth as
$$ select public._root_controle(auth.uid(), auth.jwt() ->> 'aal'); $$;

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
  values (v_id, crypt(trim(p_lw), gen_salt('bf')), crypt(trim(p_bw), gen_salt('bf')));
  return v_id;
end $$;

create or replace function public._leerlingen_toevoegen(p_klas uuid, p_namen text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_max int; v_nu int; v_nieuw text[]; n int;
begin
  select max_leerlingen into v_max from public.instellingen where id = 1;
  select count(*) into v_nu from public.leerlingen where klas_id = p_klas;
  select coalesce(array_agg(left(trim(x), 60)), '{}') into v_nieuw
    from unnest(string_to_array(replace(coalesce(p_namen, ''), E'\r', ''), E'\n')) as x
   where length(trim(x)) > 0;
  if v_nu + coalesce(array_length(v_nieuw, 1), 0) > v_max then
    raise exception 'limiet_leerlingen';
  end if;
  insert into public.leerlingen (klas_id, naam) select p_klas, unnest(v_nieuw);
  get diagnostics n = row_count;
  perform public._bump_klas(p_klas);
  return n;
end $$;

-- p_klas null = onderdeel voor iedereen (Root)
create or replace function public._activiteit_opslaan(
  p_klas uuid, p_id uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_kleur text, p_leerlingen uuid[]
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_max int;
begin
  if p_id is null then
    if p_klas is not null then
      select max_activiteiten into v_max from public.instellingen where id = 1;
      if (select count(*) from public.activiteiten where klas_id = p_klas) >= v_max then
        raise exception 'limiet_activiteiten';
      end if;
    end if;
    insert into public.activiteiten (klas_id, titel, dag, start, eind, locatie, omschrijving, kleur)
    values (p_klas, trim(p_titel), p_dag, p_start::time, p_eind::time,
            coalesce(trim(p_locatie), ''), coalesce(trim(p_omschrijving), ''), coalesce(p_kleur, 'blauw'))
    returning id into v_id;
  else
    update public.activiteiten
       set titel = trim(p_titel), dag = p_dag, start = p_start::time, eind = p_eind::time,
           locatie = coalesce(trim(p_locatie), ''), omschrijving = coalesce(trim(p_omschrijving), ''),
           kleur = coalesce(p_kleur, 'blauw')
     where id = p_id and klas_id is not distinct from p_klas
    returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;

  delete from public.deelnames where activiteit_id = v_id;
  delete from public.herinneringen where activiteit_id = v_id;
  if p_klas is not null then
    insert into public.deelnames (activiteit_id, leerling_id)
    select v_id, l.id from public.leerlingen l
     where l.klas_id = p_klas and l.id = any (coalesce(p_leerlingen, '{}'));
    perform public._bump_klas(p_klas);
  else
    perform public._bump_globaal();
  end if;
  return v_id;
end $$;

create or replace function public._dagbericht_zetten(p_klas uuid, p_dag int, p_bericht text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_bericht, ''))) = 0 then
    delete from public.dag_berichten where klas_id is not distinct from p_klas and dag = p_dag;
  else
    update public.dag_berichten set bericht = trim(p_bericht)
     where klas_id is not distinct from p_klas and dag = p_dag;
    if not found then
      insert into public.dag_berichten (klas_id, dag, bericht) values (p_klas, p_dag, trim(p_bericht));
    end if;
  end if;
  if p_klas is null then perform public._bump_globaal(); else perform public._bump_klas(p_klas); end if;
end $$;

-- Removes all personal data (students, sessions, push). Classes and programme stay.
create or replace function public._opruimen() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.sessies;
  delete from public.push_abonnementen;
  delete from public.herinneringen;
  delete from public.inlogpogingen;
  delete from public.leerlingen;
  perform public._bump_globaal();
  update public.klassen set versie = versie + 1;
end $$;

create or replace function public._auto_opruimen() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.instellingen where id = 1 and event_einde is not null
             and current_date > event_einde + 14) then
    perform public._opruimen();
  end if;
end $$;

-- Reminders: activities starting within 5 minutes, for students with a push subscription.
-- Every reminder is returned only once (logged in herinneringen).
create or replace function public._herinneringen_nu()
returns table (leerling uuid, onderwerp text, starttijd text, plek text)
language plpgsql security definer set search_path = public as $$
declare v_nu timestamp := now() at time zone 'Europe/Amsterdam';
begin
  return query
  with kandidaten as (
    select a.id as act_id, l.id as lid, a.titel as t, a.start as st, a.locatie as loc
      from public.activiteiten a
      join public.instellingen i on i.id = 1
      join public.leerlingen l on (a.klas_id is null or l.klas_id = a.klas_id)
     where ((a.dag = 1 and i.dag1 = v_nu::date) or (a.dag = 2 and i.dag2 = v_nu::date))
       and a.start > v_nu::time and a.start <= v_nu::time + interval '5 minutes'
       and (a.klas_id is null or exists (select 1 from public.deelnames d where d.activiteit_id = a.id and d.leerling_id = l.id))
       and exists (select 1 from public.push_abonnementen p where p.leerling_id = l.id)
  ), nieuw as (
    insert into public.herinneringen (activiteit_id, leerling_id)
    select act_id, lid from kandidaten
    on conflict do nothing
    returning activiteit_id, herinneringen.leerling_id as lid2
  )
  select k.lid, k.t, to_char(k.st, 'HH24:MI'), k.loc
    from nieuw n join kandidaten k on k.act_id = n.activiteit_id and k.lid = n.lid2;
end $$;

-- ======================= leerling / admin: login =======================
create or replace function public.start_info() returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'klassen', (select coalesce(json_agg(json_build_object('slug', k.slug, 'naam', k.naam) order by k.naam), '[]'::json) from public.klassen k),
    'dag1', i.dag1, 'dag2', i.dag2,
    'banner', json_build_object('actief', i.banner_actief, 'titel', i.banner_titel, 'tekst', i.banner_tekst)
  ) from public.instellingen i where i.id = 1;
$$;

-- Wrong passwords return {fout: ...} instead of raising, so the failed attempt is kept.
create or replace function public.inloggen(p_slug text, p_wachtwoord text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare k public.klassen; w public.klas_wachtwoorden; i public.instellingen; r text; t text; v_verloopt timestamptz;
begin
  select * into k from public.klassen where slug = lower(trim(coalesce(p_slug, '')));
  if not found then
    return json_build_object('fout', 'onbekende_klas');
  end if;

  delete from public.inlogpogingen where tijdstip < now() - interval '1 day';
  delete from public.sessies where verloopt_op < now();
  if (select count(*) from public.inlogpogingen
       where klas_id = k.id and tijdstip > now() - interval '10 minutes') >= 30 then
    return json_build_object('fout', 'te_veel_pogingen');
  end if;

  select * into w from public.klas_wachtwoorden where klas_id = k.id;
  if w.beheer_hash = crypt(trim(coalesce(p_wachtwoord, '')), w.beheer_hash) then
    r := 'beheer';
  elsif w.leerling_hash = crypt(trim(coalesce(p_wachtwoord, '')), w.leerling_hash) then
    r := 'leerling';
  else
    insert into public.inlogpogingen (klas_id) values (k.id);
    return json_build_object('fout', 'fout_wachtwoord');
  end if;

  select * into i from public.instellingen where id = 1;
  v_verloopt := greatest(now() + interval '2 hours',
                least(now() + interval '3 days', coalesce((i.event_einde + 1)::timestamptz, now() + interval '3 days')));
  t := encode(gen_random_bytes(24), 'hex');
  insert into public.sessies (token_hash, klas_id, rol, verloopt_op)
  values (encode(digest(t, 'sha256'), 'hex'), k.id, r, v_verloopt);

  return json_build_object('token', t, 'rol', r, 'klas', json_build_object('naam', k.naam));
end $$;

create or replace function public.uitloggen(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.sessies where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return json_build_object('ok', true);
end $$;

-- ======================= leerling / admin: data =======================
-- Tiny check: changes when anything relevant for this class changes.
create or replace function public.ververs(p_token text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  return (select i.versie::text || '.' || k.versie::text
            from public.instellingen i, public.klassen k
           where i.id = 1 and k.id = s.klas_id);
end $$;

create or replace function public.alles(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; i public.instellingen; k public.klassen; v_beheer boolean;
begin
  s := public._sessie(p_token);
  select * into i from public.instellingen where id = 1;
  select * into k from public.klassen where id = s.klas_id;
  v_beheer := s.rol = 'beheer';

  return json_build_object(
    'versie', i.versie::text || '.' || k.versie::text,
    'rol', s.rol,
    'leerling_id', s.leerling_id,
    'klas', json_build_object('naam', k.naam),
    'instellingen', json_build_object(
      'dag1', i.dag1, 'dag2', i.dag2, 'uitslag_tot_dag', i.uitslag_tot_dag,
      'max_leerlingen', i.max_leerlingen,
      'banner', json_build_object('actief', i.banner_actief, 'titel', i.banner_titel, 'tekst', i.banner_tekst)
    ),
    'mijn_info', (select l.rol_info from public.leerlingen l where l.id = s.leerling_id),
    'leerlingen', (
      select coalesce(json_agg(
        case when v_beheer then json_build_object(
               'id', l.id, 'naam', l.naam, 'rol_info', l.rol_info,
               'gekoppeld', exists (select 1 from public.sessies z where z.leerling_id = l.id),
               'meldingen', exists (select 1 from public.push_abonnementen p where p.leerling_id = l.id))
             else json_build_object('id', l.id, 'naam', l.naam) end
        order by l.naam), '[]'::json)
        from public.leerlingen l where l.klas_id = s.klas_id),
    'activiteiten', (
      select coalesce(json_agg(json_build_object(
        'id', a.id, 'titel', a.titel, 'dag', a.dag,
        'start', to_char(a.start, 'HH24:MI'), 'eind', to_char(a.eind, 'HH24:MI'),
        'locatie', a.locatie, 'omschrijving', a.omschrijving, 'kleur', a.kleur,
        'globaal', a.klas_id is null,
        'leerlingen', case when a.klas_id is null then '[]'::json
                      else coalesce((select json_agg(d.leerling_id) from public.deelnames d where d.activiteit_id = a.id), '[]'::json) end
      ) order by a.dag, a.start), '[]'::json)
        from public.activiteiten a where a.klas_id is null or a.klas_id = s.klas_id),
    'dagberichten', (
      select coalesce(json_agg(json_build_object('dag', d.dag, 'bericht', d.bericht, 'globaal', d.klas_id is null)), '[]'::json)
        from public.dag_berichten d where d.klas_id is null or d.klas_id = s.klas_id),
    'berichten', (
      select coalesce(json_agg(json_build_object(
        'id', b.id, 'titel', b.titel, 'tekst', b.tekst, 'afbeelding_pad', b.afbeelding_pad,
        'gepubliceerd', b.gepubliceerd, 'globaal', b.klas_id is null,
        'tijd', to_char(b.aangemaakt at time zone 'Europe/Amsterdam', 'DD-MM HH24:MI')
      ) order by b.aangemaakt desc), '[]'::json)
        from (select * from public.berichten b0
               where (b0.klas_id is null or b0.klas_id = s.klas_id)
                 and (b0.gepubliceerd or (v_beheer and b0.klas_id = s.klas_id))
               order by b0.aangemaakt desc limit 50) b)
  );
end $$;

create or replace function public.kies_leerling(p_token text, p_leerling_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  if not exists (select 1 from public.leerlingen where id = p_leerling_id and klas_id = s.klas_id) then
    raise exception 'onbekende_leerling';
  end if;
  update public.sessies set leerling_id = p_leerling_id
   where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  return json_build_object('ok', true);
end $$;

-- Ranking: only days up to "uitslag_tot_dag" (set by Root) are visible.
create or replace function public.stand(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; v_tot smallint;
begin
  s := public._sessie(p_token);
  select uitslag_tot_dag into v_tot from public.instellingen where id = 1;
  if v_tot = 0 then
    return json_build_object('tot_dag', 0, 'stand', '[]'::json, 'onderdelen', '[]'::json);
  end if;
  return json_build_object(
    'tot_dag', v_tot,
    'stand', (
      select coalesce(json_agg(json_build_object('klas', q.naam, 'punten', q.totaal, 'positie', q.pos, 'eigen', q.id = s.klas_id)
                               order by q.pos, q.naam), '[]'::json)
        from (select k.id, k.naam, coalesce(sum(p.punten), 0) as totaal,
                     rank() over (order by coalesce(sum(p.punten), 0) desc) as pos
                from public.klassen k
                left join public.punten p on p.klas_id = k.id and p.dag <= v_tot
               group by k.id, k.naam) q),
    'onderdelen', (
      select coalesce(json_agg(json_build_object('dag', o.dag, 'onderdeel', o.onderdeel, 'resultaten', o.res)
                               order by o.dag, o.onderdeel), '[]'::json)
        from (select p.dag, p.onderdeel,
                     json_agg(json_build_object('klas', k.naam, 'punten', p.punten, 'eigen', k.id = s.klas_id)
                              order by p.punten desc, k.naam) as res
                from public.punten p join public.klassen k on k.id = p.klas_id
               where p.dag <= v_tot group by p.dag, p.onderdeel) o)
  );
end $$;

-- ======================= push subscriptions (leerling) =======================
create or replace function public.push_aanmelden(p_token text, p_endpoint text, p_p256dh text, p_auth text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  if s.leerling_id is null then raise exception 'kies_eerst_een_naam'; end if;
  insert into public.push_abonnementen (leerling_id, endpoint, p256dh, auth)
  values (s.leerling_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set leerling_id = excluded.leerling_id, p256dh = excluded.p256dh, auth = excluded.auth;
  -- keep at most 5 devices per student
  delete from public.push_abonnementen where id in (
    select id from public.push_abonnementen where leerling_id = s.leerling_id
     order by aangemaakt desc offset 5);
  return json_build_object('ok', true);
end $$;

create or replace function public.push_afmelden(p_token text, p_endpoint text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  delete from public.push_abonnementen where endpoint = p_endpoint and leerling_id = s.leerling_id;
  return json_build_object('ok', true);
end $$;

-- ======================= admin (class admin password) =======================
create or replace function public.activiteit_opslaan(
  p_token text, p_id uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_kleur text, p_leerlingen uuid[]
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  return json_build_object('id', public._activiteit_opslaan(s.klas_id, p_id, p_titel, p_dag, p_start, p_eind,
                                                            p_locatie, p_omschrijving, p_kleur, p_leerlingen));
end $$;

create or replace function public.activiteit_verwijderen(p_token text, p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  delete from public.activiteiten where id = p_id and klas_id = s.klas_id;
  perform public._bump_klas(s.klas_id);
  return json_build_object('ok', true);
end $$;

create or replace function public.leerlingen_toevoegen(p_token text, p_namen text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  return json_build_object('toegevoegd', public._leerlingen_toevoegen(s.klas_id, p_namen));
end $$;

create or replace function public.leerling_verwijderen(p_token text, p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  delete from public.leerlingen where id = p_id and klas_id = s.klas_id;
  perform public._bump_klas(s.klas_id);
  return json_build_object('ok', true);
end $$;

create or replace function public.leerling_info_zetten(p_token text, p_id uuid, p_info text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  update public.leerlingen set rol_info = left(coalesce(trim(p_info), ''), 300)
   where id = p_id and klas_id = s.klas_id;
  perform public._bump_klas(s.klas_id);
  return json_build_object('ok', true);
end $$;

create or replace function public.dagbericht_zetten(p_token text, p_dag int, p_bericht text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  perform public._dagbericht_zetten(s.klas_id, p_dag, p_bericht);
  return json_build_object('ok', true);
end $$;

create or replace function public.bericht_opslaan(p_token text, p_id uuid, p_titel text, p_tekst text, p_gepubliceerd boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; v_id uuid;
begin
  s := public._beheer(p_token);
  if p_id is null then
    if (select count(*) from public.berichten where klas_id = s.klas_id) >= 100 then
      raise exception 'limiet_berichten';
    end if;
    insert into public.berichten (klas_id, titel, tekst, gepubliceerd)
    values (s.klas_id, trim(p_titel), coalesce(trim(p_tekst), ''), coalesce(p_gepubliceerd, true))
    returning id into v_id;
  else
    update public.berichten set titel = trim(p_titel), tekst = coalesce(trim(p_tekst), ''),
           gepubliceerd = coalesce(p_gepubliceerd, true)
     where id = p_id and klas_id = s.klas_id returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;
  perform public._bump_klas(s.klas_id);
  return json_build_object('id', v_id);
end $$;

create or replace function public.bericht_verwijderen(p_token text, p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  delete from public.berichten where id = p_id and klas_id = s.klas_id;
  perform public._bump_klas(s.klas_id);
  return json_build_object('ok', true);
end $$;

-- ======================= Root (Supabase Auth user + 2FA) =======================
create or replace function public.root_overzicht() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object(
    'instellingen', (select row_to_json(i) from public.instellingen i where i.id = 1),
    'klassen', (
      select coalesce(json_agg(json_build_object(
        'id', k.id, 'naam', k.naam, 'slug', k.slug,
        'leerlingen', (select count(*) from public.leerlingen l where l.klas_id = k.id),
        'gekoppeld', (select count(distinct z.leerling_id) from public.sessies z where z.klas_id = k.id and z.leerling_id is not null),
        'meldingen', (select count(distinct p.leerling_id) from public.push_abonnementen p join public.leerlingen l on l.id = p.leerling_id where l.klas_id = k.id),
        'activiteiten', (select count(*) from public.activiteiten a where a.klas_id = k.id),
        'laatst_gezien', (select max(z.laatst_gezien) from public.sessies z where z.klas_id = k.id)
      ) order by k.naam), '[]'::json) from public.klassen k)
  );
end $$;

create or replace function public.root_klas_detail(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object(
    'leerlingen', (select coalesce(json_agg(json_build_object('id', l.id, 'naam', l.naam, 'rol_info', l.rol_info) order by l.naam), '[]'::json)
                     from public.leerlingen l where l.klas_id = p_id),
    'activiteiten', (select coalesce(json_agg(json_build_object(
                       'id', a.id, 'titel', a.titel, 'dag', a.dag, 'start', to_char(a.start, 'HH24:MI'),
                       'eind', to_char(a.eind, 'HH24:MI'), 'locatie', a.locatie,
                       'aantal', (select count(*) from public.deelnames d where d.activiteit_id = a.id)
                     ) order by a.dag, a.start), '[]'::json) from public.activiteiten a where a.klas_id = p_id)
  );
end $$;

create or replace function public.root_klas_maken(p_naam text, p_slug text, p_lw text, p_bw text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object('id', public._maak_klas(p_naam, p_slug, p_lw, p_bw));
end $$;

create or replace function public.root_klas_hernoemen(p_id uuid, p_naam text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  update public.klassen set naam = trim(p_naam) where id = p_id;
  perform public._bump_klas(p_id);
  return json_build_object('ok', true);
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
    leerling_hash = case when p_lw is null then leerling_hash else crypt(trim(p_lw), gen_salt('bf')) end,
    beheer_hash = case when p_bw is null then beheer_hash else crypt(trim(p_bw), gen_salt('bf')) end
   where klas_id = p_id;
  if coalesce(p_sessies_beeindigen, false) then
    delete from public.sessies where klas_id = p_id;
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_sessies_beeindigen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  delete from public.sessies where klas_id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_klas_verwijderen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  delete from public.klassen where id = p_id;
  perform public._bump_globaal();
  return json_build_object('ok', true);
end $$;

create or replace function public.root_leerlingen_toevoegen(p_klas uuid, p_namen text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object('toegevoegd', public._leerlingen_toevoegen(p_klas, p_namen));
end $$;

create or replace function public.root_instellingen_opslaan(p_data jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  update public.instellingen set
    dag1 = nullif(p_data ->> 'dag1', '')::date,
    dag2 = nullif(p_data ->> 'dag2', '')::date,
    event_einde = nullif(p_data ->> 'event_einde', '')::date,
    banner_actief = coalesce((p_data ->> 'banner_actief')::boolean, banner_actief),
    banner_titel = coalesce(p_data ->> 'banner_titel', banner_titel),
    banner_tekst = coalesce(p_data ->> 'banner_tekst', banner_tekst),
    max_leerlingen = coalesce((p_data ->> 'max_leerlingen')::int, max_leerlingen),
    max_activiteiten = coalesce((p_data ->> 'max_activiteiten')::int, max_activiteiten),
    versie = versie + 1
   where id = 1;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_uitslag_zichtbaar(p_dag int) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  update public.instellingen set uitslag_tot_dag = p_dag, versie = versie + 1 where id = 1;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_dagbericht_zetten(p_dag int, p_bericht text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  perform public._dagbericht_zetten(null, p_dag, p_bericht);
  return json_build_object('ok', true);
end $$;

create or replace function public.root_programma() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object(
    'activiteiten', (select coalesce(json_agg(json_build_object(
        'id', a.id, 'titel', a.titel, 'dag', a.dag, 'start', to_char(a.start, 'HH24:MI'), 'eind', to_char(a.eind, 'HH24:MI'),
        'locatie', a.locatie, 'omschrijving', a.omschrijving, 'kleur', a.kleur, 'leerlingen', '[]'::json
      ) order by a.dag, a.start), '[]'::json) from public.activiteiten a where a.klas_id is null),
    'dagberichten', (select coalesce(json_agg(json_build_object('dag', d.dag, 'bericht', d.bericht)), '[]'::json)
                       from public.dag_berichten d where d.klas_id is null)
  );
end $$;

create or replace function public.root_activiteit_opslaan(
  p_id uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_kleur text
) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object('id', public._activiteit_opslaan(null, p_id, p_titel, p_dag, p_start, p_eind,
                                                            p_locatie, p_omschrijving, p_kleur, '{}'));
end $$;

create or replace function public.root_activiteit_verwijderen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  delete from public.activiteiten where id = p_id and klas_id is null;
  perform public._bump_globaal();
  return json_build_object('ok', true);
end $$;

create or replace function public.root_berichten_lijst() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return (select coalesce(json_agg(json_build_object(
      'id', b.id, 'klas_id', b.klas_id, 'klas', k.naam, 'titel', b.titel, 'tekst', b.tekst,
      'afbeelding_pad', b.afbeelding_pad, 'gepubliceerd', b.gepubliceerd,
      'tijd', to_char(b.aangemaakt at time zone 'Europe/Amsterdam', 'DD-MM HH24:MI')
    ) order by b.aangemaakt desc), '[]'::json)
    from public.berichten b left join public.klassen k on k.id = b.klas_id);
end $$;

create or replace function public.root_bericht_opslaan(
  p_id uuid, p_klas uuid, p_titel text, p_tekst text, p_pad text, p_gepubliceerd boolean
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_oude uuid;
begin
  perform public._root();
  if p_id is null then
    insert into public.berichten (klas_id, titel, tekst, afbeelding_pad, gepubliceerd)
    values (p_klas, trim(p_titel), coalesce(trim(p_tekst), ''), nullif(p_pad, ''), coalesce(p_gepubliceerd, true))
    returning id into v_id;
  else
    select klas_id into v_oude from public.berichten where id = p_id;
    update public.berichten set klas_id = p_klas, titel = trim(p_titel), tekst = coalesce(trim(p_tekst), ''),
           afbeelding_pad = nullif(p_pad, ''), gepubliceerd = coalesce(p_gepubliceerd, true)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
    if v_oude is not null then perform public._bump_klas(v_oude); end if;
  end if;
  if p_klas is null then perform public._bump_globaal(); else perform public._bump_klas(p_klas); end if;
  return json_build_object('id', v_id);
end $$;

create or replace function public.root_bericht_verwijderen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_klas uuid; v_pad text;
begin
  perform public._root();
  select klas_id, afbeelding_pad into v_klas, v_pad from public.berichten where id = p_id;
  delete from public.berichten where id = p_id;
  if v_klas is null then perform public._bump_globaal(); else perform public._bump_klas(v_klas); end if;
  return json_build_object('ok', true, 'afbeelding_pad', v_pad);
end $$;

create or replace function public.root_punten_lijst() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return (select coalesce(json_agg(json_build_object('klas_id', p.klas_id, 'dag', p.dag, 'onderdeel', p.onderdeel, 'punten', p.punten)
                                    order by p.dag, p.onderdeel), '[]'::json) from public.punten p);
end $$;

-- p_waarden: {"<klas_id>": 12, "<klas_id>": null, ...}  (null or empty = remove)
create or replace function public.root_punten_opslaan(p_dag int, p_onderdeel text, p_waarden jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  perform public._root();
  for r in select key, value from jsonb_each_text(p_waarden) loop
    if r.value is null or trim(r.value) = '' then
      delete from public.punten where klas_id = r.key::uuid and dag = p_dag and onderdeel = trim(p_onderdeel);
    else
      insert into public.punten (klas_id, dag, onderdeel, punten)
      values (r.key::uuid, p_dag, trim(p_onderdeel), r.value::int)
      on conflict (klas_id, dag, onderdeel) do update set punten = excluded.punten;
    end if;
  end loop;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_punten_verwijderen(p_dag int, p_onderdeel text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  delete from public.punten where dag = p_dag and onderdeel = p_onderdeel;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_opruimen() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  perform public._opruimen();
  return json_build_object('ok', true);
end $$;

-- Run in the SQL Editor after creating the user under Authentication -> Users:
--   select public.maak_root('jij@example.com');
create or replace function public.maak_root(p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.root_gebruikers (user_id)
  select id from auth.users where lower(email) = lower(trim(p_email))
  on conflict do nothing;
  if not found then raise exception 'gebruiker niet gevonden of al Root'; end if;
end $$;

-- ======================= storage: images (only Root may upload) =======================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('afbeeldingen', 'afbeeldingen', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "root uploadt afbeeldingen" on storage.objects for insert to authenticated
  with check (bucket_id = 'afbeeldingen' and public.ben_root());
create policy "root verwijdert afbeeldingen" on storage.objects for delete to authenticated
  using (bucket_id = 'afbeeldingen' and public.ben_root());

-- ======================= function permissions =======================
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


-- ======================================================================
-- migratie-v3.sql
-- ======================================================================
-- Aristeia v3: per-class customization (display name, colours, logo, emoji, slogan),
-- emoji per activity, pictures in class announcements (uploaded by class admins).
-- Run ONCE in the SQL Editor on a database that already has schema.sql (v2), then deploy the new app code right away
-- (a few admin functions changed their parameters).
-- Also needed: Authentication -> Sign In / Providers -> turn ON "Allow anonymous sign-ins"
-- (class admins use it only to get permission to upload pictures into their own class folder).

-- ======================= tables / columns =======================
alter table public.klassen add column if not exists weergavenaam text check (weergavenaam is null or length(weergavenaam) <= 40);
alter table public.klassen add column if not exists thema jsonb not null default '{}'::jsonb;
alter table public.activiteiten add column if not exists emoji text check (emoji is null or length(emoji) <= 12);

alter table public.berichten drop constraint if exists berichten_afbeelding_pad_check;
alter table public.berichten add constraint berichten_afbeelding_pad_check
  check (afbeelding_pad ~ '^([0-9a-f-]{36}/)?[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$');

create table if not exists public.upload_rechten (
  user_id uuid primary key references auth.users on delete cascade,
  klas_id uuid not null references public.klassen on delete cascade,
  verloopt_op timestamptz not null
);
alter table public.upload_rechten enable row level security;
revoke all on public.upload_rechten from anon, authenticated;

-- ======================= helpers =======================
create or replace function public._klas_thema_opslaan(p_klas uuid, p_weergavenaam text, p_thema jsonb, p_strikt boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_accent text; v_emoji text; v_slogan text; v_logo text;
begin
  v_accent := nullif(trim(coalesce(p_thema ->> 'accent', '')), '');
  if v_accent is not null and v_accent !~ '^#[0-9a-fA-F]{6}$' then raise exception 'ongeldige_kleur'; end if;
  v_emoji := nullif(trim(coalesce(p_thema ->> 'emoji', '')), '');
  if v_emoji is not null and length(v_emoji) > 12 then raise exception 'ongeldige_emoji'; end if;
  v_slogan := nullif(left(trim(coalesce(p_thema ->> 'slogan', '')), 60), '');
  v_logo := nullif(trim(coalesce(p_thema ->> 'logo', '')), '');
  if v_logo is not null then
    if v_logo !~ '^([0-9a-f-]{36}/)?[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$' then raise exception 'ongeldig_pad'; end if;
    if p_strikt and v_logo not like (p_klas::text || '/%') then raise exception 'ongeldig_pad'; end if;
  end if;
  update public.klassen
     set weergavenaam = nullif(left(trim(coalesce(p_weergavenaam, '')), 40), ''),
         thema = jsonb_strip_nulls(jsonb_build_object('accent', v_accent, 'emoji', v_emoji, 'slogan', v_slogan, 'logo', v_logo))
   where id = p_klas;
  perform public._bump_klas(p_klas);
end $$;

-- (old signatures are replaced because they gain a parameter)
drop function if exists public._activiteit_opslaan(uuid, uuid, text, int, text, text, text, text, text, uuid[]);
drop function if exists public.activiteit_opslaan(text, uuid, text, int, text, text, text, text, text, uuid[]);
drop function if exists public.root_activiteit_opslaan(uuid, text, int, text, text, text, text, text);
drop function if exists public.bericht_opslaan(text, uuid, text, text, boolean);

create or replace function public._activiteit_opslaan(
  p_klas uuid, p_id uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_kleur text, p_emoji text, p_leerlingen uuid[]
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_max int;
begin
  if p_id is null then
    if p_klas is not null then
      select max_activiteiten into v_max from public.instellingen where id = 1;
      if (select count(*) from public.activiteiten where klas_id = p_klas) >= v_max then
        raise exception 'limiet_activiteiten';
      end if;
    end if;
    insert into public.activiteiten (klas_id, titel, dag, start, eind, locatie, omschrijving, kleur, emoji)
    values (p_klas, trim(p_titel), p_dag, p_start::time, p_eind::time,
            coalesce(trim(p_locatie), ''), coalesce(trim(p_omschrijving), ''), coalesce(p_kleur, 'blauw'),
            nullif(trim(coalesce(p_emoji, '')), ''))
    returning id into v_id;
  else
    update public.activiteiten
       set titel = trim(p_titel), dag = p_dag, start = p_start::time, eind = p_eind::time,
           locatie = coalesce(trim(p_locatie), ''), omschrijving = coalesce(trim(p_omschrijving), ''),
           kleur = coalesce(p_kleur, 'blauw'), emoji = nullif(trim(coalesce(p_emoji, '')), '')
     where id = p_id and klas_id is not distinct from p_klas
    returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;

  delete from public.deelnames where activiteit_id = v_id;
  delete from public.herinneringen where activiteit_id = v_id;
  if p_klas is not null then
    insert into public.deelnames (activiteit_id, leerling_id)
    select v_id, l.id from public.leerlingen l
     where l.klas_id = p_klas and l.id = any (coalesce(p_leerlingen, '{}'));
    perform public._bump_klas(p_klas);
  else
    perform public._bump_globaal();
  end if;
  return v_id;
end $$;

create or replace function public.activiteit_opslaan(
  p_token text, p_id uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_kleur text, p_emoji text, p_leerlingen uuid[]
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  return json_build_object('id', public._activiteit_opslaan(s.klas_id, p_id, p_titel, p_dag, p_start, p_eind,
                                                            p_locatie, p_omschrijving, p_kleur, p_emoji, p_leerlingen));
end $$;

create or replace function public.root_activiteit_opslaan(
  p_id uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_kleur text, p_emoji text
) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object('id', public._activiteit_opslaan(null, p_id, p_titel, p_dag, p_start, p_eind,
                                                            p_locatie, p_omschrijving, p_kleur, p_emoji, '{}'));
end $$;

create or replace function public.bericht_opslaan(p_token text, p_id uuid, p_titel text, p_tekst text, p_pad text, p_gepubliceerd boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; v_id uuid;
begin
  s := public._beheer(p_token);
  if nullif(p_pad, '') is not null and p_pad not like (s.klas_id::text || '/%') then
    raise exception 'ongeldig_pad';
  end if;
  if p_id is null then
    if (select count(*) from public.berichten where klas_id = s.klas_id) >= 100 then
      raise exception 'limiet_berichten';
    end if;
    insert into public.berichten (klas_id, titel, tekst, afbeelding_pad, gepubliceerd)
    values (s.klas_id, trim(p_titel), coalesce(trim(p_tekst), ''), nullif(p_pad, ''), coalesce(p_gepubliceerd, true))
    returning id into v_id;
  else
    update public.berichten set titel = trim(p_titel), tekst = coalesce(trim(p_tekst), ''),
           afbeelding_pad = nullif(p_pad, ''), gepubliceerd = coalesce(p_gepubliceerd, true)
     where id = p_id and klas_id = s.klas_id returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;
  perform public._bump_klas(s.klas_id);
  return json_build_object('id', v_id);
end $$;

-- the admin removes a picture together with the message
create or replace function public.bericht_verwijderen(p_token text, p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; v_pad text;
begin
  s := public._beheer(p_token);
  select afbeelding_pad into v_pad from public.berichten where id = p_id and klas_id = s.klas_id;
  delete from public.berichten where id = p_id and klas_id = s.klas_id;
  perform public._bump_klas(s.klas_id);
  return json_build_object('ok', true, 'afbeelding_pad', v_pad);
end $$;

create or replace function public.klas_thema_opslaan(p_token text, p_weergavenaam text, p_thema jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  perform public._klas_thema_opslaan(s.klas_id, p_weergavenaam, p_thema, true);
  return json_build_object('ok', true);
end $$;

create or replace function public.root_klas_thema_opslaan(p_id uuid, p_weergavenaam text, p_thema jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  perform public._klas_thema_opslaan(p_id, p_weergavenaam, p_thema, false);
  return json_build_object('ok', true);
end $$;

-- ======================= login, data, ranking: now with class theme =======================
create or replace function public.inloggen(p_slug text, p_wachtwoord text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare k public.klassen; w public.klas_wachtwoorden; i public.instellingen; r text; t text; v_verloopt timestamptz;
begin
  select * into k from public.klassen where slug = lower(trim(coalesce(p_slug, '')));
  if not found then
    return json_build_object('fout', 'onbekende_klas');
  end if;

  delete from public.inlogpogingen where tijdstip < now() - interval '1 day';
  delete from public.sessies where verloopt_op < now();
  delete from public.upload_rechten where verloopt_op < now();
  if (select count(*) from public.inlogpogingen
       where klas_id = k.id and tijdstip > now() - interval '10 minutes') >= 30 then
    return json_build_object('fout', 'te_veel_pogingen');
  end if;

  select * into w from public.klas_wachtwoorden where klas_id = k.id;
  if w.beheer_hash = crypt(trim(coalesce(p_wachtwoord, '')), w.beheer_hash) then
    r := 'beheer';
  elsif w.leerling_hash = crypt(trim(coalesce(p_wachtwoord, '')), w.leerling_hash) then
    r := 'leerling';
  else
    insert into public.inlogpogingen (klas_id) values (k.id);
    return json_build_object('fout', 'fout_wachtwoord');
  end if;

  select * into i from public.instellingen where id = 1;
  v_verloopt := greatest(now() + interval '2 hours',
                least(now() + interval '3 days', coalesce((i.event_einde + 1)::timestamptz, now() + interval '3 days')));
  t := encode(gen_random_bytes(24), 'hex');
  insert into public.sessies (token_hash, klas_id, rol, verloopt_op)
  values (encode(digest(t, 'sha256'), 'hex'), k.id, r, v_verloopt);

  return json_build_object('token', t, 'rol', r,
    'klas', json_build_object('naam', k.naam, 'weergavenaam', k.weergavenaam, 'thema', k.thema));
end $$;

create or replace function public.alles(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; i public.instellingen; k public.klassen; v_beheer boolean;
begin
  s := public._sessie(p_token);
  select * into i from public.instellingen where id = 1;
  select * into k from public.klassen where id = s.klas_id;
  v_beheer := s.rol = 'beheer';

  return json_build_object(
    'versie', i.versie::text || '.' || k.versie::text,
    'rol', s.rol,
    'leerling_id', s.leerling_id,
    'klas', json_build_object('naam', k.naam, 'weergavenaam', k.weergavenaam, 'thema', k.thema),
    'instellingen', json_build_object(
      'dag1', i.dag1, 'dag2', i.dag2, 'uitslag_tot_dag', i.uitslag_tot_dag,
      'max_leerlingen', i.max_leerlingen,
      'banner', json_build_object('actief', i.banner_actief, 'titel', i.banner_titel, 'tekst', i.banner_tekst)
    ),
    'mijn_info', (select l.rol_info from public.leerlingen l where l.id = s.leerling_id),
    'leerlingen', (
      select coalesce(json_agg(
        case when v_beheer then json_build_object(
               'id', l.id, 'naam', l.naam, 'rol_info', l.rol_info,
               'gekoppeld', exists (select 1 from public.sessies z where z.leerling_id = l.id),
               'meldingen', exists (select 1 from public.push_abonnementen p where p.leerling_id = l.id))
             else json_build_object('id', l.id, 'naam', l.naam) end
        order by l.naam), '[]'::json)
        from public.leerlingen l where l.klas_id = s.klas_id),
    'activiteiten', (
      select coalesce(json_agg(json_build_object(
        'id', a.id, 'titel', a.titel, 'dag', a.dag,
        'start', to_char(a.start, 'HH24:MI'), 'eind', to_char(a.eind, 'HH24:MI'),
        'locatie', a.locatie, 'omschrijving', a.omschrijving, 'kleur', a.kleur, 'emoji', a.emoji,
        'globaal', a.klas_id is null,
        'leerlingen', case when a.klas_id is null then '[]'::json
                      else coalesce((select json_agg(d.leerling_id) from public.deelnames d where d.activiteit_id = a.id), '[]'::json) end
      ) order by a.dag, a.start), '[]'::json)
        from public.activiteiten a where a.klas_id is null or a.klas_id = s.klas_id),
    'dagberichten', (
      select coalesce(json_agg(json_build_object('dag', d.dag, 'bericht', d.bericht, 'globaal', d.klas_id is null)), '[]'::json)
        from public.dag_berichten d where d.klas_id is null or d.klas_id = s.klas_id),
    'berichten', (
      select coalesce(json_agg(json_build_object(
        'id', b.id, 'titel', b.titel, 'tekst', b.tekst, 'afbeelding_pad', b.afbeelding_pad,
        'gepubliceerd', b.gepubliceerd, 'globaal', b.klas_id is null,
        'tijd', to_char(b.aangemaakt at time zone 'Europe/Amsterdam', 'DD-MM HH24:MI')
      ) order by b.aangemaakt desc), '[]'::json)
        from (select * from public.berichten b0
               where (b0.klas_id is null or b0.klas_id = s.klas_id)
                 and (b0.gepubliceerd or (v_beheer and b0.klas_id = s.klas_id))
               order by b0.aangemaakt desc limit 50) b)
  );
end $$;

create or replace function public.stand(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; v_tot smallint;
begin
  s := public._sessie(p_token);
  select uitslag_tot_dag into v_tot from public.instellingen where id = 1;
  if v_tot = 0 then
    return json_build_object('tot_dag', 0, 'stand', '[]'::json, 'onderdelen', '[]'::json);
  end if;
  return json_build_object(
    'tot_dag', v_tot,
    'stand', (
      select coalesce(json_agg(json_build_object('klas', q.label, 'emoji', q.emoji, 'punten', q.totaal, 'positie', q.pos, 'eigen', q.id = s.klas_id)
                               order by q.pos, q.label), '[]'::json)
        from (select k.id, coalesce(k.weergavenaam, k.naam) as label, k.thema ->> 'emoji' as emoji,
                     coalesce(sum(p.punten), 0) as totaal,
                     rank() over (order by coalesce(sum(p.punten), 0) desc) as pos
                from public.klassen k
                left join public.punten p on p.klas_id = k.id and p.dag <= v_tot
               group by k.id) q),
    'onderdelen', (
      select coalesce(json_agg(json_build_object('dag', o.dag, 'onderdeel', o.onderdeel, 'resultaten', o.res)
                               order by o.dag, o.onderdeel), '[]'::json)
        from (select p.dag, p.onderdeel,
                     json_agg(json_build_object('klas', coalesce(k.weergavenaam, k.naam), 'emoji', k.thema ->> 'emoji', 'punten', p.punten, 'eigen', k.id = s.klas_id)
                              order by p.punten desc, k.naam) as res
                from public.punten p join public.klassen k on k.id = p.klas_id
               where p.dag <= v_tot group by p.dag, p.onderdeel) o)
  );
end $$;

create or replace function public.root_overzicht() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object(
    'instellingen', (select row_to_json(i) from public.instellingen i where i.id = 1),
    'klassen', (
      select coalesce(json_agg(json_build_object(
        'id', k.id, 'naam', k.naam, 'slug', k.slug, 'weergavenaam', k.weergavenaam, 'thema', k.thema,
        'leerlingen', (select count(*) from public.leerlingen l where l.klas_id = k.id),
        'gekoppeld', (select count(distinct z.leerling_id) from public.sessies z where z.klas_id = k.id and z.leerling_id is not null),
        'meldingen', (select count(distinct p.leerling_id) from public.push_abonnementen p join public.leerlingen l on l.id = p.leerling_id where l.klas_id = k.id),
        'activiteiten', (select count(*) from public.activiteiten a where a.klas_id = k.id),
        'laatst_gezien', (select max(z.laatst_gezien) from public.sessies z where z.klas_id = k.id)
      ) order by k.naam), '[]'::json) from public.klassen k)
  );
end $$;

create or replace function public.root_programma() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object(
    'activiteiten', (select coalesce(json_agg(json_build_object(
        'id', a.id, 'titel', a.titel, 'dag', a.dag, 'start', to_char(a.start, 'HH24:MI'), 'eind', to_char(a.eind, 'HH24:MI'),
        'locatie', a.locatie, 'omschrijving', a.omschrijving, 'kleur', a.kleur, 'emoji', a.emoji, 'leerlingen', '[]'::json
      ) order by a.dag, a.start), '[]'::json) from public.activiteiten a where a.klas_id is null),
    'dagberichten', (select coalesce(json_agg(json_build_object('dag', d.dag, 'bericht', d.bericht)), '[]'::json)
                       from public.dag_berichten d where d.klas_id is null)
  );
end $$;

-- ======================= picture uploads for class admins =======================
-- An admin first gets a (anonymous) Supabase login, then asks for upload rights for their own class folder.
create or replace function public.upload_toegang(p_token text) returns json
language plpgsql security definer set search_path = public, extensions, auth as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  if auth.uid() is null then raise exception 'geen_upload_login'; end if;
  insert into public.upload_rechten (user_id, klas_id, verloopt_op)
  values (auth.uid(), s.klas_id, s.verloopt_op)
  on conflict (user_id) do update set klas_id = excluded.klas_id, verloopt_op = excluded.verloopt_op;
  return json_build_object('klas_id', s.klas_id);
end $$;

create or replace function public.mag_uploaden(p_uid uuid, p_naam text) returns boolean
language plpgsql security definer set search_path = public, storage as $$
declare v_klas uuid;
begin
  select klas_id into v_klas from public.upload_rechten where user_id = p_uid and verloopt_op > now();
  if v_klas is null then return false; end if;
  if p_naam !~ '^[0-9a-f-]{36}/[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$' or split_part(p_naam, '/', 1) <> v_klas::text then
    return false;
  end if;
  -- at most 150 pictures per class
  return (select count(*) from storage.objects o where o.bucket_id = 'afbeeldingen' and o.name like (v_klas::text || '/%')) < 150;
end $$;

create or replace function public.mag_verwijderen(p_uid uuid, p_naam text) returns boolean
language plpgsql security definer set search_path = public, storage as $$
declare v_klas uuid;
begin
  select klas_id into v_klas from public.upload_rechten where user_id = p_uid and verloopt_op > now();
  return v_klas is not null and split_part(p_naam, '/', 1) = v_klas::text;
end $$;

drop policy if exists "root uploadt afbeeldingen" on storage.objects;
drop policy if exists "root verwijdert afbeeldingen" on storage.objects;
drop policy if exists "uploaden afbeeldingen" on storage.objects;
drop policy if exists "verwijderen afbeeldingen" on storage.objects;
create policy "uploaden afbeeldingen" on storage.objects for insert to authenticated
  with check (bucket_id = 'afbeeldingen' and (public.ben_root() or public.mag_uploaden(auth.uid(), name)));
create policy "verwijderen afbeeldingen" on storage.objects for delete to authenticated
  using (bucket_id = 'afbeeldingen' and (public.ben_root() or public.mag_verwijderen(auth.uid(), name)));

-- ======================= function permissions (same rules as schema.sql) =======================
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


-- ======================================================================
-- migratie-v4.sql
-- ======================================================================
-- Aristeia v4: robustness. Run once in the SQL Editor (after migratie-v3.sql). Safe to run again.

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


-- ======================================================================
-- migratie-v5.sql
-- ======================================================================
-- Aristeia v5: leagues + new standings, and full per-class customization (theme + class page).
-- Run once in the SQL Editor (after migratie-v4.sql). Everything here is additive: the previous app version keeps working.

-- ======================= leagues and standings settings =======================
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  naam text not null check (length(naam) between 1 and 40),
  emoji text check (emoji is null or length(emoji) <= 12),
  volgorde int not null default 0
);
alter table public.leagues enable row level security;
revoke all on public.leagues from anon, authenticated;

alter table public.klassen add column if not exists league_id uuid references public.leagues on delete set null;
create index if not exists klassen_league_id_idx on public.klassen (league_id);
alter table public.instellingen add column if not exists stand_top_aantal smallint not null default 3 check (stand_top_aantal between 1 and 10);
alter table public.instellingen add column if not exists stand_toon_punten_dag1 boolean not null default true;

-- ======================= class customization =======================
alter table public.klassen add column if not exists pagina jsonb not null default '[]'::jsonb;
alter table public.klassen drop constraint if exists klassen_thema_grootte;
alter table public.klassen add constraint klassen_thema_grootte check (length(thema::text) <= 3000);
alter table public.klassen drop constraint if exists klassen_pagina_grootte;
alter table public.klassen add constraint klassen_pagina_grootte check (length(pagina::text) <= 12000);

-- Whitelist + validation of everything a class may customize. Unknown keys are dropped, values are checked.
create or replace function public._thema_schoon(p_klas uuid, p jsonb, p_strikt boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb := '{}'::jsonb; k text; v text; e record; t jsonb; sub jsonb; toon jsonb := '{}'::jsonb; tabs jsonb := '{}'::jsonb; lijst jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;

  foreach k in array array['accent', 'accent2', 'achtergrond', 'kaart', 'tekst'] loop
    v := nullif(trim(coalesce(p ->> k, '')), '');
    if v is not null then
      if v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'ongeldige_kleur'; end if;
      r := r || jsonb_build_object(k, lower(v));
    end if;
  end loop;

  for e in select * from (values
    ('palet', array['standaard', 'zee', 'bos', 'zonsondergang', 'roze', 'goud', 'nacht', 'mono', 'neon', 'eigen']),
    ('modus', array['auto', 'licht', 'donker']),
    ('font_kop', array['systeem', 'klassiek', 'rond', 'mono', 'hand', 'sterk']),
    ('font_tekst', array['systeem', 'klassiek', 'rond', 'mono', 'hand', 'sterk']),
    ('tekstgrootte', array['klein', 'normaal', 'groot']),
    ('hoeken', array['scherp', 'normaal', 'rond', 'extra']),
    ('dichtheid', array['compact', 'normaal', 'ruim']),
    ('kop_stijl', array['compact', 'groot', 'banner']),
    ('kop_uitlijning', array['links', 'midden']),
    ('kaartstijl', array['kaart', 'lijst', 'tijdlijn', 'compact']),
    ('standaard_weergave', array['mijn', 'klas']),
    ('patroon', array['geen', 'stippen', 'sterren', 'golven', 'strepen', 'ruit', 'confetti', 'harten']),
    ('patroon_sterkte', array['zacht', 'midden', 'sterk']),
    ('emoji_regen', array['uit', 'zacht', 'veel']),
    ('mascotte_positie', array['uit', 'rechtsonder', 'linksonder']),
    ('start_tab', array['rooster', 'info', 'stand', 'pagina'])
  ) as x(sleutel, opties) loop
    v := nullif(trim(coalesce(p ->> e.sleutel, '')), '');
    if v is not null then
      if not (v = any (e.opties)) then raise exception 'ongeldige_keuze'; end if;
      r := r || jsonb_build_object(e.sleutel, v);
    end if;
  end loop;

  v := nullif(left(trim(coalesce(p ->> 'slogan', '')), 60), '');
  if v is not null then r := r || jsonb_build_object('slogan', v); end if;
  v := nullif(left(trim(coalesce(p ->> 'nu_label', '')), 20), '');
  if v is not null then r := r || jsonb_build_object('nu_label', v); end if;
  v := nullif(trim(coalesce(p ->> 'emoji', '')), '');
  if v is not null then
    if length(v) > 12 then raise exception 'ongeldige_emoji'; end if;
    r := r || jsonb_build_object('emoji', v);
  end if;

  foreach k in array array['logo', 'banner', 'mascotte'] loop
    v := nullif(trim(coalesce(p ->> k, '')), '');
    if v is not null then
      if v !~ '^([0-9a-f-]{36}/)?[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$' then raise exception 'ongeldig_pad'; end if;
      if p_strikt and v not like (p_klas::text || '/%') then raise exception 'ongeldig_pad'; end if;
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;

  foreach k in array array['emoji_strook'] loop
    if (p ->> k) in ('true', 'false') then r := r || jsonb_build_object(k, (p ->> k)::boolean); end if;
  end loop;

  foreach k in array array['logo', 'slogan', 'appnaam', 'emoji', 'locatie', 'omschrijving', 'voor', 'einde', 'nu'] loop
    if (p -> 'toon' ->> k) in ('true', 'false') then toon := toon || jsonb_build_object(k, (p -> 'toon' ->> k)::boolean); end if;
  end loop;
  if toon <> '{}'::jsonb then r := r || jsonb_build_object('toon', toon); end if;

  foreach k in array array['rooster', 'info', 'stand', 'pagina'] loop
    t := p -> 'tabs' -> k;
    if t is not null and jsonb_typeof(t) = 'object' then
      sub := '{}'::jsonb;
      if (t ->> 'aan') in ('true', 'false') then sub := sub || jsonb_build_object('aan', (t ->> 'aan')::boolean); end if;
      v := nullif(left(trim(coalesce(t ->> 'naam', '')), 14), '');
      if v is not null then sub := sub || jsonb_build_object('naam', v); end if;
      if sub <> '{}'::jsonb then tabs := tabs || jsonb_build_object(k, sub); end if;
    end if;
  end loop;
  if tabs <> '{}'::jsonb then r := r || jsonb_build_object('tabs', tabs); end if;

  if jsonb_typeof(p -> 'tab_volgorde') = 'array' then
    select coalesce(jsonb_agg(y.x order by y.o), '[]'::jsonb) into lijst from (
      select q.x, min(q.n) as o from jsonb_array_elements_text(p -> 'tab_volgorde') with ordinality as q(x, n)
       where q.x in ('rooster', 'info', 'stand', 'pagina') group by q.x) y;
    if jsonb_array_length(lijst) > 0 then r := r || jsonb_build_object('tab_volgorde', lijst); end if;
  end if;

  if jsonb_typeof(p -> 'emojis') = 'array' then
    select coalesce(jsonb_agg(left(trim(x), 12)), '[]'::jsonb) into lijst
      from (select x from jsonb_array_elements_text(p -> 'emojis') as q(x) where length(trim(x)) > 0 limit 5) y;
    if jsonb_array_length(lijst) > 0 then r := r || jsonb_build_object('emojis', lijst); end if;
  end if;

  if length(r::text) > 3000 then raise exception 'thema_te_groot'; end if;
  return r;
end $$;

-- The free-form class page: a list of simple blocks (heading, text, image, link, list, line).
create or replace function public._pagina_schoon(p_klas uuid, p jsonb, p_strikt boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb := '[]'::jsonb; b jsonb; t text; v text; titel text; lijst jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return '[]'::jsonb; end if;
  if jsonb_array_length(p) > 30 then raise exception 'pagina_te_groot'; end if;
  for b in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(b) <> 'object' then continue; end if;
    t := b ->> 'type';
    if t in ('kop', 'tekst') then
      v := left(trim(coalesce(b ->> 'tekst', '')), case when t = 'kop' then 80 else 600 end);
      if v <> '' then r := r || jsonb_build_array(jsonb_build_object('type', t, 'tekst', v)); end if;
    elsif t = 'afbeelding' then
      v := nullif(trim(coalesce(b ->> 'pad', '')), '');
      if v is not null then
        if v !~ '^([0-9a-f-]{36}/)?[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$' then raise exception 'ongeldig_pad'; end if;
        if p_strikt and v not like (p_klas::text || '/%') then raise exception 'ongeldig_pad'; end if;
        r := r || jsonb_build_array(jsonb_build_object('type', 'afbeelding', 'pad', v,
                                    'onderschrift', left(trim(coalesce(b ->> 'onderschrift', '')), 100)));
      end if;
    elsif t = 'link' then
      v := trim(coalesce(b ->> 'url', ''));
      if length(v) > 300 or v !~ '^https?://[^\s<>"'']+$' then raise exception 'ongeldige_url'; end if;
      titel := left(trim(coalesce(b ->> 'tekst', '')), 80);
      r := r || jsonb_build_array(jsonb_build_object('type', 'link', 'url', v, 'tekst', case when titel = '' then v else titel end));
    elsif t = 'lijst' then
      if jsonb_typeof(b -> 'items') = 'array' then
        select coalesce(jsonb_agg(left(trim(x), 100)), '[]'::jsonb) into lijst
          from (select x from jsonb_array_elements_text(b -> 'items') as q(x) where length(trim(x)) > 0 limit 12) y;
        if jsonb_array_length(lijst) > 0 then r := r || jsonb_build_array(jsonb_build_object('type', 'lijst', 'items', lijst)); end if;
      end if;
    elsif t = 'lijn' then
      r := r || jsonb_build_array(jsonb_build_object('type', 'lijn'));
    end if;
  end loop;
  if length(r::text) > 12000 then raise exception 'pagina_te_groot'; end if;
  return r;
end $$;

create or replace function public._klas_thema_opslaan(p_klas uuid, p_weergavenaam text, p_thema jsonb, p_strikt boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.klassen
     set weergavenaam = nullif(left(trim(coalesce(p_weergavenaam, '')), 40), ''),
         thema = public._thema_schoon(p_klas, p_thema, p_strikt)
   where id = p_klas;
  perform public._bump_klas(p_klas);
end $$;

create or replace function public.pagina_ophalen(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  return (select k.pagina::json from public.klassen k where k.id = s.klas_id);
end $$;

create or replace function public.klas_pagina_opslaan(p_token text, p_pagina jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  update public.klassen set pagina = public._pagina_schoon(s.klas_id, p_pagina, true) where id = s.klas_id;
  perform public._bump_klas(s.klas_id);
  return json_build_object('ok', true);
end $$;

create or replace function public.root_klas_pagina_opslaan(p_id uuid, p_pagina jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  update public.klassen set pagina = public._pagina_schoon(p_id, p_pagina, false) where id = p_id;
  perform public._bump_klas(p_id);
  return json_build_object('ok', true);
end $$;

create or replace function public.root_klas_pagina_ophalen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return (select k.pagina::json from public.klassen k where k.id = p_id);
end $$;

-- The login screen is themed per class too (from the /k/<class> link), so the look of each class is public.
create or replace function public.start_info() returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'klassen', (select coalesce(json_agg(json_build_object('slug', k.slug, 'naam', k.naam, 'weergavenaam', k.weergavenaam, 'thema', k.thema) order by k.naam), '[]'::json) from public.klassen k),
    'dag1', i.dag1, 'dag2', i.dag2,
    'banner', json_build_object('actief', i.banner_actief, 'titel', i.banner_titel, 'tekst', i.banner_tekst)
  ) from public.instellingen i where i.id = 1;
$$;

-- ======================= standings per league =======================
-- Day 1 mode (uitslag_tot_dag = 1): only the top N per league, points optional. Day 2 mode (= 2): everyone with points.
create or replace function public.stand_leagues(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; cfg public.instellingen; v_eigen uuid; v_leagues json; v_onderdelen json;
begin
  s := public._sessie(p_token);
  select * into cfg from public.instellingen where id = 1;
  if cfg.uitslag_tot_dag = 0 then
    return json_build_object('tot_dag', 0, 'modus', 'verborgen', 'leagues', '[]'::json, 'onderdelen', '[]'::json);
  end if;
  select league_id into v_eigen from public.klassen where id = s.klas_id;

  with totalen as (
    select k.id, k.league_id, coalesce(k.weergavenaam, k.naam) as label, k.thema ->> 'emoji' as emoji, k.thema ->> 'logo' as logo,
           coalesce(sum(p.punten), 0) as totaal
      from public.klassen k
      left join public.punten p on p.klas_id = k.id and p.dag <= cfg.uitslag_tot_dag
     group by k.id
  ), gerangschikt as (
    select t.*, rank() over (partition by t.league_id order by t.totaal desc) as pos from totalen t
  ), zichtbaar as (
    select * from gerangschikt g
     where cfg.uitslag_tot_dag >= 2 or (g.pos <= cfg.stand_top_aantal and g.totaal > 0)
  )
  select coalesce(json_agg(x.j order by x.volgorde, x.naam), '[]'::json) into v_leagues from (
    select lg.volgorde, lg.naam,
           json_build_object('id', lg.id, 'naam', lg.naam, 'emoji', lg.emoji,
             'eigen', lg.id is not distinct from v_eigen,
             'klassen', coalesce(json_agg(json_build_object(
                'klas', z.label, 'emoji', z.emoji, 'logo', z.logo,
                'punten', case when cfg.uitslag_tot_dag >= 2 or cfg.stand_toon_punten_dag1 then z.totaal else null end,
                'positie', z.pos, 'eigen', z.id = s.klas_id) order by z.pos, z.label) filter (where z.id is not null), '[]'::json)) as j
      from (select id, naam, emoji, volgorde from public.leagues
            union all
            select null::uuid, 'Overige klassen', null::text, 9999 where exists (select 1 from public.klassen where league_id is null)) lg
      left join zichtbaar z on z.league_id is not distinct from lg.id
     group by lg.id, lg.volgorde, lg.naam, lg.emoji
  ) x;

  select coalesce(json_agg(json_build_object('dag', o.dag, 'onderdeel', o.onderdeel, 'resultaten', o.res) order by o.dag, o.onderdeel), '[]'::json)
    into v_onderdelen from (
      select p.dag, p.onderdeel,
             json_agg(json_build_object('klas', coalesce(k.weergavenaam, k.naam), 'emoji', k.thema ->> 'emoji', 'punten', p.punten, 'eigen', k.id = s.klas_id)
                      order by p.punten desc, k.naam) as res
        from public.punten p join public.klassen k on k.id = p.klas_id
       where cfg.uitslag_tot_dag >= 2 and p.dag <= cfg.uitslag_tot_dag and p.onderdeel <> 'Totaal'
         and k.league_id is not distinct from v_eigen
       group by p.dag, p.onderdeel) o;

  return json_build_object(
    'tot_dag', cfg.uitslag_tot_dag,
    'modus', case when cfg.uitslag_tot_dag >= 2 then 'alles' else 'top' end,
    'aantal_top', cfg.stand_top_aantal,
    'toon_punten', cfg.uitslag_tot_dag >= 2 or cfg.stand_toon_punten_dag1,
    'leagues', v_leagues,
    'onderdelen', v_onderdelen);
end $$;

-- ======================= Root: leagues, standings settings, overview =======================
create or replace function public.root_leagues_opslaan(p_id uuid, p_naam text, p_emoji text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public._root();
  if p_id is null then
    insert into public.leagues (naam, emoji, volgorde)
    values (trim(p_naam), nullif(trim(coalesce(p_emoji, '')), ''), coalesce((select max(volgorde) + 1 from public.leagues), 0))
    returning id into v_id;
  else
    update public.leagues set naam = trim(p_naam), emoji = nullif(trim(coalesce(p_emoji, '')), '') where id = p_id returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;
  perform public._bump_globaal();
  return json_build_object('id', v_id);
end $$;

create or replace function public.root_league_verwijderen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  delete from public.leagues where id = p_id;
  perform public._bump_globaal();
  return json_build_object('ok', true);
end $$;

create or replace function public.root_klas_league_zetten(p_klas uuid, p_league uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  update public.klassen set league_id = p_league where id = p_klas;
  perform public._bump_globaal();
  return json_build_object('ok', true);
end $$;

create or replace function public.root_stand_opslaan(p_dag int, p_top int, p_punten boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  if p_dag not between 0 and 2 then raise exception 'ongeldige_dag'; end if;
  update public.instellingen
     set uitslag_tot_dag = p_dag, stand_top_aantal = greatest(1, least(10, coalesce(p_top, 3))),
         stand_toon_punten_dag1 = coalesce(p_punten, true), versie = versie + 1
   where id = 1;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_overzicht() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return json_build_object(
    'instellingen', (select row_to_json(i) from public.instellingen i where i.id = 1),
    'leagues', (select coalesce(json_agg(json_build_object('id', g.id, 'naam', g.naam, 'emoji', g.emoji) order by g.volgorde, g.naam), '[]'::json) from public.leagues g),
    'klassen', (
      select coalesce(json_agg(json_build_object(
        'id', k.id, 'naam', k.naam, 'slug', k.slug, 'weergavenaam', k.weergavenaam, 'thema', k.thema, 'league_id', k.league_id,
        'leerlingen', (select count(*) from public.leerlingen l where l.klas_id = k.id),
        'gekoppeld', (select count(distinct z.leerling_id) from public.sessies z where z.klas_id = k.id and z.leerling_id is not null),
        'meldingen', (select count(distinct p.leerling_id) from public.push_abonnementen p join public.leerlingen l on l.id = p.leerling_id where l.klas_id = k.id),
        'activiteiten', (select count(*) from public.activiteiten a where a.klas_id = k.id),
        'laatst_gezien', (select max(z.laatst_gezien) from public.sessies z where z.klas_id = k.id)
      ) order by k.naam), '[]'::json) from public.klassen k)
  );
end $$;

-- ======================= permissions (same rules as before) =======================
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


-- ======================================================================
-- migratie-v6.sql
-- ======================================================================
-- Aristeia v6: standings as places per class (shared places allowed, points optional), nicknames stay inside the own class,
-- app-icon PNG set per class, Root can force the Stand tab. Run once after migratie-v5.sql (already applied on the live project).
create table if not exists public.stand_dag (
  klas_id uuid not null references public.klassen on delete cascade,
  dag smallint not null check (dag in (1, 2)),
  plaats smallint not null check (plaats between 1 and 200),
  punten int check (punten between -100000 and 1000000),
  primary key (klas_id, dag)
);
alter table public.stand_dag enable row level security;
revoke all on public.stand_dag from anon, authenticated;
alter table public.instellingen add column if not exists stand_tab_forceer boolean not null default false;
alter table public.instellingen alter column stand_toon_punten_dag1 set default false;

-- patch existing functions in place (safe to run again: already patched functions are skipped)
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.alles(text)'::regprocedure);
  if position('stand_tab_forceer' in d) = 0 then
    if position($p$'uitslag_tot_dag', i.uitslag_tot_dag,$p$ in d) = 0 or position($p$else json_build_object('id', l.id, 'naam', l.naam) end$p$ in d) = 0 then
      raise exception 'alles: patroon niet gevonden';
    end if;
    d := replace(d, $p$'uitslag_tot_dag', i.uitslag_tot_dag,$p$, $p$'uitslag_tot_dag', i.uitslag_tot_dag, 'stand_tab_forceer', i.stand_tab_forceer,$p$);
    d := replace(d, $p$else json_build_object('id', l.id, 'naam', l.naam) end$p$, $p$else json_build_object('id', l.id, 'naam', l.naam, 'rol_info', l.rol_info) end$p$);
    execute d;
  end if;

  d := pg_get_functiondef('public._thema_schoon(uuid,jsonb,boolean)'::regprocedure);
  if position($p$'mascotte', 'icoon']$p$ in d) = 0 then
    if position($p$array['logo', 'banner', 'mascotte']$p$ in d) = 0 then raise exception '_thema_schoon: patroon niet gevonden'; end if;
    d := replace(d, $p$array['logo', 'banner', 'mascotte']$p$, $p$array['logo', 'banner', 'mascotte', 'icoon']$p$);
    execute d;
  end if;
end $do$;

create or replace function public.start_info() returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'klassen', (select coalesce(json_agg(json_build_object('slug', k.slug, 'naam', k.naam) order by k.naam), '[]'::json) from public.klassen k),
    'dag1', i.dag1, 'dag2', i.dag2,
    'banner', json_build_object('actief', i.banner_actief, 'titel', i.banner_titel, 'tekst', i.banner_tekst)
  ) from public.instellingen i where i.id = 1;
$$;

create or replace function public.stand_dag_leagues(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; cfg public.instellingen; v_eigen uuid; v_leagues json; v_onderdelen json; v_toon boolean;
begin
  s := public._sessie(p_token);
  select * into cfg from public.instellingen where id = 1;
  if cfg.uitslag_tot_dag = 0 then
    return json_build_object('tot_dag', 0, 'toon_punten', false, 'leagues', '[]'::json, 'onderdelen', '[]'::json);
  end if;
  v_toon := cfg.uitslag_tot_dag >= 2 or cfg.stand_toon_punten_dag1;
  select league_id into v_eigen from public.klassen where id = s.klas_id;

  select coalesce(json_agg(x.j order by x.volgorde, x.naam), '[]'::json) into v_leagues from (
    select lg.volgorde, lg.naam,
           json_build_object('id', lg.id, 'naam', lg.naam, 'emoji', lg.emoji, 'eigen', lg.id is not distinct from v_eigen,
             'klassen', coalesce(json_agg(json_build_object('klas', z.label, 'emoji', z.emoji, 'logo', z.logo,
                'punten', case when v_toon then z.punten else null end, 'positie', z.plaats, 'eigen', z.id = s.klas_id)
                order by z.plaats, z.label) filter (where z.id is not null), '[]'::json)) as j
      from (select id, naam, emoji, volgorde from public.leagues
            union all
            select null::uuid, 'Overige klassen', null::text, 9999 where exists (select 1 from public.klassen where league_id is null)) lg
      left join (select k.id, k.league_id, k.naam as label, k.thema ->> 'emoji' as emoji, k.thema ->> 'logo' as logo, d.plaats, d.punten
                   from public.klassen k join public.stand_dag d on d.klas_id = k.id and d.dag = cfg.uitslag_tot_dag) z
        on z.league_id is not distinct from lg.id
     group by lg.id, lg.volgorde, lg.naam, lg.emoji
  ) x;

  select coalesce(json_agg(json_build_object('dag', o.dag, 'onderdeel', o.onderdeel, 'resultaten', o.res) order by o.dag, o.onderdeel), '[]'::json)
    into v_onderdelen from (
      select p.dag, p.onderdeel,
             json_agg(json_build_object('klas', k.naam, 'emoji', k.thema ->> 'emoji', 'punten', p.punten, 'eigen', k.id = s.klas_id) order by p.punten desc, k.naam) as res
        from public.punten p join public.klassen k on k.id = p.klas_id
       where cfg.uitslag_tot_dag >= 2 and p.dag <= cfg.uitslag_tot_dag and p.onderdeel <> 'Totaal'
         and k.league_id is not distinct from v_eigen
       group by p.dag, p.onderdeel) o;

  return json_build_object('tot_dag', cfg.uitslag_tot_dag, 'toon_punten', v_toon, 'leagues', v_leagues, 'onderdelen', v_onderdelen);
end $$;

create or replace function public.root_stand_instellingen(p_dag int, p_punten boolean, p_forceer boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  if p_dag not between 0 and 2 then raise exception 'ongeldige_dag'; end if;
  update public.instellingen set uitslag_tot_dag = p_dag, stand_toon_punten_dag1 = coalesce(p_punten, false),
         stand_tab_forceer = coalesce(p_forceer, false), versie = versie + 1 where id = 1;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_stand_dag_lijst() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return (select coalesce(json_agg(json_build_object('klas_id', d.klas_id, 'dag', d.dag, 'plaats', d.plaats, 'punten', d.punten)), '[]'::json) from public.stand_dag d);
end $$;

create or replace function public.root_stand_dag_opslaan(p_dag int, p_rijen jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public._root();
  if p_dag not between 1 and 2 then raise exception 'ongeldige_dag'; end if;
  for r in select value from jsonb_array_elements(coalesce(p_rijen, '[]'::jsonb)) loop
    if nullif(r ->> 'plaats', '') is null then
      delete from public.stand_dag where klas_id = (r ->> 'klas_id')::uuid and dag = p_dag;
    else
      insert into public.stand_dag (klas_id, dag, plaats, punten)
      values ((r ->> 'klas_id')::uuid, p_dag, (r ->> 'plaats')::int, nullif(r ->> 'punten', '')::int)
      on conflict (klas_id, dag) do update set plaats = excluded.plaats, punten = excluded.punten;
    end if;
  end loop;
  perform public._bump_globaal();
  return json_build_object('ok', true);
end $$;

create or replace function public.root_stand_berekenen(p_dag int) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  if p_dag not between 1 and 2 then raise exception 'ongeldige_dag'; end if;
  delete from public.stand_dag where dag = p_dag;
  insert into public.stand_dag (klas_id, dag, plaats, punten)
  select t.id, p_dag, (rank() over (partition by t.league_id order by t.totaal desc))::smallint, t.totaal
    from (select k.id, k.league_id, coalesce(sum(p.punten), 0)::int as totaal
            from public.klassen k left join public.punten p on p.klas_id = k.id and p.dag <= p_dag group by k.id) t
   where t.totaal > 0;
  perform public._bump_globaal();
  return json_build_object('ok', true);
end $$;

do $do$
declare r record;
begin
  for r in select p.oid::regprocedure as f, p.proname as naam from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
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
end $do$;

-- ======================================================================
-- migratie-v7.sql
-- ======================================================================
-- Aristeia v7: more activity colours (also own hex colours), example roosters (templates) made by Root that class admins can copy
-- parts of, and the class app icon in the public class list (so the app can be installed with the class icon from the class link).
-- Safe to run more than once.
alter table public.activiteiten drop constraint if exists activiteiten_kleur_check;
alter table public.activiteiten add constraint activiteiten_kleur_check check (
  kleur in ('blauw', 'groen', 'amber', 'paars', 'koraal', 'grijs', 'roze', 'turquoise', 'limoen', 'oranje', 'rood', 'indigo', 'bruin', 'goud')
  or kleur ~ '^#[0-9a-fA-F]{6}$');
alter table public.activiteiten add column if not exists sjabloon_item_id uuid;

create table if not exists public.sjablonen (
  id uuid primary key default gen_random_uuid(),
  naam text not null check (length(naam) between 1 and 60),
  beschrijving text not null default '' check (length(beschrijving) <= 300),
  klas_ids uuid[] not null default '{}', -- empty = available to every class
  aangemaakt timestamptz not null default now()
);
create table if not exists public.sjabloon_items (
  id uuid primary key default gen_random_uuid(),
  sjabloon_id uuid not null references public.sjablonen on delete cascade,
  titel text not null check (length(titel) between 1 and 80),
  dag smallint not null check (dag in (1, 2)),
  start time not null,
  eind time not null,
  locatie text not null default '' check (length(locatie) <= 80),
  omschrijving text not null default '' check (length(omschrijving) <= 500),
  kleur text not null default 'blauw' check (
    kleur in ('blauw', 'groen', 'amber', 'paars', 'koraal', 'grijs', 'roze', 'turquoise', 'limoen', 'oranje', 'rood', 'indigo', 'bruin', 'goud')
    or kleur ~ '^#[0-9a-fA-F]{6}$'),
  emoji text check (emoji is null or length(emoji) <= 12),
  check (eind > start)
);
create index if not exists sjabloon_items_sjabloon_idx on public.sjabloon_items (sjabloon_id);
alter table public.sjablonen enable row level security;
alter table public.sjabloon_items enable row level security;
revoke all on public.sjablonen, public.sjabloon_items from anon, authenticated;

create or replace function public._sjabloon_json(p_klas uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', j.id, 'naam', j.naam, 'beschrijving', j.beschrijving, 'klas_ids', to_json(j.klas_ids),
    'items', (select coalesce(json_agg(json_build_object(
        'id', i.id, 'titel', i.titel, 'dag', i.dag, 'start', to_char(i.start, 'HH24:MI'), 'eind', to_char(i.eind, 'HH24:MI'),
        'locatie', i.locatie, 'omschrijving', i.omschrijving, 'kleur', i.kleur, 'emoji', i.emoji,
        'gebruikt', p_klas is not null and exists (select 1 from public.activiteiten a where a.klas_id = p_klas and a.sjabloon_item_id = i.id)
      ) order by i.dag, i.start), '[]'::json) from public.sjabloon_items i where i.sjabloon_id = j.id)
  ) order by j.naam), '[]'::json)
  from public.sjablonen j
  where p_klas is null or cardinality(j.klas_ids) = 0 or p_klas = any (j.klas_ids);
$$;

create or replace function public.root_sjablonen_lijst() returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  return public._sjabloon_json(null);
end $$;

create or replace function public.root_sjabloon_opslaan(p_id uuid, p_naam text, p_beschrijving text, p_klas_ids uuid[]) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public._root();
  if p_id is null then
    insert into public.sjablonen (naam, beschrijving, klas_ids) values (trim(p_naam), coalesce(trim(p_beschrijving), ''), coalesce(p_klas_ids, '{}')) returning id into v_id;
  else
    update public.sjablonen set naam = trim(p_naam), beschrijving = coalesce(trim(p_beschrijving), ''), klas_ids = coalesce(p_klas_ids, '{}') where id = p_id returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;
  return json_build_object('id', v_id);
end $$;

create or replace function public.root_sjabloon_verwijderen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  delete from public.sjablonen where id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.root_sjabloon_item_opslaan(
  p_id uuid, p_sjabloon uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_kleur text, p_emoji text
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public._root();
  if p_id is null then
    insert into public.sjabloon_items (sjabloon_id, titel, dag, start, eind, locatie, omschrijving, kleur, emoji)
    values (p_sjabloon, trim(p_titel), p_dag, p_start::time, p_eind::time, coalesce(trim(p_locatie), ''), coalesce(trim(p_omschrijving), ''),
            coalesce(p_kleur, 'blauw'), nullif(trim(coalesce(p_emoji, '')), '')) returning id into v_id;
  else
    update public.sjabloon_items set titel = trim(p_titel), dag = p_dag, start = p_start::time, eind = p_eind::time,
           locatie = coalesce(trim(p_locatie), ''), omschrijving = coalesce(trim(p_omschrijving), ''),
           kleur = coalesce(p_kleur, 'blauw'), emoji = nullif(trim(coalesce(p_emoji, '')), '')
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;
  return json_build_object('id', v_id);
end $$;

create or replace function public.root_sjabloon_item_verwijderen(p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._root();
  delete from public.sjabloon_items where id = p_id;
  return json_build_object('ok', true);
end $$;

-- class admin: the example roosters meant for their class, and copying chosen parts (without students, or with the whole class)
create or replace function public.sjablonen_voor_klas(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  return public._sjabloon_json(s.klas_id);
end $$;

create or replace function public.sjabloon_gebruiken(p_token text, p_item_ids uuid[], p_iedereen boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; v_nieuw uuid[]; v_max int;
begin
  s := public._beheer(p_token);
  with n as (
    insert into public.activiteiten (klas_id, titel, dag, start, eind, locatie, omschrijving, kleur, emoji, sjabloon_item_id)
    select s.klas_id, i.titel, i.dag, i.start, i.eind, i.locatie, i.omschrijving, i.kleur, i.emoji, i.id
      from public.sjabloon_items i join public.sjablonen j on j.id = i.sjabloon_id
     where i.id = any (coalesce(p_item_ids, '{}'))
       and (cardinality(j.klas_ids) = 0 or s.klas_id = any (j.klas_ids))
       and not exists (select 1 from public.activiteiten a where a.klas_id = s.klas_id and a.sjabloon_item_id = i.id)
    returning id)
  select coalesce(array_agg(id), '{}') into v_nieuw from n;

  select max_activiteiten into v_max from public.instellingen where id = 1;
  if (select count(*) from public.activiteiten where klas_id = s.klas_id) > v_max then raise exception 'limiet_activiteiten'; end if;

  if coalesce(p_iedereen, false) and cardinality(v_nieuw) > 0 then
    insert into public.deelnames (activiteit_id, leerling_id)
    select a, l.id from unnest(v_nieuw) as a, public.leerlingen l where l.klas_id = s.klas_id;
  end if;
  perform public._bump_klas(s.klas_id);
  return json_build_object('toegevoegd', cardinality(v_nieuw));
end $$;

-- the class link can show the class app icon (only the icon path is public, not the nickname or the look)
create or replace function public.start_info() returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'klassen', (select coalesce(json_agg(json_build_object('slug', k.slug, 'naam', k.naam, 'icoon', k.thema ->> 'icoon') order by k.naam), '[]'::json) from public.klassen k),
    'dag1', i.dag1, 'dag2', i.dag2,
    'banner', json_build_object('actief', i.banner_actief, 'titel', i.banner_titel, 'tekst', i.banner_tekst)
  ) from public.instellingen i where i.id = 1;
$$;

do $do$
declare r record;
begin
  for r in select p.oid::regprocedure as f, p.proname as naam from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
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
end $do$;

