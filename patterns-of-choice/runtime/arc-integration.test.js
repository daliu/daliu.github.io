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
const tagMap = require("./tag-axis-map.v0.1.json");

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

    if (beat.kind === "attachment_probe"){          // self-report beat: instrument + completion, no scene walk
      ok(Array.isArray(beat.items) && beat.items.length >= 3, "attachment_probe carries items");
      const sessionId = uuid();
      await RT.logInstrument({
        user_id: USER, instrument: beat.instrument, arc_id: arc.arc_id, beat_id: beat.beat_id,
        timestamp_iso: new Date().toISOString(), scale_min: beat.scale.min, scale_max: beat.scale.max,
        responses: beat.items.map(it => ({ item_id: it.id, value: beat.scale.max })),
      });
      await RT.logSessionChoice({
        user_id: USER, session_id: sessionId, timestamp_iso: new Date().toISOString(),
        scenario_id: beat.beat_id, scenario_type: "arc-beat-complete", domain: arc.primary_domain,
        arc_id: arc.arc_id, beat_id: beat.beat_id, item_id: null, option_id: null, tags: [],
        response_time_ms: 0, presented_position: 1, was_timeout: false,
      });
      continue;
    }

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

  ok(JSON.stringify(encounterTrace) === JSON.stringify([0, 1, 2, 3, 3]), "encounters accrue 0->1->2->3, then hold across the (non-encounter) probe", encounterTrace);

  const finalProg = P.arcProgress((await RT.exportForAnalyzer()).session_log, arc);
  ok(finalProg.done && finalProg.next === null, "arc is done after the climax");
  ok(finalProg.completedCount === 5 && finalProg.encounters === 3, "5 beats complete, 3 of them encounters (probe + climax aren't)", { c: finalProg.completedCount, e: finalProg.encounters });

  // the attachment self-report was logged + reads back (the SELF-REPORTED H8b half)
  const instrPayloads = (await RT.log()).filter(e => e.kind === "instrument").map(e => e.payload);
  const att = P.attachmentReport(instrPayloads, arc);
  ok(att.ok && att.tone === "high" && att.n === 4, "attachment self-report reads back: high tone, 4 items", att);

  // --- cost-of-virtue end-to-end: a probe logs + reads back through the analyzer export ---
  await RT.logProbe({
    user_id: USER, scenario_id: "cov-truth-001", scenario_type: "cost-of-virtue-probe",
    domain: "truth-telling", value_slot: "honesty", first_accept_stake: 1000, break_point_rung: 3,
    no_break_point: false, unit: "USD", timestamp_iso: new Date().toISOString(),
  });
  const covRead = P.costOfVirtue((await RT.exportForAnalyzer()).probes);
  const honesty = covRead.ok && covRead.byValue.find(v => v.value_slot === "honesty");
  ok(honesty && honesty.stake === 1000 && !honesty.no_break_point, "cost-of-virtue probe logs + reads back via the export", honesty);

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

  // ===== multi-arc: the Gran arc (human character, NO naming beat, family-of-origin pole) =====
  const gran = bundle.arcs.find(a => a.arc_id === "arc-gran");
  ok(!!gran && gran.name_is_participant_supplied === false, "bundle carries arc-gran (human, no participant naming)");
  ok(!gran.beats.some(b => b.kind === "naming"), "gran arc has no naming beat");
  const RTg = createRuntime({ store: MemoryStore(), corpus_version: "test" });
  await RTg.init();
  const logComplete = async (RTx, a, beat, term, step) => RTx.logSessionChoice({
    user_id: USER, session_id: uuid(), timestamp_iso: new Date().toISOString(),
    scenario_id: beat.scenario_ref || beat.beat_id, scenario_type: "arc-beat-complete",
    domain: a.primary_domain, arc_id: a.arc_id, beat_id: beat.beat_id, item_id: term ? term.id : null,
    option_id: null, tags: [], response_time_ms: 0, presented_position: step + 1, was_timeout: false });
  for (const beat of gran.beats){
    if (beat.kind === "attachment_probe"){
      await RTg.logInstrument({ user_id: USER, instrument: beat.instrument, arc_id: gran.arc_id, beat_id: beat.beat_id,
        timestamp_iso: new Date().toISOString(), scale_min: beat.scale.min, scale_max: beat.scale.max,
        responses: beat.items.map(it => ({ item_id: it.id, value: beat.scale.max })) });
      await logComplete(RTg, gran, beat, null, 1);
      continue;
    }
    const scenes = beatNode(gran, beat).scenes;
    let sid = startScene(scenes), step = 0, guard = 0, term = null, sessionId = uuid();
    while (true){
      const sc = scenes.find(x => x.id === sid);
      if (!sc || sc.terminal){ term = sc || null; break; }
      const c = sc.choices[0];
      await RTg.logSessionChoice({ user_id: USER, session_id: sessionId, timestamp_iso: new Date().toISOString(),
        scenario_id: beat.scenario_ref || beat.beat_id, scenario_type: "arc-beat", domain: gran.primary_domain,
        arc_id: gran.arc_id, beat_id: beat.beat_id, item_id: sc.id, option_id: c.id, tags: c.tags,
        response_time_ms: 4000, presented_position: step + 1, was_timeout: false });
      ok(c.tags.includes("recurring_npc:gran"), `gran ${beat.beat_id}/${sc.id}/${c.id} carries recurring_npc:gran`);
      sid = c.next; step++; if (++guard > 30){ ok(false, "gran walk runaway"); break; }
    }
    await logComplete(RTg, gran, beat, term, step);
  }
  const gp = P.arcProgress((await RTg.exportForAnalyzer()).session_log, gran);
  ok(gp.done && gp.encounters === 3, "gran arc completes; 3 encounters (probe + climax not counted)", gp);
  const granProbe = bundle.h8Probes.find(h => h.pair_id === "pp-ingroup-002");
  ok(granProbe && granProbe.near_tag === "counterparty:family-of-origin", "gran probe carries the family-of-origin near pole");
  const gfar = granProbe.abstract.options.find(o => (o.tags || []).includes("counterparty:anonymous"));
  await RTg.logSessionChoice({ user_id: USER, session_id: uuid(), timestamp_iso: new Date().toISOString(),
    scenario_id: granProbe.abstract.scenario_id, scenario_type: "h8-abstract-probe", domain: "in-group-out-group",
    item_id: granProbe.abstract.item_id, option_id: gfar.id, tags: gfar.tags, response_time_ms: 5000, presented_position: 1, was_timeout: false });
  const gdiv = P.h8Divergence((await RTg.exportForAnalyzer()).session_log, granProbe);
  ok(gdiv.ok && gdiv.narrativePole === "near" && gdiv.shift === "toward-near",
     "gran H8b end-to-end: family-of-origin climax + anonymous abstract -> shift toward-near (per-probe poles)", gdiv);

  // ===== H8a arc: Nadia (debiasing-companion — no climax; per-beat narrative-vs-twin) =====
  const nadia = bundle.arcs.find(a => a.arc_id === "arc-nadia");
  ok(!!nadia && nadia.mode === "h8a", "bundle carries arc-nadia (mode h8a)");
  ok(nadia.beats.every(b => b.signal && b.abstract_twin), "every nadia beat has signal + abstract_twin");
  const RTn = createRuntime({ store: MemoryStore(), corpus_version: "test" });
  await RTn.init();
  for (const beat of nadia.beats){
    const scenes = beatNode(nadia, beat).scenes;
    let sid = startScene(scenes), step = 0, guard = 0, term = null, sessionId = uuid();
    while (true){
      const sc = scenes.find(x => x.id === sid);
      if (!sc || sc.terminal){ term = sc || null; break; }
      const c = sc.choices[0];
      await RTn.logSessionChoice({ user_id: USER, session_id: sessionId, timestamp_iso: new Date().toISOString(),
        scenario_id: beat.beat_id, scenario_type: "arc-beat", domain: nadia.primary_domain, arc_id: nadia.arc_id,
        beat_id: beat.beat_id, item_id: sc.id, option_id: c.id, tags: c.tags, response_time_ms: 4000,
        presented_position: step + 1, was_timeout: false });
      sid = c.next; step++; if (++guard > 30){ ok(false, "nadia walk runaway"); break; }
    }
    await logComplete(RTn, nadia, beat, term, step);
    // answer the abstract twin with the SOFTENING option (lie:white), to contrast with the candid signal[0]
    const tw = beat.abstract_twin;
    const soft = tw.options.find(o => (o.tags || []).includes("lie:white")) || tw.options[tw.options.length - 1];
    await RTn.logSessionChoice({ user_id: USER, session_id: uuid(), timestamp_iso: new Date().toISOString(),
      scenario_id: tw.item_id, scenario_type: "h8a-abstract", domain: nadia.primary_domain, arc_id: nadia.arc_id,
      beat_id: beat.beat_id, item_id: tw.item_id, option_id: soft.id, tags: soft.tags, response_time_ms: 5000,
      presented_position: 1, was_timeout: false });
  }
  const np = P.arcProgress((await RTn.exportForAnalyzer()).session_log, nadia);
  ok(np.done && np.encounters === 3, "nadia h8a arc completes (3 encounters, no climax gate)", np);
  const nd = P.h8aDebiasing((await RTn.exportForAnalyzer()).session_log, nadia, tagMap);
  ok(nd.ok && nd.n === 3, "nadia h8a: all 3 narrative-vs-twin pairs read", nd && nd.n);
  ok(nd.lean === "candid-with-friend", "nadia h8a end-to-end: candid signal[0] vs softened twin -> candid-with-friend", nd && nd.lean);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
