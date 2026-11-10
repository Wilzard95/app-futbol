-- Draft foundation: test in a transaction and roll back. Do not deploy until
-- the existing account, sports and invitation RPCs enforce team membership.
create table app_private.multi_team (
  id text primary key,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create table app_private.multi_player (
  id text primary key,
  team_id text not null references app_private.multi_team(id),
  name text not null,
  number text not null,
  position text not null,
  unique (team_id, id)
);
create table app_private.multi_membership (
  team_id text not null references app_private.multi_team(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('admin', 'player')),
  player_id text,
  active boolean not null default true,
  primary key (team_id, user_id),
  unique (team_id, player_id),
  foreign key (team_id, player_id) references app_private.multi_player(team_id, id)
);
create index multi_membership_by_user on app_private.multi_membership(user_id, team_id) where active;
alter table app_private.multi_team enable row level security;
alter table app_private.multi_player enable row level security;
alter table app_private.multi_membership enable row level security;
revoke all on app_private.multi_team, app_private.multi_player, app_private.multi_membership from public, anon, authenticated;

-- Copy existing identities without modifying the legacy records.
insert into app_private.multi_team(id, name)
select id, name from app_private.team where id='combo';
insert into app_private.multi_player(id, team_id, name, number, position)
select id, 'combo', name, number, position from app_private.player;
insert into app_private.multi_membership(team_id, user_id, role, player_id, active)
select 'combo', user_id, role, player_id, active from app_private.member;

-- Do not use the legacy ensure_verified(): it can grant the single-team admin
-- role based on owner_email, which is unsafe for multiple teams.
create function app_private.multi_verified_user() returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if not exists(select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null and u.is_anonymous is not true) then
    raise exception 'Debes verificar tu correo';
  end if;
  return uid;
end $$;

create function app_private.multi_create_team(team_name text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.multi_verified_user(); team_id text := gen_random_uuid()::text;
begin
  if team_name is null or length(trim(team_name)) not between 1 and 100 then raise exception 'Nombre de equipo inválido'; end if;
  insert into app_private.multi_team(id,name) values (team_id,trim(team_name));
  insert into app_private.multi_membership(team_id,user_id,role) values (team_id,uid,'admin');
  return team_id;
end $$;

create function app_private.multi_my_teams() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.multi_verified_user(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'role',m.role,'playerId',m.player_id) order by t.name,t.id),'[]'::jsonb)
  into result from app_private.multi_membership m join app_private.multi_team t on t.id=m.team_id
  where m.user_id=uid and m.active;
  return result;
end $$;
revoke all on function app_private.multi_verified_user(), app_private.multi_create_team(text), app_private.multi_my_teams() from public, anon, authenticated;
grant execute on function app_private.multi_create_team(text), app_private.multi_my_teams() to authenticated;
