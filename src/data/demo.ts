import {
  defaultFormationIds,
  formationCatalog,
  getFormation,
} from "../domain/lineups";
import type {
  LineupProposal,
  Match,
  MatchEvent,
  MatchEventKind,
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
    goalsAgainst: 0,
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

const action = (
  id: string,
  matchId: string,
  playerId: string,
  kind: MatchEventKind,
  context = "",
): MatchEvent => ({ id, matchId, playerId, kind, context });

export const matchEvents: MatchEvent[] = [
  action("m1-g1", "m1", "p6", "goal", "Definición en el área"),
  action("m1-g2", "m1", "p6", "goal", "Remate de media distancia"),
  action("m1-g3", "m1", "p5", "goal"),
  action("m1-g4", "m1", "p7", "goal"),
  action("m1-a1", "m1", "p5", "assist"),
  action("m1-a2", "m1", "p4", "assist"),
  action("m1-a3", "m1", "p4", "assist"),
  action(
    "m1-y1",
    "m1",
    "p3",
    "yellow_card",
    "Cortó un contragolpe que dejaba al rival mano a mano",
  ),
  action("m1-y2", "m1", "p6", "yellow_card", "Discutió con el árbitro"),
  action("m1-r1", "m1", "p7", "red_card", "Expulsión por una entrada tardía"),
  action("m2-g1", "m2", "p4", "goal"),
  action("m2-g2", "m2", "p5", "goal"),
  action("m2-a1", "m2", "p7", "assist"),
  action("m2-a2", "m2", "p3", "assist"),
  action("m3-g1", "m3", "p6", "goal"),
  action("m3-g2", "m3", "p6", "goal"),
  action("m3-g3", "m3", "p5", "goal"),
  action("m3-a1", "m3", "p4", "assist"),
  action("m3-a2", "m3", "p4", "assist"),
  action("m3-a3", "m3", "p2", "assist"),
  action("m3-c1", "m3", "p1", "clean_sheet", "Arquero durante todo el partido"),
  action("m4-g1", "m4", "p6", "goal"),
  action("m4-g2", "m4", "p6", "goal"),
  action("m4-g3", "m4", "p7", "goal"),
  action("m4-g4", "m4", "p4", "goal"),
  action("m4-g5", "m4", "p5", "goal"),
  action("m4-a1", "m4", "p5", "assist"),
  action("m5-g1", "m5", "p11", "goal"),
  action("m5-a1", "m5", "p5", "assist"),
];

// The two editable demo sessions start without a general score or submitted ballot.
export const demoSessionPlayerIds = ["p1", "p2"];

// Synthetic, deterministic ballots for inspecting the proposed math. No real identities.
export const ballots: RatingBallot[] = matches.flatMap((match, matchIndex) =>
  match.participantIds
    .filter(
      (id) =>
        players.find((player) => player.id === id)?.linked &&
        !demoSessionPlayerIds.includes(id),
    )
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
        eventAdjustments: matchEvents
          .filter(
            (event) =>
              event.matchId === match.id && event.playerId === targetPlayerId,
          )
          .map((event) => ({
            eventId: event.id,
            value:
              event.kind === "goal"
                ? 0.5 + (authorIndex % 2) * 0.5
                : event.kind === "assist"
                  ? [0, 0.2, 0.5][authorIndex % 3]
                  : event.kind === "clean_sheet"
                    ? (authorIndex % 2) * 0.5 + 0.5
                    : event.kind === "red_card"
                      ? -3 + (authorIndex % 4)
                      : event.playerId === "p3"
                        ? authorIndex % 3
                        : -(authorIndex % 3),
          })),
      })),
    ),
);

export const proposals: LineupProposal[] = tournaments.flatMap((tournament) => {
  const initial = defaultFormationIds[tournament.format];
  const choices =
    tournament.format === 6
      ? [initial, initial, "f6-3-2", "f6-3-1-1"]
      : [
          initial,
          initial,
          formationCatalog[tournament.format][1].id,
          formationCatalog[tournament.format][2].id,
        ];
  return choices.map((formationId, index) => {
    const selected = getFormation(tournament.format, formationId);
    const ids = players.slice(0, tournament.format).map((player) => player.id);
    if (tournament.format === 6 && index === 1) ids[5] = "p7";
    return {
      id: `${tournament.id}-${index}`,
      tournamentId: tournament.id,
      authorPlayerId: `p${index + 3}`,
      formationId,
      picks: Object.fromEntries(
        selected.slots.map((slot, slotIndex) => [slot.id, ids[slotIndex]]),
      ),
    };
  });
});
