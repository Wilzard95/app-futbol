-- Delete one team atomically; account identities and other teams remain intact.
create function app_private.multi_delete_team(team text,confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); team_name text; legacy_player_ids text[]; legacy_member_ids uuid[];
begin
 select t.name into team_name from app_private.multi_team t join app_private.multi_membership m on m.team_id=t.id and m.user_id=uid and m.active and m.role='admin' where t.id=$1 and t.owner_user_id=uid for update of t;
 if team_name is null then raise exception 'Solo el creador puede eliminar este equipo'; end if;
 if $2 is distinct from team_name then raise exception 'El nombre de confirmación no coincide'; end if;
 -- The original combo team has an inaccessible, frozen legacy copy from migration.
 if $1='combo' then
   if exists(select 1 from app_private.team t where t.id<>'combo') then raise exception 'La copia anterior requiere revisión antes de eliminar el equipo'; end if;
   select coalesce(array_agg(p.id),'{}'::text[]) into legacy_player_ids from app_private.player p;
   select coalesce(array_agg(m.user_id),'{}'::uuid[]) into legacy_member_ids from app_private.member m;
   delete from app_private.rating_ballot b using app_private.match g,app_private.tournament t where b.match_id=g.id and g.tournament_id=t.id and t.team_id='combo';
   delete from app_private.lineup_proposal l using app_private.tournament t where l.tournament_id=t.id and t.team_id='combo';
   delete from app_private.match_event e using app_private.match g,app_private.tournament t where e.match_id=g.id and g.tournament_id=t.id and t.team_id='combo';
   delete from app_private.match_participant p using app_private.match g,app_private.tournament t where p.match_id=g.id and g.tournament_id=t.id and t.team_id='combo';
   delete from app_private.match g using app_private.tournament t where g.tournament_id=t.id and t.team_id='combo';
   delete from app_private.tournament_player r using app_private.tournament t where r.tournament_id=t.id and t.team_id='combo';
   delete from app_private.tournament t where t.team_id='combo';
   delete from app_private.claim c where c.player_id=any(legacy_player_ids);
   delete from app_private.member m where m.user_id=any(legacy_member_ids);
   delete from app_private.player p where p.id=any(legacy_player_ids);
   delete from app_private.team t where t.id='combo';
 end if;

 delete from app_private.multi_ballot b using app_private.multi_match g,app_private.multi_tournament t where b.match_id=g.id and g.tournament_id=t.id and t.team_id=$1;
 delete from app_private.multi_lineup l using app_private.multi_tournament t where l.tournament_id=t.id and t.team_id=$1;
 delete from app_private.multi_event e using app_private.multi_match g,app_private.multi_tournament t where e.match_id=g.id and g.tournament_id=t.id and t.team_id=$1;
 delete from app_private.multi_participant p using app_private.multi_match g,app_private.multi_tournament t where p.match_id=g.id and g.tournament_id=t.id and t.team_id=$1;
 delete from app_private.multi_match g using app_private.multi_tournament t where g.tournament_id=t.id and t.team_id=$1;
 delete from app_private.multi_roster r using app_private.multi_tournament t where r.tournament_id=t.id and t.team_id=$1;
 delete from app_private.multi_tournament t where t.team_id=$1;
 delete from app_private.multi_claim c where c.team_id=$1;
 delete from app_private.multi_invitation i where i.team_id=$1;
 delete from app_private.multi_membership m where m.team_id=$1;
 delete from app_private.multi_player p where p.team_id=$1;
 delete from app_private.multi_team t where t.id=$1;
end $$;
revoke all on function app_private.multi_delete_team(text,text) from public,anon,authenticated;
grant execute on function app_private.multi_delete_team(text,text) to authenticated;
create function public.multi_delete_team(team text,confirmation text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_delete_team(team,confirmation) $$;
revoke all on function public.multi_delete_team(text,text) from public,anon;
grant execute on function public.multi_delete_team(text,text) to authenticated;
