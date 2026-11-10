-- Run after multi-team-foundation.sql inside a transaction that is rolled back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','multi-test-one@example.invalid',now(),now(),now(),false),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','multi-test-two@example.invalid',now(),now(),now(),false),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','multi-unverified@example.invalid',null,now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
do $$ declare team text; teams jsonb; begin
  if app_private.multi_my_teams() <> '[]'::jsonb then raise exception 'Unrelated teams are visible'; end if;
  team:=app_private.multi_create_team('  Equipo de prueba  ');
  teams:=app_private.multi_my_teams();
  if jsonb_array_length(teams)<>1 or teams->0->>'id'<>team or teams->0->>'name'<>'Equipo de prueba' or teams->0->>'role'<>'admin' then
    raise exception 'Creator is not team admin';
  end if;
  perform set_config('test.multi_team',team,true);
  begin perform app_private.multi_create_team('   '); raise exception 'Empty team accepted';
  exception when raise_exception then if sqlerrm<>'Nombre de equipo inválido' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
do $$ begin
  if app_private.multi_my_teams() <> '[]'::jsonb then raise exception 'Another user can list this team'; end if;
  if has_table_privilege('authenticated','app_private.multi_membership','select') then raise exception 'Membership table exposed'; end if;
end $$;
reset role;
insert into app_private.multi_team(id,name) values ('test-second-team','Segundo equipo');
insert into app_private.multi_player(id,team_id,name,number,position) values ('multi-test-player','test-second-team','Prueba','1','Volante');
insert into app_private.multi_membership(team_id,user_id,role,player_id) values
 ('test-second-team','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','player','multi-test-player');
do $$ begin
  begin
    insert into app_private.multi_membership(team_id,user_id,role,player_id)
    values (current_setting('test.multi_team'),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','player','multi-test-player');
    raise exception 'Cross-team player accepted';
  exception when foreign_key_violation then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
do $$ begin
  if jsonb_array_length(app_private.multi_my_teams())<>2 then raise exception 'Same account cannot join multiple teams'; end if;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true);
do $$ begin
  begin perform app_private.multi_create_team('Test'); raise exception 'Unverified user accepted';
  exception when raise_exception then if sqlerrm<>'Debes verificar tu correo' then raise; end if; end;
end $$;
