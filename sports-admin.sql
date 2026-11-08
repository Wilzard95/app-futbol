create function app_private.sports_create_tournament(tournament_name text, game_format smallint) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.ensure_verified(); result uuid;
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Solo el administrador puede crear torneos'; end if;
 if tournament_name is null or length(trim(tournament_name)) not between 1 and 100 or game_format not in (5,6,11) then raise exception 'Datos de torneo inválidos'; end if;
 insert into app_private.tournament(name,format,team_id) values(trim(tournament_name),game_format,'combo') returning id into result;
 return result;
end $$;
create function app_private.sports_create_match(tournament uuid, opponent text, played_on date, goals_for smallint, goals_against smallint, participants text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.ensure_verified(); result uuid;
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Solo el administrador puede crear partidos'; end if;
 if not exists(select 1 from app_private.tournament where id=$1 and team_id='combo') then raise exception 'Torneo inválido'; end if;
 if $2 is null or length(trim($2)) not between 1 and 100 or $3 is null or $4 is null or $5 is null or $4 not between 0 and 99 or $5 not between 0 and 99 then raise exception 'Datos del partido inválidos'; end if;
 if $6 is null or cardinality($6)=0 or cardinality($6)<>array_length(array(select distinct unnest($6)),1) or exists(select 1 from unnest($6) p where p is null or not exists(select 1 from app_private.player where id=p)) then raise exception 'Participantes inválidos'; end if;
 insert into app_private.match(tournament_id,opponent,played_on,goals_for,goals_against) values($1,trim($2),$3,$4,$5) returning id into result;
 insert into app_private.match_participant(match_id,player_id) select result,unnest($6);
 return result;
end $$;
create function app_private.sports_add_event(match_id uuid, player_id text, kind text, event_context text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.ensure_verified();
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Solo el administrador puede registrar acciones'; end if;
 perform 1 from app_private.match g join app_private.tournament t on t.id=g.tournament_id where g.id=$1 and t.team_id='combo' for update of g;
 if not found then raise exception 'Partido inválido'; end if;
 if exists(select 1 from app_private.rating_ballot b where b.match_id=$1) then raise exception 'El partido ya tiene valoraciones; no se pueden cambiar las acciones'; end if;
 if not exists(select 1 from app_private.match_participant p where p.match_id=$1 and p.player_id=$2) or $3 not in ('goal','assist','yellow_card','red_card','clean_sheet') or $4 is null or length($4)>280 then raise exception 'Acción inválida'; end if;
 insert into app_private.match_event(match_id,player_id,kind,context) values($1,$2,$3,trim($4));
end $$;
revoke all on function app_private.sports_create_tournament(text,smallint),app_private.sports_create_match(uuid,text,date,smallint,smallint,text[]),app_private.sports_add_event(uuid,text,text,text) from public,anon,authenticated;
grant execute on function app_private.sports_create_tournament(text,smallint),app_private.sports_create_match(uuid,text,date,smallint,smallint,text[]),app_private.sports_add_event(uuid,text,text,text) to authenticated;
create function public.sports_create_tournament(tournament_name text,game_format smallint) returns uuid language sql security invoker set search_path='' as $$ select app_private.sports_create_tournament(tournament_name,game_format) $$;
create function public.sports_create_match(tournament uuid,opponent text,played_on date,goals_for smallint,goals_against smallint,participants text[]) returns uuid language sql security invoker set search_path='' as $$ select app_private.sports_create_match(tournament,opponent,played_on,goals_for,goals_against,participants) $$;
create function public.sports_add_event(match_id uuid,player_id text,kind text,event_context text) returns void language sql security invoker set search_path='' as $$ select app_private.sports_add_event(match_id,player_id,kind,event_context) $$;
revoke all on function public.sports_create_tournament(text,smallint),public.sports_create_match(uuid,text,date,smallint,smallint,text[]),public.sports_add_event(uuid,text,text,text) from public,anon;
grant execute on function public.sports_create_tournament(text,smallint),public.sports_create_match(uuid,text,date,smallint,smallint,text[]),public.sports_add_event(uuid,text,text,text) to authenticated;
