insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_anonymous) values
('ae000000-0000-4000-8000-000000000001','visual-coach-owner@example.test',now(),now(),now(),false),
('ae000000-0000-4000-8000-000000000002','visual-coach-other@example.test',now(),now(),now(),false);
select set_config('request.jwt.claim.sub','ae000000-0000-4000-8000-000000000001',true);
select set_config('test.cv_team',public.multi_create_team('Equipo prueba visual entrenador'),true);
select set_config('test.cv_id',public.multi_coach_create(current_setting('test.cv_team'),'Entrenador')::text,true);
update app_private.multi_coach set user_id='ae000000-0000-4000-8000-000000000001' where id=current_setting('test.cv_id')::uuid;
select public.multi_set_coach_visuals(current_setting('test.cv_team'),null,'{"skin":"#d99568","hair":"#241811","shirt":"#17623e","style":"short"}'::jsonb);
do $$ begin
 if (public.multi_coach_visuals(current_setting('test.cv_team'))->0->'avatar'->>'style') <> 'short' then raise exception 'Avatar not saved'; end if;
end $$;
select set_config('request.jwt.claim.sub','ae000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.multi_set_coach_visuals(current_setting('test.cv_team'),null,null); raise exception 'Unauthorized update accepted'; exception when others then if sqlerrm='Unauthorized update accepted' then raise; end if; end;
 begin perform public.multi_coach_visuals(current_setting('test.cv_team')); raise exception 'Unauthorized read accepted'; exception when others then if sqlerrm='Unauthorized read accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','ae000000-0000-4000-8000-000000000001',true);
select public.multi_coach_unlink(current_setting('test.cv_team'),current_setting('test.cv_id')::uuid);
do $$ begin
 if exists(select 1 from app_private.multi_coach where id=current_setting('test.cv_id')::uuid and (photo is not null or avatar is not null)) then raise exception 'Unlinked visual retained'; end if;
end $$;

