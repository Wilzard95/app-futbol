create or replace function app_private.multi_add_event(team text,match_id uuid,player_id text,kind text,event_context text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 perform 1 from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id=$1 for update of g;
 if not found then raise exception 'Partido inválido'; end if;
 if not exists(select 1 from app_private.multi_participant p where p.match_id=$2 and p.player_id=$3) or $4 is null or $4 not in ('goal','assist','yellow_card','red_card','clean_sheet') or $5 is null or length($5)>280 then raise exception 'Acción inválida'; end if;
 if $4='clean_sheet' and exists(select 1 from app_private.multi_event e where e.match_id=$2 and e.player_id=$3 and e.kind='clean_sheet') then raise exception 'Portería en cero duplicada'; end if;
 insert into app_private.multi_event values(gen_random_uuid(),$2,$3,$4,trim($5));
end $$;

create function app_private.multi_edit_match(team text, match_id uuid, opponent text, played_on date, goals_for smallint, goals_against smallint, participants text[]) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 perform app_private.multi_admin($1);
 select g.tournament_id into tid from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id=$1 for update of g;
 if tid is null then raise exception 'Partido no encontrado'; end if;
 if $3 is null or length(trim($3)) not between 1 and 100 or $4 is null or $5 is null or $6 is null or $5 not between 0 and 99 or $6 not between 0 and 99 then raise exception 'Datos del partido inválidos'; end if;
 if $7 is null or cardinality($7)=0 or cardinality($7)<>(select count(distinct x) from unnest($7) x) or exists(select 1 from unnest($7) x where x is null or (not exists(select 1 from app_private.multi_participant p where p.match_id=$2 and p.player_id=x) and not exists(select 1 from app_private.multi_roster r where r.tournament_id=tid and r.player_id=x))) then raise exception 'Participantes inválidos'; end if;
 if exists(select 1 from app_private.multi_ballot b where b.match_id=$2 and (not (b.author_player_id=any($7)) or not (b.target_player_id=any($7)))) then raise exception 'No se puede retirar un jugador que haya valorado o recibido valoraciones'; end if;
 if exists(select 1 from app_private.multi_event e where e.match_id=$2 and not (e.player_id=any($7))) then raise exception 'Primero elimina o reasigna las acciones de los jugadores que quieres retirar'; end if;
 update app_private.multi_match g set opponent=trim($3),played_on=$4,goals_for=$5,goals_against=$6 where g.id=$2;
 delete from app_private.multi_participant p where p.match_id=$2 and not (p.player_id=any($7));
 insert into app_private.multi_participant(match_id,player_id) select $2,x from unnest($7) x where not exists(select 1 from app_private.multi_participant p where p.match_id=$2 and p.player_id=x);
end $$;

create function app_private.multi_edit_match_event(team text,match_id uuid,event_id uuid,player_id text,kind text,event_context text,remove_event boolean) returns void language plpgsql security definer set search_path='' as $$
declare old_player text; old_kind text; old_context text;
begin
 perform app_private.multi_admin($1);
 perform 1 from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id=$1 for update of g;
 if not found then raise exception 'Partido no encontrado'; end if;
 select e.player_id,e.kind,e.context into old_player,old_kind,old_context from app_private.multi_event e where e.id=$3 and e.match_id=$2;
 if not found then raise exception 'Acción no encontrada'; end if;
 if $7 is null then raise exception 'Acción inválida'; end if;
 if not $7 and (not exists(select 1 from app_private.multi_participant p where p.match_id=$2 and p.player_id=$4) or $5 is null or $5 not in ('goal','assist','yellow_card','red_card','clean_sheet') or $6 is null or length($6)>280) then raise exception 'Acción inválida'; end if;
 if not $7 and $5='clean_sheet' and exists(select 1 from app_private.multi_event e where e.match_id=$2 and e.player_id=$4 and e.kind='clean_sheet' and e.id<>$3) then raise exception 'Portería en cero duplicada'; end if;
 if $7 or old_player is distinct from $4 or old_kind is distinct from $5 or old_context is distinct from trim($6) then
  update app_private.multi_ballot b set adjustments=coalesce((select jsonb_agg(a.item order by a.ord) from jsonb_array_elements(b.adjustments) with ordinality a(item,ord) where a.item->>'eventId'<>$3::text),'[]'::jsonb), final_score=greatest(1,least(10,b.base_score+coalesce((select sum((a.item->>'value')::numeric) from jsonb_array_elements(b.adjustments) a(item) where a.item->>'eventId'<>$3::text),0))) where b.match_id=$2 and exists(select 1 from jsonb_array_elements(b.adjustments) a(item) where a.item->>'eventId'=$3::text);
 end if;
 if $7 then delete from app_private.multi_event e where e.id=$3 and e.match_id=$2;
 else update app_private.multi_event e set player_id=$4,kind=$5,context=trim($6) where e.id=$3 and e.match_id=$2; end if;
end $$;

create function app_private.multi_delete_match(team text,match_id uuid,confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare opponent_name text;
begin
 perform app_private.multi_admin($1);
 select g.opponent into opponent_name from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id=$1 for update of g;
 if opponent_name is null then raise exception 'Partido no encontrado'; end if;
 if $3 is distinct from opponent_name then raise exception 'El nombre del rival no coincide'; end if;
 if $1='combo' and exists(select 1 from app_private.match g join app_private.tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id='combo') then
  delete from app_private.rating_ballot b where b.match_id=$2;
  delete from app_private.match_event e where e.match_id=$2;
  delete from app_private.match_participant p where p.match_id=$2;
  delete from app_private.match g where g.id=$2;
 end if;
 delete from app_private.multi_ballot b where b.match_id=$2;
 delete from app_private.multi_event e where e.match_id=$2;
 delete from app_private.multi_participant p where p.match_id=$2;
 delete from app_private.multi_match g where g.id=$2;
end $$;
revoke all on function app_private.multi_edit_match(text,uuid,text,date,smallint,smallint,text[]),app_private.multi_edit_match_event(text,uuid,uuid,text,text,text,boolean),app_private.multi_delete_match(text,uuid,text) from public,anon,authenticated;
grant execute on function app_private.multi_edit_match(text,uuid,text,date,smallint,smallint,text[]),app_private.multi_edit_match_event(text,uuid,uuid,text,text,text,boolean),app_private.multi_delete_match(text,uuid,text) to authenticated;
create function public.multi_edit_match(team text,match_id uuid,opponent text,played_on date,goals_for smallint,goals_against smallint,participants text[]) returns void language sql security invoker set search_path='' as $$ select app_private.multi_edit_match(team,match_id,opponent,played_on,goals_for,goals_against,participants) $$;
create function public.multi_edit_match_event(team text,match_id uuid,event_id uuid,player_id text,kind text,event_context text,remove_event boolean) returns void language sql security invoker set search_path='' as $$ select app_private.multi_edit_match_event(team,match_id,event_id,player_id,kind,event_context,remove_event) $$;
create function public.multi_delete_match(team text,match_id uuid,confirmation text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_delete_match(team,match_id,confirmation) $$;
revoke all on function public.multi_edit_match(text,uuid,text,date,smallint,smallint,text[]),public.multi_edit_match_event(text,uuid,uuid,text,text,text,boolean),public.multi_delete_match(text,uuid,text) from public,anon;
grant execute on function public.multi_edit_match(text,uuid,text,date,smallint,smallint,text[]),public.multi_edit_match_event(text,uuid,uuid,text,text,text,boolean),public.multi_delete_match(text,uuid,text) to authenticated;

