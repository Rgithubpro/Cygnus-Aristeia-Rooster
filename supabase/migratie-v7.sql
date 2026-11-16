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
