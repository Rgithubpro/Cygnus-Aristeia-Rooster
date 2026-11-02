-- Demo data for testing (run AFTER schema.sql and migratie-v3.sql). Remove before real use:  delete from public.klassen where slug in ('demo', 'demo2');
-- Demo   (/k/demo):   leerling-demo  /  beheer-demo
-- Demo 2 (/k/demo2):  leerling-demo2 /  beheer-demo2
update public.instellingen set dag1 = current_date, dag2 = current_date + 1 where id = 1;

select public._maak_klas('Demo', 'demo', 'leerling-demo', 'beheer-demo');
select public._maak_klas('Demo 2', 'demo2', 'leerling-demo2', 'beheer-demo2');

select public._leerlingen_toevoegen(id, E'Anna de Vries\nBram Jansen\nChloë Bakker\nDaan Visser') from public.klassen where slug = 'demo';
select public._leerlingen_toevoegen(id, E'Eva Mulder\nFinn Smit\nGijs de Boer') from public.klassen where slug = 'demo2';

select public._activiteit_opslaan(null, null, 'Opening', 1, '09:00', '09:30', 'Aula', 'Welkom bij de klassenstrijd!', 'paars', '🎉', '{}');
select public._activiteit_opslaan(null, null, 'Prijsuitreiking', 2, '15:00', '15:45', 'Aula', '', 'amber', '🏆', '{}');

select public._activiteit_opslaan(k.id, null, 'Voetbal', 1, '10:00', '10:45', 'Veld 2', 'Poule A', 'groen', '⚽',
         array(select id from public.leerlingen where klas_id = k.id and naam in ('Anna de Vries', 'Bram Jansen')))
  from public.klassen k where k.slug = 'demo';
select public._activiteit_opslaan(k.id, null, 'Estafette', 1, '13:00', '13:30', 'Atletiekbaan', '', 'koraal', null,
         array(select id from public.leerlingen where klas_id = k.id and naam in ('Anna de Vries', 'Chloë Bakker', 'Daan Visser')))
  from public.klassen k where k.slug = 'demo';

select public._dagbericht_zetten(null, 1, '08:45 aanwezig zijn in de aula');

insert into public.berichten (klas_id, titel, tekst)
values (null, 'Welkom!', E'Dit is een testbericht voor iedereen.\nMeer info: https://example.com');

insert into public.punten (klas_id, dag, onderdeel, punten)
select id, 1, 'Voetbal', case slug when 'demo' then 10 else 7 end from public.klassen where slug in ('demo', 'demo2');
