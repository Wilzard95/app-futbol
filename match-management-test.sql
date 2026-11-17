insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
('a2100000-0000-4000-8000-000000000001','match-test-owner@example.test',now(),now(),now(),false),
('a2100000-0000-4000-8000-000000000002','match-test-other@example.test',now(),now(),now(),false);
select set_config('request.jwt.claim.sub','a2100000-0000-4000-8000-000000000001',true);
select set_config('test.m_team',public.multi_create_team('Equipo partido prueba'),true);
select set_config('test.m_tournament',public.multi_create_tournament(current_setting('test.m_team'),'Torneo',6::smallint)::text,true);
select set_config('test.m_p1',public.multi_create_roster_player(current_setting('test.m_team'),current_setting('test.m_tournament')::uuid,'Jugador uno','1','Volante'),true);
select set_config('test.m_p2',public.multi_create_roster_player(current_setting('test.m_team'),current_setting('test.m_tournament')::uuid,'Jugador dos','2','Defensa'),true);
select set_config('test.m_match',public.multi_create_match(current_setting('test.m_team'),current_setting('test.m_tournament')::uuid,'Rival',current_date,2::smallint,0::smallint,array[current_setting('test.m_p1'),current_setting('test.m_p2')])::text,true);
select public.multi_add_event(current_setting('test.m_team'),current_setting('test.m_match')::uuid,current_setting('test.m_p1'),'goal','');
select set_config('test.m_event',(select id::text from app_private.multi_event where match_id=current_setting('test.m_match')::uuid),true);
insert into app_private.multi_ballot(match_id,author_user_id,author_player_id,target_player_id,base_score,final_score,adjustments,comment) values(current_setting('test.m_match')::uuid,'a2100000-0000-4000-8000-000000000001',current_setting('test.m_p2'),current_setting('test.m_p1'),6,7,jsonb_build_array(jsonb_build_object('eventId',current_setting('test.m_event'),'value',1)),'test');
do $$ begin
 begin perform public.multi_edit_match(current_setting('test.m_team'),current_setting('test.m_match')::uuid,'Rival',current_date,1::smallint,0::smallint,array[current_setting('test.m_p1')]); raise exception 'Participant with votes removed'; exception when others then if sqlerrm='Participant with votes removed' then raise; end if; end;
end $$;
select public.multi_edit_match_event(current_setting('test.m_team'),current_setting('test.m_match')::uuid,current_setting('test.m_event')::uuid,current_setting('test.m_p1'),'yellow_card','Corregida',false);
do $$ begin if not exists(select 1 from app_private.multi_ballot where match_id=current_setting('test.m_match')::uuid and final_score=6 and adjustments='[]'::jsonb) then raise exception 'Event adjustment not reset'; end if; end $$;
select public.multi_add_event(current_setting('test.m_team'),current_setting('test.m_match')::uuid,current_setting('test.m_p1'),'assist','');
select public.multi_edit_match(current_setting('test.m_team'),current_setting('test.m_match')::uuid,'Otro rival',current_date,3::smallint,1::smallint,array[current_setting('test.m_p1'),current_setting('test.m_p2')]);
select set_config('request.jwt.claim.sub','a2100000-0000-4000-8000-000000000002',true);
do $$ begin begin perform public.multi_delete_match(current_setting('test.m_team'),current_setting('test.m_match')::uuid,'Otro rival'); raise exception 'Unauthorized delete'; exception when others then if sqlerrm='Unauthorized delete' then raise; end if; end; end $$;
select set_config('request.jwt.claim.sub','a2100000-0000-4000-8000-000000000001',true);
select public.multi_delete_match(current_setting('test.m_team'),current_setting('test.m_match')::uuid,'Otro rival');
do $$ begin if exists(select 1 from app_private.multi_match where id=current_setting('test.m_match')::uuid) or exists(select 1 from app_private.multi_ballot where match_id=current_setting('test.m_match')::uuid) then raise exception 'Match deletion incomplete'; end if; end $$;

