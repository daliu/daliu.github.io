/* Runtime-core regression test. Run: node patterns-of-choice/runtime/poc-runtime.test.js
 * Pure Node, no deps; exercises the engine against the in-memory store.
 * Mirrors the gate discipline of the research repo's check_analyzer_thresholds.py. */
const R = require("./poc-runtime.js");
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : (fail++, console.log("  FAIL:", m)); };

  const rt = R.createRuntime({ store: R.MemoryStore(), corpus_version: "test" });
  await rt.init();
  ok(!!rt.deviceId, "device_id assigned");
  ok(rt.seq === 0, "seq starts at 0");

  const e1 = await rt.logSessionChoice({ user_id: "u", session_id: "s1", scenario_id: "qf-truth-001", item_id: "i01", option_id: "a", tags: ["truth:commission"], domain: "truth-telling", response_time_ms: 1200, was_timeout: false, presented_position: 1 });
  await sleep(3);
  const e2 = await rt.logSessionChoice({ user_id: "u", session_id: "s1", scenario_id: "qf-truth-001", item_id: "i02", option_id: "b", tags: ["lie:white"], domain: "truth-telling", response_time_ms: 900, was_timeout: false, presented_position: 2 });
  ok(rt.seq === 2, "seq increments to 2");
  ok(e1.event_id !== e2.event_id, "event_ids unique");
  ok(e1.kind === "session_log" && e1.schema_version === "0.1", "envelope shape");
  ok(e1.event_id.includes("-") && e1.event_id.length >= 32, "event_id is a uuid, not a content hash");

  let lg = await rt.log();
  ok(lg.length === 2, "log has 2 events");
  ok(lg[0].local_seq < lg[1].local_seq, "deterministic order by seq");

  const tsBeforeCorrection = new Date().toISOString();
  await sleep(3);
  const e2b = await rt.correct("session_log", { user_id: "u", session_id: "s1", scenario_id: "qf-truth-001", item_id: "i02", option_id: null, tags: [], domain: "truth-telling", response_time_ms: 8000, was_timeout: true, presented_position: 2 }, e2.event_id);
  lg = await rt.log();
  ok(lg.length === 2, "supersede keeps effective count at 2");
  ok(!lg.find(e => e.event_id === e2.event_id), "superseded event removed");
  ok(!!lg.find(e => e.event_id === e2b.event_id), "correction present");

  const rewound = await rt.log({ asOf: tsBeforeCorrection });
  ok(!rewound.find(e => e.event_id === e2b.event_id), "rewind excludes later correction");
  ok(!!rewound.find(e => e.event_id === e2.event_id), "rewind shows pre-correction state");

  await rt.logPairwise({ user_id: "u", layer: "aspirational_self", pair_id: "p1", left_id: "honesty", right_id: "tact", choice: "left", response_time_ms: 500, timestamp_iso: new Date().toISOString() });
  await rt.logPairwise({ user_id: "u", layer: "aspirational_self", pair_id: "p2", left_id: "loyalty", right_id: "fairness", choice: "skip", response_time_ms: 300, timestamp_iso: new Date().toISOString() });
  const exp = await rt.exportForAnalyzer();
  ok(exp.pairwise.length === 1, "pairwise export drops the skip");
  ok(exp.pairwise[0].winner === "honesty" && exp.pairwise[0].loser === "tact", "winner/loser transform");
  ok(exp.session_log.length === 2, "export session_log reflects supersede");

  const effNow = await rt.log();
  const backup = await rt.exportBackup();
  // backup is the RAW history (incl. the superseded event), so rewind survives a restore
  ok(backup.events.some(e => e.event_id === e2.event_id), "backup includes the superseded event (raw history)");
  ok(backup.events.length === effNow.length + 1, "backup = effective + 1 superseded event");
  const rt2 = R.createRuntime({ store: R.MemoryStore() });
  const n = await rt2.importBackup(backup);
  ok(n === backup.events.length, "importBackup imported all raw events");
  ok((await rt2.log()).length === effNow.length, "restored effective length matches");
  // the critical round-trip: replay-to-timestamp works AFTER restore (was broken
  // when exportBackup serialized the post-supersede fold and dropped e2).
  const rewound2 = await rt2.log({ asOf: tsBeforeCorrection });
  ok(!!rewound2.find(e => e.event_id === e2.event_id), "restored log rewinds to pre-correction state");
  ok(!rewound2.find(e => e.event_id === e2b.event_id), "restored rewind excludes the later correction");

  // settings round-trip: getSetting returns the VALUE, not the internal {value,ts} wrapper
  ok((await rt.getSetting("npc_name:arc-biscuit")) === undefined, "unset setting -> undefined");
  await rt.setSetting("npc_name:arc-biscuit", "Rufus");
  ok((await rt.getSetting("npc_name:arc-biscuit")) === "Rufus", "setSetting/getSetting round-trips the raw value");

  await rt.eraseEverything();
  ok((await rt.log()).length === 0, "eraseEverything clears the log");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
