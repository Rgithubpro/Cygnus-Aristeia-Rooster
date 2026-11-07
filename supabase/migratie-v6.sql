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