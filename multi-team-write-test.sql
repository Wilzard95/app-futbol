-- Test with all multi-team drafts in one transaction, then roll back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('ffffffff-ffff-4fff-8fff-fffffffffff1','multi-write-admin@example.invalid',now(),now(),now(),false),
 ('ffffffff-ffff-4fff-8fff-fffffffffff2','multi-write-player@example.invalid',now(),now(),now(),false),
 ('ffffffff-ffff-4fff-8fff-fffffffffff3','multi-write-other@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-fffffffffff1',true);
select set_config('test.write_team',app_private.multi_create_team('Equipo test'),true);
select set_config('test.write_tournament',app_private.multi_create_tournament(current_setting('test.write_team'),'Torneo',6::smallint)::text,true);
select set_config('test.write_player',app_private.multi_create_roster_player(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid,'Jugador','9','Delantero'),true);
select set_config('test.write_match',app_private.multi_create_match(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid,'Rival',current_date,1::smallint,0::smallint,array[current_setting('test.write_player')])::text,true);
select app_private.multi_add_event(current_setting('test.write_team'),current_setting('test.write_match')::uuid,current_setting('test.write_player'),'goal','');
select app_private.multi_open_ratings(current_setting('test.write_team'),current_setting('test.write_match')::uuid);
select app_private.multi_create_roster_player(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid,'Dos','2','Defensa');
select app_private.multi_create_roster_player(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid,'Tres','3','Defensa');
select app_private.multi_create_roster_player(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid,'Cuatro','4','Volante');
select app_private.multi_create_roster_player(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid,'Cinco','5','Volante');
select app_private.multi_create_roster_player(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid,'Seis','6','Portero');
reset role;
insert into app_private.multi_membership(team_id,user_id,role,player_id) values(current_setting('test.write_team'),'ffffffff-ffff-4fff-8fff-fffffffffff2','player',current_setting('test.write_player'));
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-fffffffffff2',true);
select app_private.multi_rating_submit(current_setting('test.write_match')::uuid,current_setting('test.write_player'),7,'[]','',null,current_setting('test.write_team'));
do $$ declare d jsonb; begin
 d:=app_private.multi_rating_results(current_setting('test.write_team'),current_setting('test.write_match')::uuid);
 if (d->0->>'average')::numeric<>7 or d::text like '%ffffffff-ffff-4fff-8fff-fffffffffff2%' then raise exception 'Rating result failed'; end if;
end $$;
do $$ declare picks jsonb; begin
 select jsonb_object_agg(slot,player_id) into picks from (
  select (array['gk','row-0-0','row-0-1','row-1-0','row-1-1','row-2-0'])[row_number() over(order by p->>'id')] slot,p->>'id' player_id
  from jsonb_array_elements(app_private.multi_sports_data(current_setting('test.write_team'))->'players') p) x;
 perform app_private.multi_lineup_submit(current_setting('test.write_tournament')::uuid,'f6-2-2-1',picks,current_setting('test.write_team'));
 if jsonb_array_length(app_private.multi_lineup_data(current_setting('test.write_team'),current_setting('test.write_tournament')::uuid)->'proposals')<>1 then raise exception 'Lineup not saved'; end if;
end $$;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-fffffffffff3',true);
do $$ begin
 begin perform app_private.multi_add_player(current_setting('test.write_team'),'Intruso','2','Defensa'); raise exception 'Intruder write accepted'; exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
 begin perform app_private.multi_rating_results(current_setting('test.write_team'),current_setting('test.write_match')::uuid); raise exception 'Intruder read accepted'; exception when raise_exception then if sqlerrm<>'Sin acceso a este equipo' then raise; end if; end;
end $$;
