import test from "node:test";
import assert from "node:assert/strict";
import {
  canRate,
  consensus,
  formations,
  matchAverage,
  tournamentAverage,
} from "./rules.ts";
import type {
  Match,
  MatchEvent,
  MatchEventKind,
  RatingBallot,
} from "./types.ts";
import { adjustedRating, eventRules, validateMatchEvents } from "./events.ts";

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

const action = (
  id: string,
  kind: MatchEventKind,
  playerId = "a",
  matchId = "m1",
): MatchEvent => ({ id, kind, playerId, matchId, context: "" });

test("each goal, assist, card and clean sheet contributes its own adjustment", () => {
  const events = [
    action("g1", "goal"),
    action("g2", "goal"),
    action("a1", "assist"),
    action("y1", "yellow_card"),
    action("r1", "red_card"),
    action("c1", "clean_sheet"),
  ];
  const rating = {
    ...ballot("b", 6),
    eventAdjustments: [
      { eventId: "g1", value: 1 },
      { eventId: "g2", value: 1 },
      { eventId: "a1", value: 0.5 },
      { eventId: "y1", value: -2 },
      { eventId: "r1", value: 3 },
      { eventId: "c1", value: 1 },
    ],
  };
  assert.equal(adjustedRating(match, rating, events).finalScore, 10);
  assert.equal(adjustedRating(match, rating, events).adjustment, 4.5);
  assert.equal(matchAverage(match, "a", [rating], events), 10);
  assert.equal(tournamentAverage("t1", "a", [match], [rating], events), 10);
});

test("cards can reward or penalize; every event enforces its own range", () => {
  for (const kind of Object.keys(eventRules) as MatchEventKind[]) {
    const event = action("event", kind);
    const rule = eventRules[kind];
    for (const value of [rule.min, 0, rule.max]) {
      const rating = {
        ...ballot("a", 5),
        eventAdjustments: [{ eventId: event.id, value }],
      };
      assert.equal(
        adjustedRating(match, rating, [event]).finalScore,
        5 + value,
      );
    }
    for (const value of [rule.min - 0.01, rule.max + 0.01, NaN, Infinity]) {
      assert.throws(
        () =>
          adjustedRating(
            match,
            {
              ...ballot("a", 5),
              eventAdjustments: [{ eventId: event.id, value }],
            },
            [event],
          ),
        /debe estar entre/,
      );
    }
  }
});

test("sum all actions before clamping once; their order does not change the result", () => {
  const events = [action("y1", "yellow_card"), action("y2", "yellow_card")];
  const adjustments = [
    { eventId: "y1", value: -2 },
    { eventId: "y2", value: 2 },
  ];
  assert.equal(
    adjustedRating(
      match,
      { ...ballot("a", 2), eventAdjustments: adjustments },
      events,
    ).finalScore,
    2,
  );
  assert.equal(
    adjustedRating(
      match,
      { ...ballot("a", 2), eventAdjustments: adjustments.toReversed() },
      events,
    ).finalScore,
    2,
  );
});

test("clamp each evaluator's final score to 1–10 before the collective average", () => {
  const events = [action("r1", "red_card")];
  const ratings = [
    { ...ballot("a", 9), eventAdjustments: [{ eventId: "r1", value: 3 }] },
    { ...ballot("b", 1), eventAdjustments: [{ eventId: "r1", value: -3 }] },
  ];
  assert.equal(adjustedRating(match, ratings[0], events).finalScore, 10);
  assert.equal(adjustedRating(match, ratings[1], events).finalScore, 1);
  assert.equal(matchAverage(match, "a", ratings, events), 5.5);
});

test("omitted adjustments are neutral; an action alone never creates a rating", () => {
  const events = [action("y1", "yellow_card")];
  assert.equal(adjustedRating(match, ballot("a", 7), events).finalScore, 7);
  assert.equal(matchAverage(match, "a", [], events), null);
});

test("reject duplicate adjustments, invented actions, other players and other matches", () => {
  const events = [
    action("own", "goal"),
    action("other-player", "goal", "b"),
    action("other-match", "goal", "a", "m2"),
  ];
  for (const eventId of ["missing", "other-player", "other-match"]) {
    assert.throws(
      () =>
        adjustedRating(
          match,
          { ...ballot("a", 5), eventAdjustments: [{ eventId, value: 1 }] },
          events,
        ),
      /este jugador y partido/,
    );
  }
  assert.throws(
    () =>
      adjustedRating(
        match,
        {
          ...ballot("a", 5),
          eventAdjustments: [
            { eventId: "own", value: 1 },
            { eventId: "own", value: 1 },
          ],
        },
        events,
      ),
    /un ajuste/,
  );
  assert.throws(
    () => adjustedRating(match, ballot("absent", 5), events),
    /participantes/,
  );
  assert.throws(
    () => adjustedRating(match, ballot("a", 11), events),
    /nota base/,
  );
});

test("events require a participating player, unique ID and at most one clean sheet per player", () => {
  assert.throws(
    () => validateMatchEvents(match, [action("x", "goal", "absent")]),
    /participantes/,
  );
  assert.throws(
    () =>
      validateMatchEvents(match, [action("x", "goal"), action("x", "goal")]),
    /duplicada/,
  );
  assert.throws(
    () =>
      validateMatchEvents(match, [
        action("c1", "clean_sheet"),
        action("c2", "clean_sheet"),
      ]),
    /portería/,
  );
});
