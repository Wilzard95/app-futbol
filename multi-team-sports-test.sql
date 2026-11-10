-- Run after multi-team-foundation.sql and multi-team-sports.sql, then roll back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','sports-multi-a@example.invalid',now(),now(),now(),false),
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2','sports-multi-b@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-ddddddddddd1',true);
select set_config('test.sports_a',app_private.multi_create_team('Equipo deportes A'),true);
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-ddddddddddd2',true);
select set_config('test.sports_b',app_private.multi_create_team('Equipo deportes B'),true);
reset role;
do $$ begin
 if (select count(*) from app_private.multi_tournament where team_id='combo')<>(select count(*) from app_private.tournament where team_id='combo')
 or (select count(*) from app_private.multi_match where tournament_id in (select id from app_private.multi_tournament where team_id='combo'))<>(select count(*) from app_private.match where tournament_id in (select id from app_private.tournament where team_id='combo'))
 or (select count(*) from app_private.multi_event)<>(select count(*) from app_private.match_event e join app_private.match g on g.id=e.match_id join app_private.tournament t on t.id=g.tournament_id where t.team_id='combo')
 then raise exception 'Existing sports data did not copy completely'; end if;
end $$;
insert into app_private.multi_player(id,team_id,name,number,position) values
 ('sports-multi-a',current_setting('test.sports_a'),'Jugador A','1','Volante'),
 ('sports-multi-b',current_setting('test.sports_b'),'Jugador B','2','Volante');
insert into app_private.multi_tournament(id,team_id,name,format) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddd01',current_setting('test.sports_a'),'Torneo A',6),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddd02',current_setting('test.sports_b'),'Torneo B',6);
insert into app_private.multi_roster values ('dddddddd-dddd-4ddd-8ddd-dddddddddd01','sports-multi-a'),('dddddddd-dddd-4ddd-8ddd-dddddddddd02','sports-multi-b');
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-ddddddddddd1',true);
do $$ declare d jsonb; begin
 d:=app_private.multi_sports_data(current_setting('test.sports_a'));
 if jsonb_array_length(d->'players')<>1 or d->'players'->0->>'name'<>'Jugador A' or jsonb_array_length(d->'tournaments')<>1 or d::text like '%Jugador B%' or d::text like '%Torneo B%' then raise exception 'Team data leaked'; end if;
 begin perform app_private.multi_sports_data(current_setting('test.sports_b')); raise exception 'Foreign team access accepted';
 exception when raise_exception then if sqlerrm<>'Sin acceso a este equipo' then raise; end if; end;
 if has_table_privilege('authenticated','app_private.multi_match','select') then raise exception 'Match table exposed'; end if;
end $$;
