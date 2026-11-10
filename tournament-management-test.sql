-- Execute after both tournament functions, in a transaction that is rolled back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','tourney-admin@example.invalid',now(),now(),now(),false),
 ('acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','tourney-player@example.invalid',now(),now(),now(),false),
 ('acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','tourney-outsider@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
select set_config('test.t_team',public.multi_create_team('Equipo prueba torneos'),true);
select set_config('test.t_a',public.multi_create_tournament(current_setting('test.t_team'),'Torneo A',6::smallint)::text,true);
select set_config('test.t_b',public.multi_create_tournament(current_setting('test.t_team'),'Torneo B',6::smallint)::text,true);
select set_config('test.t_player',public.multi_create_roster_player(current_setting('test.t_team'),current_setting('test.t_a')::uuid,'Jugador','9','Delantero'),true);
select public.multi_enroll_player(current_setting('test.t_team'),current_setting('test.t_b')::uuid,current_setting('test.t_player'));
select set_config('test.t_match',public.multi_create_match(current_setting('test.t_team'),current_setting('test.t_a')::uuid,'Rival',current_date,1::smallint,0::smallint,array[current_setting('test.t_player')])::text,true);
select public.multi_add_event(current_setting('test.t_team'),current_setting('test.t_match')::uuid,current_setting('test.t_player'),'goal','');
select public.multi_open_ratings(current_setting('test.t_team'),current_setting('test.t_match')::uuid);
reset role;
insert into app_private.multi_membership(team_id,user_id,role,player_id) values(current_setting('test.t_team'),'acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','player',current_setting('test.t_player'));
insert into app_private.multi_lineup(id,tournament_id,author_user_id,author_player_id,formation_id,picks) values('acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99',current_setting('test.t_a')::uuid,'acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',current_setting('test.t_player'),'f6-2-2-1','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
select public.multi_rating_submit(current_setting('test.t_match')::uuid,current_setting('test.t_player'),8,'[]','Bien',null,current_setting('test.t_team'));
do $$ begin
 begin perform public.multi_unenroll_player(current_setting('test.t_team'),current_setting('test.t_a')::uuid,current_setting('test.t_player')); raise exception 'Player removed roster'; exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
 begin perform public.multi_delete_tournament(current_setting('test.t_team'),current_setting('test.t_a')::uuid,'Torneo A'); raise exception 'Player deleted tournament'; exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','acaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
select public.multi_unenroll_player(current_setting('test.t_team'),current_setting('test.t_a')::uuid,current_setting('test.t_player'));
do $$ declare data jsonb; begin
 data:=public.multi_sports_data(current_setting('test.t_team'));
 if data->'roster'->current_setting('test.t_a') is not null or jsonb_array_length(data->'matches')<>1 or jsonb_array_length(public.multi_rating_results(current_setting('test.t_team'),current_setting('test.t_match')::uuid))<>1 or jsonb_array_length(public.multi_lineup_data(current_setting('test.t_team'),current_setting('test.t_a')::uuid)->'proposals')<>1 then raise exception 'Historical records lost'; end if;
 if not ((data->'roster'->current_setting('test.t_b')) ? current_setting('test.t_player')) then raise exception 'Other tournament roster changed'; end if;
 begin perform public.multi_create_match(current_setting('test.t_team'),current_setting('test.t_a')::uuid,'Rival',current_date,0::smallint,0::smallint,array[current_setting('test.t_player')]); raise exception 'Removed player added to match'; exception when raise_exception then if sqlerrm<>'Participantes inválidos' then raise; end if; end;
 begin perform public.multi_delete_tournament(current_setting('test.t_team'),current_setting('test.t_a')::uuid,'Error'); raise exception 'Wrong confirmation accepted'; exception when raise_exception then if sqlerrm<>'El nombre de confirmación no coincide' then raise; end if; end;
end $$;
select public.multi_delete_tournament(current_setting('test.t_team'),current_setting('test.t_a')::uuid,'Torneo A');
reset role;
do $$ begin
 if exists(select 1 from app_private.multi_tournament where id=current_setting('test.t_a')::uuid) or exists(select 1 from app_private.multi_match where id=current_setting('test.t_match')::uuid) or exists(select 1 from app_private.multi_ballot where match_id=current_setting('test.t_match')::uuid) or exists(select 1 from app_private.multi_lineup where tournament_id=current_setting('test.t_a')::uuid) then raise exception 'Deleted tournament data remains'; end if;
 if not exists(select 1 from app_private.multi_player where id=current_setting('test.t_player')) or not exists(select 1 from app_private.multi_membership where player_id=current_setting('test.t_player')) or not exists(select 1 from app_private.multi_roster where tournament_id=current_setting('test.t_b')::uuid and player_id=current_setting('test.t_player')) then raise exception 'Player or other tournament affected'; end if;
end $$;
