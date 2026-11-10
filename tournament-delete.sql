-- Remove only a tournament and its match, voting and lineup records.
create function app_private.multi_delete_tournament(team text,tournament uuid,confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare tournament_name text;
begin
 perform app_private.multi_admin($1);
 select t.name into tournament_name from app_private.multi_tournament t where t.id=$2 and t.team_id=$1 for update;
 if tournament_name is null then raise exception 'Torneo no encontrado en este equipo'; end if;
 if $3 is distinct from tournament_name then raise exception 'El nombre de confirmación no coincide'; end if;

 -- Remove the frozen legacy copy only when it belongs to this same tournament.
 if $1='combo' and exists(select 1 from app_private.tournament t where t.id=$2 and t.team_id='combo') then
   delete from app_private.rating_ballot b using app_private.match g where b.match_id=g.id and g.tournament_id=$2;
   delete from app_private.lineup_proposal l where l.tournament_id=$2;
   delete from app_private.match_event e using app_private.match g where e.match_id=g.id and g.tournament_id=$2;
   delete from app_private.match_participant p using app_private.match g where p.match_id=g.id and g.tournament_id=$2;
   delete from app_private.match g where g.tournament_id=$2;
   delete from app_private.tournament_player r where r.tournament_id=$2;
   delete from app_private.tournament t where t.id=$2 and t.team_id='combo';
 end if;

 delete from app_private.multi_ballot b using app_private.multi_match g where b.match_id=g.id and g.tournament_id=$2;
 delete from app_private.multi_lineup l where l.tournament_id=$2;
 delete from app_private.multi_event e using app_private.multi_match g where e.match_id=g.id and g.tournament_id=$2;
 delete from app_private.multi_participant p using app_private.multi_match g where p.match_id=g.id and g.tournament_id=$2;
 delete from app_private.multi_match g where g.tournament_id=$2;
 delete from app_private.multi_roster r where r.tournament_id=$2;
 delete from app_private.multi_tournament t where t.id=$2 and t.team_id=$1;
end $$;
revoke all on function app_private.multi_delete_tournament(text,uuid,text) from public,anon,authenticated;
grant execute on function app_private.multi_delete_tournament(text,uuid,text) to authenticated;
create function public.multi_delete_tournament(team text,tournament uuid,confirmation text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_delete_tournament(team,tournament,confirmation) $$;
revoke all on function public.multi_delete_tournament(text,uuid,text) from public,anon;
grant execute on function public.multi_delete_tournament(text,uuid,text) to authenticated;
