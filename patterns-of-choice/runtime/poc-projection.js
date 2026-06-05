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
           DOMAINS, _constants: { MIN_ITEMS_PER_SESSION, INATTENTIVE_RT_MS, NOISE_K } };
});
