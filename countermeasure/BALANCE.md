# Campaign tuning — October 25, 2026

Release 18 upgrades the whole enemy roster after each ten-level sector and expands learned boss move families. It retains the Release 17 rules, which separate post-victory suit rewards from armor attrition, replace acid binding with a timed thrown glue bomb, and give Mirror/Superboss opponents learned weights over authored combo moves. Music continues while crossing cleared rooms. The standalone updater activates the current offline release without deleting saves.

## Current rules

- Mirror duels copy build, weapon stages, selected power and learned spacing/jump/dash/attack habits at levels 10/20/30/40/50. Each leads into that milestone's resistant superboss. Saved milestone selection starts the pair; Continue resumes the saved phase.
- Armor damage carries through ordinary rooms in all four modes. Every regular boss displays a locked overhead suit crate; after all enemies die it drops and can be collected for full new armor and fresh fuel/ammo/power cooldowns. Missing it triggers salvage at the exit. It never heals a Terminator human. Terminator earns ultra gear after its first Mirror victory at level 10. Zero-armor boosters still work. Retries are fresh attempts; the earned finale retains its ultimate-suit grant.
- From level 6, part of a squad deploys later. Crossfire, pincer, airlift and relay patterns alternate after the first mech. A 1.6-second warning precedes arrival, and reserves keep the exit locked. The pre-mech sector uses forward reinforcements instead of flanking; later rooms add counter screens and command support. Total authored squads stay bounded at eleven.
- Industrial acid corrodes without grounding, binding or refreshing hit stagger. A separate industrial glue bomb is thrown in an arc, grounding for two seconds and slowing for three more, on an exact ten-second cooldown even with ultra gear. Existing progressive cognition, resistances, finite fuel/ammo, boss control recovery, eight-second objective EMPs and carried power cooldowns remain. Touch supports simultaneous steering/fire/flight and an optional nearby-target aim preference.
- Options include current-run difficulty changes (restart the level, preserve spent health/armor/resources), persistent audio/volume/aim preferences, fullscreen and saved levels. Current difficulty and release are visible.

- Mirror/Superboss combo selection uses retained weapon effectiveness, jump/dash/spacing habits, successful clear time and sample confidence. Authored moves have a 0.6-second windup and at least a 2.6-second recovery between chains: jumping bilateral circuit fire, slash/electric pursuit, duck/counter and later aerial feints. Lessons freeze on spawn. First-iteration opponents cannot gain flight from the player's suit. The first unarmored Mirror now has 450 base HP and 55% incoming human damage, replacing the prior mid-fight armor award; later boss durability is unchanged.
- Explicit pause menus still pause; room traversal keeps held movement, animation and the music phrase running. About describes this local statistical model and its limits rather than claiming neural or LLM training.

## Enemy generations

Generation II starts at level 11, III at 21, IV at 31 and V at 41. All ordinary chassis gain 7% base durability and 7.5% movement per completed sector, with quicker attacks and shorter but bounded windups on top of the existing cognition curve. Mech and armor carry rules are unchanged.

- Artillery uses higher and shorter-flight arcs, narrower landing spreads and bounded motion lead. Landing rings commit before launch; an ally entering that area makes it hold fire. Friendly explosions still hurt robots that move into them afterward.
- Linear shooters fire faster bursts, check intervening allies and hop for a clearer lane. Flak and sky slingers also improve their projectile patterns/tempo. Dousers lay longer-lived water and orchestrators signal more frequently.
- Guards gain all-around plating and stronger shields, a telegraphed shove and a physical ground barrier. They retain electrical/corrosion weaknesses and leg/disabling counters; jumping passes above the barrier.
- Conductors retain floor shocks and add a committed sliding launch. Grounded standing humans are hit; rolling or jumping avoids it.
- Drones mark a target, wait 0.72 seconds, then commit to an increasingly fast dive. They can miss. Blast hits leave longer static damage, shrapnel slowing or chemical exposure; later chemical pools persist longer. Disarming/dilution counters remain.
- More reserves arrive from alternating sides/air. Normal averages 6.8, 9.3, 11.7 and 14.1 robots in sectors II–V; Terminator averages 10.9, 14.7, 18.3 and 21.7, peaking at 23 authored units. There is a safety budget of 30 total and 16 alive; warning gates wait for room under the live cap. Blackouts become more frequent and their radius contracts, while warning marks remain visible.
- Mirror/Superboss policies now classify evasive, rolling, aerial, air-dash and ranged affinities. Roll/air-dash rates are separately learned and saved, with zero defaults for old saves. New moves are actual low-hitbox rolls, air-dash critical attempts and a brief guard against the learned weapon family. One matching front hit consumes that guard; switching family, flanking or disabling defeats the prediction. No exact input sequence is recorded. A final normal-input trace exposed stun chains suppressing every late Mirror combo; Mirror II onward now responds after 1.3 seconds of accumulated disabling with a visible 1.9-second recovery and an immediately telegraphed learned move. Damage, glue grounding and leg trauma still work. Natural-input checks require learned moves in every upgraded duel, alongside the controlled motor-skill tests.

## Reproduce

```sh
node --test tests/countermeasure*.test.mjs
node scripts/countermeasure-playtest.mjs --seeds 11,12,13,14,15 --reaction .20 --max-deaths 60 --report /tmp/countermeasure-tuning.json
node scripts/countermeasure-playtest.mjs --seeds 71,72,73,74,75 --reaction .28 --max-deaths 60 --report /tmp/countermeasure-validation.json
```

The deterministic pilot uses normal combat, movement, skills, powers, gates and pod collection. It reads arena state and uses touch aim assistance, so it is not a human or physical-phone model. Decision timing is quantized by a 40 ms simulation step. Since Release 17 it ignores locked crates, avoids self-electrifying the unarmored first Mirror, reacts to imminent shots with a jump/dash, and uses glue against flyers. These are test-player strategy changes, not edits to health, damage or victory state. The previous release also fixed a phantom Demo fallback crate in Superboss rooms and removed a trap in the test controller's pod logic.

## Results and limits

221 focused checks pass, including 19 new generation/affinity mechanics checks and ten full routes. Forty additional runs complete: 20 tuning routes on seeds 11–15 at .20-second decisions and 20 previously unused validation routes on seeds 71–75 at .28 seconds. The controller remains unchanged from Release 17: these results test the stronger enemies with the same strategy. The full-route test budget increases from 50 to 60 deaths because the new attrition intentionally increases retry demand; initial Terminator seed 32 completed with 53 deaths, so it failed the old budget without getting stuck. That is reported as additional retry cost, not a controller win-rate improvement.

| Difficulty | Tuning completion / deaths | Validation completion / deaths | Median total simulated minutes, tuning / validation |
| --- | --- | --- | ---: |
| Easy | 5/5 · 3–4 | 5/5 · 1–2 | 9.0 / 9.2 |
| Normal | 5/5 · 14–18 | 5/5 · 8–11 | 14.7 / 14.2 |
| Hard | 5/5 · 27–32 | 5/5 · 15–21 | 19.6 / 19.3 |
| Terminator | 5/5 · 25–50 | 5/5 · 20–45 | 19.2 / 18.8 |

Total time includes travel and retries. These routes prove possible completion by a state-aware controller, not human win rates, deathless qualification or fun. Later rooms are intentionally much more demanding; old release tables do not describe them. Browser checks use actual route checkpoints via ordinary Import on a separate local origin: generation-V darkness/plating, Mirror quick weapon/power controls, release/cache update and server-off reload. Native fullscreen in the in-app QA browser was inconclusive; it is not claimed as phone acceptance.

Physical-phone sessions, full human play and judgments of frustration versus satisfying pressure remain required follow-ups. Phone-sized browser checks exercise layout and ordinary UI inputs; they do not prove multitouch ergonomics on iOS/Android.

## Release 20 / adaptive boss support

Campaign boss phases now observe a bounded eight-second window of crouch time, airtime and clustered two-dimensional position. The director samples four times per second; a strong recent habit chooses ground support, drones or committed-height airburst artillery. Crouch has priority, then stationary patches, then moving airtime. At least 60% crouch / 65% airtime / 72% position density is needed. Each call has a 1.8-second warning, a safe-distance entry gate and ordinary post-entry attack timing. The director never changes existing hardware or tracks individual input sequences.

| Difficulty | Initial observation | Recovery before next warning | Team size | Live support cap, sectors I–III / IV–V |
| --- | ---: | ---: | ---: | ---: |
| Easy | 6.5s | 13s | 1 | 2 / 3 |
| Normal | 5s | 11s | 1 | 3 / 4 |
| Hard | 4.5s | 10s | 2 | 4 / 5 |
| Terminator | 4s | 9s | 2 | 5 / 6 |

Total support per encounter is bounded by sector/difficulty at 3–16 units, with at most ten non-structure enemies active. The old independent late-core summon loop is replaced, so coordinated finale cores share one budget. Calls stop when the last boss dies; remaining deployed enemies still gate the room clear and suit. Objective reboots cancel warnings and freeze observation. No changes to player health, armor repairs, resources, weapon strength or the test controller were made.

The adjacent Superboss aim fix corrects a vertical-origin error: shots previously calculated direction from feet but launched 26px higher. Shots now aim from the muzzle at the sampled posture; target locking and reaction delay remain. A regression test checks that a duck after standing aim locks can evade, while holding crouch before aim locks is targetable. Airbursts retain friendly fire and can be escaped after a mark locks.

247 focused checks pass, including fourteen adaptive-support checks. Eight additional paired full routes (seeds 11 and71, .28s decisions, 60-death budget) complete with the unchanged controller. Previous/current deaths: Easy 2,1 → 2,2; Normal 10,9 → 8,9; Hard 16,15 → 28,18; Terminator 29,45 → 31,45. Hard seed11 also took 29.6 simulated minutes versus18.1 before, a material increase in retry cost. These are possible-completion simulations, not human win rates or full-length phone acceptance.

A separate same-checkpoint Normal level20 Superboss probe held crouch without attacking for30s: prior release ended at100HP with37.7 armor; this release ended at22.1HP with no armor, after lancer and conductor calls. This is one reproducible posture probe, not proof that every fixed attack strategy loses. Browser QA uses normally reached imported checkpoints on an owned local origin. In-app native fullscreen screenshot capture remains inconclusive; ordinary phone layout and real edge-warning/pause controls are checked separately.
