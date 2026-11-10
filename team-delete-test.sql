-- Execute after team-delete.sql inside a transaction and roll back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('abeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','delete-owner@example.invalid',now(),now(),now(),false),
 ('abeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','delete-helper@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','abeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',true);
select set_config('test.delete_a',public.multi_create_team('Equipo a eliminar'),true);
select set_config('test.delete_b',public.multi_create_team('Equipo a conservar'),true);
select set_config('test.delete_t',public.multi_create_tournament(current_setting('test.delete_a'),'Torneo',6::smallint)::text,true);
select set_config('test.delete_p',public.multi_create_roster_player(current_setting('test.delete_a'),current_setting('test.delete_t')::uuid,'Jugador','9','Delantero'),true);
select set_config('test.delete_m',public.multi_create_match(current_setting('test.delete_a'),current_setting('test.delete_t')::uuid,'Rival',current_date,1::smallint,0::smallint,array[current_setting('test.delete_p')])::text,true);
select public.multi_add_event(current_setting('test.delete_a'),current_setting('test.delete_m')::uuid,current_setting('test.delete_p'),'goal','');
select public.multi_open_ratings(current_setting('test.delete_a'),current_setting('test.delete_m')::uuid);
reset role;
insert into app_private.multi_membership(team_id,user_id,role,player_id) values(current_setting('test.delete_a'),'abeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','admin',current_setting('test.delete_p'));
set local role authenticated;
select set_config('request.jwt.claim.sub','abeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',true);
select public.multi_rating_submit(current_setting('test.delete_m')::uuid,current_setting('test.delete_p'),8,'[]','Comentario',null,current_setting('test.delete_a'));
do $$ begin
 begin perform public.multi_delete_team(current_setting('test.delete_a'),'Equipo a eliminar'); raise exception 'Other admin deleted team'; exception when raise_exception then if sqlerrm<>'Solo el creador puede eliminar este equipo' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','abeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',true);
do $$ begin
 begin perform public.multi_delete_team(current_setting('test.delete_a'),'otro nombre'); raise exception 'Incorrect confirmation accepted'; exception when raise_exception then if sqlerrm<>'El nombre de confirmación no coincide' then raise; end if; end;
end $$;
select public.multi_delete_team(current_setting('test.delete_a'),'Equipo a eliminar');
reset role;
do $$ begin
 if exists(select 1 from app_private.multi_team where id=current_setting('test.delete_a')) or exists(select 1 from app_private.multi_player where team_id=current_setting('test.delete_a')) or exists(select 1 from app_private.multi_tournament where team_id=current_setting('test.delete_a')) or exists(select 1 from app_private.multi_ballot where match_id=current_setting('test.delete_m')::uuid) then raise exception 'Team data remains'; end if;
 if not exists(select 1 from app_private.multi_team where id=current_setting('test.delete_b')) or not exists(select 1 from auth.users where id='abeeeeee-eeee-4eee-8eee-eeeeeeeeeee2') then raise exception 'Other team or user removed'; end if;
end $$;
