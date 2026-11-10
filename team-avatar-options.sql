create or replace function app_private.multi_set_profile_visuals(team text,photo text,avatar jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=app_private.multi_verified_user(); pid text;
begin
 select player_id into pid from app_private.multi_membership where team_id=$1 and user_id=uid and active;
 if pid is null then raise exception 'Necesitas una ficha vinculada'; end if;
 if $2 is not null and (length($2)>100000 or $2 !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$') then raise exception 'Imagen inválida'; end if;
 if $3 is not null and (jsonb_typeof($3)<>'object' or length($3::text)>300 or coalesce($3->>'skin','') not in ('#f2c6a0','#d99568','#8d5235','#5c3828') or coalesce($3->>'hair','') not in ('#241811','#5b3421','#9a6d38','#ded0aa') or coalesce($3->>'shirt','') not in ('#17623e','#173c74','#b63131','#e6b931','#ef7a27','#7b3e9d','#1d8790','#181f25','#f3f4ef','#e35f8e','#77943d','#69a7dc') or coalesce($3->>'style','') not in ('short','long','none','curly','spiky','side') or ($3 ? 'usePhoto' and jsonb_typeof($3->'usePhoto') <> 'boolean') or ($3 ? 'photoX' and case when jsonb_typeof($3->'photoX')='number' then ($3->>'photoX')::numeric not between -1 and 1 else true end) or ($3 ? 'photoY' and case when jsonb_typeof($3->'photoY')='number' then ($3->>'photoY')::numeric not between -1 and 1 else true end)) then raise exception 'Avatar inválido'; end if;
 update app_private.multi_player set photo=$2,avatar=$3 where team_id=$1 and id=pid;
end $$;
