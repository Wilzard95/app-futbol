import type {
  LineupProposal,
  Match,
  MatchEvent,
  Player,
  RatingBallot,
  Tournament,
} from "../domain/types";

export const teamName = "combo del Inge";

// Team, roster, tournament and match events were supplied by the user. Accounts and votes are simulated.
export const players: Player[] = [
  {
    id: "p1",
    name: "William Mendoza",
    number: "09",
    position: "Delantero",
    linked: true,
  },
  { id: "p2", name: "Checho", number: "7", position: "Volante", linked: true },
  {
    id: "p3",
    name: "Diego Segura",
    number: "23",
    position: "Portero",
    linked: true,
  },
  {
    id: "p4",
    name: "Fabian VARGAS",
    number: "11",
    position: "Defensa",
    linked: true,
  },
  { id: "p5", name: "SEBAS", number: "13", position: "Volante", linked: true },
  {
    id: "p6",
    name: "Wilson Gómez",
    number: "06",
    position: "Defensa",
    linked: true,
  },
  { id: "p7", name: "Ricky", number: "5", position: "Delantero", linked: true },
  { id: "p8", name: "Chris", number: "10", position: "Volante", linked: true },
];

export const tournaments: Tournament[] = [
  { id: "grama-5", name: "Grama 5", format: 6, season: "Prueba" },
];

export const matches: Match[] = [
  {
    id: "vs-los-primeros",
    tournamentId: "grama-5",
    opponent: "Los primeros",
    playedAt: "2026-11-01",
    goalsFor: 6,
    goalsAgainst: 2,
    // All eight are enabled as participants for the requested simulation.
    participantIds: players.map((player) => player.id),
  },
  {
    id: "vs-compas",
    tournamentId: "grama-5",
    opponent: "Compas",
    playedAt: "2026-11-08",
    goalsFor: 3,
    goalsAgainst: 1,
    participantIds: players.map((player) => player.id),
  },
];

const event = (
  id: string,
  playerId: string,
  kind: MatchEvent["kind"],
  matchId = "vs-los-primeros",
): MatchEvent => ({
  id,
  matchId,
  playerId,
  kind,
  context: "",
});

export const matchEvents: MatchEvent[] = [
  event("william-goal-1", "p1", "goal"),
  event("william-goal-2", "p1", "goal"),
  event("william-goal-3", "p1", "goal"),
  event("ricky-goal-1", "p7", "goal"),
  event("ricky-goal-2", "p7", "goal"),
  event("ricky-goal-3", "p7", "goal"),
  event("ricky-yellow-1", "p7", "yellow_card"),
  event("william-assist-1", "p1", "assist"),
  event("ricky-assist-1", "p7", "assist"),
  event("sebas-assist-1", "p5", "assist"),
  event("compas-william-goal", "p1", "goal", "vs-compas"),
  event("compas-ricky-goal", "p7", "goal", "vs-compas"),
  event("compas-fabian-goal", "p4", "goal", "vs-compas"),
  event("compas-ricky-assist", "p7", "assist", "vs-compas"),
  event("compas-wilson-assist", "p6", "assist", "vs-compas"),
];

// Everyone can enter their own simulated ratings and lineup; no votes are prefilled.
export const demoSessionPlayerIds = players.map((player) => player.id);
export const ballots: RatingBallot[] = [];
export const proposals: LineupProposal[] = [];
