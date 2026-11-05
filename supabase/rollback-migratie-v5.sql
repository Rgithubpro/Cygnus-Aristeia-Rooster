-- Roll back migratie-v5.sql after it was applied on top of migratie-v4.sql.
-- WARNING: dropping competitie permanently removes values entered since v5.
-- This does not undo other application data changes made after v5.

begin;

drop function if exists public.root_klas_competitie_opslaan(uuid, text);

alter table public.klassen
  drop constraint if exists klassen_competitie_lengte;

alter table public.klassen
  drop column if exists competitie;

create or replace function public._klas_thema_opslaan(
  p_klas uuid, p_weergavenaam text, p_thema jsonb, p_strikt boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_accent text;
  v_emoji text;
  v_slogan text;
  v_logo text;
begin
  v_accent := nullif(trim(coalesce(p_thema ->> 'accent', '')), '');
  if v_accent is not null and v_accent !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'ongeldige_kleur';
  end if;
  v_emoji := nullif(trim(coalesce(p_thema ->> 'emoji', '')), '');
  if v_emoji is not null and length(v_emoji) > 12 then
    raise exception 'ongeldige_emoji';
  end if;
  v_slogan := nullif(left(trim(coalesce(p_thema ->> 'slogan', '')), 60), '');
  v_logo := nullif(trim(coalesce(p_thema ->> 'logo', '')), '');
  if v_logo is not null then
    if v_logo !~ '^([0-9a-f-]{36}/)?[a-zA-Z0-9_-]{1,60}\.(jpg|png|webp)$' then
      raise exception 'ongeldig_pad';
    end if;
    if p_strikt and v_logo not like (p_klas::text || '/%') then
      raise exception 'ongeldig_pad';
    end if;
  end if;
  update public.klassen
     set weergavenaam = nullif(left(trim(coalesce(p_weergavenaam, '')), 40), ''),
         thema = jsonb_strip_nulls(jsonb_build_object(
           'accent', v_accent, 'emoji', v_emoji, 'slogan', v_slogan, 'logo', v_logo
         ))
   where id = p_klas;
  perform public._bump_klas(p_klas);
end $$;

create or replace function public.stand(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.sessies;
  v_tot smallint;
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
        'klas', q.label, 'emoji', q.emoji, 'punten', q.totaal, 'positie', q.pos, 'eigen', q.id = s.klas_id
      ) order by q.pos, q.label), '[]'::json)
        from (
          select k.id, coalesce(k.weergavenaam, k.naam) as label, k.thema ->> 'emoji' as emoji,
                 coalesce(sum(p.punten), 0) as totaal,
                 rank() over (order by coalesce(sum(p.punten), 0) desc) as pos
            from public.klassen k
            left join public.punten p on p.klas_id = k.id and p.dag <= v_tot
           group by k.id
        ) q
    ),
    'onderdelen', (
      select coalesce(json_agg(json_build_object(
        'dag', o.dag, 'onderdeel', o.onderdeel, 'resultaten', o.res
      ) order by o.dag, o.onderdeel), '[]'::json)
        from (
          select p.dag, p.onderdeel,
                 json_agg(json_build_object(
                   'klas', coalesce(k.weergavenaam, k.naam), 'emoji', k.thema ->> 'emoji',
                   'punten', p.punten, 'eigen', k.id = s.klas_id
                 ) order by p.punten desc, k.naam) as res
            from public.punten p
            join public.klassen k on k.id = p.klas_id
           where p.dag <= v_tot
           group by p.dag, p.onderdeel
        ) o
    )
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
        'meldingen', (select count(distinct p.leerling_id) from public.push_abonnementen p
                      join public.leerlingen l on l.id = p.leerling_id where l.klas_id = k.id),
        'activiteiten', (select count(*) from public.activiteiten a where a.klas_id = k.id),
        'laatst_gezien', (select max(z.laatst_gezien) from public.sessies z where z.klas_id = k.id)
      ) order by k.naam), '[]'::json)
        from public.klassen k
    )
  );
end $$;

commit;
