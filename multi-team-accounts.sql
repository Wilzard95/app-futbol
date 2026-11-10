-- Draft only: apply with multi-team-foundation.sql in a rolled-back test.
-- Legacy RPCs are still single-team and must be replaced before deployment.
create table app_private.multi_invitation (
  team_id text primary key references app_private.multi_team(id),
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create table app_private.multi_claim (
  team_id text not null references app_private.multi_team(id),
  user_id uuid not null references auth.users(id),
  player_id text not null,
  created_at timestamptz not null default now(),
  primary key (team_id,user_id),
  foreign key (team_id,player_id) references app_private.multi_player(team_id,id)
);
alter table app_private.multi_invitation enable row level security;
alter table app_private.multi_claim enable row level security;
revoke all on app_private.multi_invitation,app_private.multi_claim from public,anon,authenticated;
insert into app_private.multi_invitation(team_id,token,expires_at)
select id,invite,invite_expires_at from app_private.team where id='combo';
insert into app_private.multi_claim(team_id,user_id,player_id,created_at)
select 'combo',user_id,player_id,created_at from app_private.claim;

create function app_private.multi_init_invitation() returns trigger language plpgsql set search_path='' as $$
begin
 insert into app_private.multi_invitation(team_id) values(new.id);
 return new;
end $$;
create trigger multi_team_invitation after insert on app_private.multi_team for each row execute function app_private.multi_init_invitation();

create function app_private.multi_admin(team text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user();
begin
 if not exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and m.active and m.role='admin') then raise exception 'Sin permiso para administrar este equipo'; end if;
 return uid;
end $$;

create function app_private.multi_new_invite(team text) returns text
language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 perform app_private.multi_admin($1);
 insert into app_private.multi_invitation(team_id,token,expires_at) values($1,token,now()+interval '7 days')
 on conflict(team_id) do update set token=excluded.token,expires_at=excluded.expires_at;
 return token::text;
end $$;

create function app_private.multi_invite_info(invite_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); result jsonb;
begin
 select jsonb_build_object('teamId',t.id,'teamName',t.name,
  'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position,
   'occupied',exists(select 1 from app_private.multi_membership m where m.team_id=t.id and m.player_id=p.id and m.active)) order by p.name),'[]'::jsonb)
   from app_private.multi_player p where p.team_id=t.id))
 into result from app_private.multi_invitation i join app_private.multi_team t on t.id=i.team_id
 where i.token::text=$1 and i.expires_at>now()
   and not exists(select 1 from app_private.multi_membership m where m.team_id=i.team_id and m.user_id=uid and not m.active);
 if result is null then raise exception 'Invitación inválida o vencida'; end if;
 return result;
end $$;

create function app_private.multi_request_player(team text,player text,invite_code text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); m app_private.multi_membership;
begin
 select * into m from app_private.multi_membership where team_id=$1 and user_id=uid;
 if m.user_id is not null and not m.active then raise exception 'Acceso revocado'; end if;
 if not coalesce(m.active,false) and not exists(select 1 from app_private.multi_invitation i where i.team_id=$1 and i.token::text=$3 and i.expires_at>now()) then raise exception 'Invitación inválida o vencida'; end if;
 if not exists(select 1 from app_private.multi_player p where p.team_id=$1 and p.id=$2) then raise exception 'Jugador inválido'; end if;
 if m.player_id is not null then raise exception 'Ya tienes una ficha vinculada en este equipo'; end if;
 if exists(select 1 from app_private.multi_membership where team_id=$1 and player_id=$2 and active) then raise exception 'Ficha ocupada'; end if;
 if m.role='admin' and m.active then
   update app_private.multi_membership set player_id=$2 where team_id=$1 and user_id=uid;
 else
   insert into app_private.multi_claim(team_id,user_id,player_id) values($1,uid,$2)
   on conflict(team_id,user_id) do update set player_id=excluded.player_id,created_at=now();
 end if;
end $$;

create function app_private.multi_decide_claim(team text,claimant uuid,approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare player text;
begin
 perform app_private.multi_admin($1);
 select c.player_id into player from app_private.multi_claim c where c.team_id=$1 and c.user_id=$2 for update;
 if player is null then raise exception 'Solicitud no encontrada'; end if;
 if $3 is null then raise exception 'Decisión inválida'; end if;
 if $3 then
   if exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.player_id=player and m.active) then raise exception 'Ficha ocupada'; end if;
   insert into app_private.multi_membership(team_id,user_id,role,player_id) values($1,$2,'player',player)
   on conflict(team_id,user_id) do update set player_id=excluded.player_id
   where app_private.multi_membership.active and app_private.multi_membership.player_id is null;
   if not found then raise exception 'La cuenta ya tiene ficha o acceso revocado'; end if;
 end if;
 delete from app_private.multi_claim where team_id=$1 and user_id=$2;
end $$;

create function app_private.multi_account_context(team text,invite_code text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); m app_private.multi_membership; allowed boolean; result jsonb;
begin
 select * into m from app_private.multi_membership where team_id=$1 and user_id=uid;
 allowed:=coalesce(m.active,false) or exists(select 1 from app_private.multi_invitation i where i.team_id=$1 and i.token::text=$2 and i.expires_at>now());
 if not allowed or (m.user_id is not null and not m.active) then raise exception 'Sin acceso a este equipo'; end if;
 select jsonb_build_object('role',case when m.active then m.role else null end,'playerId',case when m.active then m.player_id else null end,'canClaim',true,'revoked',false,
 'pending',(select c.player_id from app_private.multi_claim c where c.team_id=$1 and c.user_id=uid),
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position,
   'occupied',exists(select 1 from app_private.multi_membership x where x.team_id=$1 and x.player_id=p.id and x.active)) order by p.name),'[]'::jsonb)
   from app_private.multi_player p where p.team_id=$1),
 'invite',case when m.active and m.role='admin' then (select i.token::text from app_private.multi_invitation i where i.team_id=$1) else null end,
 'linkedAccounts',case when m.active and m.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('playerId',x.player_id,'email',u.email)),'[]'::jsonb) from app_private.multi_membership x join auth.users u on u.id=x.user_id where x.team_id=$1 and x.active and x.player_id is not null) else '[]'::jsonb end,
 'claims',case when m.active and m.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('userId',c.user_id,'playerId',c.player_id,'email',u.email,'name',p.name) order by c.created_at),'[]'::jsonb) from app_private.multi_claim c join auth.users u on u.id=c.user_id join app_private.multi_player p on p.id=c.player_id and p.team_id=c.team_id where c.team_id=$1) else '[]'::jsonb end)
 into result;
 return result;
end $$;

create function app_private.multi_unlink_player(team text,player text,remove_access boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_admin($1); target app_private.multi_membership;
begin
 select * into target from app_private.multi_membership where team_id=$1 and player_id=$2 and active for update;
 if target.user_id is null then raise exception 'Ficha vinculada no encontrada'; end if;
 if $3 is null then raise exception 'Acción inválida'; end if;
 if $3 and (target.role='admin' or target.user_id=uid) then raise exception 'No se puede retirar el acceso de un administrador'; end if;
 update app_private.multi_membership set player_id=null,active=not $3 where team_id=$1 and user_id=target.user_id;
end $$;

revoke all on function app_private.multi_admin(text),app_private.multi_new_invite(text),app_private.multi_invite_info(text),app_private.multi_request_player(text,text,text),app_private.multi_decide_claim(text,uuid,boolean),app_private.multi_account_context(text,text),app_private.multi_unlink_player(text,text,boolean) from public,anon,authenticated;
grant execute on function app_private.multi_new_invite(text),app_private.multi_invite_info(text),app_private.multi_request_player(text,text,text),app_private.multi_decide_claim(text,uuid,boolean),app_private.multi_account_context(text,text),app_private.multi_unlink_player(text,text,boolean) to authenticated;
