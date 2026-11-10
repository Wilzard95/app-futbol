-- Preserve each existing team creator, and allow only that creator to manage administrators.
alter table app_private.multi_team add column owner_user_id uuid references auth.users(id);
do $$ begin
 if exists(select 1 from app_private.multi_team t where (select count(*) from app_private.multi_membership m where m.team_id=t.id and m.active and m.role='admin')<>1) then
   raise exception 'No se puede determinar de forma inequívoca el creador de cada equipo';
 end if;
end $$;
update app_private.multi_team t set owner_user_id=(select m.user_id from app_private.multi_membership m where m.team_id=t.id and m.active and m.role='admin');
alter table app_private.multi_team alter column owner_user_id set not null;

create or replace function app_private.multi_create_team(team_name text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.multi_verified_user(); team_id text := gen_random_uuid()::text;
begin
 if team_name is null or length(trim(team_name)) not between 1 and 100 then raise exception 'Nombre de equipo inválido'; end if;
 insert into app_private.multi_team(id,name,owner_user_id) values(team_id,trim(team_name),uid);
 insert into app_private.multi_membership(team_id,user_id,role) values(team_id,uid,'admin');
 return team_id;
end $$;

create function app_private.multi_team_roles(team text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); result jsonb;
begin
 if not exists(select 1 from app_private.multi_team t where t.id=$1 and t.owner_user_id=uid and exists(select 1 from app_private.multi_membership m where m.team_id=t.id and m.user_id=uid and m.active and m.role='admin')) then raise exception 'Solo el creador puede gestionar administradores'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'playerId',m.player_id,'name',p.name,'number',p.number,'email',u.email,'role',m.role,'owner',m.user_id=uid) order by p.name,u.email),'[]'::jsonb)
 into result from app_private.multi_membership m join auth.users u on u.id=m.user_id left join app_private.multi_player p on p.id=m.player_id and p.team_id=m.team_id where m.team_id=$1 and m.active;
 return result;
end $$;

create function app_private.multi_set_admin(team text,member_user uuid,make_admin boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user();
begin
 if not exists(select 1 from app_private.multi_team t where t.id=$1 and t.owner_user_id=uid and exists(select 1 from app_private.multi_membership m where m.team_id=t.id and m.user_id=uid and m.active and m.role='admin')) then raise exception 'Solo el creador puede gestionar administradores'; end if;
 if $2=uid then raise exception 'No puedes cambiar el rol del creador'; end if;
 if $3 is null then raise exception 'Rol inválido'; end if;
 update app_private.multi_membership set role=case when $3 then 'admin' else 'player' end where team_id=$1 and user_id=$2 and active and player_id is not null;
 if not found then raise exception 'Cuenta vinculada no encontrada en este equipo'; end if;
end $$;
revoke all on function app_private.multi_team_roles(text),app_private.multi_set_admin(text,uuid,boolean) from public,anon,authenticated;
grant execute on function app_private.multi_team_roles(text),app_private.multi_set_admin(text,uuid,boolean) to authenticated;
create function public.multi_team_roles(team text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_team_roles(team) $$;
create function public.multi_set_admin(team text,member_user uuid,make_admin boolean) returns void language sql security invoker set search_path='' as $$ select app_private.multi_set_admin(team,member_user,make_admin) $$;
revoke all on function public.multi_team_roles(text),public.multi_set_admin(text,uuid,boolean) from public,anon;
grant execute on function public.multi_team_roles(text),public.multi_set_admin(text,uuid,boolean) to authenticated;
