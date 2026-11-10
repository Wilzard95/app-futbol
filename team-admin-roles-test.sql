-- Run after team-admin-roles.sql in a transaction that is rolled back.
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
 ('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','role-owner@example.invalid',now(),now(),now(),false),
 ('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','role-player@example.invalid',now(),now(),now(),false),
 ('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','role-outsider@example.invalid',now(),now(),now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
select set_config('test.role_team',public.multi_create_team('Permisos prueba'),true);
select set_config('test.role_player',public.multi_add_player(current_setting('test.role_team'),'Jugador','10','Volante'),true);
reset role;
insert into app_private.multi_membership(team_id,user_id,role,player_id) values(current_setting('test.role_team'),'a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','player',current_setting('test.role_player'));
set local role authenticated;
select set_config('request.jwt.claim.sub','a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
do $$ begin
 begin perform public.multi_create_tournament(current_setting('test.role_team'),'No permitido',6::smallint); raise exception 'Player can create tournament'; exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
 begin perform public.multi_team_roles(current_setting('test.role_team')); raise exception 'Player can list roles'; exception when raise_exception then if sqlerrm<>'Solo el creador puede gestionar administradores' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
select public.multi_set_admin(current_setting('test.role_team'),'a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
select set_config('request.jwt.claim.sub','a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
select public.multi_create_tournament(current_setting('test.role_team'),'Permitido',6::smallint);
do $$ begin
 begin perform public.multi_set_admin(current_setting('test.role_team'),'a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true); raise exception 'Delegate can grant role'; exception when raise_exception then if sqlerrm<>'Solo el creador puede gestionar administradores' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
select public.multi_set_admin(current_setting('test.role_team'),'a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',false);
do $$ begin
 begin perform public.multi_set_admin(current_setting('test.role_team'),'a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',false); raise exception 'Owner can demote self'; exception when raise_exception then if sqlerrm<>'No puedes cambiar el rol del creador' then raise; end if; end;
 begin perform public.multi_set_admin(current_setting('test.role_team'),'a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true); raise exception 'Outsider granted role'; exception when raise_exception then if sqlerrm<>'Cuenta vinculada no encontrada en este equipo' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
do $$ begin
 begin perform public.multi_create_tournament(current_setting('test.role_team'),'Denegado',6::smallint); raise exception 'Demotion did not work'; exception when raise_exception then if sqlerrm<>'Sin permiso para administrar este equipo' then raise; end if; end;
end $$;
