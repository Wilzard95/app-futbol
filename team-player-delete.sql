-- Delete only profiles with no match or lineup history, including retired profiles.
create function app_private.multi_delete_unused_player(team text,player_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.multi_admin($1);
 perform 1 from app_private.multi_player p where p.team_id=$1 and p.id=$2 for update;
 if not found then raise exception 'Ficha no encontrada en este equipo'; end if;
 if exists(select 1 from app_private.multi_participant p where p.player_id=$2)
    or exists(select 1 from app_private.multi_lineup l where l.author_player_id=$2 or exists(select 1 from jsonb_each_text(l.picks) pick where pick.value=$2)) then
   raise exception 'No se puede eliminar: el jugador tiene historial de partidos o titulares. Puedes retirarlo del equipo y conservar su historial.';
 end if;
 delete from app_private.multi_roster r using app_private.multi_tournament t where r.tournament_id=t.id and t.team_id=$1 and r.player_id=$2;
 delete from app_private.multi_claim c where c.team_id=$1 and c.player_id=$2;
 update app_private.multi_membership m set player_id=null,active=(m.active and m.role='admin') where m.team_id=$1 and m.player_id=$2;
 delete from app_private.multi_player p where p.team_id=$1 and p.id=$2;
end $$;
revoke all on function app_private.multi_delete_unused_player(text,text) from public,anon,authenticated;
grant execute on function app_private.multi_delete_unused_player(text,text) to authenticated;
create function public.multi_delete_unused_player(team text,player_id text) returns void language sql security invoker set search_path='' as $$ select app_private.multi_delete_unused_player(team,player_id) $$;
revoke all on function public.multi_delete_unused_player(text,text) from public,anon;
grant execute on function public.multi_delete_unused_player(text,text) to authenticated;

-- Serialize lineup selections with deletion of the selected profile.
create function app_private.multi_lock_lineup_players() returns trigger language plpgsql security definer set search_path='' as $$
declare chosen text;
begin
 for chosen in select distinct value from jsonb_each_text(new.picks) order by value loop
  perform 1 from app_private.multi_player p where p.id=chosen for share;
  if not found then raise exception 'La titular contiene una ficha que ya no existe'; end if;
 end loop;
 return new;
end $$;
revoke all on function app_private.multi_lock_lineup_players() from public,anon,authenticated;
create trigger multi_lineup_lock_players before insert or update of picks on app_private.multi_lineup for each row execute function app_private.multi_lock_lineup_players();

