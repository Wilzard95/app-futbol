import type {
  Format,
  LineupProposal,
  Match,
  MatchEvent,
  RatingBallot,
  Slot,
} from "./types.ts";
import { adjustedRating, validateMatchEvents } from "./events.ts";

export const formations: Record<Format, { name: string; slots: Slot[] }> = {
  5: {
    name: "1–2–1",
    slots: [
      { id: "gk", label: "ARQ", x: 50, y: 83 },
      { id: "cb", label: "DEF", x: 50, y: 62 },
      { id: "lm", label: "IZQ", x: 24, y: 40 },
      { id: "rm", label: "DER", x: 76, y: 40 },
      { id: "st", label: "DEL", x: 50, y: 17 },
    ],
  },
  6: {
    name: "2–2–1",
    slots: [
      { id: "gk", label: "ARQ", x: 50, y: 84 },
      { id: "lb", label: "DEF I", x: 27, y: 63 },
      { id: "rb", label: "DEF D", x: 73, y: 63 },
      { id: "lm", label: "MED I", x: 27, y: 39 },
      { id: "rm", label: "MED D", x: 73, y: 39 },
      { id: "st", label: "DEL", x: 50, y: 15 },
    ],
  },
  11: {
    name: "4–3–3",
    slots: [
      { id: "gk", label: "ARQ", x: 50, y: 87 },
      { id: "lb", label: "LI", x: 14, y: 67 },
      { id: "lcb", label: "DFC I", x: 38, y: 69 },
      { id: "rcb", label: "DFC D", x: 62, y: 69 },
      { id: "rb", label: "LD", x: 86, y: 67 },
      { id: "lm", label: "MC I", x: 22, y: 44 },
      { id: "cm", label: "MC", x: 50, y: 47 },
      { id: "rm", label: "MC D", x: 78, y: 44 },
      { id: "lw", label: "EI", x: 19, y: 17 },
      { id: "st", label: "DEL", x: 50, y: 14 },
      { id: "rw", label: "ED", x: 81, y: 17 },
    ],
  },
};

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

// Independent slot plurality, including all tied winners, as requested.
// Cross-slot conflicts are reported for a product decision rather than silently resolved.
export function consensus(
  tournamentId: string,
  slots: Slot[],
  proposals: LineupProposal[],
) {
  const selected = proposals.filter(
    (proposal) => proposal.tournamentId === tournamentId,
  );
  const proposalIds = new Set<string>();
  for (const proposal of selected) {
    if (proposalIds.has(proposal.id)) throw new Error("Propuesta duplicada.");
    proposalIds.add(proposal.id);
    const picks = slots.map((slot) => proposal.picks[slot.id]);
    if (picks.some((pick) => !pick) || new Set(picks).size !== slots.length) {
      throw new Error(
        "Cada propuesta debe completar la formación sin repetir jugadores.",
      );
    }
  }
  const positions = slots.map((slot) => {
    const counts = new Map<string, number>();
    for (const proposal of selected) {
      const playerId = proposal.picks[slot.id];
      counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    }
    const votes = Math.max(0, ...counts.values());
    return {
      ...slot,
      votes,
      winners: [...counts]
        .filter(([, count]) => count === votes)
        .map(([id]) => id),
    };
  });
  const allWinners = positions.flatMap((position) => position.winners);
  const conflicts = [
    ...new Set(
      allWinners.filter((id, index) => allWinners.indexOf(id) !== index),
    ),
  ];
  return { positions, conflicts, proposalCount: selected.length };
}
