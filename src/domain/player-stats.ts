import type { MatchEventKind } from "./types.ts";

type StatsMatch = {
  participants: string[];
  events: { playerId: string; kind: MatchEventKind }[];
};

export function tournamentPlayerStats(playerId: string, matches: StatsMatch[]) {
  const played = matches.filter((match) => match.participants.includes(playerId));
  const events = played.flatMap((match) => match.events.filter((event) => event.playerId === playerId));
  const count = (kind: MatchEventKind) => events.filter((event) => event.kind === kind).length;
  const goals = count("goal");
  return {
    matches: played.length,
    goals,
    goalsPerMatch: played.length ? goals / played.length : null,
    assists: count("assist"),
    yellowCards: count("yellow_card"),
    redCards: count("red_card"),
  };
}
