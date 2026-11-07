import { formations } from "../domain/rules";
import type {
  LineupProposal,
  Match,
  Player,
  RatingBallot,
  Tournament,
} from "../domain/types";

export const players: Player[] = [
  {
    id: "p1",
    name: "Mateo Ríos",
    number: 1,
    position: "Arquero",
    linked: true,
  },
  {
    id: "p2",
    name: "Andrés Vega",
    number: 4,
    position: "Defensa",
    linked: true,
  },
  {
    id: "p3",
    name: "Daniel Cruz",
    number: 3,
    position: "Defensa",
    linked: true,
  },
  {
    id: "p4",
    name: "Santiago Ruiz",
    number: 8,
    position: "Mediocampo",
    linked: true,
  },
  {
    id: "p5",
    name: "Juan Torres",
    number: 10,
    position: "Mediocampo",
    linked: true,
  },
  {
    id: "p6",
    name: "Felipe Díaz",
    number: 9,
    position: "Delantero",
    linked: true,
  },
  {
    id: "p7",
    name: "Nicolás León",
    number: 7,
    position: "Delantero",
    linked: true,
  },
  {
    id: "p8",
    name: "David Mora",
    number: 6,
    position: "Defensa",
    linked: false,
  },
  {
    id: "p9",
    name: "Pablo Gil",
    number: 11,
    position: "Mediocampo",
    linked: true,
  },
  {
    id: "p10",
    name: "Tomás Lara",
    number: 5,
    position: "Defensa",
    linked: true,
  },
  {
    id: "p11",
    name: "Lucas Peña",
    number: 17,
    position: "Delantero",
    linked: true,
  },
  {
    id: "p12",
    name: "Julián Ortiz",
    number: 12,
    position: "Arquero",
    linked: false,
  },
];

export const tournaments: Tournament[] = [
  {
    id: "barrio-6",
    name: "Copa del Barrio",
    format: 6,
    season: "2026 · Clausura",
  },
  {
    id: "nocturna-5",
    name: "Liga Nocturna",
    format: 5,
    season: "2026 · Clausura",
  },
  {
    id: "amistad-11",
    name: "Torneo de la Amistad",
    format: 11,
    season: "2026 · Clausura",
  },
];

export const matches: Match[] = [
  {
    id: "m1",
    tournamentId: "barrio-6",
    opponent: "Atlético Norte",
    playedAt: "2026-10-31",
    goalsFor: 4,
    goalsAgainst: 2,
    participantIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
  },
  {
    id: "m2",
    tournamentId: "barrio-6",
    opponent: "Deportivo Sur",
    playedAt: "2026-10-24",
    goalsFor: 2,
    goalsAgainst: 2,
    participantIds: ["p1", "p2", "p3", "p4", "p5", "p7"],
  },
  {
    id: "m3",
    tournamentId: "barrio-6",
    opponent: "Los Pinos FC",
    playedAt: "2026-10-17",
    goalsFor: 3,
    goalsAgainst: 1,
    participantIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
  },
  {
    id: "m4",
    tournamentId: "nocturna-5",
    opponent: "La Esquina",
    playedAt: "2026-10-29",
    goalsFor: 5,
    goalsAgainst: 3,
    participantIds: ["p1", "p2", "p4", "p5", "p6", "p7"],
  },
  {
    id: "m5",
    tournamentId: "amistad-11",
    opponent: "Unión Central",
    playedAt: "2026-10-25",
    goalsFor: 1,
    goalsAgainst: 2,
    participantIds: players.slice(0, 11).map((player) => player.id),
  },
];

// Synthetic, deterministic ballots for inspecting the proposed math. No real identities.
export const ballots: RatingBallot[] = matches.flatMap((match, matchIndex) =>
  match.participantIds
    .filter((id) => players.find((player) => player.id === id)?.linked)
    .flatMap((authorPlayerId, authorIndex) =>
      match.participantIds.map((targetPlayerId) => ({
        matchId: match.id,
        authorPlayerId,
        targetPlayerId,
        score: Math.min(
          10,
          6 +
            ((Number(targetPlayerId.slice(1)) * 3 + authorIndex + matchIndex) %
              8) /
              2,
        ),
      })),
    ),
);

export const proposals: LineupProposal[] = tournaments.flatMap((tournament) => {
  const formation = formations[tournament.format];
  const ids =
    tournament.format === 5
      ? ["p1", "p2", "p4", "p5", "p6"]
      : players.slice(0, tournament.format).map((player) => player.id);
  return Array.from({ length: 4 }, (_, index) => ({
    id: `${tournament.id}-${index}`,
    tournamentId: tournament.id,
    picks: Object.fromEntries(
      formation.slots.map((slot, slotIndex) => [
        slot.id,
        tournament.format === 6 && slot.id === "st" && index >= 2
          ? "p7"
          : ids[slotIndex],
      ]),
    ),
  }));
});
