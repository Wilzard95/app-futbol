-- One-time seed for combo del Inge; generated identifiers are never hardcoded.
begin;
do $$ declare t uuid; m1 uuid; m2 uuid; begin
 if exists(select 1 from app_private.tournament where team_id='combo' and name='Grama 5') then raise exception 'El torneo ya existe; no duplicar'; end if;
 insert into app_private.tournament(name,format,team_id) values('Grama 5',6,'combo') returning id into t;
 insert into app_private.match(tournament_id,opponent,played_on,goals_for,goals_against,ratings_open) values(t,'Los primeros','2026-11-01',6,2,true) returning id into m1;
 insert into app_private.match(tournament_id,opponent,played_on,goals_for,goals_against,ratings_open) values(t,'Compas','2026-11-08',3,1,true) returning id into m2;
 insert into app_private.match_participant(match_id,player_id) select m1,id from app_private.player where id in ('p1','p2','p3','p4','p5','p6','p7','p8');
 insert into app_private.match_participant(match_id,player_id) select m2,id from app_private.player where id in ('p1','p2','p3','p4','p5','p6','p7');
 insert into app_private.match_event(match_id,player_id,kind) values
 (m1,'p1','goal'),(m1,'p1','goal'),(m1,'p1','goal'),(m1,'p7','goal'),(m1,'p7','goal'),(m1,'p7','goal'),(m1,'p7','yellow_card'),(m1,'p1','assist'),(m1,'p7','assist'),(m1,'p5','assist'),
 (m2,'p1','goal'),(m2,'p7','goal'),(m2,'p4','goal'),(m2,'p7','assist'),(m2,'p6','assist');
end $$;
commit;
