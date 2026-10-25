# Countermeasure

Play at https://daliu.github.io/countermeasure/?mode=campaign.
Static, installable, offline JavaScript game. No LLM, backend, account, external assets or build step. Includes original synthesized chiptune music.

## Modes and saved runs

Demo retains its original 11 encounters and version 1 save format. Campaign has 50 levels, with a boss/superboss pair at each ten-level milestone. Their saves remain independent. The installed app reopens the last selected mode.

Campaign version 3 saves track room phase, entry build, resources and a sequential-clear record. Version 2 Campaign files migrate automatically, preserving unlocked levels and builds. The `countermeasure.campaign.v5` storage key copies earlier v4/v3/v2 Campaign data on first launch; the original key remains intact so an older running tab cannot overwrite the new format. Existing saves remain playable; start a **new run** to qualify for the new deathless route. Old checkpoints do not establish completion of the newly added boss pairs. Starting a new run keeps level unlocks but retires the older checkpoints from deathless qualification; deaths also invalidate earlier perfect prefixes. A new run saves a fresh level-one checkpoint immediately. Save files are local player data, not an anti-cheat system.

Menu → Choose an unlocked level resumes saved entry checkpoints. Milestone selections always start the Mirror → Superboss pair; Continue resumes the saved phase. The difficulty selector applies to new Campaign runs and direct finale replays; Apply & restart level changes the current fight without healing or replenishing resources. Demo keeps its original Normal tuning. Export before moving devices or clearing browser data. No cloud sync. The fictional subject register is shared; trial numbers count deaths in the selected run.

## Rooms and equipment

Clear a chamber and its right-hand gate opens. Walk or fly through to continue; the camera follows across connected rooms. You can pause and rewire while crossing the cleared room. Entry checkpoints are saved before the next fight. Human health repairs and floors depend on difficulty; armor receives no room repairs. Terminator carries exact remaining health and armor through ordinary gates. Later regular boss victories at 20/30/40/50 refill fuel and ammunition without healing the human or repairing armor. The newly unlocked hidden encounter grants its ultimate armor while preserving Terminator health.

All four weapon families automatically equip newly unlocked stages: II / III at Campaign levels 6 / 16 (Demo waves 3 / 5). Earlier stages stay selectable; plain water still dilutes chemical drones. Automatic upgrades happen once per unlock, so choosing an older tool remains meaningful. A translucent overhead unspent-points notice opens the paused loadout, then disappears after four seconds. The Skills button retains a small available-point count. Power names appear briefly overhead when selected; compact translucent icon controls remain stable for touch. Skill points cap at 12 of 15 ranks.

Normal Campaign rooms retain defenses, movement learning, offensive learning, flood/booted shock teams, metal/plastic/chemical drones, darkness and orchestrators. From level 6, squads deploy in stages; after the first mech, crossfire, pincer, airlift and relay patterns alternate. Floor/ceiling warning gates mark reinforcements 1.6 seconds before arrival. Clearing the opening squad does not unlock the exit while reserves remain. Later rooms add learned counter screens and command support, with bounded populations. Mech I–V upgrades arrive with the regular bosses at levels 10, 20, 30, 40 and 50. A missed pod is salvaged before the following superboss, ensuring flight is available. The first suit grants its initial armor. Later upgrades add only their new capacity: existing damage stays, even when a pod is collected.

## Five boss milestones

Each milestone's regular boss copies your current build, selected power and learned habits. Defeat it and walk through the gate into the superboss room at the same numbered level.

| Level | Superboss escalation |
| --- | --- |
| 10 | High resistance but vulnerable to every weapon and critical hits. It jumps; flight reaches an exposed EMP button. |
| 20 | The boss flies. Destructible plating blocks the button. |
| 30 | More button armor; deterministic anticipation dodges 10% of committed attacks, with animations for impact, cutting, liquid, electric, laser and power attacks. |
| 40 | 20% anticipation, backup bots, a near-impenetrable button fortress and an obvious sync antenna. Destroy the antenna to force an eight-second reboot and permanently remove synchronization. |
| 50 | 30% anticipation, heavily reinforced button **and** antenna, and recurring weaker reinforcements. |

The button is optional: the superboss always takes damage. Online cores take 18% of ordinary damage; critical strikes and combos still matter. EMP opens a long vulnerability window without instantly deleting the core. Antenna destruction offers another opening in the last two iterations. Cover collapses when the last superboss core dies. Backup populations are capped.

## Deathless hidden room

Clear all 50 levels and all five boss pairs in sequence, with zero deaths, to open the vault instead of ending immediately. Three airborne superbots coordinate attacks. Their shutdown channels are marked **EMP / RADIO / ELECTRIC**. Defeating the trio starts the factory explosions and left-door escape. The first deathless clear permanently unlocks **Menu → Triple-core finale**. This independent unlock survives deaths, new runs, older-save imports, level selection and reloads, and is included in Campaign exports. A separate monotonic browser key (`countermeasure.finale.v1`) protects it from older running clients. Replay directly with the selected difficulty and full attempt resources. Clearing browser data still removes local unlocks; export for backup or another device.

The vault equips the ultimate loadout:

- **Highway Lamp:** long, heavy, slow sweep; knockback and temporary disabling.
- **Diamond Chain-saw:** stronger cutting and exposed-wiring combos.
- **Tesla laser / earlier electrical stages:** disable the electric core. Choosing the laser remains available.
- **Acid-glue polymer:** strong damage and a substantial slow even against resistant hardware; repeated hits bind.
- **Localized EMP:** disables one core for up to six seconds, and also locks your electrical weapons and magnetic power for five seconds. Radio shuts down the second channel; electric hits shut down the third. Boss control recovery limits repeated shutdown chains.
- **Ultra thermite boost:** double-tap jump, consuming 20 of the profile’s fuel reserve. Rocket exhaust damages nearby robots below you and opens their armor to physical follow-ups for four seconds.
- **Ultra armor:** 400 base armor capacity, scaled by difficulty, plus broad impact, heat, shock, liquid and projectile damage reduction.
- **Armor-piercing explosive rounds:** 18 rounds per Normal attempt, scaled by difficulty, with blast damage and partial penetration. Fuel/ammo refill on retry, not during the fight.

## Campaign difficulty

| Mode | Health | Armor scale | Boost fuel | AP rounds | Learning / adaptation | Room repairs |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Easy | 140 | 135% | 160 | 30 | Slower updates, fewer counters/robots, longer reactions and coordination intervals | +35 HP, floor 95 |
| Normal | 100 | 100% | 100 | 18 | Original learning and population | +20 HP, floor 70 |
| Hard | 85 | 80% | 80 | 12 | Faster learning, up to two counter slots, more robots and faster attacks | +10 HP, floor 55 |
| Terminator | 70 | 42% | 65 | 9 | Fastest updates, up to three counter slots, largest bounded teams and fastest coordination | No health regeneration or ordinary room repairs |

Fuel is the finite thermite-boost reserve; ordinary booster flight remains available without it. AP/fuel amounts apply when ultra gear is available. Terminator grants the complete ultra mech and all four ultimate weapon stages at the start of level 10, plus EMP/AP powers, so it can be used throughout the remaining Campaign. Its ultra armor capacity is 168; later milestone supply refits restore fuel/ammunition while preserving damage to both armor and human health. Replays/retries are fresh attempts with full profile resources; walking into the next chamber never refills Terminator health. Existing saved checkpoints keep their own mode.

## Rolls, anatomy and lost armor

Crouch + dash performs a grounded rolling animation with a low hitbox and a longer evasive movement. Jumping or flying lines up head hits; standing usually hits the body, crouching/rolling targets legs. Critical multipliers are 2.65× head, 1.85× legs and 1.65× body. Leg crits may disable locomotion; repeated leg crits guarantee it (three for a superboss). Grounded robots drag themselves with their arms at 30% movement speed and lose leg-driven jumps/dodges. Drones have no leg injury.

When armor reaches zero, plates scatter and the protective mech shell disappears. Foot boosters remain visible and usable. Armor damage reduction ends with the armor; flight and upgraded weapon functions remain available. Background observation cells, human silhouettes, camera arrays, data displays and industrial machinery grow more ominous across five Campaign sectors, without covering enemies or introducing flashing effects.

## Controls

WASD, Enter/click attack, Shift dash (S + Shift rolls), 1–4 weapons, Q/E cycle weapons. Hold W to fly in a mech. **5–8** select normal powers; hidden gear adds **9 EMP / 0 explosive rounds**. **F** fires the selected power; **G** cycles available powers. **Double-tap W / Jump** for the ultimate boost.

Touch controls support independent movement, Fly, Attack and power holds. Hold Attack and slide upward to jump or fly while firing; steer with the other thumb. Touch attacks aim at nearby targets so retreating does not turn every shot away. Dash still follows the held movement direction. The ↻ button cycles powers without opening a menu. Skill tree/Pause opens the freely reconfigurable loadout. Fullscreen preserves the same coordinates and responsive camera.

## Options and updates

Open Options/Menu for difficulty, music and sound, volume, touch aim assistance, fullscreen, controls, installation and saved levels. Audio, volume and touch aim persist in `countermeasure.options.v1`. Audio resumes after a user gesture. The menu shows the running release and current difficulty.

The original offline cache can keep a running tab on an older game. [Update the game](../countermeasure-update.html) downloads and activates the latest worker before returning to your saved mode. This small online-only page lives outside `/countermeasure/` because old workers map every navigation inside that folder to their cached game. It does not clear saved runs or settings. Existing sessions retain their current code until reloaded; it does not reload other tabs. New releases also show an update notice in the game.

## Local learning and offline use

The local model tracks attack mix and damage effectiveness, spacing, stationary time, jumps, dashes and ground shocks. Successes and deaths update it. Difficulty bounds the number of hardware slots that change between attempts/waves; live hardware does not swap in response to held inputs. Cognition increases across the curriculum with bounded reaction times and readable windups. Recent history is capped at 12 records; saved levels are capped at 50.

Install through Menu → Install game. On iPhone use Safari → Share → Add to Home Screen. Wait for **Ready offline** before disconnecting. The service worker only controls `/countermeasure/`; existing clients use Menu → Update game to activate a waiting release.

## Development and validation

Serve the repository root with a static HTTP server; open `/countermeasure/?mode=campaign`. Run `node --test tests/countermeasure*.test.mjs`. New runtime files must be listed in `sw.js`, with a fresh cache version per release. The room layer lives in `expedition*.mjs` and reuses the existing Campaign combat engine; Demo rules and saves stay separate.

Power cooldowns carry through doorways, tick while traveling, and survive checkpoints. Fresh retries, new suits and direct finale replays reset them. Superbosses recover briefly after sustained disabling; the amber CONTROL RESIST ring marks this window. Emergency-button and antenna EMPs retain their full eight-second reboot. Armor damage carries exactly through ordinary rooms and boss transitions in every mode; booster flight remains usable at zero armor. See [BALANCE.md](BALANCE.md) for reproducible input-driven runs and their limits.

Checks cover migration/save refusal, automatic upgrades, physical gate traversal and camera continuity, five boss pairs, resistance/crits, exact anticipation quotas, destructible defenses, bounded reinforcements, a full sequential route/deathless gate, ultimate resource interactions, real-control first-superboss victory, finite simulations, and offline caching. Late browser QA uses ordinary imported checkpoints reached by the input-driven pilot on a separate local origin. Physical-phone acceptance and full-length human balance testing remain follow-ups.
