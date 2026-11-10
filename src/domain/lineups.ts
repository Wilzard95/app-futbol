import type {
  AnonymousLineupProposal,
  Format,
  Formation,
  LineupProposal,
  Player,
} from "./types.ts";

function formation(format: Format, lines: number[]): Formation {
  const name = lines.join("–");
  const y =
    lines.length === 2
      ? [63, 25]
      : lines.length === 3
        ? [66, 43, 19]
        : [68, 51, 34, 17];
  return {
    id: `f${format}-${lines.join("-")}`,
    format,
    name,
    slots: [
      { id: "gk", label: "ARQ", x: 50, y: 86 },
      ...lines.flatMap((count, row) =>
        Array.from({ length: count }, (_, column) => {
          const left = count >= 4 ? 12 : count === 3 ? 20 : 28;
          const group =
            row === 0 ? "DEF" : row === lines.length - 1 ? "DEL" : "MED";
          const suffix =
            count === 1
              ? ""
              : count === 2
                ? [" I", " D"][column]
                : count === 3
                  ? [" I", " C", " D"][column]
                  : ` ${column + 1}`;
          return {
            id: `row-${row}-${column}`,
            label: `${group}${suffix}`,
            x:
              count === 1
                ? 50
                : left + ((100 - left * 2) * column) / (count - 1),
            y: y[row],
          };
        }),
      ),
    ],
  };
}

export const formationCatalog: Record<Format, Formation[]> = {
  5: [formation(5, [1, 2, 1]), formation(5, [2, 2]), formation(5, [1, 3])],
  6: [
    formation(6, [3, 2]),
    formation(6, [3, 1, 1]),
    formation(6, [2, 2, 1]),
    formation(6, [2, 3]),
  ],
  11: [
    formation(11, [4, 3, 3]),
    formation(11, [4, 4, 2]),
    formation(11, [3, 5, 2]),
    formation(11, [4, 2, 3, 1]),
  ],
};

export const defaultFormationIds: Record<Format, string> = {
  5: "f5-1-2-1",
  6: "f6-2-2-1",
  11: "f11-4-3-3",
};

export function getFormation(format: Format, id: string): Formation {
  const result = formationCatalog[format].find((item) => item.id === id);
  if (!result)
    throw new Error("La formación no corresponde a la modalidad del torneo.");
  return result;
}

// Use existing players only. Incomplete rosters keep explicit empty positions.
export function suggestLineup(
  selected: Formation,
  players: Player[],
): Record<string, string> {
  const picks = Object.fromEntries(selected.slots.map((slot) => [slot.id, ""]));
  const used = new Set<string>();
  const roles: Record<string, string[]> = {
    ARQ: ["portero", "arquero"],
    DEF: ["defensa"],
    MED: ["volante", "mediocampo"],
    DEL: ["delantero"],
  };
  for (const slot of selected.slots) {
    const expected = roles[slot.label.split(" ")[0]];
    const player = players.find(
      (item) =>
        !used.has(item.id) && expected.includes(item.position.toLowerCase()),
    );
    if (player) {
      picks[slot.id] = player.id;
      used.add(player.id);
    }
  }
  for (const slot of selected.slots) {
    if (picks[slot.id]) continue;
    const player = players.find((item) => !used.has(item.id));
    if (player) {
      picks[slot.id] = player.id;
      used.add(player.id);
    }
  }
  return picks;
}

export function validateLineup(
  proposal: LineupProposal,
  format: Format,
  rosterIds: string[],
  eligibleVoterIds?: string[],
): Formation {
  const selected = getFormation(format, proposal.formationId);
  if (
    !proposal.id.trim() ||
    !proposal.tournamentId.trim() ||
    !proposal.authorPlayerId.trim()
  )
    throw new Error("La propuesta necesita identificador, torneo y autor.");
  if (eligibleVoterIds && !eligibleVoterIds.includes(proposal.authorPlayerId))
    throw new Error(
      "Solo un jugador vinculado al equipo puede proponer la titular.",
    );
  const slotIds = new Set(selected.slots.map((slot) => slot.id));
  if (
    Object.keys(proposal.picks).length !== slotIds.size ||
    Object.keys(proposal.picks).some((id) => !slotIds.has(id))
  )
    throw new Error(
      "La propuesta debe completar exactamente las posiciones de la formación.",
    );
  const ids = selected.slots.map((slot) => proposal.picks[slot.id]);
  if (ids.some((id) => !id || !rosterIds.includes(id)))
    throw new Error("Completa todas las posiciones con jugadores del equipo.");
  if (new Set(ids).size !== ids.length)
    throw new Error("Una propuesta no puede repetir jugadores.");
  return selected;
}

function tournamentProposals(
  tournamentId: string,
  format: Format,
  proposals: LineupProposal[],
  rosterIds: string[],
  eligibleVoterIds?: string[],
) {
  const selected = proposals.filter(
    (proposal) => proposal.tournamentId === tournamentId,
  );
  const ids = new Set<string>();
  const authors = new Set<string>();
  for (const proposal of selected) {
    validateLineup(proposal, format, rosterIds, eligibleVoterIds);
    if (ids.has(proposal.id) || authors.has(proposal.authorPlayerId))
      throw new Error("Solo se admite una propuesta por persona y torneo.");
    ids.add(proposal.id);
    authors.add(proposal.authorPlayerId);
  }
  return selected;
}

export function formationVoting(
  tournamentId: string,
  format: Format,
  proposals: LineupProposal[],
  rosterIds: string[],
  eligibleVoterIds?: string[],
) {
  const selected = tournamentProposals(
    tournamentId,
    format,
    proposals,
    rosterIds,
    eligibleVoterIds,
  );
  const entries = formationCatalog[format].map((item) => {
    const votes = selected.filter(
      (proposal) => proposal.formationId === item.id,
    ).length;
    return {
      formation: item,
      votes,
      percentage: selected.length ? (votes / selected.length) * 100 : 0,
    };
  });
  const maximum = Math.max(0, ...entries.map((entry) => entry.votes));
  return {
    entries,
    total: selected.length,
    leaders: entries
      .filter((entry) => maximum > 0 && entry.votes === maximum)
      .map((entry) => entry.formation.id),
  };
}

export function lineupConsensus(
  tournamentId: string,
  selected: Formation,
  proposals: LineupProposal[],
  rosterIds: string[],
  eligibleVoterIds?: string[],
  eligiblePlayerIds?: string[],
) {
  const sameFormation = tournamentProposals(
    tournamentId,
    selected.format,
    proposals,
    rosterIds,
    eligibleVoterIds,
  ).filter((proposal) => proposal.formationId === selected.id);
  const positions = selected.slots.map((slot) => {
    const counts = new Map<string, number>();
    for (const proposal of sameFormation) {
      const id = proposal.picks[slot.id];
      if (eligiblePlayerIds && !eligiblePlayerIds.includes(id)) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
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
  return { positions, conflicts, proposalCount: sameFormation.length };
}

export function upsertLineup(
  proposals: LineupProposal[],
  proposal: LineupProposal,
  format: Format,
  rosterIds: string[],
  eligibleVoterIds: string[],
): LineupProposal[] {
  validateLineup(proposal, format, rosterIds, eligibleVoterIds);
  tournamentProposals(
    proposal.tournamentId,
    format,
    proposals,
    rosterIds,
    eligibleVoterIds,
  );
  const existing = proposals.find(
    (item) =>
      item.tournamentId === proposal.tournamentId &&
      item.authorPlayerId === proposal.authorPlayerId,
  );
  const id = existing?.id ?? proposal.id;
  if (proposals.some((item) => item.id === id && item !== existing))
    throw new Error("El identificador ya pertenece a otra propuesta.");
  return [
    ...proposals.filter((item) => item !== existing),
    { ...proposal, id, picks: { ...proposal.picks } },
  ];
}

export function anonymousLineups(
  tournamentId: string,
  proposals: LineupProposal[],
): AnonymousLineupProposal[] {
  return proposals
    .filter((item) => item.tournamentId === tournamentId)
    .map((item) => ({
      id: item.id,
      tournamentId: item.tournamentId,
      formationId: item.formationId,
      picks: { ...item.picks },
    }));
}
