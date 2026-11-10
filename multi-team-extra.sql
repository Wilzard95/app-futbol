create function app_private.multi_rating_mine(team text,match_id uuid,target text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); result jsonb;
begin
 if not exists(select 1 from app_private.multi_membership m join app_private.multi_participant p on p.player_id=m.player_id join app_private.multi_match g on g.id=p.match_id join app_private.multi_tournament t on t.id=g.tournament_id where m.team_id=$1 and t.team_id=$1 and m.user_id=uid and m.active and p.match_id=$2) then raise exception 'Solo participantes pueden valorar'; end if;
 select jsonb_build_object('score',b.base_score,'adjustments',b.adjustments,'comment',b.comment,'reaction',b.reaction) into result from app_private.multi_ballot b where b.match_id=$2 and b.target_player_id=$3 and b.author_user_id=uid;
 return result;
end $$;
revoke all on function app_private.multi_rating_mine(text,uuid,text) from public,anon,authenticated;
grant execute on function app_private.multi_rating_mine(text,uuid,text) to authenticated;
