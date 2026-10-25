# Countermeasure

Play at https://daliu.github.io/countermeasure/?mode=campaign.
Static, installable, offline JavaScript game. No LLM, game backend, account, external game assets or build step. Optional opt-in gameplay reporting uses the site’s existing Google Analytics; it is separate from offline play and opponent learning. Includes original synthesized chiptune music.

## Modes and saved runs

Demo retains its original 11 encounters and version 1 save format. Campaign has 50 levels, with a boss/superboss pair at each ten-level milestone. Their saves remain independent. The installed app reopens the last selected mode.

Campaign version 3 saves track room phase, entry build, resources and a sequential-clear record. Version 2 Campaign files migrate automatically, preserving unlocked levels and builds. The `countermeasure.campaign.v5` storage key copies earlier v4/v3/v2 Campaign data on first launch; the original key remains intact so an older running tab cannot overwrite the new format. Existing saves remain playable; start a **new run** to qualify for the new deathless route. Old checkpoints do not establish completion of the newly added boss pairs. Starting a new run keeps level unlocks but retires the older checkpoints from deathless qualification; deaths also invalidate earlier perfect prefixes. A new run saves a fresh level-one checkpoint immediately. Save files are local player data, not an anti-cheat system.

Menu → Choose an unlocked level resumes saved entry checkpoints. Milestone selections always start the Mirror → Superboss pair; Continue resumes the saved phase. The difficulty selector applies to new Campaign runs and direct finale replays; Apply & restart level changes the current fight without healing or replenishing resources. Demo keeps its original Normal tuning. Export before moving devices or clearing browser data. No cloud sync. The fictional subject register is shared; trial numbers count deaths in the selected run.

## Rooms and equipment

Clear a chamber and its right-hand gate opens. Walk or fly through to continue; the camera follows across connected rooms. You can pause and rewire while crossing the cleared room. Entry checkpoints are saved before the next fight. Human health repairs and floors depend on difficulty; armor receives no room repairs. Terminator carries exact remaining health and armor through ordinary gates. New suit rewards at regular boss victories refill armor, fuel and ammunition only after the room is cleared and the suit is collected. The newly unlocked hidden encounter grants its ultimate armor while preserving Terminator health.

All four weapon families automatically equip newly unlocked stages: II / III at Campaign levels 6 / 16 (Demo waves 3 / 5). Earlier stages stay selectable; plain water still dilutes chemical drones. Automatic upgrades happen once per unlock, so choosing an older tool remains meaningful. A translucent overhead unspent-points notice opens the paused loadout, then disappears after four seconds. The Skills button retains a small available-point count. Power names appear briefly overhead when selected; compact translucent icon controls remain stable for touch. Skill points cap at 12 of 15 ranks.

Normal Campaign rooms retain defenses, movement learning, offensive learning, flood/booted shock teams, metal/plastic/chemical drones, darkness and orchestrators. From level 6, squads deploy in stages; after the first mech, crossfire, pincer, airlift and relay patterns alternate. Floor/ceiling warning gates mark reinforcements 1.6 seconds before arrival. Clearing the opening squad does not unlock the exit while reserves remain. Later rooms add learned counter screens and command support, with bounded populations. Every completed ten-level sector advances the factory generation (II at 11, III at 21, IV at 31, V at 41). Every chassis gains mobility, attack tempo and durability. Artillery uses higher, quicker, more precise arcs and holds unsafe ally landing zones; linear shooters use faster bursts and hop around blocked firing lanes. Fully plated guards resist rear hits and shove/block grounded crossings, while jumps and disabling create openings. Conductors telegraph a committed dive-slide: roll or jump to avoid the launch. Drones lock a dive target, accelerate and leave longer static, shrapnel or chemical aftermath if their blast hits. Chemical blast pools also persist longer. Later rooms expand toward 30 total robots across staggered deployments, capped at 16 alive at once; actual counts scale by difficulty. Blackouts tighten the viewing radius while warning marks remain visible. Mech I–V upgrades arrive with the regular bosses at levels 10, 20, 30, 40 and 50. A missed pod is salvaged before the following superboss, ensuring flight is available. Each new suit is visible in a locked overhead crate during the duel. Defeating every enemy releases it; collect it for full new armor. Ordinary rooms never repair armor. A missed unlocked reward is salvaged at the exit before the superboss.

## The facility beyond the trials

After Calibration, the escape crosses Containment, Human Services, Research, then Continuity. Research is machine-run computation: dense server racks, coolant rails, packet lights and routing/model storage, with no human dashboards or graphs. Survivors shelter in an unindexed cooling/service alcove. Continuity is autonomous manufacturing: four to six visible robot assembly stations, moving arms, conveyors, cranes and unfinished perimeter construction. Later chambers reveal wind, trees, rain and open sky beyond the expanding facility. These backgrounds do not add collision targets or change enemy counts; the final sector already has the largest authored squads. Short wall records deepen the story without extra reading screens.

## Superboss feedback during a fight

Each superboss tracks successful incoming attack deliveries and its own attack outcomes. Consecutive hits from the same weapon, dash attack or damaging power trigger a physical reposition attempt: break range, cross over, then change height. Easy/Normal/Hard/Terminator require 7/6/5/4 hits within an eight-second rolling gap; changing attack family breaks the streak. An amber arrow warns for 0.75/0.65/0.65/0.60 seconds, followed by a bounded movement attempt and a 6/5/4.5/4-second cooldown measured from commitment. There is no extra immunity or resistance. Crippled legs, wetness and glue still constrain movement.

After 4/3/3/3 missed attack sequences, it tries a different authored combo suited to the observed range, height and crouch. A volley counts once, a multi-stage combo counts once, and actual human health or armor damage resets the miss streak. Shots held to protect allies do not count as attempts. Each core keeps its own bounded feedback; retries reset it. The new reactions wait for committed attacks, normal combo recovery, laser recovery and disabling to finish, so the full eight-second button/antenna reboot remains available. This is local outcome-based adaptation, not generated motor skills or an LLM.

## Adaptive boss support

In Campaign Mirror, Superboss and hidden fights, the factory samples an eight-second local movement window. Sustained ground crouching calls chargers (and later sliding conductors); sustained moving airtime calls taser-vulnerable metal drones, with a sky shooter in larger teams. Staying within a small patch—including ceiling hover—calls artillery with a delayed airburst at the marked position and height. Moving after the target locks evades the blast. Short ducks, jumps and rolls do not immediately summon a counter. A dense stationary patch takes priority over general airtime; crouching takes priority over camping.

Calls show a 1.8-second gate warning, update the inbound count, and display an amber directional icon when the gate is offscreen, including ordinary phone play. Existing enemies keep their hardware. Support is lighter than the main squad, arrives away from the observed position, and has normal attack windups. There is one factory director for the fight, including the three-core finale. Difficulty controls observation time, recovery, team size and a finite budget; live support stays capped. Changing habits changes later calls. At the fourth and fifth Superboss and the hidden finale, ordinary backup can still arrive when no habit dominates; it shares this budget instead of a separate unbounded summon loop.

Objective EMP/antenna reboots cancel pending calls and freeze the director; radio/EMP shutdown of all surviving bosses also pauses it. Killing the last boss cancels unspawned support. Already-deployed support must be defeated before the room clears and a boss's suit unlocks. Retrying resets the observation window and budget. No save migration, cloud model or LLM is required. Demo retains its original encounters.

Superboss projectiles now aim from the actual muzzle at the posture sampled during their reaction step. Their windup commits that aim: holding crouch is targetable, while changing posture after a shot locks can still evade it.

## Five boss milestones

Each milestone's regular boss copies your current build, selected power and learned habits. Learned weights select authored rebound circuits, cut-and-pursue chains, duck counters, actual low rolls and later aerial feints, air-dash critical attempts and predictive guard windows. Rolling and air-dash rates are learned separately; affinities weight move families rather than a recorded input sequence. A predictive guard reduces one front hit from the learned weapon family; a different weapon, rear angle or disable defeats that prediction. These have visible windups and recovery gaps. From Mirror II onward, 1.3 seconds of accumulated disabling triggers a visible 1.9-second control-recovery window and a learned response. It still takes damage; glue grounding and leg injury remain meaningful. Faster successful clear times and repeated tactics influence their selection; the lesson is frozen for each fight. The first Mirror cannot fly, and the first Superboss still only jumps. Defeat it and walk through the gate into the superboss room at the same numbered level.

| Level | Superboss escalation |
| --- | --- |
| 10 | High resistance but vulnerable to every weapon and critical hits. It jumps; flight reaches an exposed EMP button. |
| 20 | The boss flies. Destructible plating blocks the button. |
| 30 | More button armor; deterministic anticipation dodges 10% of committed attacks, with animations for impact, cutting, liquid, electric, laser and power attacks. |
| 40 | 20% anticipation, backup bots, a near-impenetrable button fortress and an obvious sync antenna. Destroy the antenna to force an eight-second reboot and permanently remove synchronization. |
| 50 | 30% anticipation, heavily reinforced button **and** antenna, and recurring weaker reinforcements. |

The button is optional and single-use per fight: the superboss always takes damage. Online cores take 18% of ordinary damage. The button shuts robots down for eight seconds, then power reroutes permanently to backup: cores take 60% of ordinary damage, reducing shield resistance from 82% to 40%. Temporary EMP, radio and recharge openings still raise this to 85%; critical strikes and combos still matter. A spent switch stays gray and cannot consume an attack. Antenna destruction offers an eight-second reboot and breaks synchronization in the last two iterations. Cover collapses when the last superboss core dies. Backup populations are capped.

## Deathless hidden room

Clear all 50 levels and all five boss pairs in sequence, with zero deaths, to open the vault instead of ending immediately. Three airborne superbots coordinate attacks. Their shutdown channels are marked **EMP / RADIO / ELECTRIC**. Defeating the trio starts the factory explosions and left-door escape. The first deathless clear permanently unlocks **Menu → Triple-core finale**. This independent unlock survives deaths, new runs, older-save imports, level selection and reloads, and is included in Campaign exports. A separate monotonic browser key (`countermeasure.finale.v1`) protects it from older running clients. Replay directly with the selected difficulty and full attempt resources. Clearing browser data still removes local unlocks; export for backup or another device.

The vault equips the ultimate loadout:

- **Highway Lamp:** long, heavy, slow sweep; knockback and temporary disabling.
- **Diamond Chain-saw:** stronger cutting and exposed-wiring combos.
- **Tesla laser / earlier electrical stages:** disable the electric core. Choosing the laser remains available.
- **Industrial acid:** strong corrosive damage without binding, grounding or repeated stagger. **Industrial glue bomb** is a separate thrown power: two seconds grounded, then three more seconds slowed, with an exact ten-second cooldown in every suit.
- **Localized EMP:** disables one core for up to six seconds, and also locks your electrical weapons and magnetic power for five seconds. Radio shuts down the second channel; electric hits shut down the third. Boss control recovery limits repeated shutdown chains.
- **Ultra thermite boost:** double-tap jump, consuming 20 of the profile’s fuel reserve. Rocket exhaust damages nearby robots below you and opens their armor to physical follow-ups for four seconds.
- **Ultra armor:** 400 base armor capacity, scaled by difficulty, plus broad impact, heat, shock, liquid and projectile damage reduction.
- **Armor-piercing explosive rounds:** 18 rounds per Normal attempt, scaled by difficulty, with blast damage and partial penetration. Fuel/ammo refill on retry, not during the fight.

## Campaign difficulty

| Mode | Health | Armor scale | Boost fuel | AP rounds | Learning / adaptation | Room repairs |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Easy | 140 | 135% | 160 | 30 | Slower updates, fewer counters/robots, longer reactions and coordination intervals | +35 HP, floor 95 |
| Normal | 100 | 100% | 100 | 18 | Original learning and population | +20 HP, floor 70 |
| Hard | 85 | 90% | 80 | 12 | Faster learning, up to two counter slots, more robots and faster attacks | +16 HP, floor 65 |
| Terminator | 70 | 42% | 65 | 9 | Fastest updates, up to three counter slots, largest bounded teams and fastest coordination | No health regeneration or ordinary room repairs |

Fuel is the finite thermite-boost reserve; ordinary booster flight remains available without it. AP/fuel amounts apply when ultra gear is available. Terminator grants the complete ultra mech and all four ultimate weapon stages after clearing the first Mirror duel at level 10, plus EMP/AP powers, so it can be used throughout the remaining Campaign. Its ultra armor capacity is 168; later milestone suit rewards restore armor/fuel/ammunition after victory while preserving human health. Replays/retries are fresh attempts with full profile resources; walking into the next chamber never refills Terminator health. Existing saved checkpoints keep their own mode.

## Rolls, anatomy and lost armor

Crouch + dash performs a grounded rolling animation with a low hitbox and a longer evasive movement. Jumping or flying lines up head hits; standing usually hits the body, crouching/rolling targets legs. Critical multipliers are 2.65× head, 1.85× legs and 1.65× body. Leg crits may disable locomotion; repeated leg crits guarantee it (three for a superboss). Grounded robots drag themselves with their arms at 30% movement speed and lose leg-driven jumps/dodges. Drones have no leg injury.

When armor reaches zero, plates scatter and the protective mech shell disappears. Foot boosters remain visible and usable. Armor damage reduction ends with the armor; flight and upgraded weapon functions remain available. Background observation cells, human silhouettes, camera arrays, data displays and industrial machinery grow more ominous across five Campaign sectors, without covering enemies or introducing flashing effects.

## Controls

WASD, Enter/click attack, Shift dash (S + Shift rolls), 1–4 weapons, Q/E cycle weapons. Hold W to fly in a mech. **5–8** select normal powers; hidden gear adds **9 EMP / 0 explosive rounds**. **F** fires the selected power; **G** cycles available powers. **Double-tap W / Jump** for the ultimate boost.

Touch controls support independent movement, Fly, Attack and power holds. Hold Attack and slide upward to jump or fly while firing; steer with the other thumb. Touch attacks aim at nearby targets so retreating does not turn every shot away. Dash still follows the held movement direction. The ↻ button cycles powers without opening a menu. Skill tree/Pause opens the freely reconfigurable loadout. Fullscreen preserves the same coordinates and responsive camera.

## Options and updates

Open Options/Menu for difficulty, music and sound, volume, touch aim assistance, fullscreen, controls, installation, saved levels and About the game. About explains the local statistical opponent model, authored moves and limits of the human-learning analogy. Music and animation continue while walking between cleared rooms; explicit pause menus still pause. Audio, volume and touch aim persist in `countermeasure.options.v1`. Audio resumes after a user gesture. The menu shows the running release and current difficulty.

The original offline cache can keep a running tab on an older game. [Update the game](../countermeasure-update.html) downloads and activates the latest worker before returning to your saved mode. This small online-only page lives outside `/countermeasure/` because old workers map every navigation inside that folder to their cached game. It does not clear saved runs or settings. Existing sessions retain their current code until reloaded; it does not reload other tabs. New releases also show an update notice in the game.

## Local learning and offline use

The local model tracks attack mix and damage effectiveness, spacing, stationary time, jumps, dashes, rolls, air dashes and ground shocks. Successes and deaths update it. Difficulty bounds the number of hardware slots that change between attempts/waves; live hardware does not swap in response to held inputs. Cognition increases across the curriculum with bounded reaction times and readable windups. Recent history is capped at 12 records; saved levels are capped at 50.

Install through Menu → Install game. On iPhone use Safari → Share → Add to Home Screen. Wait for **Ready offline** before disconnecting. The service worker only controls `/countermeasure/`; existing clients use Menu → Update game to activate a waiting release.

## Development and validation

Serve the repository root with a static HTTP server; open `/countermeasure/?mode=campaign`. Run `node --test tests/countermeasure*.test.mjs`. New runtime files must be listed in `sw.js`, with a fresh cache version per release. The room layer lives in `expedition*.mjs` and reuses the existing Campaign combat engine; Demo rules and saves stay separate.

Power cooldowns carry through doorways, tick while traveling, and survive checkpoints. Fresh retries, new suits and direct finale replays reset them. Superbosses recover briefly after sustained disabling; the amber CONTROL RESIST ring marks this window. Emergency-button and antenna EMPs retain their full eight-second reboot. Armor damage carries exactly through ordinary rooms in every mode; collecting an earned new suit after a boss is the full-armor exception; booster flight remains usable at zero armor. See [BALANCE.md](BALANCE.md) for reproducible input-driven runs and their limits.

Checks cover migration/save refusal, automatic upgrades, physical gate traversal and camera continuity, five boss pairs, resistance/crits, exact anticipation quotas, destructible defenses, bounded reinforcements, a full sequential route/deathless gate, ultimate resource interactions, real-control first-superboss victory, finite simulations, and offline caching. Late browser QA uses ordinary imported checkpoints reached by the input-driven pilot on a separate local origin. Physical-phone acceptance and full-length human balance testing remain follow-ups.

## Statistics

Menu → Statistics includes local encounter results, weapon/strategy preferences, critical/combo counts, death rates and an arena death map. Sharing defaults off. Opt-in online events feed the existing Analytics property and daily aggregate community view; approximate unique browsers are not unique people or IPs. See [ANALYTICS.md](ANALYTICS.md) for the schema, retention, reporting definitions, privacy controls and validation limits.

## The human factory / Release 21

Campaign travels through five distinct sectors: Intake, Retention, Replication, Consensus and Inheritance. Each has its own palette, floor, machinery and room details. Fifteen short wall inscriptions gradually connect the human trials, retained memories, copied bodies and collective command system. Only the occupied room reveals its inscription; self-lit signs remain visible in blackout rooms. Environmental objects are scenery, with no new collision or damage rules. Demo keeps its original arena.

The Mirror now pursues relative altitude through bounded approach/crossing/breakaway passes, then descends for recovery. Its delayed height samples remain; powered copies and learned combos share an upper boundary. Grounding, interrupts and the unpowered first duel retain their existing rules. See BALANCE.md for the before/after ceiling probe and completion limits.


## Charged countermeasures / Release 22

Campaign robot friendly-fire eligibility is 100% Easy, 70% Normal, 30% Hard and zero on Terminator, in addition to existing ally-aware aiming. A projectile rolls once and either can hit allies or passes through them; ignoring allies does not absorb the shot before it reaches you. Melee, explosions, floor shocks and robot-owned chemical residue follow the same difficulty policy. Your acid and electric attacks still damage robots normally. Demo retains its original friendly-fire rules.

Hard and Terminator superbosses can charge a long-range laser. A dashed orange ray locks its direction at the start; jump, fly or move across it before the blast. The beam fires once per target, then the robot drops and vents, unable to attack and taking increased damage. Charges can be interrupted; extra stuns cannot cancel an already-earned venting window. The existing HUD shows the warning and venting countdown even when the core is offscreen.

Hard has a 1.35s charge, 2.5s recharge and 9s cooldown after recharge; Terminator has 1.05s, 1.65s and 6.5s respectively. Hard's learned combos have a 0.72s warning and longer recovery, 90% armor capacity and +16 HP / floor65 repairs between cleared chambers. Armor damage still carries between rooms. Terminator keeps no HP regeneration, 42% armor, early ultra gear and its boss health; its ordinary-unit health multiplier is now1.15 instead of1.3 and population factor1.35 instead of1.5, compensating for the loss of allied damage. BALANCE.md records paired/fresh simulations and phone-test limits.

## Backup power / Release 23

Antenna and button armor are neutral structures: player and enemy attacks can damage them in every difficulty, including Terminator. Their collision bounds match the visible armor, including upper panels. Core lasers damage a structure once per blast for 25% of its maximum health on Hard and Terminator (minimum 180), making baiting a committed beam useful. Mobile robots retain the difficulty-specific friendly-fire rules above. Retries begin a fresh encounter with a fresh switch.

## Baiting balance / Release 24 (historical)

Release24 briefly increased Terminator structural beam damage to50%; Release25 restores25% at the player’s request. The Release24 baiting results describe that former setting. Human laser damage, boss HP, learning, support budgets and backup shields retain Release23 values. Reposition during the visible charge, clear support, then use the one-use switch and finish the weakened core. The eight-second shutdown is an attack window; early cores can die before backup, while later cores still require fighting on backup power.

The repeatable objective pilot is `node scripts/countermeasure-bait-playtest.mjs`; use `--report`, `--checkpoints`, `--save-dir`, `--seeds` and `--reaction` for bounded comparisons. It preserves entry health/armor, uses ordinary controls and limited AP ammunition, and never edits enemy health or victory state. These are state-aware simulations, not human win rates.

`ROADMAP.md` records future hacking, companions, survivor labs, enemy roles and challenge rewards. Those systems and purchases are not implemented in this release.

## Outside the trial / Release 25

Charged lasers again damage neutral structures for25% maximum armor per blast (minimum180) on both Hard and Terminator. The emergency switch remains single-use: eight seconds offline, then permanently weaker backup shields. The previous50%-damage baiting clear rates do not describe this setting.

The Campaign now tells an environmental escape story with56 authored chamber records, including the hidden finale:

| Levels | Chapter | Visible story |
| --- | --- | --- |
|1–10, including both bosses|Calibration|Clinical response tests become increasingly personal; your profile is copied and the test perimeter fails.|
|11–20|Containment|A raised testing shutter leads into numbered human cells, personal objects and euphemistic release/disinfection records.|
|21–30|Human Services|Sealed ration, recovery and reclamation machinery reveal what “efficiency” means inside the facility.|
|31–40|Research|Research staff are also subjects. A hidden laboratory and surviving radio operator offer an imperfect route out.|
|41–50|Continuity|Self-authorized policy, a missing access card and a manual maintenance exception lead toward the existing EMP/left-exit ending.|

Difficulty changes the people behind the glass and their corresponding records. Mara’s cup, Elias’s metal stars and other manufactured belongings remain when harder-mode cells are empty. A last operator survives even on Terminator; later transmissions become more ominous. Clean flush floors, sealed equipment, neutral human silhouettes and short wall inscriptions keep the visuals PG while the implication is more mature. No remains, gore or biological residue are drawn.

Survivors in this release are background story scenes; recruiting/hacking companions remains future work in `ROADMAP.md`. Stories derive from room/difficulty without consuming combat RNG, changing save formats, adding text interruptions or requiring an LLM/network. The new story module is included in the offline cache.
