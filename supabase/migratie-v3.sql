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
