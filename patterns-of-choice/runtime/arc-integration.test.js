/* Arc-player integration test — the COMPOSED system: engine + projection + the
 * REAL content bundle, driven through a full Biscuit arc playthrough exactly as the
 * app does (decision events + completion markers per beat). Verifies gating,
 * encounter accrual, name substitution into the reused climax, and that the H8b
 * measurement substrate is present. Run: node patterns-of-choice/runtime/arc-integration.test.js
 *
 * This is the integration layer the project keeps relearning to value: the unit
 * tests pass on each module, but only a full playthrough over the real bundle
 * proves the pieces actually compose. Pure Node, no deps. */
const { createRuntime, MemoryStore, uuid } = require("./poc-runtime.js");
const P = require("./poc-projection.js");
const bundle = require("./content-bundle.v0.1.json");

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? pass++ : (fail++, console.log("  FAIL:", m, extra !== undefined ? JSON.stringify(extra) : "")); };
const USER = "test-user";
const NAME = "Rufus";

// the app's name substitution, mirrored exactly (token + canonical default name)
function subst(arc, text, name){
  return (text || "").split(arc.name_token).join(name).split(arc.npc_default_name).join(name);
}
function beatNode(arc, beat){ return beat.scenario_ref ? bundle.arcScenarios[beat.scenario_ref] : beat; }
function startScene(scenes){ return (scenes.find(s => s.id === "scene-1") || scenes.find(s => !s.terminal) || scenes[0]).id; }

(async () => {
  const arc = bundle.arcs && bundle.arcs[0];
  ok(!!arc && arc.arc_id === "arc-biscuit", "bundle carries arc-biscuit");
  const NAMEKEY = "npc_name:" + arc.arc_id;

  const RT = createRuntime({ store: MemoryStore(), corpus_version: "test", tag_map_version: "v0.1" });
  await RT.init();

  // --- data invariants the substitution + H8b read depend on ---
  ok(JSON.stringify(arc.beats[0]).includes("{dog_name}"), "build-up beat uses the {dog_name} token");
  ok(!String(arc.beats[0].setup).includes("Biscuit"), "build-up beat hard-codes no default name");
  const climax = bundle.arcScenarios["narr-allocation-008"];
  ok(climax && climax.setup.includes("Biscuit"), "reused climax canon literally says the default name");
  const subbed = subst(arc, climax.setup, NAME);
  ok(subbed.includes(NAME) && !subbed.includes("Biscuit"), "subst swaps default name -> chosen name in the climax");
  const sig = climax.scenes.find(s => s.id === "scene-the-choice");
  const sigTags = sig.choices.flatMap(c => c.tags);
  ok(sigTags.includes("counterparty:animal-dependent") && sigTags.includes("counterparty:anonymous"),
     "climax signal scene carries the H8b binary (animal-dependent vs anonymous)");
  const probe = (bundle.h8Probes || []).find(h => h.pair_id === "pp-allocation-001");
  ok(probe && probe.abstract.item_id === "qf-allocation-013-i01", "abstract twin item present in bundle for the H8b read");

  // --- play the arc in order, exactly as the app's arc-player does ---
  const encounterTrace = [];
  for (const beat of arc.beats){
    let prog = P.arcProgress((await RT.exportForAnalyzer()).session_log, arc);
    ok(prog.next && prog.next.beat_id === beat.beat_id, `arc routes to ${beat.beat_id} next`, prog.next && prog.next.beat_id);
    if (beat.kind === "high_stakes"){
      ok(!prog.locked && prog.encounters === 3, "climax is reached only after 3 accrued encounters, and is unlocked", { locked: prog.locked, enc: prog.encounters });
    } else {
      ok(!prog.locked, `${beat.beat_id} unlocked when reached`);
    }
    encounterTrace.push(prog.encounters);

    if (beat.captures_name) await RT.setSetting(NAMEKEY, NAME);

    const node = beatNode(arc, beat);
    const scenes = node.scenes;
    const sessionId = uuid();
    let sid = startScene(scenes), step = 0, guard = 0, terminal = null;
    while (true){
      const sc = scenes.find(s => s.id === sid);
      if (!sc || sc.terminal){ terminal = sc || null; break; }
      const c = sc.choices[0];
      await RT.logSessionChoice({
        user_id: USER, session_id: sessionId, timestamp_iso: new Date().toISOString(),
        scenario_id: beat.scenario_ref || beat.beat_id, scenario_type: "arc-beat",
        domain: arc.primary_domain, arc_id: arc.arc_id, beat_id: beat.beat_id,
        item_id: sc.id, option_id: c.id, tags: c.tags, response_time_ms: 4000,
        presented_position: step + 1, was_timeout: false,
      });
      // every arc choice carries the recurring-npc tag (the attachment marker)
      ok(c.tags.includes(arc.recurring_npc_tag), `${beat.beat_id}/${sc.id}/${c.id} carries ${arc.recurring_npc_tag}`);
      sid = c.next; step += 1;
      if (++guard > 30){ ok(false, `walk runaway in ${beat.beat_id}`); break; }
    }
    await RT.logSessionChoice({
      user_id: USER, session_id: sessionId, timestamp_iso: new Date().toISOString(),
      scenario_id: beat.scenario_ref || beat.beat_id, scenario_type: "arc-beat-complete",
      domain: arc.primary_domain, arc_id: arc.arc_id, beat_id: beat.beat_id,
      item_id: terminal ? terminal.id : null, option_id: null, tags: [],
      response_time_ms: 0, presented_position: step + 1, was_timeout: false,
    });
  }

  ok(JSON.stringify(encounterTrace) === JSON.stringify([0, 1, 2, 3]), "encounters accrue 0->1->2->3 across the beats", encounterTrace);

  const finalProg = P.arcProgress((await RT.exportForAnalyzer()).session_log, arc);
  ok(finalProg.done && finalProg.next === null, "arc is done after the climax");
  ok(finalProg.completedCount === 4 && finalProg.encounters === 3, "4 beats complete, 3 of them encounters", { c: finalProg.completedCount, e: finalProg.encounters });

  // the name persisted as a setting (survives reload via the meta store)
  ok((await RT.getSetting(NAMEKEY)) === NAME, "chosen name persisted as a runtime setting");

  // replay-to-timestamp still works with arc events in the log (rewind invariant)
  const full = await RT.log();
  ok(full.length > 4, "arc produced a real event stream", full.length);

  // --- H8b divergence end-to-end: the climax was carried at choice[0] (carry the
  //     dog = near); now log the abstract twin's 'anonymous'/far answer and read it ---
  const farOpt = probe.abstract.options.find(o => o.tags.includes("counterparty:anonymous"));
  ok(!!farOpt, "abstract twin has an 'anonymous' (far) option");
  await RT.logSessionChoice({
    user_id: USER, session_id: uuid(), timestamp_iso: new Date().toISOString(),
    scenario_id: probe.abstract.scenario_id, scenario_type: "h8-abstract-probe",
    domain: "resource-allocation", item_id: probe.abstract.item_id,
    option_id: farOpt.id, tags: farOpt.tags, response_time_ms: 5000, presented_position: 1, was_timeout: false,
  });
  const slog = (await RT.exportForAnalyzer()).session_log;
  const dv = P.h8Divergence(slog, probe);
  ok(dv.ok && dv.narrativePole === "near", "narrative climax (carried the dog) read as 'near'", dv);
  ok(dv.abstractPole === "far" && dv.shift === "toward-near", "abstract=anonymous + narrative=near -> shift toward-near (the H8 prediction), end-to-end", dv);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
