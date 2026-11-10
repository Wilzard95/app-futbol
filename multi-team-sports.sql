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
