# Countermeasure

Play at https://daliu.github.io/countermeasure/?mode=campaign.
Static, installable, offline JavaScript game. No LLM, backend, account, external assets or build step. Includes original synthesized chiptune music.

## Modes and saved runs

Demo retains its original 11 encounters and version 1 save format. Campaign has 50 levels, with a boss/superboss pair at each ten-level milestone. Their saves remain independent. The installed app reopens the last selected mode.

Campaign version 3 saves track room phase, entry build, resources and a sequential-clear record. Version 2 Campaign files migrate automatically, preserving unlocked levels and builds. The new `countermeasure.campaign.v3` storage key copies the earlier Campaign save on first launch; the original key remains intact so an older running tab cannot overwrite the new format. Existing saves remain playable; start a **new run** to qualify for the new deathless route. Old checkpoints do not establish completion of the newly added boss pairs. Starting a new run keeps level unlocks but retires the older checkpoints from deathless qualification; deaths also invalidate earlier perfect prefixes. A new run saves a fresh level-one checkpoint immediately. Save files are local player data, not an anti-cheat system.

Menu → level select resumes unlocked entry checkpoints. Export before moving devices or clearing browser data. No cloud sync. The fictional subject register is shared; trial numbers count deaths in the selected run.

## Rooms and equipment

Clear a chamber and its right-hand gate opens. Walk or fly through to continue; the camera follows across connected rooms. You can pause and rewire while crossing the cleared room. Entry checkpoints are saved before the next fight. Crossing a gate repairs some health/armor; health is at least 70 on entry.

All four weapon families automatically equip newly unlocked stages: II / III at Campaign levels 6 / 16 (Demo waves 3 / 5). Earlier stages stay selectable; plain water still dilutes chemical drones. Automatic upgrades happen once per unlock, so choosing an older tool remains meaningful. A visible, clickable unspent-points notice opens the paused loadout; new point grants pulse it and announce availability. Skill points cap at 12 of 15 ranks.

Normal Campaign rooms retain defenses, movement learning, offensive learning, flood/booted shock teams, metal/plastic/chemical drones, darkness and orchestrators. Mech I–V upgrades arrive with the regular bosses at levels 10, 20, 30, 40 and 50. A missed pod is salvaged before the following superboss, ensuring flight is available.

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

Clear all 50 levels and all five boss pairs in sequence, with zero deaths, to open the vault instead of ending immediately. Three airborne superbots coordinate attacks. Their shutdown channels are marked **EMP / RADIO / ELECTRIC**. Defeating the trio starts the factory explosions and left-door escape. A revealed vault can be retried; eligibility is earned by the preceding deathless clear.

The vault equips the ultimate loadout:

- **Highway Lamp:** long, heavy, slow sweep; knockback and temporary disabling.
- **Diamond Chain-saw:** stronger cutting and exposed-wiring combos.
- **Tesla laser / earlier electrical stages:** disable the electric core. Choosing the laser remains available.
- **Acid-glue polymer:** strong damage and a substantial slow even against resistant hardware; repeated hits bind.
- **Localized EMP:** disables one core for six seconds, and also locks your electrical weapons and magnetic power for five seconds. Radio shuts down the second channel; electric hits shut down the third.
- **Ultra thermite boost:** double-tap jump, consuming 20 of 100 fuel. Rocket exhaust damages nearby robots below you and opens their armor to physical follow-ups for four seconds.
- **Ultra armor:** 400 armor capacity plus broad impact, heat, shock, liquid and projectile damage reduction.
- **Armor-piercing explosive rounds:** 18 rounds per attempt, with blast damage and partial penetration. Fuel/ammo refill on retry, not during the fight.

## Controls

WASD, Enter/click attack, Shift dash, 1–4 weapons, Q/E cycle weapons. Hold W to fly in a mech. **5–8** select normal powers; hidden gear adds **9 EMP / 0 explosive rounds**. **F** fires the selected power; **G** cycles available powers. **Double-tap W / Jump** for the ultimate boost.

Touch controls support independent movement, Fly, Attack and power holds. The ↻ button cycles powers without opening a menu. Skill tree/Pause opens the freely reconfigurable loadout. Fullscreen preserves the same coordinates and responsive camera.

## Local learning and offline use

The local model tracks attack mix and damage effectiveness, spacing, stationary time, jumps, dashes and ground shocks. Successes and deaths update it. One hardware slot changes between attempts/waves; live hardware does not swap in response to held inputs. Cognition increases across the curriculum with bounded reaction times and readable windups. Recent history is capped at 12 records; saved levels are capped at 50.

Install through Menu → Install game. On iPhone use Safari → Share → Add to Home Screen. Wait for **Ready offline** before disconnecting. The service worker only controls `/countermeasure/`; existing clients use Menu → Update game to activate a waiting release.

## Development and validation

Serve the repository root with a static HTTP server; open `/countermeasure/?mode=campaign`. Run `node --test tests/countermeasure*.test.mjs`. New runtime files must be listed in `sw.js`, with a fresh cache version per release. The room layer lives in `expedition*.mjs` and reuses the existing Campaign combat engine; Demo rules and saves stay separate.

Checks cover migration/save refusal, automatic upgrades, physical gate traversal and camera continuity, five boss pairs, resistance/crits, exact anticipation quotas, destructible defenses, bounded reinforcements, a full sequential route/deathless gate, ultimate resource interactions, real-control first-superboss victory, finite simulations, and offline caching. Late browser QA uses ordinary imported synthetic checkpoints on a separate local origin. Physical-phone acceptance and full-length human balance testing remain follow-ups.
