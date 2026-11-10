alter table app_private.multi_coach add column photo text, add column avatar jsonb;
create function app_private.clear_unlinked_coach_visuals() returns trigger language plpgsql set search_path='' as $$
begin
 if old.user_id is not null and new.user_id is distinct from old.user_id then new.photo:=null; new.avatar:=null; end if;
 return new;
end $$;
create trigger coach_clear_visuals before update of user_id on app_private.multi_coach for each row execute function app_private.clear_unlinked_coach_visuals();

create function app_private.multi_coach_visuals(team text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user();
begin
 if not exists(select 1 from app_private.multi_membership m where m.team_id=$1 and m.user_id=uid and m.active and (m.role='admin' or m.player_id is not null)) then raise exception 'Sin acceso a este equipo'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'photo',c.photo,'avatar',c.avatar) order by c.name) from app_private.multi_coach c where c.team_id=$1),'[]'::jsonb);
end $$;
create function app_private.multi_set_coach_visuals(team text,photo text,avatar jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user();
begin
 if not exists(select 1 from app_private.multi_membership m join app_private.multi_coach c on c.team_id=m.team_id and c.user_id=m.user_id where m.team_id=$1 and m.user_id=uid and m.active) then raise exception 'Necesitas una ficha de entrenador vinculada'; end if;
 if $2 is not null and (length($2)>100000 or $2 !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$') then raise exception 'Imagen inválida'; end if;
 if $3 is not null and (jsonb_typeof($3)<>'object' or length($3::text)>300 or coalesce($3->>'skin','') not in ('#f2c6a0','#d99568','#8d5235','#5c3828') or coalesce($3->>'hair','') not in ('#241811','#5b3421','#9a6d38','#ded0aa') or coalesce($3->>'shirt','') not in ('#17623e','#173c74','#b63131','#e6b931','#ef7a27','#7b3e9d','#1d8790','#181f25','#f3f4ef','#e35f8e','#77943d','#69a7dc') or coalesce($3->>'style','') not in ('short','long','none','curly','spiky','side') or ($3 ? 'usePhoto' and jsonb_typeof($3->'usePhoto') <> 'boolean') or ($3 ? 'photoX' and case when jsonb_typeof($3->'photoX')='number' then ($3->>'photoX')::numeric not between -1 and 1 else true end) or ($3 ? 'photoY' and case when jsonb_typeof($3->'photoY')='number' then ($3->>'photoY')::numeric not between -1 and 1 else true end)) then raise exception 'Avatar inválido'; end if;
 update app_private.multi_coach set photo=$2,avatar=$3 where team_id=$1 and user_id=uid;
end $$;
revoke all on function app_private.multi_coach_visuals(text),app_private.multi_set_coach_visuals(text,text,jsonb) from public,anon,authenticated;
grant execute on function app_private.multi_coach_visuals(text),app_private.multi_set_coach_visuals(text,text,jsonb) to authenticated;
create function public.multi_coach_visuals(team text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.multi_coach_visuals(team) $$;
create function public.multi_set_coach_visuals(team text,photo text,avatar jsonb) returns void language sql security invoker set search_path='' as $$ select app_private.multi_set_coach_visuals(team,photo,avatar) $$;
revoke all on function public.multi_coach_visuals(text),public.multi_set_coach_visuals(text,text,jsonb) from public,anon;
grant execute on function public.multi_coach_visuals(text),public.multi_set_coach_visuals(text,text,jsonb) to authenticated;

