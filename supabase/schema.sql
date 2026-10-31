-- Klassenstrijd database. Run this once in the Supabase SQL Editor.
-- Design: nobody talks to the tables directly. RLS is on with no policies,
-- and the app only calls the functions below with a session token.

create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------
create table public.klassen (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$')
);

create table public.klas_wachtwoorden (
  klas_id uuid primary key references public.klassen on delete cascade,
  leerling_hash text not null,
  beheer_hash text not null
);

create table public.leerlingen (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid not null references public.klassen on delete cascade,
  naam text not null check (length(naam) between 1 and 60)
);
create index on public.leerlingen (klas_id);

create table public.sessies (
  token_hash text primary key,
  klas_id uuid not null references public.klassen on delete cascade,
  rol text not null check (rol in ('leerling', 'beheer')),
  leerling_id uuid references public.leerlingen on delete set null,
  aangemaakt timestamptz not null default now()
);

create table public.inlogpogingen (
  id bigint generated always as identity primary key,
  klas_id uuid not null references public.klassen on delete cascade,
  tijdstip timestamptz not null default now()
);
create index on public.inlogpogingen (klas_id, tijdstip);

create table public.activiteiten (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid not null references public.klassen on delete cascade,
  titel text not null check (length(titel) between 1 and 80),
  dag smallint not null check (dag in (1, 2)),
  start time not null,
  eind time not null,
  locatie text not null default '' check (length(locatie) <= 80),
  omschrijving text not null default '' check (length(omschrijving) <= 500),
  check (eind > start)
);
create index on public.activiteiten (klas_id);

create table public.deelnames (
  activiteit_id uuid not null references public.activiteiten on delete cascade,
  leerling_id uuid not null references public.leerlingen on delete cascade,
  primary key (activiteit_id, leerling_id)
);

create table public.mededelingen (
  id uuid primary key default gen_random_uuid(),
  klas_id uuid references public.klassen on delete cascade, -- null = voor iedereen
  titel text not null check (length(titel) between 1 and 80),
  tekst text not null default '' check (length(tekst) <= 1000),
  aangemaakt timestamptz not null default now()
);

-- ---------- lock the tables ----------
alter table public.klassen enable row level security;
alter table public.klas_wachtwoorden enable row level security;
alter table public.leerlingen enable row level security;
alter table public.sessies enable row level security;
alter table public.inlogpogingen enable row level security;
alter table public.activiteiten enable row level security;
alter table public.deelnames enable row level security;
alter table public.mededelingen enable row level security;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ---------- internal helpers (not callable from the app) ----------
create or replace function public._sessie(p_token text)
returns public.sessies
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  select * into s from public.sessies
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then
    raise exception 'sessie_ongeldig' using errcode = '28000';
  end if;
  return s;
end $$;

create or replace function public._beheer(p_token text)
returns public.sessies
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  if s.rol <> 'beheer' then
    raise exception 'geen_rechten' using errcode = '42501';
  end if;
  return s;
end $$;

revoke all on function public._sessie(text) from public, anon, authenticated;
revoke all on function public._beheer(text) from public, anon, authenticated;

-- ---------- login ----------
create or replace function public.klassen_lijst()
returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('slug', slug, 'naam', naam) order by naam), '[]'::json)
  from public.klassen;
$$;

-- Wrong passwords return {fout: ...} instead of raising, so the failed attempt is kept.
create or replace function public.inloggen(p_slug text, p_wachtwoord text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare k public.klassen; w public.klas_wachtwoorden; r text; t text;
begin
  select * into k from public.klassen where slug = lower(trim(p_slug));
  if not found then
    return json_build_object('fout', 'onbekende_klas');
  end if;

  delete from public.inlogpogingen where tijdstip < now() - interval '1 day';
  if (select count(*) from public.inlogpogingen
       where klas_id = k.id and tijdstip > now() - interval '10 minutes') >= 30 then
    return json_build_object('fout', 'te_veel_pogingen');
  end if;

  select * into w from public.klas_wachtwoorden where klas_id = k.id;
  if w.beheer_hash = crypt(trim(p_wachtwoord), w.beheer_hash) then
    r := 'beheer';
  elsif w.leerling_hash = crypt(trim(p_wachtwoord), w.leerling_hash) then
    r := 'leerling';
  else
    insert into public.inlogpogingen (klas_id) values (k.id);
    return json_build_object('fout', 'fout_wachtwoord');
  end if;

  t := encode(gen_random_bytes(24), 'hex');
  insert into public.sessies (token_hash, klas_id, rol)
  values (encode(digest(t, 'sha256'), 'hex'), k.id, r);

  return json_build_object('token', t, 'rol', r, 'klas', json_build_object('naam', k.naam));
end $$;

create or replace function public.mijn_sessie(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  return json_build_object(
    'rol', s.rol,
    'leerling_id', s.leerling_id,
    'klas', (select json_build_object('naam', k.naam) from public.klassen k where k.id = s.klas_id)
  );
end $$;

create or replace function public.uitloggen(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.sessies where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return json_build_object('ok', true);
end $$;

-- ---------- leerlingen (iedereen in de klas) ----------
create or replace function public.leerlingen_van_klas(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  return (select coalesce(json_agg(json_build_object('id', l.id, 'naam', l.naam) order by l.naam), '[]'::json)
          from public.leerlingen l where l.klas_id = s.klas_id);
end $$;

create or replace function public.kies_leerling(p_token text, p_leerling_id uuid)
returns json
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

create or replace function public.rooster_van(p_token text, p_leerling_id uuid)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  return (
    select coalesce(json_agg(json_build_object(
      'id', a.id, 'titel', a.titel, 'dag', a.dag,
      'start', to_char(a.start, 'HH24:MI'), 'eind', to_char(a.eind, 'HH24:MI'),
      'locatie', a.locatie, 'omschrijving', a.omschrijving
    ) order by a.dag, a.start), '[]'::json)
    from public.deelnames d
    join public.activiteiten a on a.id = d.activiteit_id
    join public.leerlingen l on l.id = d.leerling_id
    where d.leerling_id = p_leerling_id
      and l.klas_id = s.klas_id and a.klas_id = s.klas_id
  );
end $$;

-- ---------- mededelingen ----------
create or replace function public.mededelingen_lijst(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._sessie(p_token);
  return (
    select coalesce(json_agg(q.x order by q.sorteer desc), '[]'::json) from (
      select m.aangemaakt as sorteer,
             json_build_object(
               'id', m.id, 'titel', m.titel, 'tekst', m.tekst,
               'globaal', m.klas_id is null,
               'tijd', to_char(m.aangemaakt at time zone 'Europe/Amsterdam', 'DD-MM HH24:MI')
             ) as x
      from public.mededelingen m
      where m.klas_id is null or m.klas_id = s.klas_id
      order by m.aangemaakt desc limit 50
    ) q
  );
end $$;

-- ---------- beheer (alleen met het beheerderswachtwoord van de klas) ----------
create or replace function public.activiteiten_van_klas(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  return (
    select coalesce(json_agg(json_build_object(
      'id', a.id, 'titel', a.titel, 'dag', a.dag,
      'start', to_char(a.start, 'HH24:MI'), 'eind', to_char(a.eind, 'HH24:MI'),
      'locatie', a.locatie, 'omschrijving', a.omschrijving,
      'leerlingen', coalesce((select json_agg(d.leerling_id) from public.deelnames d where d.activiteit_id = a.id), '[]'::json)
    ) order by a.dag, a.start), '[]'::json)
    from public.activiteiten a where a.klas_id = s.klas_id
  );
end $$;

create or replace function public.activiteit_opslaan(
  p_token text, p_id uuid, p_titel text, p_dag int, p_start text, p_eind text,
  p_locatie text, p_omschrijving text, p_leerlingen uuid[]
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; v_id uuid;
begin
  s := public._beheer(p_token);
  if p_id is null then
    insert into public.activiteiten (klas_id, titel, dag, start, eind, locatie, omschrijving)
    values (s.klas_id, trim(p_titel), p_dag, p_start::time, p_eind::time,
            coalesce(trim(p_locatie), ''), coalesce(trim(p_omschrijving), ''))
    returning id into v_id;
  else
    update public.activiteiten
       set titel = trim(p_titel), dag = p_dag, start = p_start::time, eind = p_eind::time,
           locatie = coalesce(trim(p_locatie), ''), omschrijving = coalesce(trim(p_omschrijving), '')
     where id = p_id and klas_id = s.klas_id
    returning id into v_id;
    if v_id is null then raise exception 'niet_gevonden'; end if;
  end if;

  delete from public.deelnames where activiteit_id = v_id;
  insert into public.deelnames (activiteit_id, leerling_id)
  select v_id, l.id from public.leerlingen l
   where l.klas_id = s.klas_id and l.id = any (coalesce(p_leerlingen, '{}'));

  return json_build_object('id', v_id);
end $$;

create or replace function public.activiteit_verwijderen(p_token text, p_id uuid)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  delete from public.activiteiten where id = p_id and klas_id = s.klas_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.leerlingen_toevoegen(p_token text, p_namen text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies; n int;
begin
  s := public._beheer(p_token);
  insert into public.leerlingen (klas_id, naam)
  select s.klas_id, left(trim(x), 60)
    from unnest(string_to_array(replace(coalesce(p_namen, ''), E'\r', ''), E'\n')) as x
   where length(trim(x)) > 0;
  get diagnostics n = row_count;
  return json_build_object('toegevoegd', n);
end $$;

create or replace function public.leerling_verwijderen(p_token text, p_id uuid)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  delete from public.leerlingen where id = p_id and klas_id = s.klas_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.mededeling_plaatsen(p_token text, p_titel text, p_tekst text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  insert into public.mededelingen (klas_id, titel, tekst)
  values (s.klas_id, trim(p_titel), coalesce(trim(p_tekst), ''));
  return json_build_object('ok', true);
end $$;

create or replace function public.mededeling_verwijderen(p_token text, p_id uuid)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessies;
begin
  s := public._beheer(p_token);
  delete from public.mededelingen where id = p_id and klas_id = s.klas_id;
  return json_build_object('ok', true);
end $$;

-- ---------- Root: klas aanmaken (alleen via de SQL Editor, niet via de app) ----------
create or replace function public.maak_klas(
  p_naam text, p_slug text, p_leerlingwachtwoord text, p_beheerwachtwoord text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if p_leerlingwachtwoord = p_beheerwachtwoord then
    raise exception 'wachtwoorden moeten verschillen';
  end if;
  insert into public.klassen (naam, slug) values (p_naam, lower(p_slug)) returning id into v_id;
  insert into public.klas_wachtwoorden (klas_id, leerling_hash, beheer_hash)
  values (v_id, crypt(trim(p_leerlingwachtwoord), gen_salt('bf')), crypt(trim(p_beheerwachtwoord), gen_salt('bf')));
  return v_id;
end $$;

revoke all on function public.maak_klas(text, text, text, text) from public, anon, authenticated;
