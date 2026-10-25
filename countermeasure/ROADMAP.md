# Countermeasure: later development

Requested October 25, 2026. These are future systems after further gameplay polish; they are not part of Release 24. Payment implementation, pricing and purchase rules are deferred. Earned unlocks and any later purchase path must be designed separately from the present combat balance.

## Existing powers and progression

Magnetic scramble, localized EMP and limited AP explosive rounds already exist in the prototype. Later work should make their unlock paths clearer, introduce throwable localized EMP grenades, and make magnetic scramble a focused single-robot disable/corruption tool. The current scramble affects nearby susceptible robots; changing its targeting is a separate balance task. Do not silently remove powers or saved unlocks while migrating progression.

## Later enemy roles

- Gatling robots sustain projectile pressure, with readable spin-up and recovery.
- Small precision drones trade durability for high critical-hit chances and deliberate targeting.
- Rotary slashers continuously damage the area around them, including other robots. Ranged disabling and glue/acid create openings. Their self-destructive hazard is an intentional exception to allied-damage protection; settle its exact Terminator behavior explicitly when implemented.
- Electrified robots can stun the human and briefly disrupt electrical equipment, with clear recovery indicators.
- Camouflage robots blend into the current factory sector and reveal themselves while attacking. Their attack tells must remain readable on phones and in dark rooms.

## Challenge-clear powers

- Orbital precision strike targets three robots. Each marked blast also hurts the human standing beneath it; show the danger area and a brief warning.
- Magnetic resonance briefly disables nearby robots for two seconds and makes subsequent attacks deal critical damage. It can disable their ally-protection logic, allowing them to damage other bots when they reboot. This area effect is distinct from the future focused magnetic scramble. Duration and success probability remain to be balanced.
- Logic plague lets allied robots spread hacks to enemies with exposed wiring. A hack takes several uninterrupted seconds; taking a hit resets its progress. Boss and superboss systems remain unhackerable. Eligibility details and propagation limits need their own design before implementation.

## Allies and physical hacking

Add a skill-tree unlock: stand near a disabled robot with exposed wiring and hold a dedicated hack action. Incoming attacks interrupt and reset the channel. A completed hack converts the weakened robot into an ally without restoring it to full health. Hacking can be repeated indefinitely over the adventure; a boss/superboss attempt fails because its system is too complex.

Each allied robot kill has a chance to improve its health, strength and evasive ability. Active companion capacity, upgrades, persistence between rooms, saves and readable ally markings need explicit design and phone performance checks. Repeatable recruitment does not yet define an unlimited simultaneous population.

## Survivor laboratory and wireless exploitation

Late in the Campaign, survivors defend a makeshift laboratory. A scientist grants a wireless interception/injection device: it can confuse enemies, disable ally-protection, or turn bots to the human side. Its longer hack presents a large loading/exploit screen that obscures most of the fight, with a visible wireless connector, progress and cancel action. Repeated use makes its success or effectiveness decline; this is separate from the dependable physical exposed-wiring hack. Set recovery, interruption and decline rules before implementation.

Human and robot companions can travel with the player. After clearing suitable rooms, a taser can open prisoner doors and recruit survivors. Robotics workshops can improve the weapons of human and robot allies. New rooms, dialogue and environmental details should carry this story without lengthy combat text.

## Implementation order

1. Continue boss/phone balance and make existing power unlocks legible.
2. Build physical hacking and companion combat/save behavior as one bounded vertical slice.
3. Add prisoner rescue and workshops, then the survivor laboratory/wireless device.
4. Introduce new enemy roles individually with counters and difficulty tests.
5. Add challenge-clear powers and logic-plague propagation after allied combat is stable.
6. Design a later purchase system separately; no payment code or paid unlocks now.
