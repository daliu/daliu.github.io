# Countermeasure

Static, offline arena game at https://daliu.github.io/countermeasure/.
No LLM, API, account, external assets or build step. Original synthesized chiptune music is included.

## Modes and saves

- **Demo** (`?mode=demo`): the original 9 learning waves, Mirror, then EMP/escape. Its engine rules and `countermeasure.progress.v1` saves are preserved.
- **Campaign** (`?mode=campaign`): 50 authored encounters; separate `countermeasure.campaign.v1` browser checkpoints and version 2 export files. Imports cannot cross modes. The installed app remembers the last selected mode.
- The fictional subject register is shared. Trial numbers count deaths within the selected run. Menu → level select resumes unlocked entry checkpoints; export before clearing browser data or moving devices. There is no cloud sync.

## Campaign progression

| Waves | Encounter focus | Reward |
| --- | --- | --- |
| 1–3 / 4–6 / 7–10 | Defense, movement, then offense | Mech I + jetpack + radio at 10 |
| 11–20 | Flood pumps, booted floor conductors, early flyers | Mech II + glue at 20 |
| 21–30 | Metal, shunt-shell and chemical fuse drones | Mech III + flame at 30 |
| 31–40 | Darkness, airspace and mixed hazards | Mech IV + magnetic scramble at 40 |
| 41–48 | Orchestrators and coordinated mixed teams | Advanced formations |
| 49 / 50 | Mirror / emergency encounter | Mech V overdrive, EMP, destroy core, escape left |

Weapon stages II / III unlock at 6 / 16. Skill points cap at 12 so the whole tree cannot be equipped at once. Rewiring remains free. Milestone pods arrive near the end of combat; missed pods are salvaged before the next wave so flight cannot be locked out. Chassis upgrades increase armor; overdrive shortens power cooldowns.

WASD, Enter attack, Shift dash, 1–4 weapons, Q/E cycle. **5–8 select a mech power; hold F to use it**. Touch: hold arrows / Fly / Attack; tap the separate power button. Pause → skill tree selects powers and weapon stages. Fullscreen uses the same touch controls and paused loadout.

## Counterplay

- Sword hits expose wiring; liquids amplify direct taser hits. Boots isolate feet from floor conduction, not wet-body contact. Acid and chemical pools burn both sides.
- Dash + melee gives one extra contact strike per target and increases crit chance.
- Dousers flood the floor. Conductors show a long yellow warning before a brief charge. Interrupt them, use radio, or fly above it.
- Electricity detonates metal drones at range. Plastic-core drones shunt electricity until cut open or their coating is melted. Three **plain water** hits disarm chemical drones; acid does not dilute the fuse. Drone blasts hurt robots too.
- Radio stops robots and drops flyers. Three glue bursts bind; flame melts plastic and sealed coatings; magnetic corruption is strongest against conductive, exposed hardware.
- Orchestrators pulse a team attack signal and select resistant cover from visible attack effects after a sensing delay. Killing one interrupts orders and briefly confuses its team. Darkness leaves attack warnings and the player's light visible.
- Mirror freezes your build, selected power and learned fighting habits at duel entry, and can follow jetpack flight. The emergency machine counters tools and powers while online; it jumps but cannot fly. Reach **DO NOT PRESS**, fire EMP, then destroy its core before the 12-second backup timer expires.

## Local learning

Campaign tracks weapon attempts, damage effectiveness, spacing, stationary time, jumping, dashing and ground shocks. Successes **and deaths** update a weighted local model. One bounded hardware slot changes between attempts/waves; active hardware never swaps in response to a held key. Reaction/turning/dodging improve exponentially across the curriculum, with bounded reaction times and attack windups. Authored encounter roles, floor pulses and synchronized attacks provide variety beyond health scaling. Recent history is bounded to 12 records; level checkpoints are bounded to 50.

## Development

Serve the repository root with a static HTTP server; open `/countermeasure/?mode=campaign`. Run:

```sh
node --test tests/countermeasure*.test.mjs
```

No dependency install or build is needed. New runtime files must be included in `sw.js`; increment its cache version for every release. The worker scopes only `/countermeasure/`. Existing clients can use Menu → Update game to activate a waiting bundle. iOS installation uses Safari → Share → Add to Home Screen; Android uses Install game / Chrome's install menu. Wait for **Ready offline** before disconnecting.

Automated checks cover Campaign progression, learning, hazards, powers, save isolation, flight, finale, and offline caching, plus touch/fullscreen/install regressions. Browser QA uses imported synthetic checkpoints on a separate local origin. Device installation and long-term difficulty tuning still need real phone/player testing.
