-- Draft writes. Run only in a rolled-back test until full cutover.
create function app_private.multi_rating_submit(match_id uuid, target text, score numeric, adjustments jsonb, comment text, reaction text, team text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.multi_verified_user(); author_player text; item jsonb; event_kind text; event_uuid uuid; seen uuid[] := '{}'; total numeric:=0; amount numeric;
begin
 if not exists(select 1 from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$1 and t.team_id=$7) then raise exception 'Partido inválido'; end if;
 select m.player_id into author_player from app_private.multi_membership m where m.team_id=$7 and m.user_id=uid and m.active;
 if author_player is null or not exists(select 1 from app_private.multi_participant p where p.match_id=$1 and p.player_id=author_player) then raise exception 'Solo participantes pueden valorar'; end if;
 if not exists(select 1 from app_private.multi_participant p where p.match_id=$1 and p.player_id=$2) then raise exception 'Solo participantes reciben valoraciones'; end if;
 perform 1 from app_private.multi_match m where m.id=$1 and m.ratings_open and not m.ratings_closed for update;
 if not found then raise exception 'Las valoraciones aún no están abiertas o el partido está cerrado'; end if;
 if $3 is null or $3 not between 1 and 10 or $3::text in ('NaN','Infinity','-Infinity') then raise exception 'Nota inválida'; end if;
 if $4 is null or jsonb_typeof($4)<>'array' or jsonb_array_length($4)>100 then raise exception 'Ajustes inválidos'; end if;
 if $5 is null or length($5)>500 or ($6 is not null and $6 not in ('approve','disapprove')) then raise exception 'Comentario o reacción inválidos'; end if;
 for item in select * from jsonb_array_elements($4) loop
   if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'eventId') is distinct from 'string' or jsonb_typeof(item->'value') is distinct from 'number' then raise exception 'Ajuste inválido'; end if;
   begin event_uuid := (item->>'eventId')::uuid; amount := (item->>'value')::numeric; exception when others then raise exception 'Ajuste inválido'; end;
   if event_uuid=any(seen) then raise exception 'Acción duplicada'; end if;
   seen := array_append(seen,event_uuid);
   select e.kind into event_kind from app_private.multi_event e where e.id=event_uuid and e.match_id=$1 and e.player_id=$2;
   if event_kind is null then raise exception 'La acción no pertenece al jugador'; end if;
   if not (case event_kind when 'goal' then amount between 0 and 1 when 'assist' then amount between 0 and 0.5 when 'clean_sheet' then amount between 0 and 1 when 'yellow_card' then amount between -2 and 2 when 'red_card' then amount between -3 and 3 else false end) then raise exception 'Ajuste fuera de rango'; end if;
   total:=total+amount;
 end loop;
 insert into app_private.multi_ballot(match_id,author_user_id,author_player_id,target_player_id,base_score,final_score,adjustments,comment,reaction)
 values($1,uid,author_player,$2,$3,greatest(1,least(10,$3+total)),$4,$5,$6)
 on conflict on constraint multi_rating_one_per_player do update set base_score=excluded.base_score,final_score=excluded.final_score,adjustments=excluded.adjustments,comment=excluded.comment,reaction=excluded.reaction where app_private.multi_ballot.author_user_id=uid;
 if not found then raise exception 'Esta ficha ya tiene una valoración previa de otra cuenta'; end if;
end $$;


create function app_private.multi_lineup_submit(tournament uuid, formation text, picks jsonb, team text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); author_player text; fmt smallint; lines int[]; required text[]:=array['gk']; i int; j int; picked text[];
begin
 select player_id into author_player from app_private.multi_membership where team_id=$4 and user_id=uid and active;
 if author_player is null or not exists(select 1 from app_private.multi_roster r where r.tournament_id=$1 and r.player_id=author_player) then raise exception 'Solo jugadores inscritos pueden proponer'; end if;
 select t.format into fmt from app_private.multi_tournament t where t.id=$1 and t.team_id=$4;
 lines:=case $2
  when 'f5-1-2-1' then array[1,2,1] when 'f5-2-2' then array[2,2] when 'f5-1-3' then array[1,3]
  when 'f6-3-2' then array[3,2] when 'f6-3-1-1' then array[3,1,1] when 'f6-2-2-1' then array[2,2,1] when 'f6-2-3' then array[2,3]
  when 'f11-4-3-3' then array[4,3,3] when 'f11-4-4-2' then array[4,4,2] when 'f11-3-5-2' then array[3,5,2] when 'f11-4-2-3-1' then array[4,2,3,1] else null end;
 if fmt is null or lines is null or split_part($2,'-',1)<>'f'||fmt::text then raise exception 'Formación inválida para el torneo'; end if;
 if $3 is null or jsonb_typeof($3) is distinct from 'object' then raise exception 'Titular inválida'; end if;
 for i in 1..array_length(lines,1) loop for j in 1..lines[i] loop required:=array_append(required,'row-'||(i-1)||'-'||(j-1)); end loop; end loop;
 if (select count(*) from jsonb_object_keys($3))<>cardinality(required) or exists(select 1 from unnest(required) s where not ($3 ? s) or jsonb_typeof($3->s) is distinct from 'string') then raise exception 'Completa todas las posiciones'; end if;
 select array_agg(value) into picked from jsonb_each_text($3);
 if cardinality(picked)<>(select count(distinct p) from unnest(picked) p) or exists(select 1 from unnest(picked) p where not exists(select 1 from app_private.multi_player where id=p and team_id=$4)) or exists(select 1 from unnest(picked) p where not exists(select 1 from app_private.multi_roster r where r.tournament_id=$1 and r.player_id=p)) then raise exception 'Jugadores repetidos o inválidos'; end if;
 insert into app_private.multi_lineup(tournament_id,author_user_id,author_player_id,formation_id,picks) values($1,uid,author_player,$2,$3)
 on conflict on constraint multi_lineup_one_per_player do update set formation_id=excluded.formation_id,picks=excluded.picks where app_private.multi_lineup.author_user_id=uid;
 if not found then raise exception 'Esta ficha ya tiene una propuesta previa de otra cuenta'; end if;
end $$;


revoke all on function app_private.multi_rating_submit(uuid,text,numeric,jsonb,text,text,text),app_private.multi_lineup_submit(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function app_private.multi_rating_submit(uuid,text,numeric,jsonb,text,text,text),app_private.multi_lineup_submit(uuid,text,jsonb,text) to authenticated;
