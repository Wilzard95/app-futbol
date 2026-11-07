export type Format = 5 | 6 | 11;
export type TeamRole = "admin" | "coach" | "member";

// Roles belong to a membership; playing belongs to a separate player record.
// A membership may therefore be both admin/coach and linked to a player.
export interface Membership {
  id: string;
  teamId: string;
  userId: string;
  roles: TeamRole[];
  playerId: string | null;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  linked: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  format: Format;
  season: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  opponent: string;
  playedAt: string;
  goalsFor: number;
  goalsAgainst: number;
  participantIds: string[];
}

export type MatchEventKind =
  | "yellow_card"
  | "red_card"
  | "goal"
  | "assist"
  | "clean_sheet";

// The administrator records facts. A separate ballot evaluates their impact.
export interface MatchEvent {
  id: string;
  matchId: string;
  playerId: string;
  kind: MatchEventKind;
  context: string;
}

export interface EventAdjustment {
  eventId: string;
  value: number;
}

// These ballots are synthetic demo inputs. Real author IDs must stay on the server.
export interface RatingBallot {
  matchId: string;
  authorPlayerId: string;
  targetPlayerId: string;
  score: number;
  eventAdjustments?: EventAdjustment[];
}

export interface Slot {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface LineupProposal {
  id: string;
  tournamentId: string;
  picks: Record<string, string>;
}
