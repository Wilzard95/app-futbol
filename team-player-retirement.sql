alter table app_private.multi_player add column retired_from_team boolean not null default false;

create function app_private.multi_retire_team_player(team text, player_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 perform 1 from app_private.multi_player where team_id=$1 and id=$2 and not retired_from_team for update;
 if not found then raise exception 'Ficha activa no encontrada en este equipo'; end if;
 delete from app_private.multi_roster r using app_private.multi_tournament t where r.tournament_id=t.id and t.team_id=$1 and r.player_id=$2;
 delete from app_private.multi_claim c where c.team_id=$1 and c.player_id=$2;
 update app_private.multi_membership m set player_id=null, active=(m.role='admin') where m.team_id=$1 and m.player_id=$2 and m.active;
 update app_private.multi_player set retired_from_team=true where team_id=$1 and id=$2;
end $$;

create function app_private.multi_guard_active_player() returns trigger language plpgsql security definer set search_path='' as $$
declare player text; teamid text;
begin
 if tg_table_name='multi_roster' then player:=new.player_id; select team_id into teamid from app_private.multi_tournament where id=new.tournament_id;
 else player:=new.player_id; teamid:=new.team_id; end if;
 if player is null then return new; end if;
 perform 1 from app_private.multi_player p where p.team_id=teamid and p.id=player and not p.retired_from_team for share;
 if not found then raise exception 'La ficha de jugador no está activa en este equipo'; end if;
 return new;
end $$;
revoke all on function app_private.multi_guard_active_player() from public,anon,authenticated;
create trigger multi_active_roster_player before insert or update of tournament_id,player_id on app_private.multi_roster for each row execute function app_private.multi_guard_active_player();
create trigger multi_active_claim_player before insert or update of team_id,player_id on app_private.multi_claim for each row execute function app_private.multi_guard_active_player();
create trigger multi_active_member_player before insert or update of team_id,player_id on app_private.multi_membership for each row execute function app_private.multi_guard_active_player();
revoke all on function app_private.multi_retire_team_player(text,text) from public,anon,authenticated;
grant execute on function app_private.multi_retire_team_player(text,text) to authenticated;
create function public.multi_retire_team_player(team text,player_id text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_retire_team_player(team,player_id) $$;
revoke all on function public.multi_retire_team_player(text,text) from public,anon;
grant execute on function public.multi_retire_team_player(text,text) to authenticated;

-- Keep historical player references available to match views, but hide retired profiles from claims.
CREATE OR REPLACE FUNCTION app_private.multi_account_context(team text, invite_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=app_private.multi_verified_user(); m app_private.multi_membership; allowed boolean; result jsonb;
begin
 select * into m from app_private.multi_membership where team_id=$1 and user_id=uid;
 allowed:=coalesce(m.active,false) or exists(select 1 from app_private.multi_invitation i where i.team_id=$1 and i.token::text=$2 and i.expires_at>now());
 if not allowed or (m.user_id is not null and not m.active) then raise exception 'Sin acceso a este equipo'; end if;
 select jsonb_build_object('role',case when m.active then m.role else null end,'playerId',case when m.active then m.player_id else null end,'canClaim',true,'revoked',false,
 'pending',(select c.player_id from app_private.multi_claim c where c.team_id=$1 and c.user_id=uid),
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position,
   'occupied',exists(select 1 from app_private.multi_membership x where x.team_id=$1 and x.player_id=p.id and x.active)) order by p.name),'[]'::jsonb)
   from app_private.multi_player p where p.team_id=$1 and not p.retired_from_team),
 'invite',case when m.active and m.role='admin' then (select i.token::text from app_private.multi_invitation i where i.team_id=$1) else null end,
 'linkedAccounts',case when m.active and m.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('playerId',x.player_id,'email',u.email)),'[]'::jsonb) from app_private.multi_membership x join auth.users u on u.id=x.user_id where x.team_id=$1 and x.active and x.player_id is not null) else '[]'::jsonb end,
 'claims',case when m.active and m.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('userId',c.user_id,'playerId',c.player_id,'email',u.email,'name',p.name) order by c.created_at),'[]'::jsonb) from app_private.multi_claim c join auth.users u on u.id=c.user_id join app_private.multi_player p on p.id=c.player_id and p.team_id=c.team_id where c.team_id=$1) else '[]'::jsonb end)
 into result;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION app_private.multi_sports_data(team text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=app_private.multi_verified_user(); member app_private.multi_membership; result jsonb;
begin
 select * into member from app_private.multi_membership where team_id=$1 and user_id=uid and active;
 if member.user_id is null or (member.role<>'admin' and member.player_id is null) then raise exception 'Sin acceso a este equipo'; end if;
 select jsonb_build_object('myPlayer',member.player_id,'role',member.role,
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position,'retiredFromTeam',p.retired_from_team) order by p.name),'[]'::jsonb) from app_private.multi_player p where p.team_id=$1),
 'tournaments',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'format',t.format) order by t.name),'[]'::jsonb) from app_private.multi_tournament t where t.team_id=$1),
 'roster',(select coalesce(jsonb_object_agg(x.tournament_id,x.players),'{}'::jsonb) from (select r.tournament_id,jsonb_agg(r.player_id order by r.player_id) players from app_private.multi_roster r join app_private.multi_tournament t on t.id=r.tournament_id where t.team_id=$1 group by r.tournament_id) x),
 'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'tournamentId',g.tournament_id,'opponent',g.opponent,'playedAt',g.played_on,'goalsFor',g.goals_for,'goalsAgainst',g.goals_against,'closed',g.ratings_closed,'open',g.ratings_open,
 'participants',(select coalesce(jsonb_agg(p.player_id),'[]'::jsonb) from app_private.multi_participant p where p.match_id=g.id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'playerId',e.player_id,'kind',e.kind,'context',e.context) order by e.id),'[]'::jsonb) from app_private.multi_event e where e.match_id=g.id)) order by g.played_on desc),'[]'::jsonb) from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where t.team_id=$1)) into result;
 return result;
end $function$;


