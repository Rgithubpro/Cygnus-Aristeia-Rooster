-- Klassenstrijd v5: leagues + new standings, and full per-class customization (theme + class page).
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
