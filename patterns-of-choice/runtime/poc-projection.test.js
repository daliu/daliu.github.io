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

// --- h8Divergence: abstract-vs-narrative (does attachment shift the judgment?) ---
const probe = {
  pair_id: "pp-allocation-001",
  abstract: { scenario_id: "qf-allocation-013", item_id: "qf-allocation-013-i01" },
  narrative: { scenario_id: "narr-allocation-008", signal: "scene-the-choice" },
};
const ans = (scn, item, tags) => ({ scenario_id: scn, item_id: item, option_id: "x", tags });
const NEAR = ["counterparty:animal-dependent"], FAR = ["counterparty:anonymous"];
ok(!P.h8Divergence([], probe).ok && !P.h8Divergence([], probe).hasAbstract, "no answers -> not ok");
ok(!P.h8Divergence([ans("qf-allocation-013", "qf-allocation-013-i01", FAR)], probe).ok, "abstract only -> not ok (need both)");
const conc = P.h8Divergence([ans("qf-allocation-013", "qf-allocation-013-i01", NEAR), ans("narr-allocation-008", "scene-the-choice", NEAR)], probe);
ok(conc.ok && conc.concordant && conc.shift === "none", "both 'near' -> concordant, no shift");
const shiftNear = P.h8Divergence([ans("qf-allocation-013", "qf-allocation-013-i01", FAR), ans("narr-allocation-008", "scene-the-choice", NEAR)], probe);
ok(shiftNear.ok && !shiftNear.concordant && shiftNear.shift === "toward-near", "far abstract + near narrative -> shift toward-near (the H8 prediction)", shiftNear);
const shiftFar = P.h8Divergence([ans("qf-allocation-013", "qf-allocation-013-i01", NEAR), ans("narr-allocation-008", "scene-the-choice", FAR)], probe);
ok(shiftFar.ok && shiftFar.shift === "toward-far", "near abstract + far narrative -> shift toward-far");
// most-recent answer wins (a correction/re-answer supersedes an earlier one)
const recency = P.h8Divergence([ans("qf-allocation-013", "qf-allocation-013-i01", NEAR), ans("qf-allocation-013", "qf-allocation-013-i01", FAR), ans("narr-allocation-008", "scene-the-choice", FAR)], probe);
ok(recency.ok && recency.abstractPole === "far" && recency.concordant, "latest abstract answer is the one used");

// --- attachmentReport: self-report read (descriptive, single-subject) ---
const arcB = { arc_id: "arc-biscuit" };
const instr = (arcId, instrument, values) => ({ arc_id: arcId, instrument,
  responses: values.map((v, i) => ({ item_id: "psr-" + (i + 1), value: v })), scale_min: 1, scale_max: 5 });
ok(!P.attachmentReport([], arcB).ok, "no instrument events -> not ok");
ok(!P.attachmentReport([instr("other-arc", "psr-prd-v0.1", [5, 5, 5, 5])], arcB).ok, "other arc's report ignored");
const hi = P.attachmentReport([instr("arc-biscuit", "psr-prd-v0.1", [5, 5, 4, 5])], arcB);
ok(hi.ok && Math.abs(hi.mean - 4.75) < 1e-9 && hi.tone === "high", "high self-report -> tone high", hi);
ok(P.attachmentReport([instr("arc-biscuit", "psr-prd-v0.1", [1, 2, 1, 2])], arcB).tone === "low", "low self-report -> tone low");
ok(P.attachmentReport([instr("arc-biscuit", "psr-prd-v0.1", [3, 3, 4, 2])], arcB).tone === "mixed", "mid self-report -> tone mixed");
const latest = P.attachmentReport([instr("arc-biscuit", "psr", [1, 1, 1, 1]), instr("arc-biscuit", "psr", [5, 5, 5, 5])], arcB);
ok(latest.mean === 5, "most recent administration is the one used");

// --- selfAlignment: which stated reference-self the choices track best ---
const vbd3 = { "truth-telling": ["honesty", "tact"], "resource-allocation": ["generosity", "thrift"], "in-group-out-group": ["loyalty", "fairness"] };
const csMulti = [];
const mk = (layer, ids) => Object.values(vbd3).flat().forEach(v => csMulti.push({ layer, selected: ids.includes(v), value_id: v }));
mk("aspirational_self", ["honesty", "generosity", "loyalty", "fairness"]);  // spreads across domains
mk("current_self", ["honesty", "tact"]);                                     // truth-heavy only
const sa = P.selfAlignment(revealed, csMulti, vbd3, ["aspirational_self", "current_self", "admired_other"]);
ok(sa.ok && sa.n === 2, "selfAlignment: reads the two completed layers (skips the unsorted third)", sa);
ok(sa.byLayer[0].tau >= sa.byLayer[1].tau && sa.closest === sa.byLayer[0].layer, "selfAlignment: closest = highest-concordance layer");
ok(!P.selfAlignment(revealed, csMulti, vbd3, ["admired_other"]).ok, "selfAlignment: only-unsorted layer -> not ok");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
