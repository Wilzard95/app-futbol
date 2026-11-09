-- Per-tournament rosters. Existing squads are preserved during migration.
create table app_private.tournament_player (
  tournament_id uuid not null references app_private.tournament(id),
  player_id text not null references app_private.player(id),
  primary key (tournament_id, player_id)
);
alter table app_private.tournament_player enable row level security;
revoke all on app_private.tournament_player from public, anon, authenticated;
insert into app_private.tournament_player(tournament_id, player_id)
select t.id, p.id from app_private.tournament t cross join app_private.player p
where t.team_id = 'combo';

create function app_private.sports_enroll_player(tournament uuid, player_id text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.ensure_verified();
begin
  if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then
    raise exception 'Solo el administrador puede inscribir jugadores';
  end if;
  if not exists(select 1 from app_private.tournament where id=$1 and team_id='combo')
     or not exists(select 1 from app_private.player where id=$2) then
    raise exception 'Torneo o jugador inválido';
  end if;
  insert into app_private.tournament_player values ($1,$2) on conflict do nothing;
end $$;
revoke all on function app_private.sports_enroll_player(uuid,text) from public,anon,authenticated;
grant execute on function app_private.sports_enroll_player(uuid,text) to authenticated;
create function public.sports_enroll_player(tournament uuid,player_id text) returns void
language sql security invoker set search_path='' as $$ select app_private.sports_enroll_player(tournament,player_id) $$;
revoke all on function public.sports_enroll_player(uuid,text) from public,anon;
grant execute on function public.sports_enroll_player(uuid,text) to authenticated;

create function app_private.sports_create_roster_player(tournament uuid,player_name text,shirt_number text,player_position text)
returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
  if not exists(select 1 from app_private.tournament where id=$1 and team_id='combo') then raise exception 'Torneo inválido'; end if;
  result := app_private.sports_add_player($2,$3,$4);
  perform app_private.sports_enroll_player($1,result);
  return result;
end $$;
revoke all on function app_private.sports_create_roster_player(uuid,text,text,text) from public,anon,authenticated;
grant execute on function app_private.sports_create_roster_player(uuid,text,text,text) to authenticated;
create function public.sports_create_roster_player(tournament uuid,player_name text,shirt_number text,player_position text)
returns text language sql security invoker set search_path='' as $$ select app_private.sports_create_roster_player(tournament,player_name,shirt_number,player_position) $$;
revoke all on function public.sports_create_roster_player(uuid,text,text,text) from public,anon;
grant execute on function public.sports_create_roster_player(uuid,text,text,text) to authenticated;

create function app_private.check_match_roster() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from app_private.match g join app_private.tournament_player r on r.tournament_id=g.tournament_id and r.player_id=new.player_id where g.id=new.match_id) then
    raise exception 'El participante no está inscrito en el torneo';
  end if;
  return new;
end $$;
create trigger match_roster_check before insert or update on app_private.match_participant for each row execute function app_private.check_match_roster();

create function app_private.check_lineup_roster() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from app_private.tournament_player r where r.tournament_id=new.tournament_id and r.player_id=new.author_player_id)
    or exists(select 1 from jsonb_each_text(new.picks) p where not exists(select 1 from app_private.tournament_player r where r.tournament_id=new.tournament_id and r.player_id=p.value)) then
    raise exception 'Solo los jugadores inscritos pueden proponer o integrar la titular del torneo';
  end if;
  return new;
end $$;
create trigger lineup_roster_check before insert or update on app_private.lineup_proposal for each row execute function app_private.check_lineup_roster();

create or replace function app_private.sports_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.ensure_verified(); m app_private.member; result jsonb;
begin
 select * into m from app_private.member where user_id=uid and active;
 if m.user_id is null or (m.role<>'admin' and m.player_id is null) then raise exception 'Sin acceso al equipo'; end if;
 select jsonb_build_object('myPlayer',m.player_id,'role',m.role,
 'roster',(select coalesce(jsonb_object_agg(r.tournament_id, r.players),'{}'::jsonb) from (select tournament_id,jsonb_agg(player_id order by player_id) players from app_private.tournament_player group by tournament_id) r),
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position) order by p.name),'[]'::jsonb) from app_private.player p),
 'tournaments',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'format',t.format) order by t.name),'[]'::jsonb) from app_private.tournament t where t.team_id='combo'),
 'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'tournamentId',g.tournament_id,'opponent',g.opponent,'playedAt',g.played_on,'goalsFor',g.goals_for,'goalsAgainst',g.goals_against,'closed',g.ratings_closed,'open',g.ratings_open,
 'participants',(select coalesce(jsonb_agg(p.player_id),'[]'::jsonb) from app_private.match_participant p where p.match_id=g.id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'playerId',e.player_id,'kind',e.kind,'context',e.context) order by e.id),'[]'::jsonb) from app_private.match_event e where e.match_id=g.id)) order by g.played_on desc),'[]'::jsonb) from app_private.match g join app_private.tournament t on t.id=g.tournament_id where t.team_id='combo')) into result;
 return result;
end $$;
