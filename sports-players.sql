create function app_private.sports_add_player(player_name text,shirt_number text,player_position text) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.ensure_verified(); result text:='player-'||gen_random_uuid()::text;
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Solo el administrador puede agregar jugadores'; end if;
 if $1 is null or length(trim($1)) not between 1 and 100 or $2 is null or length(trim($2)) not between 1 and 5 or $3 not in ('Portero','Defensa','Volante','Delantero') then raise exception 'Datos de jugador inválidos'; end if;
 insert into app_private.player(id,name,number,position) values(result,trim($1),trim($2),$3);
 return result;
end $$;
revoke all on function app_private.sports_add_player(text,text,text) from public,anon,authenticated;
grant execute on function app_private.sports_add_player(text,text,text) to authenticated;
create function public.sports_add_player(player_name text,shirt_number text,player_position text) returns text language sql security invoker set search_path='' as $$ select app_private.sports_add_player(player_name,shirt_number,player_position) $$;
revoke all on function public.sports_add_player(text,text,text) from public,anon;
grant execute on function public.sports_add_player(text,text,text) to authenticated;
