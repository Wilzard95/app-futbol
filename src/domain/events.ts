import type {
  Match,
  MatchEvent,
  MatchEventKind,
  RatingBallot,
} from "./types.ts";

export const eventRules: Record<
  MatchEventKind,
  { label: string; min: number; max: number }
> = {
  yellow_card: { label: "Tarjeta amarilla", min: -2, max: 2 },
  red_card: { label: "Tarjeta roja", min: -3, max: 3 },
  goal: { label: "Gol", min: 0, max: 1 },
  assist: { label: "Asistencia", min: 0, max: 0.5 },
  clean_sheet: { label: "Portería en cero", min: 0, max: 1 },
};

export function validateMatchEvents(
  match: Match,
  events: MatchEvent[],
): MatchEvent[] {
  const selected = events.filter((event) => event.matchId === match.id);
  const ids = new Set<string>();
  const cleanSheets = new Set<string>();
  for (const event of selected) {
    if (!event.id.trim() || ids.has(event.id))
      throw new Error("Acción duplicada o sin identificador.");
    ids.add(event.id);
    if (!match.participantIds.includes(event.playerId))
      throw new Error("Solo se pueden registrar acciones de participantes.");
    if (!Object.hasOwn(eventRules, event.kind))
      throw new Error("Tipo de acción inválido.");
    if (event.context.length > 280)
      throw new Error("El contexto admite hasta 280 caracteres.");
    if (event.kind === "clean_sheet") {
      if (cleanSheets.has(event.playerId))
        throw new Error(
          "La portería en cero no se puede duplicar para el mismo jugador y partido.",
        );
      cleanSheets.add(event.playerId);
    }
  }
  return selected;
}

export function adjustedRating(
  match: Match,
  ballot: RatingBallot,
  events: MatchEvent[],
) {
  if (
    ballot.matchId !== match.id ||
    !match.participantIds.includes(ballot.authorPlayerId) ||
    !match.participantIds.includes(ballot.targetPlayerId)
  ) {
    throw new Error(
      "Solo los participantes pueden valorar y recibir valoraciones en este partido.",
    );
  }
  if (!Number.isFinite(ballot.score) || ballot.score < 1 || ballot.score > 10)
    throw new Error("La nota base debe estar entre 1 y 10.");
  const available = new Map(
    validateMatchEvents(match, events).map((event) => [event.id, event]),
  );
  const seen = new Set<string>();
  let adjustment = 0;
  for (const item of ballot.eventAdjustments ?? []) {
    if (seen.has(item.eventId))
      throw new Error("Una acción solo admite un ajuste por valoración.");
    seen.add(item.eventId);
    const event = available.get(item.eventId);
    if (!event || event.playerId !== ballot.targetPlayerId)
      throw new Error(
        "El ajuste debe corresponder a una acción de este jugador y partido.",
      );
    const rule = eventRules[event.kind];
    if (
      !Number.isFinite(item.value) ||
      item.value < rule.min ||
      item.value > rule.max
    ) {
      throw new Error(
        `El ajuste de ${rule.label.toLowerCase()} debe estar entre ${rule.min} y ${rule.max}.`,
      );
    }
    adjustment += item.value;
  }
  const rawScore = ballot.score + adjustment;
  const finalScore = Math.max(1, Math.min(10, rawScore));
  return {
    baseScore: ballot.score,
    adjustment,
    rawScore,
    finalScore,
    limited: rawScore !== finalScore,
  };
}
