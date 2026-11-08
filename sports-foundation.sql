-- Private sports data. No table is directly available to browser clients.
create table app_private.tournament (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 100),
 format smallint not null check (format in (5,6,11)),
 team_id text not null references app_private.team(id)
);
create table app_private.match (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references app_private.tournament(id),
 opponent text not null check (length(trim(opponent)) between 1 and 100),
 played_on date,
 goals_for smallint not null check (goals_for between 0 and 99),
 goals_against smallint not null check (goals_against between 0 and 99),
 ratings_closed boolean not null default false
);
create table app_private.match_participant (
 match_id uuid not null references app_private.match(id),
 player_id text not null references app_private.player(id),
 primary key (match_id,player_id)
);
create table app_private.match_event (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null,
 player_id text not null,
 kind text not null check (kind in ('goal','assist','yellow_card','red_card','clean_sheet')),
 context text not null default '' check (length(context)<=280),
 foreign key (match_id,player_id) references app_private.match_participant(match_id,player_id)
);
create index match_by_tournament on app_private.match(tournament_id);
create index event_by_match_player on app_private.match_event(match_id,player_id);
create unique index one_clean_sheet_per_player on app_private.match_event(match_id,player_id) where kind='clean_sheet';
alter table app_private.tournament enable row level security;
alter table app_private.match enable row level security;
alter table app_private.match_participant enable row level security;
alter table app_private.match_event enable row level security;
revoke all on app_private.tournament, app_private.match, app_private.match_participant, app_private.match_event from public, anon, authenticated;
