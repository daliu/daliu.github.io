# Gameplay statistics

Release 19 adds local encounter summaries and optional shared GA4 reporting.
The opponent still learns only from the current player's local game. Gameplay,
music, saves, installation and the local statistics screen work offline without
Google, an account, a backend or an LLM.

## Player controls

Menu → Statistics shows this browser's latest 500 finished or abandoned attempts
within 90 days, with mode/difficulty filters, weapon attack shares, detected
strategies, critical/combo counts, encounter death rates and a 10 × 5 arena death
map. JSON export is separate from save export. Clearing statistics preserves
game saves, settings and the fictional subject register. Imports do not import
statistics or manufacture prior gameplay events.

**Share gameplay statistics defaults off.** Enabling it loads Google's tag only
on the canonical HTTPS origin. Preview origins, offline use, Do Not Track and
Global Privacy Control do not send events. Turning it off disables the tag,
clears pending events and removes the game's `cm_` analytics cookies. It does
not delete previously received Google data. Tabs honor changes to the preference.
There is no historical/offline upload queue: only events created while sharing
is enabled and online are eligible. An in-memory queue of at most 32 events
covers initial script loading. Delivery is best effort, not exactly-once or an
anti-cheat system. Blocking or closing the browser can lose events.

Local random attempt IDs deduplicate local-tab writes and never leave the
browser. Shared events whitelist bounded categories and numbers; no fictional
subject names, real names, save builds, raw inputs, raw coordinates, IP lookup,
fingerprints or custom persistent player identifiers are sent. GA4 uses a
game-scoped first-party cookie (`cm` prefix, `/countermeasure/` path, 90-day
expiry), standard device/browser information and its own user identification.
Ad personalization and Google signals are disabled in this game's tag config.
The page URL sent to GA is fixed and query parameters/referrers are omitted.

## Owner reporting

The existing web stream was verified in the signed-in Google Analytics UI:

- Property `530194999`, account `238429903`, stream `14237297777`.
- Public measurement ID `G-GR5Z815VXW` (not a secret).
- [Private Google Analytics](https://analytics.google.com/analytics/web/#/a238429903p530194999)
- Public aggregate view: `/countermeasure/statistics.html`.

The property also contains other site traffic. Every game report must filter
**hostname exactly `daliu.github.io` and event name to `cm_attempt_start`,
`cm_attempt_end` or `cm_escape`**, excluding `cm_entry = qa`. Never publish
unfiltered property traffic or replace the existing unrelated site reports.

Eleven event-scoped dimensions and fourteen event-scoped metrics were registered
for this release. They use the `cm_` parameter names below. In Explore, use
Event count for attempt counts and Total users for an approximate browser count.
Do not sum unique-user counts across dates, outcomes or difficulty groups.

| Event | Meaning |
| --- | --- |
| `cm_attempt_start` | One actual encounter start; retry/resume/level-select starts count separately. Pausing does not. |
| `cm_attempt_end` | Clear, death or explicit abandonment/reset/navigation. Clearing opening enemies while reserves remain is not a clear. |
| `cm_escape` | The player actually reaches the exit after the final fight. |

| Dimensions | Values |
| --- | --- |
| `cm_mode`, `cm_difficulty`, `cm_release` | Demo/Campaign, four difficulty modes, numeric game release. |
| `cm_level` | Wave plus phase, e.g. `10-boss`, `10-super`, `50-hidden`. |
| `cm_entry` | `new_run`, `continuation`, `retry`, `resume`, `level_select`, `finale_replay`, `difficulty_change`; `qa` for marked validation. |
| `cm_input` | Controls used on this visit: keyboard, touch, mouse, mixed, unknown. Sent on starts/escapes. |
| `cm_outcome` | `clear`, `death`, `abandoned`. |
| `cm_strategy` | Detected actual wet-electric or cut-liquid combos, evasive movement, dominant weapon family, mixed or no attacks. Priority is combo, movement, then attack share. |
| `cm_weapon` | Most-used weapon family by activations; ties choose first family. |
| `cm_death_cell`, `cm_death_cause` | Coarse arena cell and fixed game-cause category, or `none`. |

Metrics on attempt ends: `cm_seconds`, `cm_attacks`, `cm_hits`,
`cm_damage_taken`, `cm_kills`, `cm_criticals`, `cm_combos`, `cm_jumps`,
`cm_rolls`, `cm_air_dashes`, `cm_hp`, `cm_armor`, `cm_fuel`, `cm_ammo`.
Use per-event averages for remaining resources. Simulation seconds exclude
pauses, travel and escape. Health damage excludes absorbed armor damage.
Destroyed units include structures and robot friendly fire. A hit may activate
multiple synergies, so combo hits count synergy applications. Multi-target
weapons can hit several targets per attack; hits/attacks is not accuracy.

## Daily aggregate export

`scripts/countermeasure_analytics.py` is called by the existing
`scripts/fetch_analytics.py`; the existing scheduled job commits its new
`countermeasure` section inside `analytics/data.json`. No new workflow, schedule,
permissions, credentials or manual workflow dispatch is needed. Existing site
report sections remain independent. The game-specific helper pins the verified game property independently of the
existing site-property environment variable, and uses read-only GA4 Data API
credentials already supplied to that job. Those credentials must have read access
to the pinned property; a missing grant produces an unavailable report. No credentials are
available to the game or in the repository.

The community view starts in an honest waiting state until the first successful
daily report. Reporting definitions may take 24–48 hours to appear. Missing
definitions/access produce `unavailable`, not invented zeros. Successful zero
counts mean no eligible events in that report window. Requests cap each table
at 10,000 rows and surface truncation, thresholding or sampling. The public
download contains the site's existing aggregate report plus game aggregates,
never client IDs or individual play histories.

Death rate = deaths / (deaths + clears); explicit abandoned attempts are separate.
Browser crashes and some exits are unobserved, so starts need not equal ends.
Entry and release filters apply to outcomes; strategy/heatmap breakdowns hide
when those filters are selected because their smaller export does not contain
those dimensions. Unique browsers always covers the entire report window, not
the selected difficulty. Counts have opt-in and online selection bias. They are
observational, not causal tests of weapon effectiveness or exact population size.

## Validation

Use `?analytics_test=1` on an owned production QA tab to mark sent events `qa`
and enable DebugView. This flag also isolates all game records under a QA
storage prefix and uses separate `cmqa_` cookies, preserving player saves and
analytics preferences. These events are explicitly excluded from the aggregate
export. Local preview always blocks Google requests, even if sharing is enabled.
Never enable sharing on a player's existing tab to test collection.

Run `node --test tests/countermeasure*.test.mjs` and
`python3 -B -m unittest discover -s tests -p test_countermeasure_analytics.py`.
Tests use synthetic providers and normal game inputs; no Google credentials or
test traffic is required. Verify the marked production QA events separately in
the native Analytics UI. That is collection proof, not proof that tomorrow's
scheduled snapshot has run.

IP-based unique counts are **not implemented**. GitHub Pages is static hosting;
an IP collector would require a separate backend. GA4 does not log/store IPs.
Unique browsers can overcount multiple devices or cookie resets and undercount
shared browsers; unique IPs would also conflate shared networks and split users
whose IP changes.
