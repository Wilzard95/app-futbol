import test from "node:test";
import assert from "node:assert/strict";
import {
  anonymousLineups,
  defaultFormationIds,
  formationCatalog,
  formationVoting,
  getFormation,
  lineupConsensus,
  suggestLineup,
  upsertLineup,
  validateLineup,
} from "./lineups.ts";
import type { LineupProposal, Player } from "./types.ts";

const roster = Array.from({ length: 12 }, (_, index) => `p${index + 1}`);
const voters = roster.slice(0, 10);
const defaultId = defaultFormationIds[6];
const selected = getFormation(6, defaultId);
function proposal(
  id: string,
  authorPlayerId: string,
  formationId = defaultId,
  tournamentId = "t1",
): LineupProposal {
  return {
    id,
    authorPlayerId,
    formationId,
    tournamentId,
    picks: Object.fromEntries(
      getFormation(6, formationId).slots.map((slot, index) => [
        slot.id,
        roster[index],
      ]),
    ),
  };
}

test("all formations have the right player count, one keeper and positions inside the pitch", () => {
  assert.deepEqual(
    formationCatalog[6].map((item) => item.name),
    ["3–2", "3–1–1", "2–2–1", "2–3"],
  );
  for (const format of [5, 6, 11] as const)
    for (const item of formationCatalog[format]) {
      assert.equal(item.slots.length, format);
      assert.equal(item.slots.filter((slot) => slot.id === "gk").length, 1);
      assert.equal(new Set(item.slots.map((slot) => slot.id)).size, format);
      assert.ok(
        item.slots.every(
          (slot) => slot.x > 0 && slot.x < 100 && slot.y > 0 && slot.y < 100,
        ),
      );
      assert.equal(
        item.name.split("–").reduce((sum, size) => sum + Number(size), 0),
        format - 1,
      );
    }
});

test("formation voting counts a proposal once, isolates tournaments and preserves a tie for first", () => {
  const proposals = [
    proposal("a", "p1"),
    proposal("b", "p2", "f6-3-2"),
    proposal("c", "p1", "f6-2-3", "other"),
  ];
  const voting = formationVoting("t1", 6, proposals, roster, voters);
  assert.equal(voting.total, 2);
  assert.deepEqual(new Set(voting.leaders), new Set([defaultId, "f6-3-2"]));
  assert.equal(
    voting.entries.find((item) => item.formation.id === defaultId)!.percentage,
    50,
  );
  assert.equal(
    voting.entries.find((item) => item.formation.id === "f6-2-3")!.votes,
    0,
  );
});

test("editing one's formation replaces their proposal and preserves its anonymous ID", () => {
  const original = proposal("stable-id", "p1");
  const other = proposal("other", "p2");
  const changed = upsertLineup(
    [original, other],
    proposal("new-id", "p1", "f6-3-2"),
    6,
    roster,
    voters,
  );
  assert.equal(changed.length, 2);
  assert.equal(
    changed.find((item) => item.authorPlayerId === "p1")!.id,
    "stable-id",
  );
  assert.equal(formationVoting("t1", 6, changed, roster, voters).total, 2);
  assert.equal(
    formationVoting("t1", 6, changed, roster, voters).entries.find(
      (item) => item.formation.id === defaultId,
    )!.votes,
    1,
  );
  assert.equal(original.formationId, defaultId);
  assert.equal(
    upsertLineup(changed, proposal("unused", "p1", "f6-3-2"), 6, roster, voters)
      .length,
    2,
  );
});

test("unfinished lineups, repeated players, outsiders and foreign positions cannot be saved", () => {
  const valid = proposal("a", "p1");
  assert.throws(
    () => validateLineup({ ...valid, picks: { gk: "p1" } }, 6, roster, voters),
    /exactamente/,
  );
  assert.throws(
    () =>
      validateLineup(
        { ...valid, picks: { ...valid.picks, [selected.slots[1].id]: "p1" } },
        6,
        roster,
        voters,
      ),
    /repetir/,
  );
  assert.throws(
    () =>
      validateLineup(
        { ...valid, picks: { ...valid.picks, gk: "outsider" } },
        6,
        roster,
        voters,
      ),
    /jugadores del equipo/,
  );
  const wrongPosition = { ...valid.picks };
  delete wrongPosition.gk;
  wrongPosition.unknown = "p1";
  assert.throws(
    () => validateLineup({ ...valid, picks: wrongPosition }, 6, roster, voters),
    /exactamente/,
  );
  assert.throws(
    () =>
      validateLineup({ ...valid, formationId: "f11-4-3-3" }, 6, roster, voters),
    /modalidad/,
  );
  assert.throws(
    () =>
      validateLineup({ ...valid, authorPlayerId: "p12" }, 6, roster, voters),
    /vinculado/,
  );
});

test("duplicates by author across formations are rejected before counting", () => {
  assert.throws(
    () =>
      formationVoting(
        "t1",
        6,
        [proposal("a", "p1"), proposal("b", "p1", "f6-3-2")],
        roster,
        voters,
      ),
    /una propuesta/,
  );
});

test("collective positions use only votes for the same formation and keep all tied players", () => {
  const first = proposal("a", "p1");
  const second = proposal("b", "p2");
  [second.picks[selected.slots[1].id], second.picks[selected.slots[2].id]] = [
    second.picks[selected.slots[2].id],
    second.picks[selected.slots[1].id],
  ];
  const different = proposal("c", "p3", "f6-3-2");
  const result = lineupConsensus(
    "t1",
    selected,
    [first, second, different],
    roster,
    voters,
  );
  assert.equal(result.proposalCount, 2);
  assert.equal(result.positions[0].votes, 2);
  assert.deepEqual(result.positions[1].winners, ["p2", "p3"]);
  assert.deepEqual(new Set(result.conflicts), new Set(["p2", "p3"]));
});

test("no saved proposals means no winning formation and no invented players", () => {
  const voting = formationVoting("t1", 6, [], roster, voters);
  assert.deepEqual(voting.leaders, []);
  assert.ok(
    voting.entries.every((item) => item.votes === 0 && item.percentage === 0),
  );
  assert.ok(
    lineupConsensus("t1", selected, [], roster, voters).positions.every(
      (slot) => slot.winners.length === 0,
    ),
  );
});

test("historical proposals stay visible while removed players do not win current positions", () => {
  const first = proposal("a", "p1");
  const second = proposal("b", "p2");
  const removed = first.picks[selected.slots[1].id];
  const active = roster.filter(id => id !== removed);
  const voting = formationVoting("t1", 6, [first, second], roster, voters);
  const result = lineupConsensus("t1", selected, [first, second], roster, voters, active);
  assert.equal(voting.total, 2);
  assert.equal(result.proposalCount, 2);
  assert.ok(result.positions.every(position => !position.winners.includes(removed)));
});

test("anonymous proposals omit author identity and do not share mutable picks", () => {
  const original = proposal("a", "p1");
  const result = anonymousLineups("t1", [
    original,
    proposal("b", "p2", defaultId, "other"),
  ]);
  assert.equal(result.length, 1);
  assert.equal("authorPlayerId" in result[0], false);
  result[0].picks.gk = "p12";
  assert.equal(original.picks.gk, "p1");
});

test("suggestions put the supplied keeper in goal and leave vacancies instead of inventing players", () => {
  const positions = [
    "Delantero",
    "Volante",
    "Portero",
    "Defensa",
    "Volante",
    "Defensa",
    "Delantero",
    "Volante",
  ];
  const players: Player[] = positions.map((position, index) => ({
    id: roster[index],
    name: `Jugador ${index + 1}`,
    number: String(index + 1),
    position,
    linked: true,
  }));
  const complete = suggestLineup(selected, players);
  assert.equal(complete.gk, "p3");
  assert.equal(
    validateLineup(
      { ...proposal("a", "p1"), picks: complete },
      6,
      players.map((player) => player.id),
      voters,
    ).format,
    6,
  );
  const eleven = suggestLineup(
    getFormation(11, defaultFormationIds[11]),
    players,
  );
  const assigned = Object.values(eleven).filter(Boolean);
  assert.equal(eleven.gk, "p3");
  assert.equal(assigned.length, 8);
  assert.equal(new Set(assigned).size, 8);
  assert.equal(Object.values(eleven).filter((id) => !id).length, 3);
  assert.ok(assigned.every((id) => players.some((player) => player.id === id)));
});
