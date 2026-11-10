-- Draft: team-scoped sports writes. Apply only as part of the complete cutover.
create function app_private.multi_add_player(team text, player_name text, shirt_number text, player_position text) returns text language plpgsql security definer set search_path='' as $$
declare result text:='player-'||gen_random_uuid()::text;
begin
 perform app_private.multi_admin($1);
 if $2 is null or length(trim($2)) not between 1 and 100 or $3 is null or length(trim($3)) not between 1 and 5 or $4 not in ('Portero','Defensa','Volante','Delantero') then raise exception 'Datos de jugador inválidos'; end if;
 insert into app_private.multi_player(id,team_id,name,number,position) values(result,$1,trim($2),trim($3),$4);
 return result;
end $$;
create function app_private.multi_create_tournament(team text,tournament_name text,game_format smallint) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid:=gen_random_uuid();
begin
 perform app_private.multi_admin($1);
 if $2 is null or length(trim($2)) not between 1 and 100 or $3 is null or $3 not in (5,6,11) then raise exception 'Datos de torneo inválidos'; end if;
 insert into app_private.multi_tournament(id,team_id,name,format) values(result,$1,trim($2),$3); return result;
end $$;
create function app_private.multi_enroll_player(team text,tournament uuid,player_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 if not exists(select 1 from app_private.multi_tournament where id=$2 and team_id=$1) or not exists(select 1 from app_private.multi_player where id=$3 and team_id=$1) then raise exception 'Torneo o jugador inválido'; end if;
 insert into app_private.multi_roster values($2,$3) on conflict do nothing;
end $$;
create function app_private.multi_create_roster_player(team text,tournament uuid,player_name text,shirt_number text,player_position text) returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 perform app_private.multi_admin($1);
 if not exists(select 1 from app_private.multi_tournament where id=$2 and team_id=$1) then raise exception 'Torneo inválido'; end if;
 result:=app_private.multi_add_player($1,$3,$4,$5); perform app_private.multi_enroll_player($1,$2,result); return result;
end $$;
create function app_private.multi_create_match(team text,tournament uuid,opponent text,played_on date,goals_for smallint,goals_against smallint,participants text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid:=gen_random_uuid();
begin
 perform app_private.multi_admin($1);
 if not exists(select 1 from app_private.multi_tournament where id=$2 and team_id=$1) then raise exception 'Torneo inválido'; end if;
 if $3 is null or length(trim($3)) not between 1 and 100 or $4 is null or $5 is null or $6 is null or $5 not between 0 and 99 or $6 not between 0 and 99 then raise exception 'Datos del partido inválidos'; end if;
 if $7 is null or cardinality($7)=0 or cardinality($7)<>(select count(distinct p) from unnest($7) p) or exists(select 1 from unnest($7) p where p is null or not exists(select 1 from app_private.multi_roster r where r.tournament_id=$2 and r.player_id=p)) then raise exception 'Participantes inválidos'; end if;
 insert into app_private.multi_match values(result,$2,trim($3),$4,$5,$6,false,false);
 insert into app_private.multi_participant(match_id,player_id) select result,unnest($7); return result;
end $$;
create function app_private.multi_add_event(team text,match_id uuid,player_id text,kind text,event_context text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 perform 1 from app_private.multi_match g join app_private.multi_tournament t on t.id=g.tournament_id where g.id=$2 and t.team_id=$1 for update of g;
 if not found then raise exception 'Partido inválido'; end if;
 if exists(select 1 from app_private.multi_ballot b where b.match_id=$2) then raise exception 'El partido ya tiene valoraciones; no se pueden cambiar las acciones'; end if;
 if not exists(select 1 from app_private.multi_participant p where p.match_id=$2 and p.player_id=$3) or $4 is null or $4 not in ('goal','assist','yellow_card','red_card','clean_sheet') or $5 is null or length($5)>280 then raise exception 'Acción inválida'; end if;
 if $4='clean_sheet' and exists(select 1 from app_private.multi_event e where e.match_id=$2 and e.player_id=$3 and e.kind='clean_sheet') then raise exception 'Portería en cero duplicada'; end if;
 insert into app_private.multi_event values(gen_random_uuid(),$2,$3,$4,trim($5));
end $$;
create function app_private.multi_open_ratings(team text,match_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 update app_private.multi_match set ratings_open=true where id=$2 and not ratings_closed and tournament_id in (select id from app_private.multi_tournament where team_id=$1);
 if not found then raise exception 'Partido inválido o cerrado'; end if;
end $$;
revoke all on function app_private.multi_add_player(text,text,text,text),app_private.multi_create_tournament(text,text,smallint),app_private.multi_enroll_player(text,uuid,text),app_private.multi_create_roster_player(text,uuid,text,text,text),app_private.multi_create_match(text,uuid,text,date,smallint,smallint,text[]),app_private.multi_add_event(text,uuid,text,text,text),app_private.multi_open_ratings(text,uuid) from public,anon,authenticated;
grant execute on function app_private.multi_add_player(text,text,text,text),app_private.multi_create_tournament(text,text,smallint),app_private.multi_enroll_player(text,uuid,text),app_private.multi_create_roster_player(text,uuid,text,text,text),app_private.multi_create_match(text,uuid,text,date,smallint,smallint,text[]),app_private.multi_add_event(text,uuid,text,text,text),app_private.multi_open_ratings(text,uuid) to authenticated;
