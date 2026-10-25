# Campaign tuning — October 25, 2026

Release 17 separates post-victory suit rewards from armor attrition, replaces acid binding with a timed thrown glue bomb, and gives Mirror/Superboss opponents learned weights over authored combo moves. Music continues while crossing cleared rooms. The standalone updater activates the current offline release without deleting saves.

## Current rules

- Mirror duels copy build, weapon stages, selected power and learned spacing/jump/dash/attack habits at levels 10/20/30/40/50. Each leads into that milestone's resistant superboss. Saved milestone selection starts the pair; Continue resumes the saved phase.
- Armor damage carries through ordinary rooms in all four modes. Every regular boss displays a locked overhead suit crate; after all enemies die it drops and can be collected for full new armor and fresh fuel/ammo/power cooldowns. Missing it triggers salvage at the exit. It never heals a Terminator human. Terminator earns ultra gear after its first Mirror victory at level 10. Zero-armor boosters still work. Retries are fresh attempts; the earned finale retains its ultimate-suit grant.
- From level 6, part of a squad deploys later. Crossfire, pincer, airlift and relay patterns alternate after the first mech. A 1.6-second warning precedes arrival, and reserves keep the exit locked. The pre-mech sector uses forward reinforcements instead of flanking; later rooms add counter screens and command support. Total authored squads stay bounded at eleven.
- Industrial acid corrodes without grounding, binding or refreshing hit stagger. A separate industrial glue bomb is thrown in an arc, grounding for two seconds and slowing for three more, on an exact ten-second cooldown even with ultra gear. Existing progressive cognition, resistances, finite fuel/ammo, boss control recovery, eight-second objective EMPs and carried power cooldowns remain. Touch supports simultaneous steering/fire/flight and an optional nearby-target aim preference.
- Options include current-run difficulty changes (restart the level, preserve spent health/armor/resources), persistent audio/volume/aim preferences, fullscreen and saved levels. Current difficulty and release are visible.

- Mirror/Superboss combo selection uses retained weapon effectiveness, jump/dash/spacing habits, successful clear time and sample confidence. Authored moves have a 0.6-second windup and at least a 2.6-second recovery between chains: jumping bilateral circuit fire, slash/electric pursuit, duck/counter and later aerial feints. Lessons freeze on spawn. First-iteration opponents cannot gain flight from the player's suit. The first unarmored Mirror now has 450 base HP and 55% incoming human damage, replacing the prior mid-fight armor award; later boss durability is unchanged.
- Explicit pause menus still pause; room traversal keeps held movement, animation and the music phrase running. About describes this local statistical model and its limits rather than claiming neural or LLM training.

## Reproduce

```sh
node --test tests/countermeasure*.test.mjs
node scripts/countermeasure-playtest.mjs --seeds 11,12,13,14,15 --reaction .20 --max-deaths 50 --report /tmp/countermeasure-tuning.json
node scripts/countermeasure-playtest.mjs --seeds 51,52,53,54,55 --reaction .28 --max-deaths 50 --report /tmp/countermeasure-validation.json
```

The deterministic pilot uses normal combat, movement, skills, powers, gates and pod collection. It reads arena state and uses touch aim assistance, so it is not a human or physical-phone model. Decision timing is quantized by a 40 ms simulation step. For this release it ignores locked crates, avoids self-electrifying the unarmored first Mirror, reacts to imminent shots with a jump/dash, and uses glue against flyers. These are test-player strategy changes, not edits to health, damage or victory state. Fixing a phantom Demo fallback crate in Superboss rooms also removed a trap in the test controller's pod logic.

## Results and limits

201 focused checks pass, including eight complete routes, the exact glue timers, continuous acid without grounding, post-clear reward checkpoints, music phrase continuity, real bilateral projectiles and actual duck hitboxes. Forty final runs completed: twenty tuning runs followed by twenty previously unused validation seeds after combat calibration. Another twenty calibration cross-checks also completed; those are not called independent validation. The retry budget is now 50 because the pilot needs more attempts under armor attrition and stronger learned offense.

| Difficulty | Tuning completion / deaths | Validation completion / deaths | Median successful superboss combat seconds, tuning / validation |
| --- | --- | --- | ---: |
| Easy | 5/5 · 0–1 | 5/5 · 0–0 | 10.9 / 13.7 |
| Normal | 5/5 · 6–7 | 5/5 · 1–4 | 15.7 / 16.7 |
| Hard | 5/5 · 12–17 | 5/5 · 5–6 | 18.3 / 18.7 |
| Terminator | 5/5 · 18–39 | 5/5 · 15–35 | 18.2 / 16.6 |

Timing/seed resonance means slower decisions can sometimes perform better. These counts demonstrate routes with retries, not human win rates, deathless Terminator proof, or proof that the game is fun. Boss timings exclude travel and failed attempts. Human health still repairs by difficulty outside Terminator; ordinary-room armor does not.

Browser acceptance covers the locked suit during a first Mirror, earned level-20 Superboss loaded through ordinary Import, compact touch power switching/firing and the ten-second glue cooldown, a 390-pixel About layout, and a server-off cached reload. Checkpoints came from actual input-driven routes on a separate local origin. Existing input checks cover independent steering/fire/flight, pointer cancellation and pause. Physical iPhone/Android sessions and full human Campaign play remain follow-ups.
