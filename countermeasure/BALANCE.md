# Campaign balance playtest — October 24, 2026

This pass preserves all 50 levels, the five boss pairs, permanent finale unlock and separate Demo. It addresses an early difficulty cliff, late boss shutdown loops, room-entry overlap, and two-thumb flight/combat.

## Changes

- First Mirror attacks deal 18% less damage and its mech pod drops at 55% remaining health. Collecting the pod remains part of the fight.
- Extra enemies spawn outside the human entry lane, with front-line and ranged roles separated.
- Superboss health reserves rise with each milestone. Terminator bosses receive a further 45% reserve. Every weapon and critical hit still damages them.
- Sustained stuns/roots/shutdowns exhaust a boss control budget. An amber ring marks its brief recovery; damage, corrosion and slowing remain useful. Button and antenna EMPs retain eight seconds of reboot.
- Power cooldowns survive room changes and saved checkpoints, and tick during travel. Fresh retries, replacement suits and finale replays reset them.
- Ultra armor absorbs less incoming damage on Hard and Terminator. Ordinary armor repairs scale with difficulty. Terminator still never heals the human; regular boss victories at 20/30/40/50 refit armor, fuel and ammunition.
- Touch Attack aims toward a nearby target while movement remains independent. Hold Attack and slide upward to jump/fly while firing, leaving the other thumb free to steer. Dash follows the held movement direction. Keyboard and canvas aiming remain manual.

## Reproduce

```sh
node --test tests/countermeasure*.test.mjs
node scripts/countermeasure-playtest.mjs --seeds 11,12,13,14,15 --reaction .20 --report /tmp/countermeasure-holdout.json
node scripts/countermeasure-playtest.mjs --seeds 21,22,23,24,25 --reaction .28 --report /tmp/countermeasure-delayed.json
```

The test player uses ordinary movement, attacks, weapon stages, skill allocation, powers, pod collection and gate traversal. It never edits health, enemy damage or victory state. Seeded randomness makes failures reproducible. Decision timing is quantized by the 40 ms simulation step. The controller reads arena state and uses touch aim assistance; it is not a human or phone performance model. Comparisons with the previous release include that new assistance, rather than isolating damage tuning alone.

## Results

179 focused tests pass, including eight complete runs and input routing at all five superboss milestones in all four modes. Forty additional full runs on held-out seeds finished within the 12-death retry budget. Eight direct unlocked triple-core replays finished without deaths.

| Difficulty | Completed runs | Deaths per run, 200 ms decisions | Deaths per run, 280 ms decisions | Median superboss combat seconds, 200 / 280 ms |
| --- | ---: | ---: | ---: | ---: |
| Easy | 10/10 | 0 | 0 | 10.9 / 11.5 |
| Normal | 10/10 | 1–2 | 0 | 15.4 / 16.2 |
| Hard | 10/10 | 8–9 | 1–3 | 17.8 / 18.0 |
| Terminator | 10/10 | 7–10 | 4–5 | 17.2 / 16.4 |

The prior release, with a pod-aware controller, completed 20/20 runs; median superboss combat lasted only 3.8–5.7 seconds. The earlier baseline controller also failed to collect the first pod reliably; those failed experiments were excluded from this comparison. Travel time is excluded from boss timings. Timing/seed resonance explains why slower decisions sometimes perform better; these numbers are regression evidence, not calibrated human win rates or completion times.

Browser checks cover 320×568, 390×844 and 844×390 layouts; boss weapon/power switching, EMP electric lockout, ammunition consumption, pause/resume and skill menu; and a native attack-slide jump gesture. Compact combat targets are at least 44 px. Pointer tests additionally hold firing, flight and steering together, cancel one finger without releasing another, and prevent stale movement after pause. Physical iPhone/Android multitouch and sustained human runs are still needed to judge fatigue, fun and perceived difficulty.
