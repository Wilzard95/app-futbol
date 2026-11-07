import type { Match, MatchEvent, RatingBallot } from "./types.ts";
import { adjustedRating, validateMatchEvents } from "./events.ts";

export function canRate(match: Match, author: string, target: string): boolean {
  return (
    match.participantIds.includes(author) &&
    match.participantIds.includes(target)
  );
}

export function matchAverage(
  match: Match,
  playerId: string,
  ballots: RatingBallot[],
  events: MatchEvent[] = [],
): number | null {
  validateMatchEvents(match, events);
  const seen = new Set<string>();
  const scores = ballots
    .filter((ballot) => {
      if (ballot.matchId !== match.id || ballot.targetPlayerId !== playerId)
        return false;
      if (!canRate(match, ballot.authorPlayerId, ballot.targetPlayerId))
        return false;
      if (
        !Number.isFinite(ballot.score) ||
        ballot.score < 1 ||
        ballot.score > 10
      )
        return false;
      if (seen.has(ballot.authorPlayerId))
        throw new Error(
          "Valoración duplicada para el mismo autor, jugador y partido.",
        );
      seen.add(ballot.authorPlayerId);
      return true;
    })
    .map((ballot) => adjustedRating(match, ballot, events).finalScore);
  return scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
}

// Each rated match has equal weight. A match with no ratings is not a zero.
export function tournamentAverage(
  tournamentId: string,
  playerId: string,
  matches: Match[],
  ballots: RatingBallot[],
  events: MatchEvent[] = [],
): number | null {
  const values = matches
    .filter((match) => match.tournamentId === tournamentId)
    .map((match) => matchAverage(match, playerId, ballots, events))
    .filter((score): score is number => score !== null);
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}
