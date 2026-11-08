-- Apply after accounts-setup.sql: expose invoker wrappers around private checked functions.
alter function public.account_context(text) set schema app_private;
alter function public.account_request(text,text) set schema app_private;
alter function public.account_decide(uuid,boolean) set schema app_private;
alter function public.account_unlink(text) set schema app_private;
alter function public.account_new_invite() set schema app_private;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.account_context(text), app_private.account_request(text,text), app_private.account_decide(uuid,boolean), app_private.account_unlink(text), app_private.account_new_invite() to authenticated;
create function public.account_context(invite_code text default null) returns jsonb language sql security invoker set search_path='' as $$ select app_private.account_context(invite_code) $$;
create function public.account_request(player text, invite_code text default null) returns void language sql security invoker set search_path='' as $$ select app_private.account_request(player,invite_code) $$;
create function public.account_decide(claimant uuid, approve boolean) returns void language sql security invoker set search_path='' as $$ select app_private.account_decide(claimant,approve) $$;
create function public.account_unlink(player text) returns void language sql security invoker set search_path='' as $$ select app_private.account_unlink(player) $$;
create function public.account_new_invite() returns void language sql security invoker set search_path='' as $$ select app_private.account_new_invite() $$;
revoke all on function public.account_context(text), public.account_request(text,text), public.account_decide(uuid,boolean), public.account_unlink(text), public.account_new_invite() from public, anon;
grant execute on function public.account_context(text), public.account_request(text,text), public.account_decide(uuid,boolean), public.account_unlink(text), public.account_new_invite() to authenticated;

create function app_private.account_remove_player(player text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.ensure_verified(); removed uuid;
begin
 if not exists(select 1 from app_private.member where user_id=uid and active and role='admin') then raise exception 'Sin permiso'; end if;
 update app_private.member set active=false,player_id=null where player_id=$1 and active and role='player' returning user_id into removed;
 if removed is null then raise exception 'No se encontró una cuenta de jugador activa'; end if;
end $$;
revoke all on function app_private.account_remove_player(text) from public, anon, authenticated;
grant execute on function app_private.account_remove_player(text) to authenticated;
create function public.account_remove_player(player text) returns void language sql security invoker set search_path='' as $$ select app_private.account_remove_player(player) $$;
revoke all on function public.account_remove_player(text) from public, anon;
grant execute on function public.account_remove_player(text) to authenticated;
