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
  // Shirt numbers are labels: preserve values such as "09" and "06".
  number: string;
  position: string;
  linked: boolean;
  avatar?: import("./visuals").AvatarStyle | null;
  photo?: string | null;
  retired?: boolean;
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
  playedAt: string | null;
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

export interface Formation {
  id: string;
  format: Format;
  name: string;
  slots: Slot[];
}

export interface LineupProposal {
  id: string;
  tournamentId: string;
  // Private input in production; never returned with anonymous proposals.
  authorPlayerId: string;
  formationId: string;
  picks: Record<string, string>;
}

export type AnonymousLineupProposal = Omit<LineupProposal, "authorPlayerId">;
