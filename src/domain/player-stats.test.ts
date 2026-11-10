import { strict as assert } from "node:assert";
import { test } from "node:test";
import { tournamentPlayerStats } from "./player-stats.ts";

test("counts the player's actions in participated matches and computes goals per match", () => {
  const matches = [
    { participants: ["a", "b"], events: [{ playerId: "a", kind: "goal" as const }, { playerId: "a", kind: "goal" as const }, { playerId: "b", kind: "assist" as const }, { playerId: "a", kind: "yellow_card" as const }] },
    { participants: ["a"], events: [{ playerId: "a", kind: "assist" as const }, { playerId: "a", kind: "red_card" as const }] },
    { participants: ["b"], events: [{ playerId: "b", kind: "goal" as const }] },
  ];
  assert.deepEqual(tournamentPlayerStats("a", matches), { matches: 2, goals: 2, goalsPerMatch: 1, assists: 1, yellowCards: 1, redCards: 1 });
  assert.deepEqual(tournamentPlayerStats("absent", matches), { matches: 0, goals: 0, goalsPerMatch: null, assists: 0, yellowCards: 0, redCards: 0 });
});
