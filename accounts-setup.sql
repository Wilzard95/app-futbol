-- Account data is private; browser access is only through checked functions.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.team (id text primary key, name text not null, owner_email text not null, invite uuid not null default gen_random_uuid(), invite_expires_at timestamptz not null default now() + interval '7 days');
create table app_private.player (id text primary key, name text not null, number text not null, position text not null);
create table app_private.member (user_id uuid primary key references auth.users(id), role text not null check (role in ('admin','player')), player_id text unique references app_private.player(id), active boolean not null default true);
create table app_private.claim (user_id uuid primary key references auth.users(id), player_id text not null references app_private.player(id), created_at timestamptz not null default now());
alter table app_private.team enable row level security;
alter table app_private.player enable row level security;
alter table app_private.member enable row level security;
alter table app_private.claim enable row level security;
revoke all on all tables in schema app_private from public, anon, authenticated;

insert into app_private.team(id,name,owner_email) values ('combo','combo del Inge','__ADMIN_EMAIL__');
insert into app_private.player values
 ('p1','William Mendoza','09','Delantero'), ('p2','Checho','7','Volante'),
 ('p3','Diego Segura','23','Portero'), ('p4','Fabian VARGAS','11','Defensa'),
 ('p5','SEBAS','13','Volante'), ('p6','Wilson Gómez','06','Defensa'),
 ('p7','Ricky','5','Delantero'), ('p8','Chris','10','Volante');

create function app_private.ensure_verified() returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mail text;
begin
 select lower(email) into mail from auth.users where id=uid and email_confirmed_at is not null and is_anonymous is not true;
 if mail is null then raise exception 'Debes verificar tu correo'; end if;
 if exists(select 1 from app_private.team where owner_email=mail) then
   insert into app_private.member(user_id,role) values(uid,'admin') on conflict(user_id) do nothing;
 end if;
 return uid;
end $$;

create function public.account_context(invite_code text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := app_private.ensure_verified(); m app_private.member; allowed boolean; result jsonb;
begin
 select * into m from app_private.member where user_id=uid;
 allowed := (m.active is true) or exists(select 1 from app_private.team where invite::text=invite_code and invite_expires_at > now());
 select jsonb_build_object('role',case when m.active then m.role else null end,'playerId',case when m.active then m.player_id else null end,
 'revoked',coalesce(not m.active,false), 'canClaim',allowed and not coalesce(not m.active,false),
 'pending', (select player_id from app_private.claim where user_id=uid),
 'players',case when allowed then (select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position,'occupied',exists(select 1 from app_private.member mm where mm.player_id=p.id and mm.active)) order by p.name) from app_private.player p) else '[]'::jsonb end,
 'linkedAccounts',case when m.active and m.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('playerId',mm.player_id,'email',u.email) order by mm.player_id),'[]'::jsonb) from app_private.member mm join auth.users u on u.id=mm.user_id where mm.active and mm.player_id is not null) else '[]'::jsonb end,
 'invite',case when m.active and m.role='admin' then (select invite::text from app_private.team where id='combo') else null end,
 'claims',case when m.active and m.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('userId',c.user_id,'playerId',c.player_id,'email',u.email,'name',p.name) order by c.created_at),'[]'::jsonb) from app_private.claim c join auth.users u on u.id=c.user_id join app_private.player p on p.id=c.player_id) else '[]'::jsonb end) into result;
 return result;
end $$;

create function public.account_request(player text, invite_code text default null) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := app_private.ensure_verified(); m app_private.member;
begin
 select * into m from app_private.member where user_id=uid;
 if m.active is false then raise exception 'Acceso revocado'; end if;
 if not (m.active is true or exists(select 1 from app_private.team where invite::text=invite_code and invite_expires_at > now())) then raise exception 'Invitación inválida o vencida'; end if;
 if not exists(select 1 from app_private.player p where p.id=$1) then raise exception 'Jugador inválido'; end if;
 if m.player_id is not null then raise exception 'Ya tienes una ficha vinculada'; end if;
 if exists(select 1 from app_private.member where player_id=$1 and active) then raise exception 'Ficha ocupada'; end if;
 if m.role='admin' and m.active then
   update app_private.member set player_id=$1 where user_id=uid;
 else
   insert into app_private.claim(user_id,player_id) values(uid,$1) on conflict(user_id) do update set player_id=excluded.player_id,created_at=now();
 end if;
end $$;

create function public.account_decide(claimant uuid, approve boolean) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := app_private.ensure_verified(); p text;
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Sin permiso'; end if;
 select player_id into p from app_private.claim where user_id=claimant for update;
 if p is null then raise exception 'Solicitud no encontrada'; end if;
 if approve then
   if exists(select 1 from app_private.member where player_id=p and active) then raise exception 'Ficha ocupada'; end if;
   insert into app_private.member(user_id,role,player_id) values(claimant,'player',p)
   on conflict(user_id) do update set player_id=excluded.player_id,active=true where app_private.member.active and app_private.member.player_id is null;
   if not found then raise exception 'La cuenta ya tiene ficha o acceso revocado'; end if;
 end if;
 delete from app_private.claim where user_id=claimant;
end $$;

create function public.account_unlink(player text) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := app_private.ensure_verified();
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Sin permiso'; end if;
 update app_private.member set player_id=null where player_id=$1 and active;
end $$;

create function public.account_new_invite() returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := app_private.ensure_verified();
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Sin permiso'; end if;
 update app_private.team set invite=gen_random_uuid(), invite_expires_at=now()+interval '7 days' where id='combo';
end $$;

revoke all on function public.account_context(text), public.account_request(text,text), public.account_decide(uuid,boolean), public.account_unlink(text), public.account_new_invite() from public, anon;
grant execute on function public.account_context(text), public.account_request(text,text), public.account_decide(uuid,boolean), public.account_unlink(text), public.account_new_invite() to authenticated;
