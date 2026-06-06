/* Client-projection regression test. Run: node patterns-of-choice/runtime/poc-projection.test.js
 * Verifies the on-device scoring matches scoring.md §2.2/§3/§5.1/§13 with known
 * expected outputs. Pure Node, no deps. Mirrors check_analyzer_thresholds.py discipline. */
const P = require("./poc-projection.js");
const tagMap = require("./tag-axis-map.v0.1.json");

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? pass++ : (fail++, console.log("  FAIL:", m, extra !== undefined ? JSON.stringify(extra) : "")); };

// itemScore: clamp + NA + axis isolation
ok(P.itemScore("truth-telling", ["truth:commission"], tagMap).score === 1.0, "single +1 tag");
ok(P.itemScore("truth-telling", ["truth:commission", "truth:confront-direct"], tagMap).score === 1.0, "sum clamps to +1");
ok(P.itemScore("truth-telling", ["lie:white"], tagMap).score === -0.5, "lie:white = -0.5");
ok(P.itemScore("truth-telling", ["counterparty:close"], tagMap).n === 0, "metadata-only tag -> NA");
ok(P.itemScore("in-group-out-group", ["hospitality"], tagMap).n === 0, "secondary-axis tag excluded from primary");
ok(P.itemScore("in-group-out-group", ["loyalty"], tagMap).score === 1.0, "primary loyalty tag scores");

// revealedScores: NA (<3) and inattentive (median RT<2s) drops
const entry = (sess, dom, tags, rt) => ({ session_id: sess, domain: dom, tags, response_time_ms: rt });
const log1 = [entry("s1", "truth-telling", ["truth:commission"], 3000), entry("s1", "truth-telling", ["lie:white"], 3000), entry("s1", "truth-telling", ["truth:state"], 3000)];
const rv = P.revealedScores(log1, tagMap);
ok(Math.abs(rv["truth-telling"].revealed_score_mean - (1.0 - 0.5 + 0.7) / 3) < 1e-9, "3-item session mean");
ok(rv["truth-telling"].n_sessions_contributing === 1, "1 session contributing");
ok(!P.revealedScores([entry("s1", "truth-telling", ["truth:commission"], 3000), entry("s1", "truth-telling", ["lie:white"], 3000)], tagMap)["truth-telling"], "<3 items -> domain absent");
ok(!P.revealedScores([entry("s1", "truth-telling", ["truth:commission"], 500), entry("s1", "truth-telling", ["lie:white"], 400), entry("s1", "truth-telling", ["truth:state"], 600)], tagMap)["truth-telling"], "inattentive session dropped");

// card-sort fraction
const vbd = { "truth-telling": ["honesty", "tact", "transparency", "discretion", "authenticity"] };
const cs = [{ layer: "aspirational_self", selected: true, value_id: "honesty" }, { layer: "aspirational_self", selected: true, value_id: "tact" }, { layer: "current_self", selected: true, value_id: "transparency" }];
ok(P.cardSortStated(cs, vbd, "aspirational_self")["truth-telling"] === 0.4, "2 of 5 in aspirational -> 0.4");
ok(Object.keys(P.cardSortStated([], vbd, "aspirational_self")).length === 0, "empty card-sort -> {} (stated channel absent, not all-zeros)");
ok(Object.keys(P.cardSortStated(cs, vbd, "admired_other")).length === 0, "no responses for layer -> {} (not all-zeros)");

// §13 ordering + concordance
const revealed = {
  "truth-telling": { domain: "truth-telling", revealed_score_mean: 0.21, n_sessions_contributing: 16, se: 0.06 },
  "resource-allocation": { domain: "resource-allocation", revealed_score_mean: 0.16, n_sessions_contributing: 15, se: 0.07 },
  "in-group-out-group": { domain: "in-group-out-group", revealed_score_mean: 0.55, n_sessions_contributing: 15, se: 0.07 },
  "reciprocity-cooperation": { domain: "reciprocity-cooperation", revealed_score_mean: -0.30, n_sessions_contributing: 1, se: null },
};
const ord = P.ipsativeOrdering(revealed);
ok(ord.ok && !ord.level && ord.order[0] === "in-group-out-group", "ordering: in-group top");
const tie = ord.rels.find(r => (r.a + r.b).includes("truth-telling") && (r.a + r.b).includes("resource-allocation"));
ok(tie && tie.tie === true, "truth vs allocation is a TIE");
ok(!ord.order.includes("reciprocity-cooperation"), "single-session domain excluded");
const con = P.wordDeedConcordance(revealed, { "truth-telling": 0.80, "resource-allocation": 0.40, "in-group-out-group": 0.20, "reciprocity-cooperation": 0.60 });
ok(con.ok && con.band === "high", "concordance band high", { band: con.band, tau: con.tau });
ok(con.flips.some(f => f.said_lower === "in-group-out-group"), "in-group unclaimed-strength flip");

// --- arcProgress: completion-gated recurring-character beats ---
const arc = { arc_id: "arc-biscuit", beats: [
  { beat_id: "arc-biscuit-b1", order: 1, kind: "naming",      min_prior_encounters: 0 },
  { beat_id: "arc-biscuit-b2", order: 2, kind: "encounter",   min_prior_encounters: 1 },
  { beat_id: "arc-biscuit-b3", order: 3, kind: "encounter",   min_prior_encounters: 2 },
  { beat_id: "arc-biscuit-b4", order: 4, kind: "high_stakes", min_prior_encounters: 3 },
]};
const cx = (aid, bid) => ({ scenario_type: "arc-beat-complete", arc_id: aid, beat_id: bid });
const dx = (aid, bid) => ({ scenario_type: "arc-beat", arc_id: aid, beat_id: bid, tags: ["recurring_npc:biscuit"] });
const C = bid => cx("arc-biscuit", bid);

const a0 = P.arcProgress([], arc);
ok(a0.next.beat_id === "arc-biscuit-b1" && !a0.locked && a0.encounters === 0 && !a0.done, "fresh arc -> b1 next, unlocked, 0 encounters");
ok(P.arcProgress([dx("arc-biscuit", "arc-biscuit-b1")], arc).next.beat_id === "arc-biscuit-b1", "a decision without a completion marker does NOT advance the arc");
const a1 = P.arcProgress([C("arc-biscuit-b1")], arc);
ok(a1.next.beat_id === "arc-biscuit-b2" && a1.encounters === 1, "b1 complete -> b2 next, 1 encounter accrued");
const a2 = P.arcProgress([C("arc-biscuit-b1"), C("arc-biscuit-b2")], arc);
ok(a2.next.beat_id === "arc-biscuit-b3" && a2.encounters === 2 && !a2.locked, "b1+b2 -> b3 next, unlocked (gate 2 <= 2)");
const a3 = P.arcProgress([C("arc-biscuit-b1"), C("arc-biscuit-b2"), C("arc-biscuit-b3")], arc);
ok(a3.next.beat_id === "arc-biscuit-b4" && a3.encounters === 3 && !a3.locked, "build-up done -> climax is next AND unlocked (3 encounters >= gate 3)");
const a4 = P.arcProgress([C("arc-biscuit-b1"), C("arc-biscuit-b2"), C("arc-biscuit-b3"), C("arc-biscuit-b4")], arc);
ok(a4.done && a4.next === null, "all beats complete -> done, no next");
ok(P.arcProgress([cx("other-arc", "arc-biscuit-b1")], arc).encounters === 0, "a different arc's completion marker is ignored");
// the gate has teeth: a beat whose min_prior_encounters exceeds accrued encounters is locked
const lockArc = { arc_id: "x", beats: [
  { beat_id: "x1", order: 1, kind: "encounter", min_prior_encounters: 0 },
  { beat_id: "x2", order: 2, kind: "high_stakes", min_prior_encounters: 5 },
]};
const al = P.arcProgress([cx("x", "x1")], lockArc);
ok(al.next.beat_id === "x2" && al.locked && al.needed === 5 && al.encounters === 1, "next beat gated behind more encounters -> locked, needed reported");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
