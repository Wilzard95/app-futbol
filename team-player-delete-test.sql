insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
('af100000-0000-4000-8000-000000000001','delete-player-owner@example.test',now(),now(),now(),false),
('af100000-0000-4000-8000-000000000002','delete-player-other@example.test',now(),now(),now(),false);
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000001',true);
select set_config('test.del_team',public.multi_create_team('Equipo prueba'),true);
select set_config('test.del_tournament',public.multi_create_tournament(current_setting('test.del_team'),'Torneo',6::smallint)::text,true);
select set_config('test.del_player',public.multi_create_roster_player(current_setting('test.del_team'),current_setting('test.del_tournament')::uuid,'Sin historial','9','Delantero'),true);
select set_config('test.del_history',public.multi_create_roster_player(current_setting('test.del_team'),current_setting('test.del_tournament')::uuid,'Con historial','10','Volante'),true);
select public.multi_create_match(current_setting('test.del_team'),current_setting('test.del_tournament')::uuid,'Rival',current_date,1::smallint,0::smallint,array[current_setting('test.del_history')]);
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.multi_delete_unused_player(current_setting('test.del_team'),current_setting('test.del_player')); raise exception 'Unauthorized deletion accepted'; exception when others then if sqlerrm='Unauthorized deletion accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','af100000-0000-4000-8000-000000000001',true);
do $$ begin
 begin perform public.multi_delete_unused_player(current_setting('test.del_team'),current_setting('test.del_history')); raise exception 'History deletion accepted'; exception when others then if sqlerrm='History deletion accepted' then raise; end if; end;
end $$;
insert into app_private.multi_lineup(tournament_id,author_user_id,author_player_id,formation_id,picks) values(current_setting('test.del_tournament')::uuid,'af100000-0000-4000-8000-000000000001',current_setting('test.del_history'),'f6-2-3',jsonb_build_object('gk',current_setting('test.del_player')));
do $$ begin
 begin perform public.multi_delete_unused_player(current_setting('test.del_team'),current_setting('test.del_player')); raise exception 'Lineup history deletion accepted'; exception when others then if sqlerrm='Lineup history deletion accepted' then raise; end if; end;
end $$;
delete from app_private.multi_lineup where tournament_id=current_setting('test.del_tournament')::uuid;
select public.multi_retire_team_player(current_setting('test.del_team'),current_setting('test.del_player'));
select public.multi_delete_unused_player(current_setting('test.del_team'),current_setting('test.del_player'));
do $$ begin
 if exists(select 1 from app_private.multi_player where id=current_setting('test.del_player')) then raise exception 'Profile not deleted'; end if;
 if not exists(select 1 from app_private.multi_player where id=current_setting('test.del_history')) then raise exception 'Historical profile deleted'; end if;
end $$;

