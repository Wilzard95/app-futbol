-- Remove only a current tournament registration; historical records remain.
create function app_private.multi_unenroll_player(team text,tournament uuid,player_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 if not exists(select 1 from app_private.multi_tournament t where t.id=$2 and t.team_id=$1) or not exists(select 1 from app_private.multi_player p where p.id=$3 and p.team_id=$1) then raise exception 'Torneo o jugador inválido'; end if;
 delete from app_private.multi_roster r where r.tournament_id=$2 and r.player_id=$3;
 if not found then raise exception 'El jugador no está inscrito en este torneo'; end if;
end $$;
revoke all on function app_private.multi_unenroll_player(text,uuid,text) from public,anon,authenticated;
grant execute on function app_private.multi_unenroll_player(text,uuid,text) to authenticated;
create function public.multi_unenroll_player(team text,tournament uuid,player_id text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_unenroll_player(team,tournament,player_id) $$;
revoke all on function public.multi_unenroll_player(text,uuid,text) from public,anon;
grant execute on function public.multi_unenroll_player(text,uuid,text) to authenticated;

-- Serialize new participant entries with registration removal.
create function app_private.multi_check_participant_roster() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from app_private.multi_roster r join app_private.multi_match g on g.tournament_id=r.tournament_id where g.id=new.match_id and r.player_id=new.player_id for key share of r;
 if not found then raise exception 'El participante no está inscrito en el torneo'; end if;
 return new;
end $$;
revoke all on function app_private.multi_check_participant_roster() from public,anon,authenticated;
create trigger multi_participant_roster_check before insert or update on app_private.multi_participant for each row execute function app_private.multi_check_participant_roster();
