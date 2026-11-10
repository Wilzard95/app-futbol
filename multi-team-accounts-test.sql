-- Run after both multi-team drafts in a transaction that is rolled back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','admin-one@example.invalid',now(),now(),now(),false),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','admin-two@example.invalid',now(),now(),now(),false),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3','player@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',true);
select set_config('test.team_a',app_private.multi_create_team('Equipo A'),true);
select set_config('test.invite_a',app_private.multi_new_invite(current_setting('test.team_a')),true);
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',true);
select set_config('test.team_b',app_private.multi_create_team('Equipo B'),true);
select set_config('test.invite_b',app_private.multi_new_invite(current_setting('test.team_b')),true);
do $$ begin
 begin perform app_private.multi_new_invite(current_setting('test.team_a')); raise exception 'foreign admin accepted';
 exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
 begin perform app_private.multi_decide_claim(current_setting('test.team_a'),'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',true); raise exception 'foreign approval accepted';
 exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
end $$;
reset role;
insert into app_private.multi_player(id,team_id,name,number,position) values
 ('multi-account-a',current_setting('test.team_a'),'Jugador A','1','Volante'),
 ('multi-account-b',current_setting('test.team_b'),'Jugador B','2','Defensa');
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc3',true);
do $$ begin
 if app_private.multi_invite_info(current_setting('test.invite_a'))->>'teamName'<>'Equipo A' then raise exception 'incorrect invitation team'; end if;
 begin perform app_private.multi_account_context(current_setting('test.team_a'),null); raise exception 'outsider access accepted';
 exception when raise_exception then if sqlerrm<>'Sin acceso a este equipo' then raise; end if; end;
 begin perform app_private.multi_request_player(current_setting('test.team_a'),'multi-account-b',current_setting('test.invite_a')); raise exception 'foreign player accepted';
 exception when raise_exception then if sqlerrm<>'Jugador inválido' then raise; end if; end;
 begin perform app_private.multi_request_player(current_setting('test.team_b'),'multi-account-b',current_setting('test.invite_a')); raise exception 'foreign invite accepted';
 exception when raise_exception then if sqlerrm<>'Invitación inválida o vencida' then raise; end if; end;
 perform app_private.multi_request_player(current_setting('test.team_a'),'multi-account-a',current_setting('test.invite_a'));
 perform app_private.multi_request_player(current_setting('test.team_b'),'multi-account-b',current_setting('test.invite_b'));
end $$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',true);
select app_private.multi_decide_claim(current_setting('test.team_a'),'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',true);
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',true);
select app_private.multi_decide_claim(current_setting('test.team_b'),'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',true);
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc3',true);
do $$ begin
 if jsonb_array_length(app_private.multi_my_teams())<>2 then raise exception 'independent memberships failed'; end if;
 if jsonb_array_length(app_private.multi_account_context(current_setting('test.team_a'),null)->'linkedAccounts')<>0 then raise exception 'player can see emails'; end if;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',true);
select app_private.multi_unlink_player(current_setting('test.team_a'),'multi-account-a',true);
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc3',true);
do $$ begin
 if jsonb_array_length(app_private.multi_my_teams())<>1 or app_private.multi_my_teams()->0->>'id'<>current_setting('test.team_b') then raise exception 'removing one team affected other membership'; end if;
 begin perform app_private.multi_account_context(current_setting('test.team_a'),current_setting('test.invite_a')); raise exception 'revoked user accepted';
 exception when raise_exception then if sqlerrm<>'Sin acceso a este equipo' then raise; end if; end;
 begin perform app_private.multi_invite_info(current_setting('test.invite_a')); raise exception 'revoked user can read invitation';
 exception when raise_exception then if sqlerrm<>'Invitación inválida o vencida' then raise; end if; end;
end $$;
