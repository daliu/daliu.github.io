/* Full-profile COMPOSITION test — the gap the unit tests left open.
 *
 * The projection's §13 reads (ipsative ordering, word/deed concordance, self-
 * alignment) were each unit-tested on SYNTHETIC `revealed`/`stated` objects, and
 * the arc/H8/cov reads in arc-integration.test.js. But nothing verified that
 * revealedScores() — fed a realistic multi-session, multi-layer event log built
 * through the runtime — produces output the downstream reads can actually consume,
 * which is exactly what the reveal screen composes. This builds one realistic user
 * end-to-end and asserts every reveal section's data composes. Pure Node, no deps.
 * Run: node patterns-of-choice/runtime/full-profile.test.js */
const { createRuntime, MemoryStore } = require("./poc-runtime.js");
const P = require("./poc-projection.js");
const tagMap = require("./tag-axis-map.v0.1.json");
const bundle = require("./content-bundle.v0.1.json");

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? pass++ : (fail++, console.log("  FAIL:", m, extra !== undefined ? JSON.stringify(extra) : "")); };
const USER = "compose-user";

// distinct revealed means so the ordering is unambiguous:
// truth 0.9 > in-group 0.7 > allocation 0.5 > reciprocity 0.3
const DOMAIN_ITEMS = {
  "truth-telling":        [["truth:commission"], ["truth:commission"], ["truth:state"]],       // (1+1+.7)/3 = .9
  "in-group-out-group":   [["loyalty:community"], ["loyalty:community"], ["loyalty:community"]],// .7
  "resource-allocation":  [["value:need_sensitivity"], ["value:need_sensitivity"], ["value:need_sensitivity"]], // .5
  "reciprocity-cooperation": [["trust:institutional"], ["trust:institutional"], ["trust:institutional"]],       // .3
};
// 3 stated layers with deliberately different alignment to the revealed order
const LAYER_KEEP = {
  aspirational_self: ["honesty", "tact", "generosity", "loyalty", "trust"],          // truth-leaning -> tracks revealed
  current_self:      ["trust", "vigilance", "cooperation", "independence", "forgiveness"], // all reciprocity -> anti-tracks
  admired_other:     ["honesty", "generosity", "loyalty", "universalism", "fairness"],     // spread
};

(async () => {
  const RT = createRuntime({ store: MemoryStore(), corpus_version: "test" });
  await RT.init();

  // 3-layer card sort (one CardSortResponse per deck value per layer)
  const allValues = Object.values(bundle.valuesByDomain).flat();
  for (const [layer, keep] of Object.entries(LAYER_KEEP)) {
    const kept = new Set(keep);
    for (const v of allValues)
      await RT.logCardSort({ user_id: USER, layer, value_id: v, selected: kept.has(v), timestamp_iso: new Date().toISOString() });
  }

  // 4 domains x 2 sessions x 3 scored items (RT >= 2s so the inattentive gate passes)
  let sess = 0;
  for (const [domain, items] of Object.entries(DOMAIN_ITEMS)) {
    for (let s = 0; s < 2; s++) {
      const session_id = `s-${domain}-${s}`;
      items.forEach((tags, i) => {
        sess++;
        return RT.logSessionChoice({
          user_id: USER, session_id, scenario_id: `qf-${domain}`, scenario_type: "quick-fire-round",
          domain, item_id: `i${i}`, option_id: "a", tags, response_time_ms: 3500,
          presented_position: i + 1, was_timeout: false, timestamp_iso: new Date().toISOString(),
        });
      });
    }
  }
  // allow the awaited appends above to settle (forEach fired them; drain once more)
  await RT.logSessionChoice({ user_id: USER, session_id: "drain", scenario_id: "x", scenario_type: "quick-fire-round",
    domain: "truth-telling", item_id: "z", option_id: null, tags: [], response_time_ms: 0, presented_position: 1, was_timeout: true });

  const exp = await RT.exportForAnalyzer();
  const rev = P.revealedScores(exp.session_log, tagMap);

  // (1) revealedScores composes for all 4 domains, in the intended order
  ok(Object.keys(rev).length === 4, "revealed: all 4 domains scored", Object.keys(rev));
  ok(Math.abs(rev["truth-telling"].revealed_score_mean - 0.9) < 1e-9, "revealed: truth mean .9", rev["truth-telling"]);
  ok(rev["truth-telling"].se !== null, "revealed: se defined (>=2 sessions)");

  // (2) ipsative ordering composes off the real revealed object
  const ord = P.ipsativeOrdering(rev);
  ok(ord.ok && !ord.level, "ordering: composes, not level");
  ok(ord.order[0] === "truth-telling" && ord.order[ord.order.length - 1] === "reciprocity-cooperation",
     "ordering: truth top, reciprocity bottom", ord.order);

  // (3) word/deed concordance composes for each completed layer
  for (const layer of Object.keys(LAYER_KEEP)) {
    const stated = P.cardSortStated(exp.card_sort, bundle.valuesByDomain, layer);
    ok(Object.keys(stated).length === 4, `concordance input: ${layer} stated covers 4 domains`);
    ok(P.wordDeedConcordance(rev, stated).ok, `concordance composes for ${layer}`);
  }

  // (4) self-alignment composes across all 3 layers and picks the best-tracking self
  const align = P.selfAlignment(rev, exp.card_sort, bundle.valuesByDomain, ["aspirational_self", "current_self", "admired_other"]);
  ok(align.ok && align.n === 3, "selfAlignment: all 3 layers compose", align && align.n);
  const tau = Object.fromEntries(align.byLayer.map(x => [x.layer, x.tau]));
  ok(tau.aspirational_self > tau.current_self, "selfAlignment: aspirational tracks the deeds better than the reciprocity-only 'current' self", tau);

  // (5) the top-level profile() helper composes end-to-end
  const prof = P.profile(exp, tagMap, bundle.valuesByDomain, "aspirational_self");
  ok(prof.revealed && Object.keys(prof.revealed).length === 4 && prof.ordering.ok && prof.concordance.ok,
     "profile(): revealed + ordering + concordance all compose together");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
