create table app_private.lineup_proposal (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references app_private.tournament(id),
 author_user_id uuid not null references auth.users(id),
 author_player_id text not null references app_private.player(id),
 formation_id text not null,
 picks jsonb not null,
 unique(tournament_id,author_user_id),
 constraint lineup_one_per_player unique(tournament_id,author_player_id)
);
alter table app_private.lineup_proposal enable row level security;
revoke all on app_private.lineup_proposal from public,anon,authenticated;

create function app_private.lineup_submit(tournament uuid, formation text, picks jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.ensure_verified(); author_player text; fmt smallint; lines int[]; required text[]:=array['gk']; i int; j int; picked text[];
begin
 select player_id into author_player from app_private.member where user_id=uid and active;
 if author_player is null then raise exception 'Solo jugadores vinculados pueden proponer'; end if;
 select t.format into fmt from app_private.tournament t where t.id=$1 and t.team_id='combo';
 lines:=case $2
  when 'f5-1-2-1' then array[1,2,1] when 'f5-2-2' then array[2,2] when 'f5-1-3' then array[1,3]
  when 'f6-3-2' then array[3,2] when 'f6-3-1-1' then array[3,1,1] when 'f6-2-2-1' then array[2,2,1] when 'f6-2-3' then array[2,3]
  when 'f11-4-3-3' then array[4,3,3] when 'f11-4-4-2' then array[4,4,2] when 'f11-3-5-2' then array[3,5,2] when 'f11-4-2-3-1' then array[4,2,3,1] else null end;
 if fmt is null or lines is null or split_part($2,'-',1)<>'f'||fmt::text then raise exception 'Formación inválida para el torneo'; end if;
 if $3 is null or jsonb_typeof($3) is distinct from 'object' then raise exception 'Titular inválida'; end if;
 for i in 1..array_length(lines,1) loop for j in 1..lines[i] loop required:=array_append(required,'row-'||(i-1)||'-'||(j-1)); end loop; end loop;
 if (select count(*) from jsonb_object_keys($3))<>cardinality(required) or exists(select 1 from unnest(required) s where not ($3 ? s) or jsonb_typeof($3->s) is distinct from 'string') then raise exception 'Completa todas las posiciones'; end if;
 select array_agg(value) into picked from jsonb_each_text($3);
 if cardinality(picked)<>(select count(distinct p) from unnest(picked) p) or exists(select 1 from unnest(picked) p where not exists(select 1 from app_private.player where id=p)) then raise exception 'Jugadores repetidos o inválidos'; end if;
 insert into app_private.lineup_proposal(tournament_id,author_user_id,author_player_id,formation_id,picks) values($1,uid,author_player,$2,$3)
 on conflict on constraint lineup_one_per_player do update set formation_id=excluded.formation_id,picks=excluded.picks where app_private.lineup_proposal.author_user_id=uid;
 if not found then raise exception 'Esta ficha ya tiene una propuesta previa de otra cuenta'; end if;
end $$;

create function app_private.lineup_data(tournament uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.ensure_verified(); result jsonb;
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and (role='admin' or player_id is not null)) then raise exception 'Sin acceso al equipo'; end if;
 if not exists(select 1 from app_private.tournament where id=$1 and team_id='combo') then raise exception 'Torneo inválido'; end if;
 select jsonb_build_object(
 'mine',(select jsonb_build_object('id',l.id,'formationId',l.formation_id,'picks',l.picks) from app_private.lineup_proposal l where l.tournament_id=$1 and l.author_user_id=uid),
 'proposals',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'formationId',l.formation_id,'picks',l.picks) order by l.id),'[]'::jsonb) from app_private.lineup_proposal l where l.tournament_id=$1),
 'averages',(select coalesce(jsonb_object_agg(x.target_player_id,x.tournament_average),'{}'::jsonb) from (select target_player_id,avg(match_average) tournament_average from (select b.target_player_id,b.match_id,avg(b.final_score) match_average from app_private.rating_ballot b join app_private.match g on g.id=b.match_id where g.tournament_id=$1 group by b.target_player_id,b.match_id) matches group by target_player_id) x)) into result;
 return result;
end $$;
revoke all on function app_private.lineup_submit(uuid,text,jsonb),app_private.lineup_data(uuid) from public,anon,authenticated;
grant execute on function app_private.lineup_submit(uuid,text,jsonb),app_private.lineup_data(uuid) to authenticated;
create function public.lineup_submit(tournament uuid,formation text,picks jsonb) returns void language sql security invoker set search_path='' as $$ select app_private.lineup_submit(tournament,formation,picks) $$;
create function public.lineup_data(tournament uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.lineup_data(tournament) $$;
revoke all on function public.lineup_submit(uuid,text,jsonb),public.lineup_data(uuid) from public,anon;
grant execute on function public.lineup_submit(uuid,text,jsonb),public.lineup_data(uuid) to authenticated;
