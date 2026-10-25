import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {expeditionCheckpoint,retuneCheckpoint} from '../countermeasure/expedition-saves.mjs';
import {DIFFICULTIES} from '../countermeasure/difficulty.mjs';
import {readOptions,saveOptions,OPTIONS_KEY} from '../countermeasure/options.mjs';
import {Chiptune} from '../countermeasure/music.mjs';
function start(wave=21,difficulty='normal',encounter=null){const g=new ExpeditionArena({difficulty,random:()=>.99});g.mechTier=difficulty==='terminator'&&(wave>10||encounter==='super')?5:encounter==='super'?Math.floor(wave/10):Math.floor((wave-1)/10);g.plan=g.makePlan(wave,g.memory,encounter);g.state='between';g.startWave();return g;}
function advance(g,time,input={}){for(let t=0;t<time;t+=.02)g.update(.02,input);}
function clear(g){g.player.invulnerable=100;for(let t=0;t<10&&g.state==='playing';t+=.02){for(const r of g.robots)if(r.hp>0)g.damageRobot(r,1e8);g.update(.02);}}
function walk(g){for(let t=0;t<6&&g.state==='traveling';t+=.02)g.update(.02,{right:true});}
test('all modes carry exact armor damage through ordinary doors and saved checkpoints',()=>{
 for(const difficulty of Object.keys(DIFFICULTIES)){const g=start(21,difficulty);g.player.mechaShield=7.25;clear(g);assert.equal(g.carry.shield,7.25);const c=g.nextCheckpoint();assert.ok(expeditionCheckpoint(c));const h=new ExpeditionArena();assert.ok(h.resume(c));assert.equal(h.player.mechaShield,7.25);walk(g);assert.equal(g.wave,22);assert.equal(g.player.mechaShield,7.25);}
});
test('newer suits provide full armor only after enemies are defeated and the crate is collected',()=>{
 const g=start(20);g.player.mechaShield=6;g.player.x=500;g.player.y=420;advance(g,.1);assert.equal(g.player.mechaShield,6);assert.equal(g.collectMechReward(),false);clear(g);assert.equal(g.player.mechaShield,6);assert.ok(g.collectMechReward());assert.equal(g.mechTier,2);assert.equal(g.player.mechaShield,96);
 const t=start(20,'terminator','boss');t.player.mechaShield=3;t.player.hp=.25;clear(t);assert.equal(t.carry.shield,3);assert.equal(t.carry.hp,.25);walk(t);assert.equal(t.player.mechaShield,168);assert.equal(t.player.hp,.25);
});
test('every ten-level milestone freezes the actual build and learned jump/dash style, then leads to its superboss',()=>{
 for(const wave of [10,20,30,40,50]){const g=start(wave);g.skills.agility=2;g.skills.voltage=3;g.weapon=2;g.memory.jumpRate=.4;g.memory.dashRate=.4;g.memory.farRatio=.9;g.memory.weapon=[0,0,1,0];g.mirrorBlueprint=null;g.state='between';g.startWave();const r=g.robots[0];assert.equal(r.type,'mirror');assert.deepEqual(r.build.skills,g.skills);assert.deepEqual(r.build.tiers,g.weaponTiers);assert.equal(r.build.style.jumpRate,.4);g.player.invulnerable=100;advance(g,6);assert.ok(r.jumps>0&&r.dashes>0,`level ${wave}: ${r.jumps} jumps ${r.dashes} dashes`);g.skills.voltage=0;assert.equal(r.build.skills.voltage,3);clear(g);walk(g);assert.equal(g.wave,wave);assert.equal(g.encounter,'super');assert.ok(g.robots.some(r=>r.super));}
});
test('staggered squads keep the door locked, warn before spawning, and stop their timer in pause',()=>{
 const g=start(13);const total=g.plan.units.length;assert.ok(g.robots.length<total);for(const r of g.robots)g.damageRobot(r,1e8);g.update(.02);assert.equal(g.state,'playing');assert.equal(g.next,null);assert.equal(g.deploymentWarning.side,'left');const remaining=g.deploymentWarning.remaining;g.pause();advance(g,2);assert.equal(g.deploymentWarning.remaining,remaining);g.pause();advance(g,.8);assert.equal(g.robots.filter(r=>r.hp>0).length,0);g.player.invulnerable=100;advance(g,1);assert.ok(g.robots.some(r=>r.hp>0&&r.x<380));assert.ok(g.robots.length<=total);for(let n=0;n<12&&g.state==='playing';n++){clear(g);advance(g,1.8);}assert.equal(g.robots.length,total);assert.equal(g.state,'traveling');assert.equal(g.memory.attempts,1);
});
test('relay, pincer, crossfire and airlift reconstruct deterministically from an entry save',()=>{
 const seen=new Set();for(const wave of [13,14,15,16]){const g=start(wave);seen.add(g.plan.pattern);const h=new ExpeditionArena();assert.ok(h.resume(g.snapshot()));assert.deepEqual(h.deployments,g.deployments);assert.deepEqual(h.robots.map(r=>r.type),g.robots.map(r=>r.type));assert.ok(g.plan.units.length<=11);}assert.equal(seen.size,4);
});
test('difficulty changes preserve spent health, armor and resources and remain valid across all mode pairs',()=>{
 for(const from of Object.keys(DIFFICULTIES))for(const to of Object.keys(DIFFICULTIES))for(const wave of [10,21,40,50]){const g=start(wave,from);const c=g.snapshot();c.carry={hp:.25,shield:g.player.mecha?3:0};c.resources.fuel=2;c.resources.ammo=1;const tuned=retuneCheckpoint(c,to);assert.ok(tuned,`${from} to ${to} level ${wave}`);assert.equal(tuned.carry.hp,.25);assert.equal(tuned.carry.shield,c.carry.shield);assert.equal(tuned.resources.fuel,2);assert.equal(tuned.resources.ammo,1);const h=new ExpeditionArena();assert.ok(h.resume(tuned));assert.equal(h.difficulty,to);assert.equal(h.player.hp,.25);assert.equal(h.player.mechaShield,c.carry.shield);}
});
test('selecting a milestone saved at its superboss starts a mirror duel without granting armor or a perfect run',()=>{
 for(const wave of [10,20,30,40,50]){const g=start(wave,'normal','super');const c=g.snapshot();c.carry={hp:30,shield:5};const replay=retuneCheckpoint(c,'normal',{mirror:true});assert.ok(replay);assert.equal(replay.journey.flawless,false);const h=new ExpeditionArena();assert.ok(h.resume(replay));assert.equal(h.encounter,'boss');assert.equal(h.robots[0].type,'mirror');assert.equal(h.player.mechaShield,5);}
});
test('options persist safely and corrupt settings cannot produce invalid audio volume',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};const options={audio:true,volume:.22,touchAim:false};assert.ok(saveOptions(storage,options));assert.deepEqual(readOptions(storage),options);values.set(OPTIONS_KEY,'{"volume":40,"audio":"yes"}');assert.deepEqual(readOptions(storage),{audio:false,volume:1,touchAim:true});assert.deepEqual(readOptions({getItem(){throw Error();}}),{audio:false,volume:.65,touchAim:true});const music=new Chiptune();music.setVolume(0);assert.equal(music.volume,0);music.setVolume(10);assert.equal(music.volume,.045);
});
test('touch aim preference disables automatic turning without breaking attack inputs',()=>{
 const g=start(10);g.touchAimEnabled=false;g.player.x=300;g.player.y=420;g.weapon=2;const r=g.robots[0];r.x=450;r.y=420;const hp=r.hp;g.update(.02,{left:true,attack:true,aim:true});assert.equal(g.player.facing,-1);assert.equal(r.hp,hp);
});

test('a difficulty restart copies newly unlocked ultimate weapon stages before the mirror spawns',()=>{const g=start(20);const c=g.snapshot();c.carry={hp:60,shield:8};const h=new ExpeditionArena();assert.ok(h.resume(retuneCheckpoint(c,'terminator')));assert.deepEqual(h.weaponTiers,[3,3,3,3]);assert.deepEqual(h.robots[0].build.tiers,h.weaponTiers);assert.equal(h.robots[0].build.mechTier,5);assert.equal(h.player.mechaShield,8);});
