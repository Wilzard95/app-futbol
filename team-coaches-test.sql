insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
('ad000000-0000-4000-8000-000000000001','coach-owner@example.test',now(),now(),now(),false),
('ad000000-0000-4000-8000-000000000002','coach-user@example.test',now(),now(),now(),false);
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select set_config('test.coach_team',public.multi_create_team('Equipo entrenadores'),true);
select set_config('test.coach_invite',app_private.multi_new_invite(current_setting('test.coach_team')),true);
select set_config('test.coach_id',public.multi_coach_create(current_setting('test.coach_team'),'Entrenador')::text,true);
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
select public.multi_coach_request(current_setting('test.coach_team'),current_setting('test.coach_id')::uuid,current_setting('test.coach_invite'));
do $$ begin
 begin perform public.multi_coach_decide(current_setting('test.coach_team'),'ad000000-0000-4000-8000-000000000002',true); raise exception 'Non-owner approved coach';
 exception when others then if sqlerrm='Non-owner approved coach' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select public.multi_coach_decide(current_setting('test.coach_team'),'ad000000-0000-4000-8000-000000000002',true);
do $$ begin
 if not exists(select 1 from app_private.multi_membership where team_id=current_setting('test.coach_team') and user_id='ad000000-0000-4000-8000-000000000002' and role='admin' and active and player_id is null) then raise exception 'Coach was not granted admin without player'; end if;
 perform public.multi_coach_unlink(current_setting('test.coach_team'),current_setting('test.coach_id')::uuid);
 if exists(select 1 from app_private.multi_membership where team_id=current_setting('test.coach_team') and user_id='ad000000-0000-4000-8000-000000000002' and active) then raise exception 'Coach access not revoked'; end if;
end $$;

