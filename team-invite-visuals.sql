-- A verified invitee may see the same player identities as the invited roster.
create function app_private.multi_invite_visuals(invite_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare info jsonb; team_id text; result jsonb;
begin
 info:=app_private.multi_invite_info($1);
 team_id:=info->>'teamId';
 select jsonb_build_object('teamId',t.id,'crest',t.crest,'players',coalesce((select jsonb_object_agg(p.id,jsonb_build_object('photo',p.photo,'avatar',p.avatar)) from app_private.multi_player p where p.team_id=t.id),'{}'::jsonb)) into result from app_private.multi_team t where t.id=team_id;
 return result;
end $$;
revoke all on function app_private.multi_invite_visuals(text) from public,anon,authenticated;
grant execute on function app_private.multi_invite_visuals(text) to authenticated;
create function public.multi_invite_visuals(invite_code text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_invite_visuals(invite_code) $$;
revoke all on function public.multi_invite_visuals(text) from public,anon;
grant execute on function public.multi_invite_visuals(text) to authenticated;
