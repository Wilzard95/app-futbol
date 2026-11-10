-- Atomic cutover. Existing records are retained; old API calls are revoked to avoid writes to the legacy copy.
begin;
lock table app_private.team,app_private.player,app_private.member,app_private.claim,app_private.tournament,app_private.match,app_private.match_participant,app_private.match_event,app_private.tournament_player,app_private.rating_ballot,app_private.lineup_proposal in access exclusive mode;
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

-- Draft only. This isolated copy is intended for reversible migration tests;
-- never publish it before all rating, lineup and administration RPCs are scoped.
create table app_private.multi_tournament (
 id uuid primary key, team_id text not null references app_private.multi_team(id),
 name text not null, format smallint not null check(format in (5,6,11))
);
create index multi_tournament_team on app_private.multi_tournament(team_id);
create table app_private.multi_match (
 id uuid primary key, tournament_id uuid not null references app_private.multi_tournament(id),
 opponent text not null, played_on date, goals_for smallint not null, goals_against smallint not null,
 ratings_closed boolean not null, ratings_open boolean not null
);
create index multi_match_tournament on app_private.multi_match(tournament_id);
create table app_private.multi_participant (
 match_id uuid not null references app_private.multi_match(id),
 player_id text not null references app_private.multi_player(id),
 primary key(match_id,player_id)
);
create table app_private.multi_event (
 id uuid primary key, match_id uuid not null, player_id text not null,
 kind text not null, context text not null,
 foreign key(match_id,player_id) references app_private.multi_participant(match_id,player_id)
);
create index multi_event_match on app_private.multi_event(match_id);
create table app_private.multi_roster (
 tournament_id uuid not null references app_private.multi_tournament(id),
 player_id text not null references app_private.multi_player(id),
 primary key(tournament_id,player_id)
);
alter table app_private.multi_tournament enable row level security;
alter table app_private.multi_match enable row level security;
alter table app_private.multi_participant enable row level security;
alter table app_private.multi_event enable row level security;
alter table app_private.multi_roster enable row level security;
revoke all on app_private.multi_tournament,app_private.multi_match,app_private.multi_participant,app_private.multi_event,app_private.multi_roster from public,anon,authenticated;

insert into app_private.multi_tournament(id,team_id,name,format) select id,team_id,name,format from app_private.tournament where team_id='combo';
insert into app_private.multi_match(id,tournament_id,opponent,played_on,goals_for,goals_against,ratings_closed,ratings_open)
 select g.id,g.tournament_id,g.opponent,g.played_on,g.goals_for,g.goals_against,g.ratings_closed,g.ratings_open from app_private.match g join app_private.multi_tournament t on t.id=g.tournament_id;
insert into app_private.multi_participant select p.match_id,p.player_id from app_private.match_participant p join app_private.multi_match g on g.id=p.match_id;
insert into app_private.multi_event select e.id,e.match_id,e.player_id,e.kind,e.context from app_private.match_event e join app_private.multi_match g on g.id=e.match_id;
insert into app_private.multi_roster select r.tournament_id,r.player_id from app_private.tournament_player r join app_private.multi_tournament t on t.id=r.tournament_id;

create function app_private.multi_sports_data(team text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); member app_private.multi_membership; result jsonb;
begin
 select * into member from app_private.multi_membership where team_id=$1 and user_id=uid and active;
 if member.user_id is null or (member.role<>'admin' and member.player_id is null) then raise exception 'Sin acceso a este equipo'; end if;
 select jsonb_build_object('myPlayer',member.player_id,'role',member.role,
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position) order by p.name),'[]'::jsonb) from app_private.multi_player p where p.team_id=$1),
 'tournaments',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'format',t.format) order by t.name),'[]'::jsonb) from app_private.multi_tournament t where t.team_id=$1),
 'roster',(select coalesce(jsonb_object_agg(x.tournament_id,x.players),'{}'::jsonb) from (select r.tournament_id,jsonb_agg(r.player_id order by r.player_id) players from app_private.multi_roster r join app_private.multi_tournament t on t.id=r.tournament_id where t.team_id=$1 group by r.tournament_id) x),
 'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'tournamentId',g.tournament_id,'opponent',g.opponent,'playedAt',g.played_on,'goalsFor',g.goals_for,'goalsAgainst',g.goals_against,'closed',g.ratings_closed,'open',g.ratings_open,
 'participants',(select coalesce(jsonb_agg(p.player_id),'[]'::jsonb) from app_private.multi_participant p where p.match_id=g.id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'playerId',e.player_id,'kind',e.kind,'context',e.context) order by e.id),'[]'::jsonb) from app_private.multi_event e where e.match_id=g.id)) order by g.played_on desc),'[]'::jsonb) from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where t.team_id=$1)) into result;
 return result;
end $$;
revoke all on function app_private.multi_sports_data(text) from public,anon,authenticated;
grant execute on function app_private.multi_sports_data(text) to authenticated;

-- Draft data migration and read endpoints; write paths are not ready for deployment.
create table app_private.multi_ballot (
 id uuid primary key default gen_random_uuid(), match_id uuid not null references app_private.multi_match(id),
 author_user_id uuid not null references auth.users(id), author_player_id text not null,
 target_player_id text not null, base_score numeric not null, final_score numeric not null,
 adjustments jsonb not null, comment text not null, reaction text,
 unique(match_id,author_user_id,target_player_id), constraint multi_rating_one_per_player unique(match_id,author_player_id,target_player_id),
 foreign key(match_id,author_player_id) references app_private.multi_participant(match_id,player_id),
 foreign key(match_id,target_player_id) references app_private.multi_participant(match_id,player_id)
);
create table app_private.multi_lineup (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references app_private.multi_tournament(id),
 author_user_id uuid not null references auth.users(id), author_player_id text not null references app_private.multi_player(id),
 formation_id text not null, picks jsonb not null,
 unique(tournament_id,author_user_id), constraint multi_lineup_one_per_player unique(tournament_id,author_player_id)
);
alter table app_private.multi_ballot enable row level security;
alter table app_private.multi_lineup enable row level security;
revoke all on app_private.multi_ballot,app_private.multi_lineup from public,anon,authenticated;
insert into app_private.multi_ballot select b.id,b.match_id,b.author_user_id,b.author_player_id,b.target_player_id,b.base_score,b.final_score,b.adjustments,b.comment,b.reaction from app_private.rating_ballot b join app_private.multi_match g on g.id=b.match_id;
insert into app_private.multi_lineup select l.id,l.tournament_id,l.author_user_id,l.author_player_id,l.formation_id,l.picks from app_private.lineup_proposal l join app_private.multi_tournament t on t.id=l.tournament_id;

create function app_private.multi_rating_results(team text,match_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); result jsonb;
begin
 if not exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and m.active and (m.role='admin' or m.player_id is not null)) then raise exception 'Sin acceso a este equipo'; end if;
 if not exists(select 1 from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id=$1) then raise exception 'Partido inválido'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('playerId',x.player_id,'average',x.average,'count',x.n,'comments',x.comments,'approvals',x.approvals,'disapprovals',x.disapprovals)),'[]'::jsonb) into result from (
 select b.target_player_id player_id,avg(b.final_score) average,count(*) n,coalesce(jsonb_agg(b.comment order by b.id) filter(where b.comment<>''),'[]'::jsonb) comments,
 count(*) filter(where b.reaction='approve') approvals,count(*) filter(where b.reaction='disapprove') disapprovals
 from app_private.multi_ballot b where b.match_id=$2 group by b.target_player_id) x;
 return result;
end $$;

create function app_private.multi_lineup_data(team text,tournament uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); result jsonb;
begin
 if not exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and m.active and (m.role='admin' or m.player_id is not null)) then raise exception 'Sin acceso a este equipo'; end if;
 if not exists(select 1 from app_private.multi_tournament t where t.id=$2 and t.team_id=$1) then raise exception 'Torneo inválido'; end if;
 select jsonb_build_object(
 'mine',(select jsonb_build_object('id',l.id,'formationId',l.formation_id,'picks',l.picks) from app_private.multi_lineup l where l.tournament_id=$2 and l.author_user_id=uid),
 'proposals',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'formationId',l.formation_id,'picks',l.picks) order by l.id),'[]'::jsonb) from app_private.multi_lineup l where l.tournament_id=$2),
 'averages',(select coalesce(jsonb_object_agg(x.target_player_id,x.tournament_average),'{}'::jsonb) from (select target_player_id,avg(match_average) tournament_average from (select b.target_player_id,b.match_id,avg(b.final_score) match_average from app_private.multi_ballot b join app_private.multi_match g on g.id=b.match_id where g.tournament_id=$2 group by b.target_player_id,b.match_id) matches group by target_player_id) x)) into result;
 return result;
end $$;
revoke all on function app_private.multi_rating_results(text,uuid),app_private.multi_lineup_data(text,uuid) from public,anon,authenticated;
grant execute on function app_private.multi_rating_results(text,uuid),app_private.multi_lineup_data(text,uuid) to authenticated;

-- Draft: team-scoped sports writes. Apply only as part of the complete cutover.
create function app_private.multi_add_player(team text, player_name text, shirt_number text, player_position text) returns text language plpgsql security definer set search_path='' as $$
declare result text:='player-'||gen_random_uuid()::text;
begin
 perform app_private.multi_admin($1);
 if $2 is null or length(trim($2)) not between 1 and 100 or $3 is null or length(trim($3)) not between 1 and 5 or $4 not in ('Portero','Defensa','Volante','Delantero') then raise exception 'Datos de jugador inválidos'; end if;
 insert into app_private.multi_player(id,team_id,name,number,position) values(result,$1,trim($2),trim($3),$4);
 return result;
end $$;
create function app_private.multi_create_tournament(team text,tournament_name text,game_format smallint) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid:=gen_random_uuid();
begin
 perform app_private.multi_admin($1);
 if $2 is null or length(trim($2)) not between 1 and 100 or $3 is null or $3 not in (5,6,11) then raise exception 'Datos de torneo inválidos'; end if;
 insert into app_private.multi_tournament(id,team_id,name,format) values(result,$1,trim($2),$3); return result;
end $$;
create function app_private.multi_enroll_player(team text,tournament uuid,player_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 if not exists(select 1 from app_private.multi_tournament where id=$2 and team_id=$1) or not exists(select 1 from app_private.multi_player where id=$3 and team_id=$1) then raise exception 'Torneo o jugador inválido'; end if;
 insert into app_private.multi_roster values($2,$3) on conflict do nothing;
end $$;
create function app_private.multi_create_roster_player(team text,tournament uuid,player_name text,shirt_number text,player_position text) returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 perform app_private.multi_admin($1);
 if not exists(select 1 from app_private.multi_tournament where id=$2 and team_id=$1) then raise exception 'Torneo inválido'; end if;
 result:=app_private.multi_add_player($1,$3,$4,$5); perform app_private.multi_enroll_player($1,$2,result); return result;
end $$;
create function app_private.multi_create_match(team text,tournament uuid,opponent text,played_on date,goals_for smallint,goals_against smallint,participants text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid:=gen_random_uuid();
begin
 perform app_private.multi_admin($1);
 if not exists(select 1 from app_private.multi_tournament where id=$2 and team_id=$1) then raise exception 'Torneo inválido'; end if;
 if $3 is null or length(trim($3)) not between 1 and 100 or $4 is null or $5 is null or $6 is null or $5 not between 0 and 99 or $6 not between 0 and 99 then raise exception 'Datos del partido inválidos'; end if;
 if $7 is null or cardinality($7)=0 or cardinality($7)<>(select count(distinct p) from unnest($7) p) or exists(select 1 from unnest($7) p where p is null or not exists(select 1 from app_private.multi_roster r where r.tournament_id=$2 and r.player_id=p)) then raise exception 'Participantes inválidos'; end if;
 insert into app_private.multi_match values(result,$2,trim($3),$4,$5,$6,false,false);
 insert into app_private.multi_participant(match_id,player_id) select result,unnest($7); return result;
end $$;
create function app_private.multi_add_event(team text,match_id uuid,player_id text,kind text,event_context text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 perform 1 from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id=$1 for update of g;
 if not found then raise exception 'Partido inválido'; end if;
 if exists(select 1 from app_private.multi_ballot b where b.match_id=$2) then raise exception 'El partido ya tiene valoraciones; no se pueden cambiar las acciones'; end if;
 if not exists(select 1 from app_private.multi_participant p where p.match_id=$2 and p.player_id=$3) or $4 is null or $4 not in ('goal','assist','yellow_card','red_card','clean_sheet') or $5 is null or length($5)>280 then raise exception 'Acción inválida'; end if;
 if $4='clean_sheet' and exists(select 1 from app_private.multi_event e where e.match_id=$2 and e.player_id=$3 and e.kind='clean_sheet') then raise exception 'Portería en cero duplicada'; end if;
 insert into app_private.multi_event values(gen_random_uuid(),$2,$3,$4,trim($5));
end $$;
create function app_private.multi_open_ratings(team text,match_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 update app_private.multi_match set ratings_open=true where id=$2 and not ratings_closed and tournament_id in (select id from app_private.multi_tournament where team_id=$1);
 if not found then raise exception 'Partido inválido o cerrado'; end if;
end $$;
revoke all on function app_private.multi_add_player(text,text,text,text),app_private.multi_create_tournament(text,text,smallint),app_private.multi_enroll_player(text,uuid,text),app_private.multi_create_roster_player(text,uuid,text,text,text),app_private.multi_create_match(text,uuid,text,date,smallint,smallint,text[]),app_private.multi_add_event(text,uuid,text,text,text),app_private.multi_open_ratings(text,uuid) from public,anon,authenticated;
grant execute on function app_private.multi_add_player(text,text,text,text),app_private.multi_create_tournament(text,text,smallint),app_private.multi_enroll_player(text,uuid,text),app_private.multi_create_roster_player(text,uuid,text,text,text),app_private.multi_create_match(text,uuid,text,date,smallint,smallint,text[]),app_private.multi_add_event(text,uuid,text,text,text),app_private.multi_open_ratings(text,uuid) to authenticated;

-- Draft writes. Run only in a rolled-back test until full cutover.
create function app_private.multi_rating_submit(match_id uuid, target text, score numeric, adjustments jsonb, comment text, reaction text, team text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.multi_verified_user(); author_player text; item jsonb; event_kind text; event_uuid uuid; seen uuid[] := '{}'; total numeric:=0; amount numeric;
begin
 if not exists(select 1 from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$1 and t.team_id=$7) then raise exception 'Partido inválido'; end if;
 select m.player_id into author_player from app_private.multi_membership m where m.team_id=$7 and m.user_id=uid and m.active;
 if author_player is null or not exists(select 1 from app_private.multi_participant p where p.match_id=$1 and p.player_id=author_player) then raise exception 'Solo participantes pueden valorar'; end if;
 if not exists(select 1 from app_private.multi_participant p where p.match_id=$1 and p.player_id=$2) then raise exception 'Solo participantes reciben valoraciones'; end if;
 perform 1 from app_private.multi_match m where m.id=$1 and m.ratings_open and not m.ratings_closed for update;
 if not found then raise exception 'Las valoraciones aún no están abiertas o el partido está cerrado'; end if;
 if $3 is null or $3 not between 1 and 10 or $3::text in ('NaN','Infinity','-Infinity') then raise exception 'Nota inválida'; end if;
 if $4 is null or jsonb_typeof($4)<>'array' or jsonb_array_length($4)>100 then raise exception 'Ajustes inválidos'; end if;
 if $5 is null or length($5)>500 or ($6 is not null and $6 not in ('approve','disapprove')) then raise exception 'Comentario o reacción inválidos'; end if;
 for item in select * from jsonb_array_elements($4) loop
   if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'eventId') is distinct from 'string' or jsonb_typeof(item->'value') is distinct from 'number' then raise exception 'Ajuste inválido'; end if;
   begin event_uuid := (item->>'eventId')::uuid; amount := (item->>'value')::numeric; exception when others then raise exception 'Ajuste inválido'; end;
   if event_uuid=any(seen) then raise exception 'Acción duplicada'; end if;
   seen := array_append(seen,event_uuid);
   select e.kind into event_kind from app_private.multi_event e where e.id=event_uuid and e.match_id=$1 and e.player_id=$2;
   if event_kind is null then raise exception 'La acción no pertenece al jugador'; end if;
   if not (case event_kind when 'goal' then amount between 0 and 1 when 'assist' then amount between 0 and 0.5 when 'clean_sheet' then amount between 0 and 1 when 'yellow_card' then amount between -2 and 2 when 'red_card' then amount between -3 and 3 else false end) then raise exception 'Ajuste fuera de rango'; end if;
   total:=total+amount;
 end loop;
 insert into app_private.multi_ballot(match_id,author_user_id,author_player_id,target_player_id,base_score,final_score,adjustments,comment,reaction)
 values($1,uid,author_player,$2,$3,greatest(1,least(10,$3+total)),$4,$5,$6)
 on conflict on constraint multi_rating_one_per_player do update set base_score=excluded.base_score,final_score=excluded.final_score,adjustments=excluded.adjustments,comment=excluded.comment,reaction=excluded.reaction where app_private.multi_ballot.author_user_id=uid;
 if not found then raise exception 'Esta ficha ya tiene una valoración previa de otra cuenta'; end if;
end $$;


create function app_private.multi_lineup_submit(tournament uuid, formation text, picks jsonb, team text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); author_player text; fmt smallint; lines int[]; required text[]:=array['gk']; i int; j int; picked text[];
begin
 select player_id into author_player from app_private.multi_membership where team_id=$4 and user_id=uid and active;
 if author_player is null or not exists(select 1 from app_private.multi_roster r where r.tournament_id=$1 and r.player_id=author_player) then raise exception 'Solo jugadores inscritos pueden proponer'; end if;
 select t.format into fmt from app_private.multi_tournament t where t.id=$1 and t.team_id=$4;
 lines:=case $2
  when 'f5-1-2-1' then array[1,2,1] when 'f5-2-2' then array[2,2] when 'f5-1-3' then array[1,3]
  when 'f6-3-2' then array[3,2] when 'f6-3-1-1' then array[3,1,1] when 'f6-2-2-1' then array[2,2,1] when 'f6-2-3' then array[2,3]
  when 'f11-4-3-3' then array[4,3,3] when 'f11-4-4-2' then array[4,4,2] when 'f11-3-5-2' then array[3,5,2] when 'f11-4-2-3-1' then array[4,2,3,1] else null end;
 if fmt is null or lines is null or split_part($2,'-',1)<>'f'||fmt::text then raise exception 'Formación inválida para el torneo'; end if;
 if $3 is null or jsonb_typeof($3) is distinct from 'object' then raise exception 'Titular inválida'; end if;
 for i in 1..array_length(lines,1) loop for j in 1..lines[i] loop required:=array_append(required,'row-'||(i-1)||'-'||(j-1)); end loop; end loop;
 if (select count(*) from jsonb_object_keys($3))<>cardinality(required) or exists(select 1 from unnest(required) s where not ($3 ? s) or jsonb_typeof($3->s) is distinct from 'string') then raise exception 'Completa todas las posiciones'; end if;
 select array_agg(value) into picked from jsonb_each_text($3);
 if cardinality(picked)<>(select count(distinct p) from unnest(picked) p) or exists(select 1 from unnest(picked) p where not exists(select 1 from app_private.multi_player where id=p and team_id=$4)) or exists(select 1 from unnest(picked) p where not exists(select 1 from app_private.multi_roster r where r.tournament_id=$1 and r.player_id=p)) then raise exception 'Jugadores repetidos o inválidos'; end if;
 insert into app_private.multi_lineup(tournament_id,author_user_id,author_player_id,formation_id,picks) values($1,uid,author_player,$2,$3)
 on conflict on constraint multi_lineup_one_per_player do update set formation_id=excluded.formation_id,picks=excluded.picks where app_private.multi_lineup.author_user_id=uid;
 if not found then raise exception 'Esta ficha ya tiene una propuesta previa de otra cuenta'; end if;
end $$;


revoke all on function app_private.multi_rating_submit(uuid,text,numeric,jsonb,text,text,text),app_private.multi_lineup_submit(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function app_private.multi_rating_submit(uuid,text,numeric,jsonb,text,text,text),app_private.multi_lineup_submit(uuid,text,jsonb,text) to authenticated;

create function app_private.multi_rating_mine(team text,match_id uuid,target text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); result jsonb;
begin
 if not exists(select 1 from app_private.multi_membership m join app_private.multi_participant p on p.player_id=m.player_id join app_private.multi_match g on g.id=p.match_id join app_private.multi_tournament t on t.id=g.tournament_id where m.team_id=$1 and t.team_id=$1 and m.user_id=uid and m.active and p.match_id=$2) then raise exception 'Solo participantes pueden valorar'; end if;
 select jsonb_build_object('score',b.base_score,'adjustments',b.adjustments,'comment',b.comment,'reaction',b.reaction) into result from app_private.multi_ballot b where b.match_id=$2 and b.target_player_id=$3 and b.author_user_id=uid;
 return result;
end $$;
revoke all on function app_private.multi_rating_mine(text,uuid,text) from public,anon,authenticated;
grant execute on function app_private.multi_rating_mine(text,uuid,text) to authenticated;

-- Public security-invoker wrappers for validated private functions.
create function public.multi_create_team(team_name text) returns text language sql security invoker set search_path='' as $$ select app_private.multi_create_team($1) $$;
revoke all on function public.multi_create_team(text) from public,anon;
grant execute on function public.multi_create_team(text) to authenticated;
create function public.multi_my_teams() returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_my_teams() $$;
revoke all on function public.multi_my_teams() from public,anon;
grant execute on function public.multi_my_teams() to authenticated;
create function public.multi_new_invite(team text) returns text language sql security invoker set search_path='' as $$ select app_private.multi_new_invite($1) $$;
revoke all on function public.multi_new_invite(text) from public,anon;
grant execute on function public.multi_new_invite(text) to authenticated;
create function public.multi_invite_info(invite_code text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_invite_info($1) $$;
revoke all on function public.multi_invite_info(text) from public,anon;
grant execute on function public.multi_invite_info(text) to authenticated;
create function public.multi_request_player(team text,player text,invite_code text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_request_player($1,$2,$3) $$;
revoke all on function public.multi_request_player(text,text,text) from public,anon;
grant execute on function public.multi_request_player(text,text,text) to authenticated;
create function public.multi_decide_claim(team text,claimant uuid,approve boolean) returns void language sql security invoker set search_path='' as $$ select app_private.multi_decide_claim($1,$2,$3) $$;
revoke all on function public.multi_decide_claim(text,uuid,boolean) from public,anon;
grant execute on function public.multi_decide_claim(text,uuid,boolean) to authenticated;
create function public.multi_account_context(team text,invite_code text default null) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_account_context($1,$2) $$;
revoke all on function public.multi_account_context(text,text) from public,anon;
grant execute on function public.multi_account_context(text,text) to authenticated;
create function public.multi_unlink_player(team text,player text,remove_access boolean default false) returns void language sql security invoker set search_path='' as $$ select app_private.multi_unlink_player($1,$2,$3) $$;
revoke all on function public.multi_unlink_player(text,text,boolean) from public,anon;
grant execute on function public.multi_unlink_player(text,text,boolean) to authenticated;
create function public.multi_sports_data(team text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_sports_data($1) $$;
revoke all on function public.multi_sports_data(text) from public,anon;
grant execute on function public.multi_sports_data(text) to authenticated;
create function public.multi_rating_results(team text,match_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_rating_results($1,$2) $$;
revoke all on function public.multi_rating_results(text,uuid) from public,anon;
grant execute on function public.multi_rating_results(text,uuid) to authenticated;
create function public.multi_lineup_data(team text,tournament uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_lineup_data($1,$2) $$;
revoke all on function public.multi_lineup_data(text,uuid) from public,anon;
grant execute on function public.multi_lineup_data(text,uuid) to authenticated;
create function public.multi_add_player(team text, player_name text, shirt_number text, player_position text) returns text language sql security invoker set search_path='' as $$ select app_private.multi_add_player($1,$2,$3,$4) $$;
revoke all on function public.multi_add_player(text,text,text,text) from public,anon;
grant execute on function public.multi_add_player(text,text,text,text) to authenticated;
create function public.multi_create_tournament(team text,tournament_name text,game_format smallint) returns uuid language sql security invoker set search_path='' as $$ select app_private.multi_create_tournament($1,$2,$3) $$;
revoke all on function public.multi_create_tournament(text,text,smallint) from public,anon;
grant execute on function public.multi_create_tournament(text,text,smallint) to authenticated;
create function public.multi_enroll_player(team text,tournament uuid,player_id text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_enroll_player($1,$2,$3) $$;
revoke all on function public.multi_enroll_player(text,uuid,text) from public,anon;
grant execute on function public.multi_enroll_player(text,uuid,text) to authenticated;
create function public.multi_create_roster_player(team text,tournament uuid,player_name text,shirt_number text,player_position text) returns text language sql security invoker set search_path='' as $$ select app_private.multi_create_roster_player($1,$2,$3,$4,$5) $$;
revoke all on function public.multi_create_roster_player(text,uuid,text,text,text) from public,anon;
grant execute on function public.multi_create_roster_player(text,uuid,text,text,text) to authenticated;
create function public.multi_create_match(team text,tournament uuid,opponent text,played_on date,goals_for smallint,goals_against smallint,participants text[]) returns uuid language sql security invoker set search_path='' as $$ select app_private.multi_create_match($1,$2,$3,$4,$5,$6,$7) $$;
revoke all on function public.multi_create_match(text,uuid,text,date,smallint,smallint,text[]) from public,anon;
grant execute on function public.multi_create_match(text,uuid,text,date,smallint,smallint,text[]) to authenticated;
create function public.multi_add_event(team text,match_id uuid,player_id text,kind text,event_context text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_add_event($1,$2,$3,$4,$5) $$;
revoke all on function public.multi_add_event(text,uuid,text,text,text) from public,anon;
grant execute on function public.multi_add_event(text,uuid,text,text,text) to authenticated;
create function public.multi_open_ratings(team text,match_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.multi_open_ratings($1,$2) $$;
revoke all on function public.multi_open_ratings(text,uuid) from public,anon;
grant execute on function public.multi_open_ratings(text,uuid) to authenticated;
create function public.multi_rating_submit(match_id uuid, target text, score numeric, adjustments jsonb, comment text, reaction text, team text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_rating_submit($1,$2,$3,$4,$5,$6,$7) $$;
revoke all on function public.multi_rating_submit(uuid,text,numeric,jsonb,text,text,text) from public,anon;
grant execute on function public.multi_rating_submit(uuid,text,numeric,jsonb,text,text,text) to authenticated;
create function public.multi_lineup_submit(tournament uuid, formation text, picks jsonb, team text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_lineup_submit($1,$2,$3,$4) $$;
revoke all on function public.multi_lineup_submit(uuid,text,jsonb,text) from public,anon;
grant execute on function public.multi_lineup_submit(uuid,text,jsonb,text) to authenticated;
create function public.multi_rating_mine(team text,match_id uuid,target text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_rating_mine($1,$2,$3) $$;
revoke all on function public.multi_rating_mine(text,uuid,text) from public,anon;
grant execute on function public.multi_rating_mine(text,uuid,text) to authenticated;

do $$ begin
 if (select count(*) from app_private.multi_player)<>(select count(*) from app_private.player) or (select count(*) from app_private.multi_membership)<>(select count(*) from app_private.member) or (select count(*) from app_private.multi_ballot)<>(select count(*) from app_private.rating_ballot) or (select count(*) from app_private.multi_lineup)<>(select count(*) from app_private.lineup_proposal) or (select count(*) from app_private.multi_event)<>(select count(*) from app_private.match_event) or (select count(*) from app_private.multi_match)<>(select count(*) from app_private.match) then raise exception 'La copia de los datos no coincide; se cancela la migración'; end if;
end $$;
do $$ declare r record; begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'account_%' or p.proname like 'sports_%' or p.proname like 'rating_%' or p.proname like 'lineup_%') loop
 execute format('revoke execute on function %s from public,anon,authenticated',r.signature);
 end loop;
end $$;
commit;
