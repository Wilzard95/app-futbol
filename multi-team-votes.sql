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
