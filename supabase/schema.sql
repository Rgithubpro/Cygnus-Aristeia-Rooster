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
