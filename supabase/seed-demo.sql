-- Demo class for testing. DELETE it before real use:  delete from public.klassen where slug = 'demo';
-- Link: /k/demo   Leerling password: leerling-demo   Beheer password: beheer-demo
select public.maak_klas('Demo', 'demo', 'leerling-demo', 'beheer-demo');

insert into public.leerlingen (klas_id, naam)
select k.id, n from public.klassen k, unnest(array['Anna de Vries', 'Bram Jansen', 'Chloë Bakker', 'Daan Visser']) as n
where k.slug = 'demo';

with k as (select id from public.klassen where slug = 'demo'),
a as (
  insert into public.activiteiten (klas_id, titel, dag, start, eind, locatie, omschrijving)
  select k.id, v.titel, v.dag, v.start::time, v.eind::time, v.locatie, v.omschrijving
  from k, (values
    ('Voetbal', 1, '10:00', '10:45', 'Veld 2', 'Poule A tegen 3B'),
    ('Estafette', 1, '13:00', '13:30', 'Atletiekbaan', '')
  ) as v(titel, dag, start, eind, locatie, omschrijving)
  returning id, titel
)
insert into public.deelnames (activiteit_id, leerling_id)
select a.id, l.id
from a join public.leerlingen l on l.klas_id = (select id from k)
where (a.titel = 'Voetbal' and l.naam in ('Anna de Vries', 'Bram Jansen'))
   or (a.titel = 'Estafette' and l.naam in ('Anna de Vries', 'Chloë Bakker', 'Daan Visser'));
