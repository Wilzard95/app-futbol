insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
('af000000-0000-4000-8000-000000000001','retire-owner@example.test',now(),now(),now(),false),
('af000000-0000-4000-8000-000000000002','retire-player@example.test',now(),now(),now(),false),
('af000000-0000-4000-8000-000000000003','retire-outsider@example.test',now(),now(),now(),false);
select set_config('request.jwt.claim.sub','af000000-0000-4000-8000-000000000001',true);
select set_config('test.retire_team',public.multi_create_team('Equipo de prueba'),true);
select set_config('test.retire_tournament',public.multi_create_tournament(current_setting('test.retire_team'),'Torneo',6::smallint)::text,true);
select set_config('test.retire_player',public.multi_create_roster_player(current_setting('test.retire_team'),current_setting('test.retire_tournament')::uuid,'Jugador','9','Delantero'),true);
select set_config('test.retire_match',public.multi_create_match(current_setting('test.retire_team'),current_setting('test.retire_tournament')::uuid,'Rival',current_date,1::smallint,0::smallint,array[current_setting('test.retire_player')])::text,true);
insert into app_private.multi_membership(team_id,user_id,role,player_id) values(current_setting('test.retire_team'),'af000000-0000-4000-8000-000000000002','player',current_setting('test.retire_player'));
select set_config('request.jwt.claim.sub','af000000-0000-4000-8000-000000000003',true);
do $$ begin
 begin perform public.multi_retire_team_player(current_setting('test.retire_team'),current_setting('test.retire_player')); raise exception 'Unauthorized removal accepted'; exception when others then if sqlerrm='Unauthorized removal accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','af000000-0000-4000-8000-000000000001',true);
select public.multi_retire_team_player(current_setting('test.retire_team'),current_setting('test.retire_player'));
do $$ begin
 if exists(select 1 from app_private.multi_roster where player_id=current_setting('test.retire_player')) then raise exception 'Still enrolled'; end if;
 if not exists(select 1 from app_private.multi_participant where match_id=current_setting('test.retire_match')::uuid and player_id=current_setting('test.retire_player')) then raise exception 'History removed'; end if;
 if exists(select 1 from app_private.multi_membership where team_id=current_setting('test.retire_team') and user_id='af000000-0000-4000-8000-000000000002' and active) then raise exception 'Membership still active'; end if;
 if exists(select 1 from jsonb_array_elements(public.multi_account_context(current_setting('test.retire_team'),null)->'players') p where p->>'id'=current_setting('test.retire_player')) then raise exception 'Retired profile offered for claims'; end if;
 begin perform public.multi_enroll_player(current_setting('test.retire_team'),current_setting('test.retire_tournament')::uuid,current_setting('test.retire_player')); raise exception 'Retired player re-enrolled'; exception when others then if sqlerrm='Retired player re-enrolled' then raise; end if; end;
end $$;

