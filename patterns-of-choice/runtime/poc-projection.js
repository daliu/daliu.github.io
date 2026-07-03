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
  const SE_FLOOR = 0.07;                 // §13.1: floor on within-person SE (added in
                                         //   quadrature) so n=2 identical-answer sessions
                                         //   (se=0) can't fake a confident ordering
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
    // Floor each within-person SE in quadrature so an implausibly small se (e.g. n=2
    // identical-answer sessions -> se=0) can't collapse the gate and manufacture a
    // confident ordering from a trivial mean difference (§13.1).
    const devs = inf.map(r => ({ domain: r.domain, dev: r.revealed_score_mean - mbar, m: r.revealed_score_mean, se: Math.sqrt(r.se * r.se + SE_FLOOR * SE_FLOOR) }));
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
      const seq = byValue[slot].slice().sort((a, b) => a.timestamp_iso < b.timestamp_iso ? -1 : a.timestamp_iso > b.timestamp_iso ? 1 : 0);
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
    out.sort((a, b) => a.value_slot < b.value_slot ? -1 : a.value_slot > b.value_slot ? 1 : 0);
    return { ok: true, byValue: out };
  }

  // --- moral-identity centrality: the two facets, the N=1 reveal (§19.1, R1) ---
  // One person's internalization (private, self-defining) and symbolization (public,
  // expressed) facet means, each a within-person mean of its OWN 1–7 Likert items.
  // Reported SEPARATELY and NEVER pooled into one "moral-identity score" (§13.5, the
  // load-bearing discipline here): a facet with fewer than MIN_CENTRALITY_ITEMS
  // scorable items is SUPPRESSED (null), never scored on thin data (§1.5); a declined
  // item (non-numeric / boolean response) is DROPPED, never imputed 0 (§1.5). Value-
  // neutral — a high internalization mean is integrity OR rigid self-righteousness,
  // described never ranked, and internalizing is not "better" than symbolizing (Aquino
  // & Reed 2002). Mirrors the analyzer's centrality_facet_by_user; JS↔Python parity-
  // locked in scripts/check_impl_parity.py. Like attachmentReport, the records are read
  // straight from the raw instrument log (outside the analyzer export contract).
  const MIN_CENTRALITY_ITEMS = 3;                        // §1.5 floor (== analyzer R1_MIN_ITEMS)
  const CENTRALITY_FACETS = ["internalization", "symbolization"];
  function centralityResponse(r) {
    const v = r && r.response;
    return typeof v === "number" ? v : null;             // typeof excludes booleans -> matches the analyzer
  }
  function facetMean(records, facet) {
    const vals = [];
    for (const r of records || []) {
      if (!r || r.facet !== facet) continue;
      const v = centralityResponse(r);
      if (v !== null) vals.push(v);
    }
    return { facet, mean: vals.length >= MIN_CENTRALITY_ITEMS ? mean(vals) : null, n: vals.length };
  }
  function centralityFacets(records) {
    // the two facets exposed SEPARATELY — never averaged into one centrality scalar (§13.5)
    const out = {};
    for (const f of CENTRALITY_FACETS) {
      const fm = facetMean(records, f);
      out[f] = fm.mean;                                  // null <=> below the >=3-item floor (suppressed)
      out["n_" + f] = fm.n;
    }
    out.ok = out.internalization !== null || out.symbolization !== null;
    return out;
  }

  // --- metaethical objectivism: the two claim-type reads, the N=1 reveal (§20.1, R6) ---
  // One person's moral-claim and taste-claim objectivism reads, each a within-person
  // mean of its OWN 1–7 objectivism Likert items (1 = purely opinion/preference … 7 =
  // objective fact, true independent of anyone's view). Reported SEPARATELY and NEVER
  // pooled into one "conviction score" (§13.5, the load-bearing discipline here) — and
  // the STATED probe is never fused with the deferred REVEALED tolerance/language
  // signatures either. A claim type with fewer than MIN_OBJECTIVISM_ITEMS scorable items
  // is SUPPRESSED (null), never scored on thin data (§1.5); a declined item (non-numeric
  // / boolean) is DROPPED, never imputed 0 (§1.5). Value-neutral with EXTRA force — the
  // branch is charged: treating morals as objective fact is moral clarity OR rigid
  // intolerance, subjectivism is tolerant pluralism OR standing for nothing; each pole
  // DESCRIBED, never ranked, and the two reads are shown side by side without implying
  // one should exceed the other at the individual level (that gradient is the cohort-only
  // R6d, never an N=1 verdict; Goodwin & Darley 2008). Mirrors the analyzer's
  // objectivism_by_user; JS↔Python parity-locked in scripts/check_impl_parity.py.
  const MIN_OBJECTIVISM_ITEMS = 3;                       // §1.5 floor (== analyzer R6_MIN_ITEMS)
  const OBJECTIVISM_CLAIM_TYPES = ["moral", "taste"];
  function objectivismResponse(r) {
    const v = r && r.objectivism;
    return typeof v === "number" ? v : null;             // typeof excludes booleans -> matches the analyzer
  }
  function claimTypeMean(records, claimType) {
    const vals = [];
    for (const r of records || []) {
      if (!r || r.claim_type !== claimType) continue;
      const v = objectivismResponse(r);
      if (v !== null) vals.push(v);
    }
    return { claim_type: claimType, mean: vals.length >= MIN_OBJECTIVISM_ITEMS ? mean(vals) : null, n: vals.length };
  }
  function objectivismReads(records) {
    // the two claim-type reads exposed SEPARATELY — never averaged into one objectivism scalar (§13.5)
    const out = {};
    for (const c of OBJECTIVISM_CLAIM_TYPES) {
      const cm = claimTypeMean(records, c);
      out[c] = cm.mean;                                  // null <=> below the >=3-item floor (suppressed)
      out["n_" + c] = cm.n;
    }
    out.ok = out.moral !== null || out.taste !== null;
    return out;
  }

  // --- moral hypocrisy: the self–other severity asymmetry, the N=1 reveal (§18.1, H12) ---
  // One person's paired within-person contrast on a common 0–10 severity scale: the SAME
  // act rated as one's own (severity_self) and as another's (severity_other), and
  // H_i = mean(severity_other − severity_self) over their matched pairs. SIGNED and
  // value-neutral: positive = harsher on others (the self-serving direction), negative =
  // harsher on self — BOTH directions described, never ranked (a self-critical person is
  // not "more honest", a self-serving one not "more confident"); the cohort "holier than
  // thou" tilt is the cohort-only H12c anchor, never an N=1 verdict (Tappin & McKay 2017;
  // Epley & Dunning 2000). A declined judgment — either side missing / non-numeric /
  // boolean — DROPS the pair, never imputed 0 (the §18.1 pairing lock, the H12 analog of
  // the §13.2 censoring lock), and the sign is preserved (harsher-on-self stays negative,
  // never clamped). Fewer than MIN_HYPOCRISY_PAIRS scorable pairs → SUPPRESSED (null),
  // never scored on thin data (§1.5). Never summed into any composite (§13.5). Judgments
  // of hypothetical acts — a STATED asymmetry; the reveal never claims the person would
  // act on it (§18.4). Mirrors the analyzer's hypocrisy_asymmetry_by_user; JS↔Python
  // parity-locked in scripts/check_impl_parity.py.
  const MIN_HYPOCRISY_PAIRS = 3;                         // §1.5 floor (== analyzer H12_MIN_PAIRS)
  function hypocrisyPairDelta(r) {
    const s = r && r.severity_self;
    const o = r && r.severity_other;
    if (typeof s !== "number" || typeof o !== "number") return null; // declined -> pair DROPPED (typeof excludes booleans -> matches _hypocrisy_pair_delta)
    return o - s;                                        // SIGNED: harsher-on-self stays negative
  }
  function hypocrisyAsymmetry(records) {
    const deltas = [];
    for (const r of records || []) {
      const d = hypocrisyPairDelta(r);
      if (d !== null) deltas.push(d);
    }
    const h = deltas.length >= MIN_HYPOCRISY_PAIRS ? mean(deltas) : null; // null <=> below the >=3-pair floor
    return { h: h, n_pairs: deltas.length, ok: h !== null };
  }

  // --- cross-situational consistency: per-construct sd_i(c) + V, the N=1 reveal (§15.5, H10) ---
  // Per construct (domain), the sample SD of that construct's context means; V is the
  // §15.1 within-branch mean of this branch's own sd facets, reported ALONGSIDE them —
  // never a cross-branch composite (§13.5). Low sd reads "steadiness", high reads
  // "responsiveness to context" (Dancy's particularism caveat): both DESCRIBED, never
  // ranked. §1.5 floors: a context enters with ≥2 items, a construct with ≥3 qualifying
  // contexts, V with ≥3 qualifying constructs — below a floor the value is SUPPRESSED
  // (construct absent / V null; the surviving facets still reveal alone). Consumes the
  // runtime's ALREADY-SCORED items {domain, context, score} — no declined-guard, exactly
  // like the analyzer's context_sd_by_user_construct / context_profile_by_user, which
  // this mirrors under the JS↔Python parity lock in scripts/check_impl_parity.py.
  const MIN_ITEMS_PER_CONTEXT = 2;                       // §1.5 floor (== analyzer H10_ITEMS_PER_CONTEXT_MIN)
  const MIN_CONTEXTS = 3;                                // §1.5 floor (== analyzer H10_CONTEXT_MIN)
  const MIN_CONSTRUCTS = 3;                              // §1.5 floor (== analyzer H10_CONSTRUCT_MIN)
  function sampleSD(xs) {
    if (xs.length < 2) return null;                      // matches _sample_sd's NaN guard (never reached above the floors)
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
  }
  function contextVariability(records) {
    const cells = new Map();                             // domain -> context -> scores
    for (const r of records || []) {
      if (!cells.has(r.domain)) cells.set(r.domain, new Map());
      const byCtx = cells.get(r.domain);
      if (!byCtx.has(r.context)) byCtx.set(r.context, []);
      byCtx.get(r.context).push(r.score);
    }
    const constructs = [];
    for (const domain of Array.from(cells.keys()).sort()) {
      const means = [];
      for (const scores of cells.get(domain).values()) {
        if (scores.length >= MIN_ITEMS_PER_CONTEXT) means.push(mean(scores));
      }
      if (means.length >= MIN_CONTEXTS) {
        constructs.push({ domain: domain, sd: sampleSD(means), n_contexts: means.length });
      }
    }
    const v = constructs.length >= MIN_CONSTRUCTS ? mean(constructs.map(c => c.sd)) : null; // null <=> below the >=3-construct floor
    return { constructs: constructs, v: v, n_constructs: constructs.length, ok: constructs.length > 0 };
  }

  // --- moral-circle shape: β_i slope + right-censored radius R_i, the N=1 reveal (§16.5, H11) ---
  // Concern per social-distance bin (mean of ≥2 circle_radius-axis item scores; a user
  // forms a shape only with ≥4 populated ordered bins, else SUPPRESSED — §1.5). β_i is
  // the OLS slope of concern on bin index (steepness); R_i is the first bin ascending
  // where concern crosses the midpoint between near-bin concern and the axis floor.
  // When concern NEVER crosses, the radius is RIGHT-CENSORED: radius stays null,
  // censored true — never made finite (§13.2). Reach and steepness DESCRIBE the shape;
  // a wider circle is never scored as better (Singer's impartialism and Williams/
  // MacIntyre's partialism are both readings, §16.5). β_i and R_i are separate facets,
  // never pooled into a circle score (§13.5). Consumes the runtime's ALREADY-SCORED
  // circle items {bin, score} — no declined-guard, exactly like the analyzer's
  // circle_shape_by_user, which this mirrors under the JS↔Python parity lock in
  // scripts/check_impl_parity.py.
  const MIN_ITEMS_PER_BIN = 2;                           // §1.5 floor (== analyzer H11_ITEMS_PER_BIN_MIN)
  const MIN_BINS = 4;                                    // §1.5 floor (== analyzer H11_BINS_MIN)
  const CIRCLE_AXIS_FLOOR = -1.0;                        // boundaries pole of the circle_radius axis (== analyzer H11_AXIS_FLOOR)
  function olsSlope(xs, ys) {
    if (xs.length < 2) return null;                      // matches _ols_slope's NaN guards (never reached above the ≥4-bin floor:
    const mx = mean(xs), my = mean(ys);                  // ≥4 distinct integer bins always give positive x-spread)
    let num = 0, denom = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      denom += (xs[i] - mx) * (xs[i] - mx);
    }
    return denom === 0 ? null : num / denom;
  }
  function circleShape(records) {
    const cells = new Map();                             // bin -> scores
    for (const r of records || []) {
      if (!cells.has(r.bin)) cells.set(r.bin, []);
      cells.get(r.bin).push(r.score);
    }
    const concern = new Map();
    for (const [b, scores] of cells) {
      if (scores.length >= MIN_ITEMS_PER_BIN) concern.set(b, mean(scores));
    }
    if (concern.size < MIN_BINS) {
      return { beta: null, radius: null, censored: null, n_bins: concern.size, ok: false }; // suppressed (§1.5)
    }
    const bins = Array.from(concern.keys()).sort((a, b) => a - b);
    const beta = olsSlope(bins, bins.map(b => concern.get(b)));
    const nearBin = bins[0], farBin = bins[bins.length - 1];
    const nearC = concern.get(nearBin), farC = concern.get(farBin);
    const midpoint = (nearC + CIRCLE_AXIS_FLOOR) / 2;
    let radius = null, censored = true;
    for (const b of bins) {
      if (concern.get(b) <= midpoint) { radius = b; censored = false; break; }
    }
    return { beta: beta, radius: radius, censored: censored, n_bins: concern.size, midpoint: midpoint,
             near_bin: nearBin, far_bin: farBin, near_concern: nearC, far_concern: farC, ok: true };
  }

  // --- professed protected values: the set P_i of `never` slots, the N=1 reveal (§17.5, R2) ---
  // A pure re-read of the cost-of-virtue channel: the value slots whose response is a
  // right-censored `never` (no_break_point true, or first_accept_rung "never" — the SAME
  // predicate the break-point scorer censors on, pole-agnostic) ARE the professed
  // protected set. Membership is CATEGORICAL — the set holds value-slot strings, never
  // prices; a `never` is never finitized (§13.2). First-wave read: with multi-wave
  // records the earliest wave wins, mirroring the analyzer census. An EMPTY set is
  // DATA (every probed value has a price at some stake), not suppression — nothing is
  // estimated here, so no §1.5 floor applies; ok:false only when no probed wave exists.
  // PROFESSED (cheap-talk caveat, §17.5): a hypothetical `never` is costless, so the
  // reveal never claims the value would survive a real offer. A large set is NEVER
  // scored as better — many `never`s read integrity OR rigid dogmatism; the set is
  // named, never ranked, never summed into a sacredness score (§13.5). Consumes flat
  // CoV responses {wave, value_slot, no_break_point, first_accept_rung} — exactly like
  // the analyzer's protected_profile_by_user, which this mirrors under the JS↔Python
  // parity lock in scripts/check_impl_parity.py.
  function isProtectedResponse(r) {                      // == analyzer _cov_response_is_protected
    return r.no_break_point === true || r.first_accept_rung === "never";
  }
  function protectedValues(records) {
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);  // mirrors Python sorted() for strings
    const waves = new Set();
    const professedByWave = new Map(), probedByWave = new Map();
    for (const r of records || []) {
      const w = r.wave === undefined || r.wave === null ? null : r.wave;
      if (w === null) continue;                          // no wave key -> dropped, like wave_of -> None
      waves.add(w);
      if (!professedByWave.has(w)) { professedByWave.set(w, new Set()); probedByWave.set(w, new Set()); }
      if (r.value_slot) {
        probedByWave.get(w).add(r.value_slot);
        if (isProtectedResponse(r)) professedByWave.get(w).add(r.value_slot);
      }
    }
    if (!waves.size) {
      return { professed: null, n_professed: 0, n_slots_probed: 0, wave: null, ok: false }; // never probed
    }
    const wave = Array.from(waves).sort(cmp)[0];         // FIRST wave, like the analyzer census
    const professed = Array.from(professedByWave.get(wave)).sort(cmp);
    return { professed: professed, n_professed: professed.length,
             n_slots_probed: probedByWave.get(wave).size, wave: wave, ok: true };
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
    // Iterate beats in logical order (matches arcProgress), not array order.
    const beats = (arc.beats || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const pairs = [];
    for (const beat of beats) {
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
      for (const beat of beats) {
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

  // --- within-dimension composition: the spread of a person's primary-axis
  // choices toward each pole, underneath the revealed mean (§2.2). Descriptive
  // counts by valence band — "what your choices were made of", NOT a score. ---
  function dimensionTexture(sessionLog, tagMap) {
    const primaryAxis = tagMap.primary_axis, scoring = tagMap.scoring;
    const bandOf = c => c >= 0.7 ? "strongFor" : c > 0 ? "mildFor" : c <= -0.7 ? "strongAgainst" : "mildAgainst";
    const out = {};
    for (const e of sessionLog || []) {
      const d = e.domain, primary = primaryAxis[d];
      if (!primary) continue;
      for (const t of e.tags || []) {
        const hit = scoring[d + "\t" + t];
        if (!hit || hit.axis !== primary || !hit.contribution) continue; // primary-axis, non-neutral only
        const o = out[d] || (out[d] = { domain: d, total: 0, strongFor: 0, mildFor: 0, mildAgainst: 0, strongAgainst: 0 });
        o[bandOf(hit.contribution)] += 1;
        o.total += 1;
      }
    }
    return out; // { domain: { total, strongFor, mildFor, mildAgainst, strongAgainst } }
  }

  // --- within-dimension over time: the per-session revealed means (the exact
  // values revealedScores() averages, gated identically by §3.1 min-items and §10
  // inattentive-RT), exposed as a chronological series. This is a PRESENTATION of
  // existing points, NOT a new aggregation — a domain's series averages back to its
  // revealed_score_mean. Ordered by first appearance in the (time-sorted) log. ---
  function dimensionTrajectory(sessionLog, tagMap) {
    const bySession = {};                 // "session_id\tdomain" -> { scores, rts }
    const sessionOrder = [], seen = new Set();
    for (const e of sessionLog || []) {
      if (!seen.has(e.session_id)) { seen.add(e.session_id); sessionOrder.push(e.session_id); }
      const { score, n } = itemScore(e.domain, e.tags, tagMap);
      const g = bySession[e.session_id + "\t" + e.domain] || (bySession[e.session_id + "\t" + e.domain] = { scores: [], rts: [] });
      if (n > 0) { g.scores.push(score); g.rts.push(e.response_time_ms); }
    }
    const qualified = {};                  // "session_id\tdomain" -> per-session mean
    for (const key in bySession) {
      const g = bySession[key];
      if (g.scores.length < MIN_ITEMS_PER_SESSION) continue;   // §3.1 NA
      if (median(g.rts) < INATTENTIVE_RT_MS) continue;         // §10 inattentive drop
      qualified[key] = mean(g.scores);
    }
    const out = {};
    for (const d of DOMAINS) {
      const series = [];
      for (const sid of sessionOrder) { const k = sid + "\t" + d; if (k in qualified) series.push(qualified[k]); }
      if (series.length) out[d] = series;
    }
    return out; // { domain: [meanSession1, meanSession2, ...] } in chronological order
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
           arcProgress, h8Divergence, attachmentReport, selfAlignment, costOfVirtue, h8aDebiasing, dimensionTexture, dimensionTrajectory,
           centralityFacets, facetMean, objectivismReads, claimTypeMean, hypocrisyAsymmetry, hypocrisyPairDelta,
           contextVariability, sampleSD, circleShape, olsSlope, protectedValues, isProtectedResponse,
           DOMAINS, _constants: { MIN_ITEMS_PER_SESSION, INATTENTIVE_RT_MS, NOISE_K, SE_FLOOR, MIN_CENTRALITY_ITEMS, MIN_OBJECTIVISM_ITEMS, MIN_HYPOCRISY_PAIRS, MIN_ITEMS_PER_CONTEXT, MIN_CONTEXTS, MIN_CONSTRUCTS, MIN_ITEMS_PER_BIN, MIN_BINS, CIRCLE_AXIS_FLOOR } };
});
