alter table app_private.match add column ratings_open boolean not null default false;
update app_private.match set ratings_open=true where id in (select g.id from app_private.match g join app_private.tournament t on t.id=g.tournament_id where t.team_id='combo' and t.name='Grama 5' and ((g.opponent='Los primeros' and g.played_on='2026-11-01') or (g.opponent='Compas' and g.played_on='2026-11-08')));
create function app_private.sports_open_ratings(match_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.ensure_verified();
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Solo el administrador puede abrir valoraciones'; end if;
 update app_private.match set ratings_open=true where id=$1 and not ratings_closed and tournament_id in (select id from app_private.tournament where team_id='combo');
 if not found then raise exception 'Partido inválido o cerrado'; end if;
end $$;
revoke all on function app_private.sports_open_ratings(uuid) from public,anon,authenticated;
grant execute on function app_private.sports_open_ratings(uuid) to authenticated;
create function public.sports_open_ratings(match_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.sports_open_ratings(match_id) $$;
revoke all on function public.sports_open_ratings(uuid) from public,anon;
grant execute on function public.sports_open_ratings(uuid) to authenticated;
