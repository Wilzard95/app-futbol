-- Run only in a test transaction. All temporary accounts, games and votes roll back.
begin;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','sports-test1@example.invalid',now(),now(),now(),false),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','sports-test2@example.invalid',now(),now(),now(),false),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','sports-test3@example.invalid',now(),now(),now(),false),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','sports-test4@example.invalid',now(),now(),now(),false);
insert into app_private.player(id,name,number,position) values ('test-rating-1','Test1','1','Volante'),('test-rating-2','Test2','2','Volante'),('test-rating-3','Test3','3','Volante');
insert into app_private.member(user_id,role,player_id) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','admin','test-rating-1'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','player','test-rating-2'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','player','test-rating-3');
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',true);
do $$ declare t uuid; t5 uuid; t11 uuid; m uuid; e uuid; yellow_match uuid; yellow_event uuid; begin
 t:=public.sports_create_tournament('Test',6::smallint);
 perform public.sports_enroll_player(t,p) from unnest(array['test-rating-1','test-rating-2','p1','p2','p3','p4','p5','p6']) p;
 m:=public.sports_create_match(t,'Test',current_date,1::smallint,0::smallint,array['test-rating-1','test-rating-2']);
 perform public.sports_add_event(m,'test-rating-1','goal','');
 begin perform public.rating_submit(m,'test-rating-1',7,'[]','',null); raise exception 'closed rating accepted'; exception when raise_exception then if sqlerrm<>'Las valoraciones aún no están abiertas o el partido está cerrado' then raise; end if; end;
 perform public.sports_open_ratings(m);
 perform set_config('test.tournament',t::text,true); perform set_config('test.match',m::text,true);
 select (e1->>'id')::uuid into e from jsonb_array_elements((select g->'events' from jsonb_array_elements(public.sports_data()->'matches') g where g->>'id'=m::text)) e1;
 perform set_config('test.event',e::text,true);
 perform public.rating_submit(m,'test-rating-1',7,jsonb_build_array(jsonb_build_object('eventId',e,'value',1)),'Bien','approve');
 perform public.rating_submit(m,'test-rating-1',7,jsonb_build_array(jsonb_build_object('eventId',e,'value',1)),'Bien','approve');
 yellow_match:=public.sports_create_match(t,'Amarilla',current_date,0::smallint,0::smallint,array['test-rating-1','test-rating-2']);
 perform public.sports_add_event(yellow_match,'test-rating-1','yellow_card','');
 perform public.sports_open_ratings(yellow_match);
 select (e1->>'id')::uuid into yellow_event from jsonb_array_elements((select g->'events' from jsonb_array_elements(public.sports_data()->'matches') g where g->>'id'=yellow_match::text)) e1;
 perform set_config('test.yellow_match',yellow_match::text,true); perform set_config('test.yellow_event',yellow_event::text,true);
 perform public.rating_submit(yellow_match,'test-rating-1',7,jsonb_build_array(jsonb_build_object('eventId',yellow_event,'value',0)),'',null);
 begin perform public.sports_add_event(m,'test-rating-1','assist',''); raise exception 'changed after vote'; exception when raise_exception then if sqlerrm<>'El partido ya tiene valoraciones; no se pueden cambiar las acciones' then raise; end if; end;
 perform public.lineup_submit(t,'f6-2-2-1','{"gk":"p3","row-0-0":"p4","row-0-1":"p6","row-1-0":"p2","row-1-1":"p5","row-2-0":"p1"}');
 perform public.lineup_submit(t,'f6-2-2-1','{"gk":"p3","row-0-0":"p4","row-0-1":"p6","row-1-0":"p2","row-1-1":"p5","row-2-0":"p1"}');
 t5:=public.sports_create_tournament('Test 5',5::smallint);
 perform public.sports_enroll_player(t5,p) from unnest(array['test-rating-1','p1','p2','p3','p4','p6']) p;
 perform public.lineup_submit(t5,'f5-2-2','{"gk":"p3","row-0-0":"p4","row-0-1":"p6","row-1-0":"p2","row-1-1":"p1"}');
 t11:=public.sports_create_tournament('Test 11',11::smallint);
 perform public.sports_enroll_player(t11,p) from unnest(array['test-rating-1','test-rating-2','test-rating-3','p1','p2','p3','p4','p5','p6','p7','p8']) p;
 perform public.lineup_submit(t11,'f11-4-3-3','{"gk":"p3","row-0-0":"p4","row-0-1":"p6","row-0-2":"p2","row-0-3":"p5","row-1-0":"p1","row-1-1":"p7","row-1-2":"p8","row-2-0":"test-rating-1","row-2-1":"test-rating-2","row-2-2":"test-rating-3"}');
 begin perform public.lineup_submit(t5,'f6-2-2-1','{}'); raise exception 'wrong format accepted'; exception when raise_exception then if sqlerrm<>'Formación inválida para el torneo' then raise; end if; end;
 if jsonb_array_length(public.account_context(null)->'linkedAccounts')<2 then raise exception 'admin cannot review linked accounts'; end if;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',true);
do $$ declare r jsonb; begin
 if jsonb_array_length(public.account_context(null)->'linkedAccounts')<>0 then raise exception 'linked account emails leaked'; end if;
 perform public.rating_submit(current_setting('test.match')::uuid,'test-rating-1',9,'[]','Buen trabajo',null);
 perform public.rating_submit(current_setting('test.yellow_match')::uuid,'test-rating-1',7,jsonb_build_array(jsonb_build_object('eventId',current_setting('test.yellow_event'),'value',0.1)),'',null);
 if (public.rating_results(current_setting('test.yellow_match')::uuid)->0->>'average')::numeric<>7.05 then raise exception 'independent yellow-card adjustments failed'; end if;
 r:=public.rating_results(current_setting('test.match')::uuid);
 if (r->0->>'average')::numeric<>8.5 or (r->0->>'count')::int<>2 or r::text like '%bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1%' then raise exception 'aggregate privacy or arithmetic failed'; end if;
 begin perform public.rating_submit(current_setting('test.match')::uuid,'test-rating-1',7,jsonb_build_array(jsonb_build_object('eventId',current_setting('test.event'),'value',2)),'',null); raise exception 'bad adjustment accepted'; exception when raise_exception then if sqlerrm<>'Ajuste fuera de rango' then raise; end if; end;
 perform public.lineup_submit(current_setting('test.tournament')::uuid,'f6-2-2-1','{"gk":"p1","row-0-0":"p4","row-0-1":"p6","row-1-0":"p2","row-1-1":"p5","row-2-0":"p3"}');
 r:=public.lineup_data(current_setting('test.tournament')::uuid);
 if jsonb_array_length(r->'proposals')<>2 or r::text like '%bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1%' or (r->'averages'->>'test-rating-1')::numeric<>7.775 then raise exception 'lineup privacy or average failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',true);
do $$ begin
 begin perform public.rating_submit(current_setting('test.match')::uuid,'test-rating-1',7,'[]','',null); raise exception 'outsider accepted'; exception when raise_exception then if sqlerrm<>'Solo participantes pueden valorar' then raise; end if; end;
 if has_table_privilege('authenticated','app_private.rating_ballot','select') or has_function_privilege('anon','public.rating_results(uuid)','execute') then raise exception 'direct private access'; end if;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',true);
select public.account_unlink('test-rating-1');
select public.account_unlink('test-rating-2');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',true);
select public.account_request('test-rating-1',null);
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',true);
select public.account_decide('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',true);
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',true);
do $$ begin
 begin perform public.rating_submit(current_setting('test.match')::uuid,'test-rating-1',7,'[]','',null); raise exception 'duplicate player rating accepted'; exception when raise_exception then if sqlerrm<>'Esta ficha ya tiene una valoración previa de otra cuenta' then raise; end if; end;
 begin perform public.lineup_submit(current_setting('test.tournament')::uuid,'f6-2-2-1','{"gk":"p3","row-0-0":"p4","row-0-1":"p6","row-1-0":"p2","row-1-1":"p5","row-2-0":"p1"}'); raise exception 'duplicate player lineup accepted'; exception when raise_exception then if sqlerrm<>'Esta ficha ya tiene una propuesta previa de otra cuenta' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',true);
do $$ begin
 begin perform public.sports_data(); raise exception 'outsider could view team'; exception when raise_exception then if sqlerrm<>'Sin acceso al equipo' then raise; end if; end;
 begin perform public.sports_add_player('Test','99','Volante'); raise exception 'outsider could add players'; exception when raise_exception then if sqlerrm<>'Solo el administrador puede agregar jugadores' then raise; end if; end;
end $$;
rollback;
