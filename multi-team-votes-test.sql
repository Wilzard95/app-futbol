-- Run after the foundation, sports and votes drafts, and roll back.
do $$ begin
 if (select count(*) from app_private.multi_ballot)<>(select count(*) from app_private.rating_ballot b join app_private.match g on g.id=b.match_id join app_private.tournament t on t.id=g.tournament_id where t.team_id='combo') then raise exception 'Ballots did not copy completely'; end if;
 if (select count(*) from app_private.multi_lineup)<>(select count(*) from app_private.lineup_proposal l join app_private.tournament t on t.id=l.tournament_id where t.team_id='combo') then raise exception 'Lineups did not copy completely'; end if;
end $$;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','votes-multi-a@example.invalid',now(),now(),now(),false),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','votes-multi-b@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',true);
select set_config('test.votes_a',app_private.multi_create_team('Equipo A'),true);
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',true);
select set_config('test.votes_b',app_private.multi_create_team('Equipo B'),true);
reset role;
insert into app_private.multi_tournament(id,team_id,name,format) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',current_setting('test.votes_b'),'Torneo B',6);
insert into app_private.multi_match(id,tournament_id,opponent,goals_for,goals_against,ratings_closed,ratings_open) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02','eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01','Rival',1,0,false,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',true);
do $$ begin
 begin perform app_private.multi_lineup_data(current_setting('test.votes_a'),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'); raise exception 'Foreign lineup leaked';
 exception when raise_exception then if sqlerrm<>'Torneo inválido' then raise; end if; end;
 begin perform app_private.multi_rating_results(current_setting('test.votes_a'),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'); raise exception 'Foreign ratings leaked';
 exception when raise_exception then if sqlerrm<>'Partido inválido' then raise; end if; end;
 if has_table_privilege('authenticated','app_private.multi_ballot','select') or has_table_privilege('authenticated','app_private.multi_lineup','select') then raise exception 'Private votes exposed'; end if;
end $$;
