-- Coaches are team-specific profiles; membership role controls administrative access.
create table app_private.multi_coach (
 id uuid primary key default gen_random_uuid(), team_id text not null references app_private.multi_team(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), user_id uuid references auth.users(id), was_admin boolean not null default false,
 unique(team_id,id), unique(team_id,user_id)
);
create table app_private.multi_coach_claim (
 team_id text not null references app_private.multi_team(id) on delete cascade, user_id uuid not null references auth.users(id),
 coach_id uuid not null, created_at timestamptz not null default now(), primary key(team_id,user_id),
 foreign key(team_id,coach_id) references app_private.multi_coach(team_id,id) on delete cascade
);
alter table app_private.multi_coach enable row level security;
alter table app_private.multi_coach_claim enable row level security;
revoke all on app_private.multi_coach,app_private.multi_coach_claim from public,anon,authenticated;

create function app_private.multi_coach_owner(team text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user();
begin
 if not exists(select 1 from app_private.multi_team t join app_private.multi_membership m on m.team_id=t.id and m.user_id=uid and m.active and m.role='admin' where t.id=$1 and t.owner_user_id=uid) then raise exception 'Solo el creador puede gestionar entrenadores'; end if;
 return uid;
end $$;
create function app_private.multi_coach_create(team text,coach_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform app_private.multi_coach_owner($1);
 if $2 is null or length(trim($2)) not between 1 and 100 then raise exception 'Nombre de entrenador inválido'; end if;
 insert into app_private.multi_coach(team_id,name) values($1,trim($2)) returning id into result; return result;
end $$;
create function app_private.multi_coach_data(team text,invite_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); is_owner boolean; result jsonb;
begin
 if not exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and m.active) and not exists(select 1 from app_private.multi_invitation i where i.team_id=$1 and i.token::text=$2 and i.expires_at>now()) then raise exception 'Sin acceso a este equipo'; end if;
 if exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and not m.active) then raise exception 'Acceso revocado'; end if;
 select exists(select 1 from app_private.multi_team t where t.id=$1 and t.owner_user_id=uid) into is_owner;
 select jsonb_build_object('owner',is_owner,'myCoach',(select c.id from app_private.multi_coach c where c.team_id=$1 and c.user_id=uid),'pending',(select c.coach_id from app_private.multi_coach_claim c where c.team_id=$1 and c.user_id=uid),
 'coaches',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'occupied',c.user_id is not null,'email',case when is_owner then u.email else null end) order by c.name),'[]'::jsonb) from app_private.multi_coach c left join auth.users u on u.id=c.user_id where c.team_id=$1),
 'claims',case when is_owner then (select coalesce(jsonb_agg(jsonb_build_object('userId',q.user_id,'coachId',q.coach_id,'name',c.name,'email',u.email) order by q.created_at),'[]'::jsonb) from app_private.multi_coach_claim q join app_private.multi_coach c on c.team_id=q.team_id and c.id=q.coach_id join auth.users u on u.id=q.user_id where q.team_id=$1) else '[]'::jsonb end) into result;
 return result;
end $$;
create function app_private.multi_coach_request(team text,coach uuid,invite_code text default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user();
begin
 if exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and not m.active) then raise exception 'Acceso revocado'; end if;
 if not exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and m.active) and not exists(select 1 from app_private.multi_invitation i where i.team_id=$1 and i.token::text=$3 and i.expires_at>now()) then raise exception 'Invitación inválida o vencida'; end if;
 if not exists(select 1 from app_private.multi_coach c where c.team_id=$1 and c.id=$2 and c.user_id is null) then raise exception 'Ficha de entrenador no disponible'; end if;
 if exists(select 1 from app_private.multi_coach c where c.team_id=$1 and c.user_id=uid) then raise exception 'Ya tienes una ficha de entrenador'; end if;
 insert into app_private.multi_coach_claim(team_id,user_id,coach_id) values($1,uid,$2) on conflict(team_id,user_id) do update set coach_id=excluded.coach_id,created_at=now();
end $$;
create function app_private.multi_coach_decide(team text,claimant uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 perform app_private.multi_coach_owner($1);
 if $3 is null then raise exception 'Decisión inválida'; end if;
 select q.coach_id into cid from app_private.multi_coach_claim q where q.team_id=$1 and q.user_id=$2 for update;
 if cid is null then raise exception 'Solicitud no encontrada'; end if;
 if $3 then
  update app_private.multi_coach c set user_id=$2,was_admin=exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=$2 and m.active and m.role='admin') where c.id=cid and c.team_id=$1 and c.user_id is null;
  if not found then raise exception 'Ficha de entrenador ocupada'; end if;
  insert into app_private.multi_membership(team_id,user_id,role) values($1,$2,'admin') on conflict(team_id,user_id) do update set role='admin' where app_private.multi_membership.active;
  if not found then raise exception 'Cuenta con acceso revocado'; end if;
 end if;
 delete from app_private.multi_coach_claim q where q.team_id=$1 and q.user_id=$2;
end $$;
create function app_private.multi_coach_unlink(team text,coach uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_coach_owner($1); linked uuid; previous_admin boolean;
begin
 select c.user_id,c.was_admin into linked,previous_admin from app_private.multi_coach c where c.id=$2 and c.team_id=$1 for update;
 if not found then raise exception 'Ficha de entrenador no encontrada'; end if;
 if linked is null then raise exception 'La ficha no está vinculada'; end if;
 update app_private.multi_coach c set user_id=null,was_admin=false where c.id=$2 and c.team_id=$1;
 if linked<>uid and not previous_admin then
  update app_private.multi_membership m set role='player',active=(m.player_id is not null) where m.team_id=$1 and m.user_id=linked and m.active;
 end if;
end $$;
create or replace function app_private.multi_set_admin(team text,member_user uuid,make_admin boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user();
begin
 if not exists(select 1 from app_private.multi_team t where t.id=$1 and t.owner_user_id=uid and exists(select 1 from app_private.multi_membership m where m.team_id=t.id and m.user_id=uid and m.active and m.role='admin')) then raise exception 'Solo el creador puede gestionar administradores'; end if;
 if $2=uid then raise exception 'No puedes cambiar el rol del creador'; end if;
 if $3 is null then raise exception 'Rol inválido'; end if;
 if not $3 and exists(select 1 from app_private.multi_coach c where c.team_id=$1 and c.user_id=$2) then raise exception 'Primero desvincula la ficha de entrenador'; end if;
 update app_private.multi_membership set role=case when $3 then 'admin' else 'player' end where team_id=$1 and user_id=$2 and active and player_id is not null;
 if not found then raise exception 'Cuenta vinculada no encontrada en este equipo'; end if;
 if $3 then update app_private.multi_coach set was_admin=true where team_id=$1 and user_id=$2; end if;
end $$;
revoke all on function app_private.multi_coach_owner(text),app_private.multi_coach_create(text,text),app_private.multi_coach_data(text,text),app_private.multi_coach_request(text,uuid,text),app_private.multi_coach_decide(text,uuid,boolean),app_private.multi_coach_unlink(text,uuid) from public,anon,authenticated;
grant execute on function app_private.multi_coach_create(text,text),app_private.multi_coach_data(text,text),app_private.multi_coach_request(text,uuid,text),app_private.multi_coach_decide(text,uuid,boolean),app_private.multi_coach_unlink(text,uuid) to authenticated;
create function public.multi_coach_create(team text,coach_name text) returns uuid language sql security invoker set search_path='' as $$ select app_private.multi_coach_create(team,coach_name) $$;
create function public.multi_coach_data(team text,invite_code text default null) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_coach_data(team,invite_code) $$;
create function public.multi_coach_request(team text,coach uuid,invite_code text default null) returns void language sql security invoker set search_path='' as $$ select app_private.multi_coach_request(team,coach,invite_code) $$;
create function public.multi_coach_decide(team text,claimant uuid,approve boolean) returns void language sql security invoker set search_path='' as $$ select app_private.multi_coach_decide(team,claimant,approve) $$;
create function public.multi_coach_unlink(team text,coach uuid) returns void language sql security invoker set search_path='' as $$ select app_private.multi_coach_unlink(team,coach) $$;
revoke all on function public.multi_coach_create(text,text),public.multi_coach_data(text,text),public.multi_coach_request(text,uuid,text),public.multi_coach_decide(text,uuid,boolean),public.multi_coach_unlink(text,uuid) from public,anon;
grant execute on function public.multi_coach_create(text,text),public.multi_coach_data(text,text),public.multi_coach_request(text,uuid,text),public.multi_coach_decide(text,uuid,boolean),public.multi_coach_unlink(text,uuid) to authenticated;

