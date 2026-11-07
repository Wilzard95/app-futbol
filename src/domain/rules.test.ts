import test from "node:test";
import assert from "node:assert/strict";
import {
  canRate,
  consensus,
  formations,
  matchAverage,
  tournamentAverage,
} from "./rules.ts";
import type { Match, RatingBallot } from "./types.ts";

const match: Match = {
  id: "m1",
  tournamentId: "t1",
  opponent: "Rival",
  playedAt: "2026-10-01",
  goalsFor: 1,
  goalsAgainst: 0,
  participantIds: ["a", "b"],
};
const ballot = (
  authorPlayerId: string,
  score: number,
  matchId = "m1",
): RatingBallot => ({ matchId, authorPlayerId, targetPlayerId: "a", score });

test("participants can rate themselves; absentees cannot rate or receive ratings", () => {
  assert.equal(canRate(match, "a", "a"), true);
  assert.equal(canRate(match, "c", "a"), false);
  assert.equal(canRate(match, "a", "c"), false);
  assert.equal(
    matchAverage(match, "a", [ballot("a", 8), ballot("b", 10), ballot("c", 1)]),
    9,
  );
});
test("invalid scores and missing ratings never become zero", () => {
  assert.equal(
    matchAverage(match, "a", [ballot("a", NaN), ballot("b", 11)]),
    null,
  );
  assert.equal(
    tournamentAverage("other", "a", [match], [ballot("a", 9)]),
    null,
  );
});
test("tournament averages weight matches equally, regardless of voter count", () => {
  const matches = [match, { ...match, id: "m2" }, { ...match, id: "m3" }];
  assert.equal(
    tournamentAverage("t1", "a", matches, [
      ballot("a", 8),
      ballot("b", 10),
      ballot("b", 5, "m2"),
    ]),
    7,
  );
});
test("duplicate votes are rejected instead of inflating the average", () => {
  assert.throws(
    () => matchAverage(match, "a", [ballot("a", 8), ballot("a", 10)]),
    /duplicada/,
  );
});
test("formations include exactly one keeper and the correct number of players", () => {
  for (const format of [5, 6, 11] as const) {
    assert.equal(formations[format].slots.length, format);
    assert.equal(
      formations[format].slots.filter((slot) => slot.id === "gk").length,
      1,
    );
  }
});
test("consensus preserves ties, isolates tournaments and reports cross-slot conflicts", () => {
  const slots = formations[5].slots.slice(0, 2);
  const result = consensus("t1", slots, [
    { id: "1", tournamentId: "t1", picks: { gk: "a", cb: "b" } },
    { id: "2", tournamentId: "t1", picks: { gk: "b", cb: "a" } },
    { id: "3", tournamentId: "other", picks: { gk: "z", cb: "x" } },
  ]);
  assert.deepEqual(result.positions[0].winners, ["a", "b"]);
  assert.equal(result.proposalCount, 2);
  assert.deepEqual(result.conflicts.sort(), ["a", "b"]);
  assert.equal(consensus("empty", slots, []).positions[0].votes, 0);
});
test("a proposal cannot repeat a player or omit a position", () => {
  const slots = formations[5].slots.slice(0, 2);
  assert.throws(
    () =>
      consensus("t1", slots, [
        { id: "1", tournamentId: "t1", picks: { gk: "a", cb: "a" } },
      ]),
    /sin repetir/,
  );
  assert.throws(
    () =>
      consensus("t1", slots, [
        { id: "1", tournamentId: "t1", picks: { gk: "a" } },
      ]),
    /completar/,
  );
});
