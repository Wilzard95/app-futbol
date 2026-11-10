-- Execute inside a transaction and roll back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('bbbbbbbb-aaaa-4aaa-8aaa-aaaaaaaaaaa1','visual-admin@example.invalid',now(),now(),now(),false),
 ('bbbbbbbb-aaaa-4aaa-8aaa-aaaaaaaaaaa2','visual-player@example.invalid',now(),now(),now(),false),
 ('bbbbbbbb-aaaa-4aaa-8aaa-aaaaaaaaaaa3','visual-outside@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
select set_config('test.visual_team',public.multi_create_team('Visual test'),true);
select set_config('test.visual_tournament',public.multi_create_tournament(current_setting('test.visual_team'),'Test',6::smallint)::text,true);
select set_config('test.visual_player',public.multi_create_roster_player(current_setting('test.visual_team'),current_setting('test.visual_tournament')::uuid,'Test','1','Volante'),true);
select public.multi_set_crest(current_setting('test.visual_team'),'data:image/jpeg;base64,YQ==');
reset role;
insert into app_private.multi_membership(team_id,user_id,role,player_id) values(current_setting('test.visual_team'),'bbbbbbbb-aaaa-4aaa-8aaa-aaaaaaaaaaa2','player',current_setting('test.visual_player'));
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
select public.multi_set_profile_visuals(current_setting('test.visual_team'),'data:image/jpeg;base64,YQ==','{"skin":"#d99568","hair":"#241811","shirt":"#17623e","style":"short"}');
select public.multi_set_profile_visuals(current_setting('test.visual_team'),'data:image/jpeg;base64,YQ==','{"skin":"#d99568","hair":"#241811","shirt":"#ef7a27","style":"curly","usePhoto":false,"photoX":0.5,"photoY":-0.5}');
do $$ declare d jsonb; begin
 d:=public.multi_visuals(current_setting('test.visual_team'));
 if d->>'crest'<>'data:image/jpeg;base64,YQ==' or d->'players'->current_setting('test.visual_player')->'avatar'->>'style'<>'curly' or (d->'players'->current_setting('test.visual_player')->'avatar'->>'usePhoto')::boolean then raise exception 'Visuals not saved'; end if;
 begin perform public.multi_set_crest(current_setting('test.visual_team'),null); raise exception 'Non-admin changed crest'; exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
 begin perform public.multi_set_profile_visuals(current_setting('test.visual_team'),null,'{"skin":null,"hair":"#241811","shirt":"#17623e","style":"short"}'); raise exception 'Invalid avatar accepted'; exception when raise_exception then if sqlerrm<>'Avatar inválido' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true);
do $$ begin
 begin perform public.multi_visuals(current_setting('test.visual_team')); raise exception 'Outsider accessed visuals'; exception when raise_exception then if sqlerrm<>'Sin acceso a este equipo' then raise; end if; end;
 begin perform public.multi_set_profile_visuals(current_setting('test.visual_team'),null,null); raise exception 'Outsider changed profile'; exception when raise_exception then if sqlerrm<>'Necesitas una ficha vinculada' then raise; end if; end;
end $$;
