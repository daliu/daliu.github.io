/* ============================================================================
 * Patterns of Choice — runtime core (event-sourced, local-first, dependency-free)
 *
 * The load-bearing spine of the production runtime described in the research
 * repo's runtime-architecture.md (DECISIONS §18), built for the repositioned
 * goal: an OPEN, INDIVIDUAL-BENEFIT instrument that runs entirely on the user's
 * own device and is statically hostable on GitHub Pages — no server, no relay,
 * no auth, no cohort.
 *
 * Design (faithful to runtime-architecture.md §4-6):
 *   - The SessionLogEntry / ProbeResponse / CardSortResponse / PairwiseResponse /
 *     StoryResponse stream (types.ts) is the SINGLE SOURCE OF TRUTH, stored as an
 *     append-only event log in IndexedDB.
 *   - Each payload is wrapped in a thin Envelope {event_id, kind, schema_version,
 *     tag_map_version, corpus_version, device_id, local_seq, timestamp_iso, payload}.
 *   - Immutability: the store exposes NO update/delete on events. Corrections are
 *     compensating events ({supersedes: <event_id>}); deletion is whole-user.
 *   - Scores are deterministic PROJECTIONS of the log; rewind is replay-to-timestamp
 *     (a filter over the immutable list). Nothing is stored as derived truth.
 *   - event_id is a random per-event UUID (NOT a content hash — see §4 security note),
 *     so even a future export carries no plaintext-derived dedup oracle.
 *
 * This module is environment-agnostic: it works in a browser (IndexedDB) and, for
 * tests, against an injected in-memory store. No imports, no build step.
 * ============================================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.POCRuntime = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA_VERSION = "0.1";
  const EVENT_KINDS = ["session_log", "probe", "card_sort", "pairwise", "story", "instrument"];
  const DB_NAME = "patterns-of-choice";
  const DB_VERSION = 1;
  const STORE_EVENTS = "events";   // append-only event log
  const STORE_META = "meta";       // device_id, local_seq counter, settings (mutable, LWW)

  // ---- ids & time ----------------------------------------------------------
  function uuid() {
    // RFC4122 v4. Uses crypto when available (browser/Node 19+), else a fallback.
    const g = typeof crypto !== "undefined" ? crypto : null;
    if (g && g.randomUUID) return g.randomUUID();
    if (g && g.getRandomValues) {
      const b = g.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map(x => x.toString(16).padStart(2, "0"));
      return `${h.slice(0,4).join("")}-${h.slice(4,6).join("")}-${h.slice(6,8).join("")}-${h.slice(8,10).join("")}-${h.slice(10,16).join("")}`;
    }
    // last-resort (tests only); not cryptographically strong
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function nowIso() { return new Date().toISOString(); }

  // ===========================================================================
  // Storage adapters. The engine talks to a minimal async interface so it can
  // run against IndexedDB in the browser or an in-memory store in tests.
  //   appendRaw(envelope) -> Promise<envelope>
  //   allEvents()         -> Promise<envelope[]>  (any order; engine sorts)
  //   getMeta(key)/setMeta(key,val) -> Promise
  //   clearAll()          -> Promise   (whole-user deletion)
  // ===========================================================================

  function MemoryStore() {
    const events = [];
    const meta = {};
    return {
      async appendRaw(env) { events.push(env); return env; },
      async allEvents() { return events.slice(); },
      async getMeta(k) { return k in meta ? meta[k] : undefined; },
      async setMeta(k, v) { meta[k] = v; },
      async clearAll() { events.length = 0; for (const k in meta) delete meta[k]; },
    };
  }

  function IndexedDBStore() {
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_EVENTS))
            db.createObjectStore(STORE_EVENTS, { keyPath: "event_id" });
          if (!db.objectStoreNames.contains(STORE_META))
            db.createObjectStore(STORE_META, { keyPath: "key" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return dbp;
    }
    function tx(store, mode, fn) {
      return open().then(db => new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const out = fn(s);
        t.oncomplete = () => resolve(out._result !== undefined ? out._result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }));
    }
    return {
      async appendRaw(env) {
        // add() (not put()) enforces append-only: a duplicate event_id throws.
        await tx(STORE_EVENTS, "readwrite", s => s.add(env));
        return env;
      },
      async allEvents() {
        return tx(STORE_EVENTS, "readonly", s => {
          const box = {};
          s.getAll().onsuccess = e => { box._result = e.target.result; };
          return box;
        });
      },
      async getMeta(k) {
        return tx(STORE_META, "readonly", s => {
          const box = {};
          s.get(k).onsuccess = e => { box._result = e.target.result ? e.target.result.value : undefined; };
          return box;
        });
      },
      async setMeta(k, v) { await tx(STORE_META, "readwrite", s => s.put({ key: k, value: v })); },
      async clearAll() {
        await tx(STORE_EVENTS, "readwrite", s => s.clear());
        await tx(STORE_META, "readwrite", s => s.clear());
      },
    };
  }

  // ===========================================================================
  // The engine
  // ===========================================================================

  function createRuntime(opts) {
    opts = opts || {};
    const store = opts.store || (typeof indexedDB !== "undefined" ? IndexedDBStore() : MemoryStore());
    const corpusVersion = opts.corpus_version || "unknown";
    const tagMapVersion = opts.tag_map_version || "v0.1";

    let deviceId = null;
    let seq = 0;
    let ready = null;

    async function init() {
      if (ready) return ready;
      ready = (async () => {
        deviceId = await store.getMeta("device_id");
        if (!deviceId) { deviceId = uuid(); await store.setMeta("device_id", deviceId); }
        const s = await store.getMeta("local_seq");
        seq = typeof s === "number" ? s : 0;
      })();
      return ready;
    }

    function makeEnvelope(kind, payload, extra) {
      if (!EVENT_KINDS.includes(kind)) throw new Error("unknown event kind: " + kind);
      seq += 1;
      const env = {
        event_id: uuid(),               // random UUID — not a content hash (§4 security note)
        kind,
        schema_version: SCHEMA_VERSION,
        tag_map_version: tagMapVersion,
        corpus_version: corpusVersion,
        device_id: deviceId,
        local_seq: seq,
        timestamp_iso: nowIso(),
        payload,
      };
      if (extra && extra.supersedes) env.supersedes = extra.supersedes;
      return env;
    }

    // --- append (the only write path) ---
    async function append(kind, payload, extra) {
      await init();
      const env = makeEnvelope(kind, payload, extra);
      await store.appendRaw(env);
      await store.setMeta("local_seq", seq);
      return env;
    }
    // a correction references the event it supersedes; the fold drops the superseded one
    async function correct(kind, payload, supersededEventId) {
      return append(kind, payload, { supersedes: supersededEventId });
    }

    // --- deterministic total order for replay (§4): (timestamp, device, local_seq) ---
    function order(a, b) {
      if (a.timestamp_iso !== b.timestamp_iso) return a.timestamp_iso < b.timestamp_iso ? -1 : 1;
      if (a.device_id !== b.device_id) return a.device_id < b.device_id ? -1 : 1;
      return a.local_seq - b.local_seq;
    }

    // --- the live log, optionally rewound to a timestamp (replay-to-timestamp) ---
    async function log(opt) {
      await init();
      let evs = await store.allEvents();
      evs = evs.slice().sort(order);
      if (opt && opt.asOf) evs = evs.filter(e => e.timestamp_iso <= opt.asOf);
      // apply supersedes: a superseded event_id is removed from the effective log
      const superseded = new Set();
      for (const e of evs) if (e.supersedes) superseded.add(e.supersedes);
      return evs.filter(e => !superseded.has(e.event_id));
    }

    // --- export: strip envelopes, group by kind, into analyzer-ingestible arrays
    // (faithful to runtime-architecture.md §4: pairwise needs a winner/loser
    //  transform + skip-drop; the others pass through verbatim). asOf supported. ---
    async function exportForAnalyzer(opt) {
      const evs = await log(opt);
      const out = { session_log: [], probes: [], card_sort: [], pairwise: [], story: [] };
      for (const e of evs) {
        const p = e.payload;
        if (e.kind === "session_log") out.session_log.push(p);
        else if (e.kind === "probe") out.probes.push(p);
        else if (e.kind === "card_sort") out.card_sort.push(p);
        else if (e.kind === "story") out.story.push(p);
        else if (e.kind === "pairwise") {
          if (p.choice === "skip") continue; // analyzer drops skips
          const winner = p.choice === "left" ? p.left_id : p.right_id;
          const loser = p.choice === "left" ? p.right_id : p.left_id;
          out.pairwise.push({ user_id: p.user_id, layer: p.layer, winner, loser });
        }
        // "instrument" events (e.g. PSR-PRD attachment self-report) are retained in
        // the log but not part of the analyzer's current array contract.
      }
      return out;
    }

    // --- encrypted-free local backup: the raw envelope log (restore = re-append) ---
    async function exportBackup() {
      const evs = await log(); // full, ordered, post-supersede
      return { format: "poc-backup", schema_version: SCHEMA_VERSION, device_id: deviceId,
               exported_iso: nowIso(), events: evs };
    }
    async function importBackup(bundle) {
      await init();
      if (!bundle || bundle.format !== "poc-backup" || !Array.isArray(bundle.events))
        throw new Error("not a poc-backup bundle");
      // re-append each event verbatim (idempotent on event_id via add())
      let imported = 0;
      for (const e of bundle.events) {
        try { await store.appendRaw(e); imported += 1; if (typeof e.local_seq === "number") seq = Math.max(seq, e.local_seq); }
        catch (_) { /* duplicate event_id — already present, skip */ }
      }
      await store.setMeta("local_seq", seq);
      return imported;
    }

    // --- whole-user deletion (the only deletion; matches data-handling-policy) ---
    async function eraseEverything() {
      await store.clearAll();
      deviceId = null; seq = 0; ready = null;
      await init();
    }

    // --- mutable settings (LWW-by-timestamp) — the one non-event-sourced surface ---
    async function getSetting(k) { await init(); const s = (await store.getMeta("settings")) || {}; return s[k]; }
    async function setSetting(k, v) {
      await init();
      const s = (await store.getMeta("settings")) || {};
      s[k] = { value: v, ts: nowIso() };
      await store.setMeta("settings", s);
      return v;
    }

    return {
      init,
      // writes
      append, correct,
      logSessionChoice: (payload) => append("session_log", payload),
      logProbe: (payload) => append("probe", payload),
      logCardSort: (payload) => append("card_sort", payload),
      logPairwise: (payload) => append("pairwise", payload),
      logStory: (payload) => append("story", payload),
      logInstrument: (payload) => append("instrument", payload),
      // reads / projections
      log,                       // the effective event log, optionally asOf a timestamp (rewind)
      exportForAnalyzer,         // analyzer-ingestible arrays (supports asOf)
      exportBackup, importBackup,
      eraseEverything,
      getSetting, setSetting,
      // introspection
      get deviceId() { return deviceId; },
      get seq() { return seq; },
      _constants: { SCHEMA_VERSION, EVENT_KINDS, DB_NAME },
    };
  }

  return { createRuntime, MemoryStore, IndexedDBStore, uuid, SCHEMA_VERSION, EVENT_KINDS };
});
