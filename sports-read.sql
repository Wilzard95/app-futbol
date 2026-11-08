create function app_private.sports_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.ensure_verified(); m app_private.member; result jsonb;
begin
 select * into m from app_private.member where user_id=uid and active;
 if m.user_id is null or (m.role<>'admin' and m.player_id is null) then raise exception 'Sin acceso al equipo'; end if;
 select jsonb_build_object('myPlayer',m.player_id,'role',m.role,
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'position',p.position) order by p.name),'[]'::jsonb) from app_private.player p),
 'tournaments',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'format',t.format) order by t.name),'[]'::jsonb) from app_private.tournament t where t.team_id='combo'),
 'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'tournamentId',g.tournament_id,'opponent',g.opponent,'playedAt',g.played_on,'goalsFor',g.goals_for,'goalsAgainst',g.goals_against,'closed',g.ratings_closed,'open',g.ratings_open,
 'participants',(select coalesce(jsonb_agg(p.player_id),'[]'::jsonb) from app_private.match_participant p where p.match_id=g.id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'playerId',e.player_id,'kind',e.kind,'context',e.context) order by e.id),'[]'::jsonb) from app_private.match_event e where e.match_id=g.id)) order by g.played_on desc),'[]'::jsonb) from app_private.match g join app_private.tournament t on t.id=g.tournament_id where t.team_id='combo')) into result;
 return result;
end $$;
revoke all on function app_private.sports_data() from public,anon,authenticated;
grant execute on function app_private.sports_data() to authenticated;
create function public.sports_data() returns jsonb language sql security invoker set search_path='' as $$ select app_private.sports_data() $$;
revoke all on function public.sports_data() from public,anon;
grant execute on function public.sports_data() to authenticated;
