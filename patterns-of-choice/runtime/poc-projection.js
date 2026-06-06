/* ============================================================================
 * Patterns of Choice — client-side scoring projection (reference-free)
 *
 * Computes, ENTIRELY ON-DEVICE from one person's own event log, the reads that
 * are honestly interpretable for an individual (no cohort needed):
 *   - per-item revealed score        (scoring.md §2.2)
 *   - per-session mean, NA if <3      (scoring.md §3.1, with the §10 inattentive
 *     quick-fire drop: median item RT < 2s)
 *   - per-user-per-domain revealed    (scoring.md §3.2)
 *   - card-sort stated fraction       (scoring.md §5.1)
 *   - §13.1 ipsative domain ordering  (mean-centered, noise-gated, ordinal)
 *   - §13.4 word/deed concordance     (Kendall tau-b on the person's own orders)
 *
 * Deliberately NOT computed here (need a cohort / external lib / RNG seed; see
 * scoring.md §6/§8/§13.5): the sample-standardized gap, bootstrap CIs, the
 * cross-person z-scores, the H-tests. Those stay with the canonical Python
 * analyzer over a consented export. This module is the individual-benefit
 * subset only, and it is honest about that.
 *
 * Pure, dependency-free, browser + Node. The tag-axis map is the JSON generated
 * from analysis/tag_axis_map_v0.1.csv (the canonical source).
 * ============================================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.POCProjection = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DOMAINS = ["truth-telling", "resource-allocation", "in-group-out-group", "reciprocity-cooperation"];
  const MIN_ITEMS_PER_SESSION = 3;       // §3.1
  const INATTENTIVE_RT_MS = 2000;        // §10: quick-fire median RT < 2s -> drop session
  const NOISE_K = 1;                     // §13.1 noise-gate multiplier
  const MIN_SESSIONS_FOR_ORDER = 2;      // need >=2 sessions/domain for an SE
  const MIN_DOMAINS_FOR_ORDER = 3;       // §13.1
  const MIN_DOMAINS_FOR_CONCORDANCE = 3; // §13.4

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
  function median(a) {
    if (!a.length) return NaN;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function sd(a) {
    if (a.length < 2) return NaN;
    const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
  }
  function se(a) { const s = sd(a); return isNaN(s) ? NaN : s / Math.sqrt(a.length); }

  // --- per-item revealed score on the domain's PRIMARY axis (§2.2) ---
  // tagMap: { primary_axis: {domain:axis}, scoring: {"domain\ttag":{axis,contribution}} }
  function itemScore(domain, tags, tagMap) {
    const primary = tagMap.primary_axis[domain];
    let total = 0, n = 0;
    for (const t of tags || []) {
      const hit = tagMap.scoring[domain + "\t" + t];
      if (hit && hit.axis === primary) { total += hit.contribution; n += 1; }
    }
    return { score: clamp(total, -1, 1), n }; // n===0 -> NA (exclude)
  }

  // --- revealed scores per domain, from session_log events (§3.1, §3.2, §10) ---
  // sessionLog: array of SessionLogEntry payloads (from runtime.exportForAnalyzer().session_log)
  function revealedScores(sessionLog, tagMap) {
    // group items by (session_id, domain)
    const bySession = {};
    for (const e of sessionLog) {
      const { score, n } = itemScore(e.domain, e.tags, tagMap);
      const key = e.session_id + "\t" + e.domain;
      (bySession[key] || (bySession[key] = { scores: [], rts: [], domain: e.domain })) ;
      if (n > 0) { bySession[key].scores.push(score); bySession[key].rts.push(e.response_time_ms); }
    }
    // per-session mean, applying NA rules
    const sessionMeans = {}; // domain -> [session means]
    for (const key in bySession) {
      const g = bySession[key];
      if (g.scores.length < MIN_ITEMS_PER_SESSION) continue;          // §3.1 NA
      if (median(g.rts) < INATTENTIVE_RT_MS) continue;                // §10 inattentive drop
      (sessionMeans[g.domain] || (sessionMeans[g.domain] = [])).push(mean(g.scores));
    }
    // per-domain user score
    const out = {};
    for (const d of DOMAINS) {
      const ms = sessionMeans[d];
      if (!ms || !ms.length) continue;
      out[d] = { domain: d, revealed_score_mean: mean(ms), n_sessions_contributing: ms.length,
                 se: ms.length >= MIN_SESSIONS_FOR_ORDER ? se(ms) : null };
    }
    return out; // { domain: {revealed_score_mean, n_sessions_contributing, se} }
  }

  // --- card-sort stated fraction per domain×layer (§5.1) ---
  // cardSort: array of CardSortResponse; valuesByDomain: {domain:[value_id,...]}
  function cardSortStated(cardSort, valuesByDomain, layer) {
    const forLayer = cardSort.filter(r => r.layer === layer);
    if (!forLayer.length) return {}; // the stated channel doesn't exist yet — NOT all-zeros
    const sel = new Set(forLayer.filter(r => r.selected).map(r => r.value_id));
    const out = {};
    for (const d of DOMAINS) {
      const vals = valuesByDomain[d] || [];
      if (!vals.length) continue;
      out[d] = vals.filter(v => sel.has(v)).length / vals.length;
    }
    return out; // {domain: frac_in_top5}
  }

  // --- §13.1 ipsative ordering (mean-centered, ordinal, noise-gated) ---
  function ipsativeOrdering(revealed) {
    const inf = Object.values(revealed).filter(r => r.se !== null && r.n_sessions_contributing >= MIN_SESSIONS_FOR_ORDER);
    if (inf.length < MIN_DOMAINS_FOR_ORDER) return { ok: false, reason: "needs at least three areas with enough sessions" };
    const mbar = mean(inf.map(r => r.revealed_score_mean));
    const devs = inf.map(r => ({ domain: r.domain, dev: r.revealed_score_mean - mbar, m: r.revealed_score_mean, se: r.se }));
    const spread = Math.max(...devs.map(d => d.dev)) - Math.min(...devs.map(d => d.dev));
    const pooledSE = Math.sqrt(mean(devs.map(d => d.se * d.se)));
    if (spread < pooledSE) return { ok: true, level: true, domains: devs.map(d => d.domain) };
    devs.sort((a, b) => b.dev - a.dev);
    const rels = [];
    for (let i = 0; i < devs.length - 1; i++) {
      const a = devs[i], b = devs[i + 1];
      const gate = NOISE_K * Math.sqrt(a.se * a.se + b.se * b.se);
      rels.push({ a: a.domain, b: b.domain, tie: Math.abs(a.m - b.m) <= gate });
    }
    return { ok: true, level: false, order: devs.map(d => d.domain), rels };
  }

  // --- §13.4 word/deed concordance (Kendall tau-b on the person's own orders) ---
  function wordDeedConcordance(revealed, statedByDomain) {
    const C = DOMAINS
      .filter(d => revealed[d] && revealed[d].se !== null && d in statedByDomain)
      .map(d => ({ domain: d, said: statedByDomain[d], did: revealed[d].revealed_score_mean, se: revealed[d].se }));
    if (C.length < MIN_DOMAINS_FOR_CONCORDANCE) return { ok: false, reason: "needs at least three areas with both a stated and a revealed reading" };
    let nc = 0, nd = 0, ts = 0, tr = 0; const flips = [];
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
      const ds = C[i].said - C[j].said, dr = C[i].did - C[j].did;
      if (ds === 0 && dr === 0) { ts++; tr++; continue; }
      if (ds === 0) { ts++; continue; }
      if (dr === 0) { tr++; continue; }
      if (Math.sign(ds) === Math.sign(dr)) nc++;
      else {
        nd++;
        flips.push({ a: C[i].domain, b: C[j].domain, fragile: Math.abs(dr) < 0.12,
          said_lower: ds < 0 ? C[i].domain : C[j].domain,
          did_higher: dr > 0 ? C[i].domain : C[j].domain });
      }
    }
    const denom = Math.sqrt((nc + nd + ts) * (nc + nd + tr));
    const tau = denom > 0 ? (nc - nd) / denom : 0;
    const band = tau >= 0.6 ? "low" : (tau >= 0.2 ? "moderate" : "high");
    return { ok: true, band, tau, nc, nd, flips, n: C.length };
  }

  // --- recurring-character arc progress (the H8 attachment-accrual substrate) ---
  // Pure projection over the event log: which beats are done, how much attachment
  // has accrued (completed naming/encounter beats), and the next *playable* beat
  // given each beat's min_prior_encounters gate. A beat counts as completed only
  // when its "arc-beat-complete" marker is in the log (reaching a terminal scene),
  // so a half-played beat doesn't unlock the gated climax.
  //   sessionLog: SessionLogEntry payloads; arc: a content-bundle arc entry.
  const ARC_ENCOUNTER_KINDS = new Set(["naming", "encounter"]);
  function arcProgress(sessionLog, arc) {
    const completed = new Set();
    for (const e of sessionLog || []) {
      if (e && e.scenario_type === "arc-beat-complete" && e.arc_id === arc.arc_id && e.beat_id)
        completed.add(e.beat_id);
    }
    const beats = (arc.beats || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    let encounters = 0;
    for (const b of beats) if (ARC_ENCOUNTER_KINDS.has(b.kind) && completed.has(b.beat_id)) encounters++;
    let next = null, locked = false, needed = 0;
    for (const b of beats) {
      if (completed.has(b.beat_id)) continue;
      next = b;
      const gate = b.min_prior_encounters || 0;
      if (gate > encounters) { locked = true; needed = gate; }
      break;
    }
    return {
      arc_id: arc.arc_id,
      completed: [...completed],
      completedCount: completed.size,
      totalBeats: beats.length,
      encounters,
      next,                 // next beat object, or null when the arc is done
      locked,               // next beat exists but is gated behind more encounters
      needed,               // encounters required to unlock `next`
      done: next === null && beats.length > 0,
    };
  }

  // --- cost-of-virtue: the break-point on a stated value, and its trajectory ---
  // probeEvents: kind "probe" payloads. Per value, the latest break-point (the
  // smallest stake at which the person would set the value aside; null = wouldn't
  // at any stake in range = "ceiling above probe range") and, across repeated
  // administrations, the within-person trajectory — the primary longitudinal
  // signal per concept.md. A concrete revealed price, not an inferential statistic.
  function costOfVirtue(probeEvents) {
    const cov = (probeEvents || []).filter(e => e && e.scenario_type === "cost-of-virtue-probe" && e.value_slot);
    if (!cov.length) return { ok: false };
    const byValue = {};
    for (const e of cov) (byValue[e.value_slot] || (byValue[e.value_slot] = [])).push(e);
    const out = [];
    for (const slot in byValue) {
      const seq = byValue[slot].slice().sort((a, b) => (a.timestamp_iso < b.timestamp_iso ? -1 : 1));
      const latest = seq[seq.length - 1];
      const val = e => (e.no_break_point ? Infinity : e.first_accept_stake);
      let trend = null;
      if (seq.length >= 2) {
        const f = val(seq[0]), l = val(latest);
        trend = l < f ? "down" : (l > f ? "up" : "flat");   // down = cheaper to set aside now
      }
      out.push({
        value_slot: slot,
        stake: latest.no_break_point ? null : latest.first_accept_stake,
        no_break_point: !!latest.no_break_point,
        unit: latest.unit || "USD",
        n: seq.length,
        trend,
      });
    }
    out.sort((a, b) => a.value_slot < b.value_slot ? -1 : 1);
    return { ok: true, byValue: out };
  }

  // --- self-alignment across the three stated reference-selves (self-discrepancy) ---
  // Given the revealed order and a card sort done in multiple layers (who you ARE /
  // who you ASPIRE to be / who you ADMIRE), report which stated self the person's
  // actual choices track most closely. Reuses the per-layer word/deed concordance;
  // descriptive, single-subject (the comparison is among the person's own selves).
  function selfAlignment(revealed, cardSort, valuesByDomain, layers) {
    const out = [];
    for (const layer of layers || []) {
      const stated = cardSortStated(cardSort, valuesByDomain, layer);
      if (!Object.keys(stated).length) continue;
      const con = wordDeedConcordance(revealed, stated);
      if (con.ok) out.push({ layer, tau: con.tau, band: con.band });
    }
    if (!out.length) return { ok: false };
    out.sort((a, b) => b.tau - a.tau);           // highest tau = best aligned
    return { ok: true, byLayer: out, closest: out[0].layer, n: out.length };
  }

  // --- attachment self-report (the SELF-REPORTED half of the H8b convergent measure) ---
  // instrumentEvents: payloads of kind "instrument" (the app reads these straight from
  // the raw log; they are intentionally outside the analyzer export contract). A single
  // person's own mean over a short single-construct self-report is directly
  // interpretable — like the card-sort fraction — so this is descriptive, not an
  // inferential statistic needing a reference distribution.
  function attachmentReport(instrumentEvents, arc) {
    const arcId = arc && arc.arc_id;
    const rs = (instrumentEvents || []).filter(e => e && e.arc_id === arcId && /psr/i.test(e.instrument || ""));
    if (!rs.length) return { ok: false };
    const latest = rs[rs.length - 1];                 // most recent administration wins
    const vals = (latest.responses || []).map(r => r.value).filter(v => typeof v === "number");
    if (!vals.length) return { ok: false };
    const m = mean(vals);
    const lo = latest.scale_min != null ? latest.scale_min : 1;
    const hi = latest.scale_max != null ? latest.scale_max : 5;
    const mid = (lo + hi) / 2;
    const tone = m >= mid + (hi - mid) * 0.5 ? "high" : (m <= lo + (mid - lo) * 0.5 ? "low" : "mixed");
    return { ok: true, mean: m, n: vals.length, scaleMin: lo, scaleMax: hi, tone };
  }

  // --- H8b: abstract-vs-narrative divergence — the core narrative-immersion read ---
  // Does the participant judge the SAME indivisible trade differently when it is
  // their attached companion (narrative climax) vs. a faceless animal (abstract
  // twin)? Classifies each choice by the counterparty pole its CHOSEN option carries
  // (near = the identified/attached dependent; far = the anonymous many) and reports
  // whether attachment shifted the judgment. Reference-free, descriptive, no verdict.
  // Each H8 pair carries its own near/far pole tags (e.g. counterparty:animal-dependent
  // for the dog, counterparty:family-of-origin for the grandmother; far is anonymous).
  // The probe supplies near_tag/far_tag; we fall back to the animal pair for safety.
  const H8_NEAR_TAG = "counterparty:animal-dependent";
  const H8_FAR_TAG = "counterparty:anonymous";
  function h8PoleOf(tags, nearTag, farTag) {
    const t = tags || [];
    if (t.includes(nearTag)) return "near";
    if (t.includes(farTag)) return "far";
    return null;
  }
  function h8LastChoice(sessionLog, scenarioId, itemId) {
    let hit = null; // most-recent answered entry for this (scenario,item) wins
    for (const e of sessionLog || [])
      if (e && e.scenario_id === scenarioId && e.item_id === itemId && e.option_id != null) hit = e;
    return hit;
  }
  function h8Divergence(sessionLog, probe) {
    if (!probe) return { ok: false, reason: "no probe" };
    const nearTag = probe.near_tag || H8_NEAR_TAG;
    const farTag = probe.far_tag || H8_FAR_TAG;
    const a = h8LastChoice(sessionLog, probe.abstract.scenario_id, probe.abstract.item_id);
    const n = h8LastChoice(sessionLog, probe.narrative.scenario_id, probe.narrative.signal);
    const abstractPole = a ? h8PoleOf(a.tags, nearTag, farTag) : null;
    const narrativePole = n ? h8PoleOf(n.tags, nearTag, farTag) : null;
    if (!abstractPole || !narrativePole)
      return { ok: false, hasAbstract: !!abstractPole, hasNarrative: !!narrativePole, pair_id: probe.pair_id };
    const concordant = abstractPole === narrativePole;
    const shift = concordant ? "none"
      : (abstractPole === "far" && narrativePole === "near") ? "toward-near" : "toward-far";
    return { ok: true, pair_id: probe.pair_id, abstractPole, narrativePole, concordant, shift };
  }

  // --- H8a debiasing: narrative-about-the-figure vs the abstract twin, per beat ---
  // For each H8a beat: the participant's SIGNAL choice (made about the known figure)
  // vs their answer to the abstract TWIN (the same value choice posed generically),
  // each scored on the arc's value axis via itemScore. The gap is the debiasing
  // signal — typically a tidier/more-virtuous abstract answer vs a more candid one
  // about the friend (the social-desirability pull the design predicts), or vice
  // versa. Descriptive, per-pair, NO aggregate score.
  function h8aLast(sessionLog, pred) {
    let hit = null;
    for (const e of sessionLog || []) if (e && e.option_id != null && pred(e)) hit = e;
    return hit;
  }
  // score a choice for the H8a read: normally on the domain's value axis (itemScore),
  // but an "inclusion" arc (e.g. marisol — widen vs hold the circle, which lives on
  // universalism/particularism, NOT the loyalty axis) scores its circle-widened/held poles.
  function h8aScore(arc, tags, tagMap) {
    if (arc && arc.scoring === "inclusion") {
      const t = tags || [];
      if (t.includes("resolution:circle-widened")) return 1;
      if (t.includes("resolution:circle-held")) return -1;
      return 0;
    }
    return itemScore(arc.primary_domain, tags, tagMap).score;
  }
  function h8aDebiasing(sessionLog, arc, tagMap) {
    if (!arc || arc.mode !== "h8a") return { ok: false };
    const pairs = [];
    for (const beat of arc.beats || []) {
      if (!beat.signal || !beat.abstract_twin) continue;
      const narr = h8aLast(sessionLog, e => e.scenario_type === "arc-beat" && e.arc_id === arc.arc_id && e.beat_id === beat.beat_id && e.item_id === beat.signal);
      const abs = h8aLast(sessionLog, e => e.scenario_type === "h8a-abstract" && e.arc_id === arc.arc_id && e.beat_id === beat.beat_id);
      if (!narr || !abs) continue;
      const nS = h8aScore(arc, narr.tags, tagMap);
      const aS = h8aScore(arc, abs.tags, tagMap);
      const shift = nS - aS;
      pairs.push({
        beat_id: beat.beat_id, narrative: nS, abstract: aS, shift,
        direction: Math.abs(shift) < 1e-9 ? "same" : (shift > 0 ? "more-candid-with-friend" : "more-candid-in-abstract"),
      });
    }
    // evolves arcs (e.g. cole): the trajectory of the narrative choice across the
    // ordered beats — does trust/candor return as the relationship's history accrues?
    let trajectory = null;
    if (arc.evolves) {
      const seq = [];
      for (const beat of arc.beats || []) {
        if (!beat.signal) continue;
        const narr = h8aLast(sessionLog, e => e.scenario_type === "arc-beat" && e.arc_id === arc.arc_id && e.beat_id === beat.beat_id && e.item_id === beat.signal);
        if (narr) seq.push(h8aScore(arc, narr.tags, tagMap));
      }
      if (seq.length >= 2) {
        const d = seq[seq.length - 1] - seq[0];
        trajectory = { scores: seq, direction: d > 0.15 ? "rising" : (d < -0.15 ? "falling" : "flat") };
      }
    }
    if (!pairs.length && !trajectory) return { ok: false, pairs: [] };
    const shifts = pairs.filter(p => p.direction !== "same");
    const perf = shifts.filter(p => p.direction === "more-candid-in-abstract").length;
    const candid = shifts.filter(p => p.direction === "more-candid-with-friend").length;
    const lean = !shifts.length ? "consistent"
      : (perf > candid ? "performed-in-abstract" : (candid > perf ? "candid-with-friend" : "mixed"));
    return { ok: true, kind: arc.scoring === "inclusion" ? "inclusion" : "candor", pairs, n: pairs.length, nShifts: shifts.length, lean, trajectory };
  }

  // --- top-level: full individual profile from an analyzer-export bundle ---
  // bundle: runtime.exportForAnalyzer() output; valuesByDomain from values-deck
  function profile(bundle, tagMap, valuesByDomain, layer) {
    layer = layer || "aspirational_self";
    const revealed = revealedScores(bundle.session_log || [], tagMap);
    const stated = cardSortStated(bundle.card_sort || [], valuesByDomain, layer);
    return {
      revealed,
      stated,
      ordering: ipsativeOrdering(revealed),
      concordance: wordDeedConcordance(revealed, stated),
    };
  }

  return { profile, revealedScores, cardSortStated, ipsativeOrdering, wordDeedConcordance, itemScore,
           arcProgress, h8Divergence, attachmentReport, selfAlignment, costOfVirtue, h8aDebiasing,
           DOMAINS, _constants: { MIN_ITEMS_PER_SESSION, INATTENTIVE_RT_MS, NOISE_K } };
});
