# Campaign tuning — October 25, 2026

Release 16 replaces one opening squad with staged deployments and removes automatic armor repairs. The running Chrome tab inspected during this pass was still on the original Campaign with a single final mirror; it had not loaded the later five-pair progression. A standalone online updater outside the old worker scope now provides a reliable path to the latest game without deleting saves.

## Current rules

- Mirror duels copy build, weapon stages, selected power and learned spacing/jump/dash/attack habits at levels 10/20/30/40/50. Each leads into that milestone's resistant superboss. Saved milestone selection starts the pair; Continue resumes the saved phase.
- Armor damage carries through every doorway in all four modes. The first suit grants armor; later suit upgrades add only their extra capacity. Terminator supplies after later regular boss victories refill fuel/ammunition without repairing armor or healing the human. Zero-armor boosters still work. Retries are fresh attempts; the earned finale retains its ultimate-suit grant.
- From level 6, part of a squad deploys later. Crossfire, pincer, airlift and relay patterns alternate after the first mech. A 1.6-second warning precedes arrival, and reserves keep the exit locked. The pre-mech sector uses forward reinforcements instead of flanking; later rooms add counter screens and command support. Total authored squads stay bounded at eleven.
- Existing progressive cognition, resistances, combos, finite fuel/ammo, boss control recovery, eight-second objective EMPs and carried power cooldowns remain. Touch supports simultaneous steering/fire/flight and an optional nearby-target aim preference.
- Options include current-run difficulty changes (restart the level, preserve spent health/armor/resources), persistent audio/volume/aim preferences, fullscreen and saved levels. Current difficulty and release are visible.

## Reproduce

```sh
node --test tests/countermeasure*.test.mjs
node scripts/countermeasure-playtest.mjs --seeds 11,12,13,14,15 --reaction .20 --max-deaths 40 --report /tmp/countermeasure-tuning.json
node scripts/countermeasure-playtest.mjs --seeds 21,22,23,24,25 --reaction .28 --max-deaths 40 --report /tmp/countermeasure-holdout.json
```

The deterministic pilot uses normal combat, movement, skills, powers, gates and pod collection. It now targets the visible sync antenna in later superboss fights; this is a test-player strategy change, not extra player damage. It never edits health or victory state. It reads arena state and uses touch aim assistance, so it is not a human or physical-phone model. Decision timing is quantized by a 40 ms simulation step.

## Results and limits

189 focused checks pass, including eight complete routes and five-milestone input/copy tests. Forty additional complete runs passed: twenty used during tuning, then twenty on held-out seeds/timing. The higher retry budget is deliberate for the harder armor-attrition rules; prior release results with room repairs and a 12-death budget do not describe this release.

| Difficulty | Tuning completion / deaths | Held-out completion / deaths | Median superboss combat seconds, tuning / held-out |
| --- | --- | --- | ---: |
| Easy | 5/5 · 0–2 | 5/5 · 0–0 | 10.4 / 13.1 |
| Normal | 5/5 · 8–10 | 5/5 · 3–4 | 15.4 / 14.4 |
| Hard | 5/5 · 17–20 | 5/5 · 6–8 | 18.7 / 17.5 |
| Terminator | 5/5 · 20–40 | 5/5 · 14–26 | 16.8 / 18.0 |

Early flanking trials trapped the pre-mech controller and were revised before these final batches. Timing/seed resonance means slower decisions can sometimes perform better. These counts demonstrate routes with retries, not human win rates, deathless Terminator proof, or proof that the game is fun. Boss timings exclude travel. Human health still repairs by difficulty outside Terminator; armor does not.

Browser acceptance covers persisted options, a difficulty change without healing, milestone replay entering Mirror 2 with damaged armor, phone menu layout, cached-client update/return, and offline reload. Input tests cover independent steering/fire/flight, pointer cancellation and pause. Physical iPhone/Android sessions and full human Campaign play remain follow-ups.
