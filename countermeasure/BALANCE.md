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

## Release 21 / Mirror flight and factory sectors

The old flight loop applied upward velocity whenever the sampled human height was above a threshold, irrespective of relative altitude. The Mirror could keep rising after it had overtaken the human. Powered flight now samples at the existing 0.24-second interval, approaches/crosses/breaks below the target over a 3.2-second pass and descends for 1.1 seconds. Relative-height velocity is bounded; the 145px upper boundary also applies to authored Mirror combos. Glue grounding and unpowered copies get no new thrust. Superboss flight rules are unchanged.

A paired probe uses the same normally reached Normal level20 Mirror checkpoint and seed123. For20s it holds flight and alternates horizontal direction every2s, without attacking or editing health. Time with Mirror feet above130px falls from10.44s to0s; longest ceiling streak falls from3.90s to0s. Both probes remain alive. This tests the reported ceiling behavior, not every player strategy.

254 focused checks pass. Eight full input-driven routes (seeds11/71, .28s decisions,60-death budget) complete with the unchanged controller: Easy2/2 deaths, Normal7/9, Hard25/33, Terminator30/45. Hard seed71 rises from18 to33 deaths compared with Release20, a material retry-cost increase; these are state-aware simulations rather than human win rates. Sector drawing checks cover all56 chambers, finite geometry, trial labels, lore progression and offline precaching. Browser QA uses ordinary imported route saves on an owned local origin; physical-phone ergonomics remain unproven.

## Release 22 / friendly fire, charged lasers and Hard retry cost

Campaign allied-damage eligibility is now Easy1.0, Normal0.7, Hard0.3, Terminator0. A projectile samples once and either collides with allies or passes through them, so Terminator robots cannot become harmless bullet sponges for the human. Melee contacts, blasts, floor shocks, laser beams and robot-owned chemical residue use the same policy. Pool/source ownership is the adjacent required change: robot chemistry cannot bypass zero friendly fire, while human acid remains damaging. Existing ally-aware aiming still avoids unsafe lanes. Demo keeps its original policy.

Hard/Terminator superbosses gain a1200px locked-direction laser with dashed orange charge, brief beam and cyan venting ring/countdown. The boss stops during the charge/blast, then drops and cannot attack while recharging. Damage scales with the existing core weakness multiplier0.85 rather than active resistance0.18 during recharge. Charges can be interrupted by disabling powers; a subsequent stun does not cancel the earned recharge window. Player contact is limited to one hit per blast. Existing objective EMPs and pause rules remain. Enemy support observation pauses while all cores are venting or shut down.

| Mode | Charge | Beam | Recharge vulnerability | Cooldown after recharge | Base human damage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hard | 1.35s | .32s | 2.5s | 9s | 28 |
| Terminator | 1.05s | .30s | 1.65s | 6.5s | 32 |

Hard combo warnings grow from0.60s to0.72s, ordinary post-combo recovery from0.9s to1.2s, and combo cooldowns by12%. Hard armor capacity grows from80% to90%; human chamber repairs grow from+10/floor55 to+16/floor65. Armor damage still carries exactly between ordinary rooms; only earned post-clear suits refill it. Enemy learning, adaptation slots, quantities, speed and damage remain Hard's existing values.

Initial removal of friendly fire produced two Terminator death-limit failures by levels33/39 on the four paired seeds. To compensate, ordinary Terminator enemy health changes from1.30 to1.15 and population factor1.50 to1.35. Mirror/core health, no HP regeneration,42% armor, faster cognition and early ultra suit remain. The controller is unchanged throughout; no health or victory edits and no raised death budget were used to obtain completion.

267 focused checks pass. Final explicit model validation includes32 complete full routes:16 paired (seeds11/71/83/97) and16 fresh for this change (12/72/84/98), .28s decisions,60-death limit. Two additional read-only traced routes verify learned moves in completed Mirror20/30/40/50 fights, zero ceiling time above130px, real laser shots and venting in the final superboss. Many earlier charges are interrupted by the controller's powers; availability does not guarantee every attempt fires a laser.

| Difficulty | Previous paired deaths | New paired deaths | Fresh deaths | New paired/fresh median total minutes |
| --- | --- | --- | --- | ---: |
| Easy | 2,2,2,1 | 2,2,2,1 | 2,2,2,1 | 9.1 /9.5 |
| Normal | 7,9,9,9 | 9,9,10,8 | 9,10,11,9 | 14.6 /14.7 |
| Hard | 25,33,19,20 | 16,21,17,18 | 18,16,15,18 | 20.5 /20.1 |
| Terminator | 30,45,21,22 | 19,20,20,22 | 19,17,18,18 | 17.0 /16.5 |

Hard's paired average decreases24.25→18 deaths (about26%), worst33→21. Those are state-aware model results, not human win rates, physical-phone acceptance or deathless balance. The prior every-attempt Mirror-combo assertion incorrectly included brief losing human attempts; it now requires each completed upgraded duel to show a learned combo, plus all four milestones and actual attacks. The old ally-projectile regression forces an eligible friendly-fire sample rather than assuming every Normal shot hits allies.

Phone checks use ordinary imported checkpoints reached by the pilot on an owned local origin: revised Hard Mirror20/50 weapon/Fly/Attack/Dash actions, visible locked-ray warning, an evasive flight input and venting countdown. Multi-pointer control tests exercise simultaneous steering, firing, flight and weapon switching at every boss milestone.390px and320px portraits and844×390 landscape control bounds are checked; native fullscreen screenshot capture remains inconclusive in the in-app browser. Offline verification reloads with the preview server stopped and resumes the new attack. Physical iOS/Android feel and human run balance remain follow-ups.

## Release 23 / single-use EMP and neutral defenses

The Campaign emergency switch works once per fight. Its eight-second shutdown hands directly to backup power; it never rearms. Backup cores take 60% of ordinary damage instead of18% (82%→40% shield resistance), while existing temporary weaknesses still use85%. Core health, learning, player stats and difficulty profiles are unchanged. The spent switch is gray, no longer intercepts nearby attacks, and the boss shows a broken amber shield ring. A retry starts a fresh encounter.

Antenna/button defenses bypass robot friendly-fire eligibility in every mode, including Terminator. The adjacent required geometry change makes visible upper armor hittable by player attacks, swept projectiles, blasts and lasers, rather than only the old small humanoid target. Ally-safe aiming ignores neutral structures. A charged core laser deals25% maximum structural HP (minimum180) once per blast; ordinary weapons retain their damage. Destroying the antenna still causes an eight-second reboot and permanent desynchronization. The new geometry module is precached for offline use. Demo rules remain unchanged.

276 focused checks pass, including nine new objective regressions. Eight full input-driven routes complete with the unchanged controller (seeds11/71, .28s decisions,60-death budget): Easy1/2 deaths, Normal9/9, Hard15/16, Terminator19/17. Prior Release22 paired deaths were2/2,9/9,16/21,19/20. These verify possible completion, not human win rates.

Six input-only Terminator50 probes use normally reached checkpoints, three seeds per target, with no player attacks or state edits. All six bait a real charged laser into the antenna/fortress within about7.7 seconds while preserving human HP. Extended movement-only probes destroy four of six targets; two humans die with armor remaining on the objective. Baiting is viable and remains dangerous. Phone-width UI checks import a normally reached Hard10 superboss save through the ordinary local save menu, fly to and press the switch, observe the full shutdown and backup handoff, and verify a second press is disabled. Server-off reload checks cover the final cached build; physical iOS/Android feel remains unproven. Bounded evidence is retained outside the published site.

## Release 24 / full Terminator bait sequence

The scoped change doubles Terminator charged-laser structural damage from25% to50% maximum armor (minimum180); Hard stays25%. Two aligned beams can now clear a full antenna/fortress. Human laser damage, core HP/resistance, learning, support caps/timing and player resources are unchanged. This follows passive and active bait probes that repeatedly failed before reaching backup, while direct combat was faster. The target’s existing damage flash/armor bar shows the payoff.

A dedicated input-driven pilot compares direct combat, baited cover→button→backup, and (levels40/50) baited antenna→cover→button→backup. It uses normally reached **entry** checkpoints from the unchanged Terminator pilot, seeds11/71, preserving incoming human health, armor and limited resources. An ordinary snapshot after startWave clears the carry field and is unsuitable for this comparison. Decisions occur every.28s; the finisher uses available AP rounds, acid/electric combinations and existing powers. Damage observers record enemy objective kills, one button use and real core damage after rerouting. No health/enemy/victory edits occur.

There are144 paired attempts per build: six previously unused encounter seeds12/72/84/98/211/401, two route checkpoints and the same strategies/controller. The two routes use the same pilot style and have similar builds; these are not144 independent players.

| Level | Cover clears before→after /12 | Both defenses before→after /12 | After median successful cover / both seconds |
| --- | --- | --- | --- |
|10|12→12|No armor/antenna|5.3 / —|
|20|12→12|No antenna|22.7 / —|
|30|10→12|No antenna|29.5 / —|
|40|7→12|4→10|34.1 /54.9|
|50|2→6|0→5|42.0 /70.9|

All revised level40/50 bait clears meet the complete sequence: required defenses destroyed by enemy attacks, switch used once, and core damage dealt on backup before clearing. Early cores can die during the eight-second shutdown, which is a legitimate attack window rather than a forced wait. All five successful level50 two-defense attempts expend their nine AP rounds and end with zero armor,32.7–52.7 human HP. Direct combat remains12/12 at every milestone for this.28s controller; efficient AP burst still makes early cores easy and is a separate balance concern.

A further144 final-build attempts use fresh seeds19/79/109/199/271/307 and slower.4s decisions. Level50 direct combat clears9/12, cover2/12, both3/12; every bait clear completes the backup sequence. Level40 cover9/12 and both7/12. Level20 has one stalled attempt from an extended missed-bait exchange, even though11/12 clear. The route is viable in these models, remains slower/riskier than efficient direct combat, and is sensitive to timing; these are not human win rates or proof of broad/deathless balance.

276 focused tests pass, including actual Hard quarter/Terminator half structural beam damage once per blast. Eight standard full routes, unchanged pilot/seeds11/71/.28s/60-death cap, complete with unchanged Release23 death counts: Easy1/2,Normal9/9,Hard15/16,Terminator19/17. No other difficulty tuning was needed.

Phone-width390px local UI checks import normally reached Terminator10/20/50 checkpoints through ordinary save transfer. Movement/flight, held attack, acid/electric switching and a real level10 switch→backup→core/support clear pass, with damaged armor carried throughout. Sequenced manual level20/50 bait attempts do not establish a complete late bait clear; the complete late sequence is model-verified. Existing multi-pointer control tests pass. Final cached build is checked after stopping its owned preview server. Physical iOS/Android feel and a human late-boss bait clear remain follow-ups. `ROADMAP.md` separately records future systems without implementing payments or companions.

Separate follow-up: [early Terminator AP/core balance](https://github.com/daliu/daliu.github.io/issues/51).

## Release 25 / player-directed structural rollback and facility story

At the player’s request, structural charged-beam damage returns to25% maximum HP/min180 on both Hard and Terminator. No further compensating balance changes are made. Release24’s50% bait clear rates are historical and cannot be treated as current acceptance. The single-use EMP, permanent backup shield reduction and neutral Terminator objective policy remain intact.

The background follows the trial survivor from Calibration(levels1–10, including Mirror/superboss), through a breached perimeter into Containment(11–20), Human Services(21–30), Research(31–40), and Continuity(41–50).56 room records include the hidden finale. Difficulty-dependent people/records use manufactured traces and never consume combat randomness or alter saves, collisions, enemy plans or damage. Props and numbered cells remain matched across modes. Human figures are background scenes, not recruited allies. The existing factory explosions and left exit receive a matching final wall record.

278 focused checks pass: all224 room/difficulty combinations render finite geometry, preserve trial/state, withhold future preview records and switch to the exit ending; chapter boundaries match actual roomIndex, and harder modes have monotonically fewer survivor appearances while retaining a final lab operator. Hard/Terminator real-beam checks both confirm25% once per blast. Two unchanged-controller full routes, Normal/Terminator seed11/.28s/60-death budget, complete with9/19 deaths.

Browser QA inspects all five background motifs and Normal/Terminator comparisons in an explicitly labeled local rendering proof. Ordinary UI imports of normally reached level12 checkpoints verify the actual phone-width scene, movement/attacks/flight, and warning priority over ambient records. The final cached build is checked after its preview server is stopped. No physical-device or new full-bait win-rate claim is made. Bounded evidence stays outside the public site.

## Release 26 / autonomous factories and live superboss feedback

Research is now machine computation/routing infrastructure, with survivor belongings restricted to service voids. Continuity shows four-to-six robot assembly stations, conveyors, construction cranes and an expanding perimeter that progressively exposes trees, rain and sky. Background rendering remains independent of combat RNG, plans, damage and saves. Combat populations remain unchanged.

Superbosses now keep per-core live feedback. A successful delivery from the same family queues a warned physical reposition after7/6/5/4 hits on Easy/Normal/Hard/Terminator, with an eight-second inter-hit window. Delivery serials deduplicate chains and splash; ongoing corrosion/rocket exhaust ticks are not new deliveries. Main weapons, dash strikes, AP rounds, flame and magnetic powers participate. Repositions cycle break-range/cross-over/change-height, warn for at least0.6s, last at most0.75s after the warning and retain status/leg penalties. No immunity, HP, resistance or structural-damage values change.

A whole volley or multi-stage combo is one outcome. Actual human HP/armor damage marks success. After4/3/3/3 consecutive misses the core queues a different authored combo, using the current observed position/posture. Ally-safe held fire has no ticket. Recent outcomes cap at12, pending attempts at8. Reactions wait for committed combos, normal combo recovery, beams/recharge and disabling; stale plans expire. Objective EMPs clear outstanding shot outcomes. Button/antenna reboot remains8s; backup shields and Hard/Terminator25% structural beams remain unchanged. Demo and ordinary enemies do not acquire this controller.

289 focused checks pass, including eleven new feedback/factory checks, real primary-hit and projectile attribution, one-ticket spread fire, held-safe volleys, success reset, distinct executed combos, movement warning/bounds/status priority and objective/laser recovery, and eventual replanning through normal recovery even without prior player samples. All224 difficulty/chamber backgrounds render finite geometry without changing combat state.

Eight paired input-driven50-level runs use the unchanged pilot, seeds11/71,0.28s decisions and a60-death limit:

| Mode | Before deaths | Release26 deaths | Actual movement changes | Actual attack switches |
| --- | --- | --- | --- | --- |
|Easy|1 /2|2 /1|7 /6|0 /1|
|Normal|9 /9|6 /10|9 /8|1 /0|
|Hard|15 /16|18 /17|13 /8|0 /2|
|Terminator|19 /17|19 /17|14 /11|3 /0|

Every route completes. These are two seeds of one automated strategy per mode, not human win rates, a deathless clear, or fresh proof of the full late bait sequence. A boss that lands attacks regularly need not switch families. Feedback counters were observed on actual spawned cores during these runs; they were not inferred from rule availability. The early AP concern remains separate in issue51.

Browser QA uses normally reached entry checkpoints through ordinary local save import. Hard30 phone-landscape checks cover held flight, attack, weapon switching, flight+pointer fire and the paused skill tree. Environment comparison views are explicitly labeled rendering proofs with no combat or modified save. Existing multi-pointer unit checks pass; physical phone feel remains unverified. Final source is precached under v26-feedback-4 and checked with the owned server stopped.

## Release 27 / boss warning and focused encounter validation

A cross-over move near either arena wall could warn in the opposite horizontal direction from its actual, wall-clamped destination. The arrow now follows that committed destination. The regression fails on Release26 and passes on both walls after the fix. No movement target, timing, damage, resistance, learning threshold, population or resource value changes.

292 tests pass. A focused input-driven comparison uses normally reached entry checkpoints from a completed Hard and Terminator route (seed11,0.28s decisions). Encounters20/40/50 use fresh seeds19/79 and slower0.4s decisions, testing direct combat, enemy-destroyed cover→button→backup, and antenna→cover→button→backup at40/50:32 encounters per build. Every encounter trace, including ending HP/armor/ammo, objective events and boss feedback counters, is identical between Release26 and the warning fix. Those runs observe53 reposition commitments and138 attack-family revisions. A separate30 direct encounters across all five milestones observe98 reposition commitments with matching warning direction before and after; the targeted wall fixture catches the uncommon mismatch that these routes did not reach.

The same32 encounters also run against the pre-feedback Release25 engine. On Terminator, direct combat clears6/6 both before and after; level20 cover clears2/2 in both. At40, both-defense clears change2/2→1/2 while cover-only changes0/2→1/2. At50, neither bait strategy clears in either build, although three of four current attempts reach the button. Hard clears only one of six direct attempts and none of the bait attempts in either build. These are small samples from one imperfect automated controller with carried resources, not human win rates or proof that late baiting is broadly balanced. The user-directed25% structural beam damage remains intact. Early AP/core balance stays separate in issue51; slower human/device testing remains a follow-up.

Phone-width390px local UI checks cover real reached Terminator40 and Hard40 superbosses, held flight/fire, approach movement, quick weapon changes, power cycling/use, and the paused skill tree. Keyboard+pointer combinations are used for overlapping holds; this is not physical multitouch-device proof. The final cache is v27-telegraph-2. Final server-stopped reload and cached boss input are checked separately. No new human full-boss victory or deathless-run claim is made.

The required adjacent offline fix prevents an installer from filling a new release cache with fresh-but-stale HTTP-cache responses. The old installer reproduced this locally: the updater finished, but the menu and subsequent server-off reload still showed Release26. Precache now uses explicit reload requests for every asset. Existing offline test fixtures accept real Request objects, and two new checks cover stale HTTP-cache replacement plus failed-download preservation of the previous offline release. Ordinary UI update on that same browser origin now shows Release27; saved runs are preserved. This change is required for the warning correction to reach installed clients reliably.

## Release 28 / earned late defense feedback

Scope: levels30/40/50 Hard and Terminator superbosses. A charged beam that damages living neutral structure armor without touching the human earns6s Hard /3s Terminator core recovery and same-duration interruption of the support relay. Cyan FEEDBACK identifies the opening. Next-laser availability after that recovery is3.8s/2.8s; normal combo scheduling still applies. Ordinary recovery remains2.5s/1.65s with9s/6.5s cooldown. No stacking, rewards from ruins, or reward for tanking. Existing hazards persist. Antenna destruction retains the8s full reboot; future late support calls use one bot and1.5× Hard /1.25× Terminator intervals. Finite budgets/caps and individual enemies remain unchanged.

Both modes keep25% max structural armor per blast (minimum180). Core HP/resistance,85% incoming damage during recovery, permanent backup shield reduction, single-use8s button, human armor/health and finite resources are unchanged. Easy/Normal, Demo and earlier milestones retain their rules.

Paired probes use two normally reached saved entry checkpoints per difficulty (routes11/71), preserving carried resources. Each entry is replayed without hidden HP/enemy/victory edits. A strict sequence requires both structures actually finished by charged lasers, one button use, positive damage on backup and a surviving clear. Mixed clears may use ordinary weapons alongside baiting. Two checkpoint routes are not independent human players and can have duplicate builds.

| Model / seeds | Hard both-objective clears before → after | Terminator both-objective clears before → after |
|---|---:|---:|
|Tuning, fast .28s,12/72/84, levels40/50|0/12 →6/12|2/12 →8/12|
|Fresh seeds, fast .28s,19/79/109/199/271/307, levels40/50|0/24 →10/24|4/24 →20/24|
|Fresh seeds, careful .4s, same levels|0/24 →0/24|5/24 →8/24|

On the fresh fast probe, strict two-structure laser/button/backup completions are2/24 Hard and8/24 Terminator after tuning; before0/24 and2/24. Tuning adds four strict completions per mode. The slower careful probe has no strict two-structure completions: it often mixes fire into defenses or fails positioning/finishing. This remains a timing-sensitive route, not broadly proven accessible balance. Hard50 cover-only improves0/12→2/12 and Terminator50 cover-only0/12→6/12 on the fresh fast probe. There are still many losses. Fresh fast Terminator50 both-objective wins take115–136s versus32–52s direct; most lose all armor and some survive with only2.5–6.7HP. Efficient direct burst combat remains stronger and is a separate balance concern.

The pilot was corrected before paired baselines: it previously selected locked AP in Hard, used thermal Laser instead of electrical Arc projector on wet bots, failed to evade visible long-range lasers and missed support at the wrong altitude. All reports above share the corrected pilot hash and identical checkpoints per comparison. Two input policies and two decision delays expose sensitivity; no human win-rate, physical multitouch or full human victory claim follows from these simulations.

305 focused tests pass, including clean/tanked/missed/dead-defense beam cases, unchanged early modes, finite recovery/cooldown/vulnerability, persistent hazards, paused timers, post-antenna support budgets and controller regressions. Eight full50-level standard-controller routes complete (seeds11/71,.28s,60-death cap); paired deaths are Easy2/1→2/1, Normal6/10→6/10, Hard18/17→16/18, Terminator19/17→18/17. These are completion checks, not retry targets for humans. Local reached Hard40/Terminator50 UI checks cover flight/fire, quick weapon/power changes and paused skills at phone dimensions. Server-stopped reload, saved Hard40 combat and Release28/Ready offline pass with no console errors. The responsive browser capture/input mapping limits direct held-touch validation; physical multitouch and human full-boss wins remain unverified.

## Release 29 / readable baiting and slower-controller audit

Locked lasers mark actual entry points on living neutral armor with an orange diamond. Markers use the collision bounds, do not track or redirect the committed beam, add no text, and vanish on recovery/ruins. They indicate damage rather than shelter: beams still pierce the defenses and players must dodge for feedback. Combat rules and numbers remain Release28.

The previous slow result combined .4s decisions with a different input policy. Two crossed72-attempt audits of fast/.4 and careful/.28 confirms both policy and delay matter. Two additional controller defects were then corrected: full-length movement holds could oscillate across the switch interaction radius; floor prediction omitted gravity while releasing electrical fire. Switch taps are scheduled at a decision and released on a timer without a new observation. Both policies now release electrical fire before a predicted pool landing. Neither correction is an automatic aid in the actual game.

With the same two normally reached entries and seeds19/79/109/199/271/307 at .4s careful decisions, cover-only clears improve Hard40 0→6/12, Hard50 0→3/12, Terminator40 4→10/12 and Terminator50 0→4/12. Both-objective clears become8/12,0/12,12/12,2/12 respectively (previously0,0,8,0). Hard40 has8 strict laser/laser/button/backup clears. Other mixed clears can use ordinary attacks to finish armor; do not label them all pure laser-bait completions. Three Hard50 both-objective attempts remain alive at the180s probe cutoff; nine die. The game has no corresponding encounter time limit. This is improved measurement, not proof that slow late Hard is broadly balanced.

A paired144-encounter check using the same corrected pilot and checkpoints against Release28 and Release29 produces identical complete result rows. This isolates the new visible markers from combat difficulty.310 tests pass, including live beam/marker agreement, render purity, ignored ruins/misses and real Hard40/Terminator50 engine fights using independent pointer flight/fire/steering, mid-hold weapon changes, pointer cancellation and pause clearing. These are synthetic pointer integration checks, not physical-phone evidence. Existing full-route evidence remains applicable because combat is unchanged.
