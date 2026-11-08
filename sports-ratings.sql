-- The author is derived from the session and never returned in collective results.
create table app_private.rating_ballot (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null references app_private.match(id),
 author_user_id uuid not null references auth.users(id),
 author_player_id text not null references app_private.player(id),
 target_player_id text not null references app_private.player(id),
 base_score numeric not null check(base_score between 1 and 10),
 final_score numeric not null check(final_score between 1 and 10),
 adjustments jsonb not null default '[]'::jsonb,
 comment text not null default '' check(length(comment)<=500),
 reaction text check(reaction in ('approve','disapprove')),
 unique(match_id,author_user_id,target_player_id),
 constraint rating_one_per_player unique(match_id,author_player_id,target_player_id),
 foreign key(match_id,author_player_id) references app_private.match_participant(match_id,player_id),
 foreign key(match_id,target_player_id) references app_private.match_participant(match_id,player_id)
);
alter table app_private.rating_ballot enable row level security;
revoke all on app_private.rating_ballot from public, anon, authenticated;

create function app_private.rating_submit(match_id uuid, target text, score numeric, adjustments jsonb, comment text, reaction text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.ensure_verified(); author_player text; item jsonb; event_kind text; event_uuid uuid; seen uuid[] := '{}'; total numeric:=0; amount numeric;
begin
 select m.player_id into author_player from app_private.member m where m.user_id=uid and m.active;
 if author_player is null or not exists(select 1 from app_private.match_participant p where p.match_id=$1 and p.player_id=author_player) then raise exception 'Solo participantes pueden valorar'; end if;
 if not exists(select 1 from app_private.match_participant p where p.match_id=$1 and p.player_id=$2) then raise exception 'Solo participantes reciben valoraciones'; end if;
 perform 1 from app_private.match m where m.id=$1 and m.ratings_open and not m.ratings_closed for update;
 if not found then raise exception 'Las valoraciones aún no están abiertas o el partido está cerrado'; end if;
 if $3 is null or $3 not between 1 and 10 or $3::text in ('NaN','Infinity','-Infinity') then raise exception 'Nota inválida'; end if;
 if $4 is null or jsonb_typeof($4)<>'array' or jsonb_array_length($4)>100 then raise exception 'Ajustes inválidos'; end if;
 if $5 is null or length($5)>500 or ($6 is not null and $6 not in ('approve','disapprove')) then raise exception 'Comentario o reacción inválidos'; end if;
 for item in select * from jsonb_array_elements($4) loop
   if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'eventId') is distinct from 'string' or jsonb_typeof(item->'value') is distinct from 'number' then raise exception 'Ajuste inválido'; end if;
   begin event_uuid := (item->>'eventId')::uuid; amount := (item->>'value')::numeric; exception when others then raise exception 'Ajuste inválido'; end;
   if event_uuid=any(seen) then raise exception 'Acción duplicada'; end if;
   seen := array_append(seen,event_uuid);
   select e.kind into event_kind from app_private.match_event e where e.id=event_uuid and e.match_id=$1 and e.player_id=$2;
   if event_kind is null then raise exception 'La acción no pertenece al jugador'; end if;
   if not (case event_kind when 'goal' then amount between 0 and 1 when 'assist' then amount between 0 and 0.5 when 'clean_sheet' then amount between 0 and 1 when 'yellow_card' then amount between -2 and 2 when 'red_card' then amount between -3 and 3 else false end) then raise exception 'Ajuste fuera de rango'; end if;
   total:=total+amount;
 end loop;
 insert into app_private.rating_ballot(match_id,author_user_id,author_player_id,target_player_id,base_score,final_score,adjustments,comment,reaction)
 values($1,uid,author_player,$2,$3,greatest(1,least(10,$3+total)),$4,$5,$6)
 on conflict on constraint rating_one_per_player do update set base_score=excluded.base_score,final_score=excluded.final_score,adjustments=excluded.adjustments,comment=excluded.comment,reaction=excluded.reaction where app_private.rating_ballot.author_user_id=uid;
 if not found then raise exception 'Esta ficha ya tiene una valoración previa de otra cuenta'; end if;
end $$;

create function app_private.rating_results(match_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.ensure_verified(); result jsonb;
begin
 if not exists(select 1 from app_private.member m where m.user_id=uid and m.active and (m.role='admin' or m.player_id is not null)) then raise exception 'Sin acceso al equipo'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('playerId',x.target_player_id,'average',x.average,'count',x.n,'comments',x.comments,'approvals',x.approvals,'disapprovals',x.disapprovals)),'[]'::jsonb) into result from (
 select b.target_player_id,avg(b.final_score) average,count(*) n,
 coalesce(jsonb_agg(b.comment order by b.id) filter(where b.comment<>''),'[]'::jsonb) comments,
 count(*) filter(where b.reaction='approve') approvals,count(*) filter(where b.reaction='disapprove') disapprovals
 from app_private.rating_ballot b where b.match_id=$1 group by b.target_player_id) x;
 return result;
end $$;

create function app_private.rating_mine(match_id uuid, target text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := app_private.ensure_verified(); result jsonb;
begin
 if not exists(select 1 from app_private.member m join app_private.match_participant p on p.player_id=m.player_id where m.user_id=uid and m.active and p.match_id=$1) then raise exception 'Solo participantes pueden valorar'; end if;
 select jsonb_build_object('score',b.base_score,'adjustments',b.adjustments,'comment',b.comment,'reaction',b.reaction) into result from app_private.rating_ballot b where b.match_id=$1 and b.target_player_id=$2 and b.author_user_id=uid;
 return result;
end $$;

revoke all on function app_private.rating_submit(uuid,text,numeric,jsonb,text,text), app_private.rating_results(uuid), app_private.rating_mine(uuid,text) from public, anon, authenticated;
grant execute on function app_private.rating_submit(uuid,text,numeric,jsonb,text,text), app_private.rating_results(uuid), app_private.rating_mine(uuid,text) to authenticated;
create function public.rating_submit(match_id uuid, target text, score numeric, adjustments jsonb, comment text, reaction text) returns void language sql security invoker set search_path='' as $$ select app_private.rating_submit(match_id,target,score,adjustments,comment,reaction) $$;
create function public.rating_results(match_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.rating_results(match_id) $$;
create function public.rating_mine(match_id uuid, target text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.rating_mine(match_id,target) $$;
revoke all on function public.rating_submit(uuid,text,numeric,jsonb,text,text), public.rating_results(uuid), public.rating_mine(uuid,text) from public, anon;
grant execute on function public.rating_submit(uuid,text,numeric,jsonb,text,text), public.rating_results(uuid), public.rating_mine(uuid,text) to authenticated;
