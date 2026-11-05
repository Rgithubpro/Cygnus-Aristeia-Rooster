-- Klassenstrijd v5: leagues, day-by-day standings and complete class themes.
-- Run after migratie-v4.sql. Safe to run again.

alter table public.klassen
  add column if not exists competitie text not null default 'Algemeen';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.klassen'::regclass
       and conname = 'klassen_competitie_lengte'
  ) then
    alter table public.klassen add constraint klassen_competitie_lengte
      check (length(trim(competitie)) between 1 and 40);
  end if;
end $$;

create or replace function public._klas_thema_opslaan(
  p_klas uuid, p_weergavenaam text, p_thema jsonb, p_strikt boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_accent text;
  v_achtergrond text;
  v_kaart text;
  v_tekst text;
  v_emoji text;
  v_slogan text;
  v_logo text;
  v_banner text;
  v_banner_tekst text;
  v_layout text;
  v_decoratie text;
  v_toon_rooster boolean;
  v_toon_info boolean;
  v_toon_stand boolean;
begin
  v_accent := nullif(trim(coalesce(p_thema ->> 'accent', '')), '');
  v_achtergrond := nullif(trim(coalesce(p_thema ->> 'achtergrond', '')), '');
  v_kaart := nullif(trim(coalesce(p_thema ->> 'kaart', '')), '');
  v_tekst := nullif(trim(coalesce(p_thema ->> 'tekst', '')), '');
  if (v_accent is not null and v_accent !~ '^#[0-9a-fA-F]{6}$')
     or (v_achtergrond is not null and v_achtergrond !~ '^#[0-9a-fA-F]{6}$')
     or (v_kaart is not null and v_kaart !~ '^#[0-9a-fA-F]{6}$')
     or (v_tekst is not null and v_tekst !~ '^#[0-9a-fA-F]{6}$') then
    raise exception 'ongeldige_kleur';
  end if;

  v_emoji := nullif(trim(coalesce(p_thema ->> 'emoji', '')), '');
  if v_emoji is not null and length(v_emoji) > 12 then raise exception 'ongeldige_emoji'; end if;
  v_slogan := nullif(left(trim(coalesce(p_thema ->> 'slogan', '')), 60), '');
  v_logo := nullif(trim(coalesce(p_thema ->> 'logo', '')), '');
  v_banner := nullif(trim(coalesce(p_thema ->> 'banner', '')), '');
  v_banner_tekst := nullif(left(trim(coalesce(p_thema ->> 'bannerTekst', '')), 200), '');
  if v_logo is not null then
    if v_logo !~ '^([0-9a-f-]{36}/)?[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$' then raise exception 'ongeldig_pad'; end if;
    if p_strikt and v_logo not like (p_klas::text || '/%') then raise exception 'ongeldig_pad'; end if;
  end if;
  if v_banner is not null then
    if v_banner !~ '^([0-9a-f-]{36}/)?[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$' then raise exception 'ongeldig_pad'; end if;
    if p_strikt and v_banner not like (p_klas::text || '/%') then raise exception 'ongeldig_pad'; end if;
  end if;

  v_layout := coalesce(nullif(p_thema ->> 'layout', ''), 'standaard');
  if v_layout not in ('standaard', 'compact', 'breed') then raise exception 'ongeldige_indeling'; end if;
  v_decoratie := coalesce(nullif(p_thema ->> 'decoratie', ''), 'geen');
  if v_decoratie not in ('geen', '✨', '🎉', '🌿', '🏆') then raise exception 'ongeldige_versiering'; end if;
  v_toon_rooster := coalesce(nullif(p_thema ->> 'toonRooster', '')::boolean, true);
  v_toon_info := coalesce(nullif(p_thema ->> 'toonInfo', '')::boolean, true);
  v_toon_stand := coalesce(nullif(p_thema ->> 'toonStand', '')::boolean, true);
  if not (v_toon_rooster or v_toon_info or v_toon_stand) then raise exception 'minstens_een_onderdeel'; end if;

  update public.klassen
     set weergavenaam = nullif(left(trim(coalesce(p_weergavenaam, '')), 40), ''),
         thema = jsonb_strip_nulls(jsonb_build_object(
           'accent', v_accent,
           'achtergrond', v_achtergrond,
           'kaart', v_kaart,
           'tekst', v_tekst,
           'emoji', v_emoji,
           'slogan', v_slogan,
           'logo', v_logo,
           'banner', v_banner,
           'bannerTekst', v_banner_tekst,
           'layout', v_layout,
           'decoratie', v_decoratie,
           'toonRooster', v_toon_rooster,
           'toonInfo', v_toon_info,
           'toonStand', v_toon_stand
         ))
   where id = p_klas;
  if not found then raise exception 'niet_gevonden'; end if;
  perform public._bump_klas(p_klas);
end $$;

create or replace function public.root_klas_competitie_opslaan(p_id uuid, p_competitie text) returns json
language plpgsql security definer set search_path = public as $$
declare v_competitie text := coalesce(nullif(trim(p_competitie), ''), 'Algemeen');
begin
  perform public._root();
  if length(v_competitie) > 40 then raise exception 'competitie_te_lang'; end if;
  update public.klassen set competitie = v_competitie where id = p_id;
  if not found then raise exception 'niet_gevonden'; end if;
  perform public._bump_klas(p_id);
  perform public._bump_globaal();
  return json_build_object('ok', true);
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
      select coalesce(json_agg(json_build_object(
        'klas', q.label, 'emoji', q.emoji, 'competitie', q.competitie,
        'punten', q.totaal, 'positie', q.pos, 'eigen', q.id = s.klas_id
      ) order by q.competitie, q.pos, q.label), '[]'::json)
      from (
        select q0.*,
               rank() over (partition by q0.competitie order by q0.totaal desc) as pos
          from (
            select k.id, coalesce(k.weergavenaam, k.naam) as label, k.thema ->> 'emoji' as emoji,
                   coalesce(nullif(k.competitie, ''), 'Algemeen') as competitie,
                   coalesce(sum(p.punten), 0) as totaal
              from public.klassen k
              left join public.punten p on p.klas_id = k.id and p.dag <= v_tot
             group by k.id, k.naam, k.weergavenaam, k.thema, k.competitie
          ) q0
      ) q
      where v_tot > 1 or q.pos <= 2
    ),
    'onderdelen', case when v_tot = 1 then '[]'::json else (
      select coalesce(json_agg(json_build_object('dag', o.dag, 'onderdeel', o.onderdeel, 'resultaten', o.res)
                               order by o.dag, o.onderdeel), '[]'::json)
        from (
          select q.dag, q.onderdeel,
                 json_agg(json_build_object(
                   'klas', q.label, 'emoji', q.emoji, 'competitie', q.competitie,
                   'punten', q.punten, 'positie', q.pos, 'eigen', q.id = s.klas_id
                 ) order by q.competitie, q.pos, q.label) as res
            from (
              select p.dag, p.onderdeel, k.id,
                     coalesce(k.weergavenaam, k.naam) as label, k.thema ->> 'emoji' as emoji,
                     coalesce(nullif(k.competitie, ''), 'Algemeen') as competitie,
                     p.punten,
                     rank() over (
                       partition by p.dag, p.onderdeel, coalesce(nullif(k.competitie, ''), 'Algemeen')
                       order by p.punten desc
                     ) as pos
                from public.punten p join public.klassen k on k.id = p.klas_id
               where p.dag <= v_tot
            ) q
           group by q.dag, q.onderdeel
        ) o
    ) end
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
        'id', k.id, 'naam', k.naam, 'slug', k.slug, 'competitie', k.competitie,
        'weergavenaam', k.weergavenaam, 'thema', k.thema,
        'leerlingen', (select count(*) from public.leerlingen l where l.klas_id = k.id),
        'gekoppeld', (select count(distinct z.leerling_id) from public.sessies z where z.klas_id = k.id and z.leerling_id is not null),
        'meldingen', (select count(distinct p.leerling_id) from public.push_abonnementen p join public.leerlingen l on l.id = p.leerling_id where l.klas_id = k.id),
        'activiteiten', (select count(*) from public.activiteiten a where a.klas_id = k.id),
        'laatst_gezien', (select max(z.laatst_gezien) from public.sessies z where z.klas_id = k.id)
      ) order by k.naam), '[]'::json) from public.klassen k)
  );
end $$;

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
