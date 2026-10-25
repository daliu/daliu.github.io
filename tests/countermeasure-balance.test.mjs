import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {ExpeditionStore,expeditionCheckpoint} from '../countermeasure/expedition-saves.mjs';
import {HeldControls,bindPointerControl,bindAttackControl,bindWeaponSwitch} from '../countermeasure/controls.mjs';
import {play} from './helpers/countermeasure-pilot.mjs';
function encounter(wave=10,difficulty='normal',phase='super'){
 const g=new ExpeditionArena({difficulty,random:()=>.99});g.mechTier=difficulty==='terminator'&&wave>=10?5:Math.floor(wave/10);g.plan=g.makePlan(wave,g.memory,phase);g.state='between';g.startWave();return g;
}
class Pad extends EventTarget{
 classes=new Set();classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)};
 setPointerCapture(id){this.capture=id;}
 emit(type,id=1,extra={}){const e=new Event(type,{cancelable:true});for(const [k,v] of Object.entries({pointerId:id,button:0,clientX:100,clientY:100,...extra}))Object.defineProperty(e,k,{value:v});this.dispatchEvent(e);}
}
function setup(g){const c=new HeldControls(),attack=new Pad(),left=new Pad(),power=new Pad();const canStart=()=>g.state==='playing';bindAttackControl(attack,{controls:c,canStart,canFly:()=>g.player.mecha,onJump:()=>g.jump(),onPress:()=>{g.aimAssist=true;g.attack();}});bindPointerControl(left,{controls:c,action:'left',canStart});bindPointerControl(power,{controls:c,action:'module',aim:true,canStart,onPress:()=>g.useModule()});return {c,attack,left,power};}
function advance(g,c,seconds){for(let t=0;t<seconds;t+=.02)g.update(.02,c.state);}
test('single-thumb attack drag adds flight while steering, switching and powers retain their holds at every boss',()=>{
 for(const difficulty of ['easy','normal','hard','terminator'])for(const wave of [10,20,30,40,50]){
  const g=encounter(wave,difficulty),{c,attack,left,power}=setup(g);left.emit('pointerdown',1);attack.emit('pointerdown',2);attack.emit('pointermove',2,{clientY:65});advance(g,c,.3);assert.ok(g.player.y<400);assert.ok(c.state.left&&c.state.attack&&c.state.up&&c.state.aim);
  const bar=new Pad();bindWeaponSwitch(bar,n=>g.weapon=n);bar.emit('pointerdown',4,{target:{closest:()=>({dataset:{weapon:'2'}})}});power.emit('pointerdown',3);assert.ok(c.state.attack&&c.state.up&&c.state.left&&c.state.module);advance(g,c,.2);power.emit('pointercancel',3);assert.ok(c.state.aim&&c.state.attack&&c.state.up);
  attack.emit('pointercancel',2);assert.equal(c.state.attack,false);assert.equal(c.state.up,false);assert.equal(c.state.aim,false);assert.equal(c.state.left,true);left.emit('pointerup',1);assert.ok(Object.values(c.state).every(v=>!v));
 }
});
test('slide can lower thrust while firing; human slide jumps once and empty armor/fuel still permits booster flight',()=>{
 const g=encounter(50,'terminator','hidden'),{c,attack}=setup(g);g.player.mechaShield=0;g.resources.fuel=0;attack.emit('pointerdown',1);attack.emit('pointermove',1,{clientY:70});advance(g,c,.2);assert.ok(g.player.flying);attack.emit('pointermove',1,{clientY:95});assert.ok(c.state.attack&&!c.state.up);attack.emit('lostpointercapture',1);assert.ok(Object.values(c.state).every(v=>!v));
 const h=new ExpeditionArena();h.startWave();const s=setup(h);s.attack.emit('pointerdown',2);s.attack.emit('pointermove',2,{clientY:60});s.attack.emit('pointermove',2,{clientY:55});assert.equal(h.stats.jumps,1);assert.equal(s.c.state.up,false);assert.equal(s.c.state.attack,true);
});
test('a cancelled or paused gesture cannot revive stale thrust on a later pointer move',()=>{
 const g=encounter(),{c,attack}=setup(g);attack.emit('pointerdown',1);attack.emit('pointermove',1,{clientY:50});g.pause();c.clear();g.pause();attack.emit('pointermove',1,{clientY:40});assert.ok(Object.values(c.state).every(v=>!v));attack.emit('pointerup',1);
});
test('touch aim permits backpedalling fire; manual keyboard attacks retain their direction',()=>{
 const make=aim=>{const g=encounter();g.player.x=300;g.player.y=420;g.weapon=2;const r=g.robots[0];r.x=450;r.y=420;const hp=r.hp;g.update(.02,{left:true,attack:true,aim});return {g,r,hp};};const a=make(true);assert.ok(a.g.player.x<300);assert.equal(a.g.player.facing,1);assert.ok(a.r.hp<a.hp);const b=make(false);assert.equal(b.g.player.facing,-1);assert.equal(b.r.hp,b.hp);
});
test('boss control budget guarantees a readable recovery window instead of an endless stun loop',()=>{
 const g=encounter(),r=g.robots[0],{c}=setup(g);g.disable(r,'radio',20);advance(g,c,4.2);assert.ok(r.controlRecovery>0);assert.equal(r.disabled,false);assert.equal(g.disable(r,'radio',2.6),false);const hp=r.hp;g.player.x=r.x-20;g.hit(r,2);g.update(.02);assert.equal(r.paralyzed,0);assert.ok(r.hp<hp);assert.ok(g.events.length<10);
});
test('objective EMP and antenna retain their full eight-second reboot despite control recovery',()=>{
 const g=encounter(),r=g.robots[0];r.controlRecovery=2;g.player.x=900;g.player.y=138;assert.ok(g.pressEmergency());for(let t=0;t<7;t+=.04)g.update(.04);assert.ok(r.emp>.8);assert.equal(r.controlRecovery,0);
 const h=encounter(40),a=h.robots.find(b=>b.type==='antenna'),b=h.robots[0];b.controlRecovery=2;h.damageRobot(a,1e6);for(let t=0;t<7;t+=.04)h.update(.04);assert.ok(b.emp>.8);assert.equal(h.synchronized,false);
});
test('cooldowns tick through gates and survive reload; retries and earned finale replays start fresh',()=>{
 const g=encounter();g.selectModule(0);g.useModule();const before=g.moduleCooldowns[0];for(const r of g.robots)g.damageRobot(r,1e8);g.update(.02);assert.equal(g.state,'traveling');g.update(.04,{right:true});assert.ok(g.moduleCooldowns[0]<before);const c=g.nextCheckpoint();assert.ok(expeditionCheckpoint(c));const h=new ExpeditionArena();assert.ok(h.resume(c));assert.equal(h.moduleCooldowns[0],c.cooldowns[0]);assert.ok(h.moduleCooldowns[0]>0);
 const hidden=encounter(50,'normal','hidden');hidden.journey={cleared:50,flawless:true,secretQualified:true};hidden.moduleCooldowns[0]=8;const s=new ExpeditionStore();assert.ok(s.save(hidden.snapshot()));assert.deepEqual(s.finaleFor('normal').cooldowns,[0,0,0,0,0,0]);const invalid=g.snapshot();invalid.cooldowns=[Infinity,0,0,0,0,0];assert.equal(expeditionCheckpoint(invalid),null);
});
test('later Terminator suits stay inaccessible until clear, then refill armor without healing human HP',()=>{
 const g=encounter(20,'terminator','boss');g.player.hp=.25;g.player.mechaShield=0;g.resources.fuel=0;g.resources.ammo=0;for(const r of g.robots)g.damageRobot(r,1e8);g.update(.02);assert.equal(g.carry.hp,.25);assert.equal(g.carry.shield,0);assert.deepEqual(g.resources,{fuel:0,ammo:0,electricLock:0});assert.ok(g.collectMechReward());assert.equal(g.carry.shield,168);assert.equal(g.player.hp,.25);assert.deepEqual(g.resources,{fuel:65,ammo:9,electricLock:0});
});
test('late populations spawn away from the entry lane instead of on top of the human',()=>{
 for(const difficulty of ['easy','normal','hard','terminator']){const g=encounter(48,difficulty,'room');assert.ok(g.plan.units.length>2);assert.ok(g.robots.every(r=>r.x>=380));}
});
test('seeded tactical inputs clear all fifty levels and boss pairs on every mode without direct HP or win-state edits',()=>{
 for(const difficulty of ['easy','normal','hard','terminator'])for(const seed of [31,32]){const r=play(difficulty,seed,{reaction:.2,maxDeaths:60});assert.equal(r.status,'complete',`${difficulty} seed ${seed} stopped at ${r.level}`);assert.equal(r.level,50);assert.equal(r.rows.filter(row=>row.result==='clear'&&row.phase==='super').length,5);assert.ok(r.rows.some(row=>row.wave===1));}
});

test('normal inputs actually provoke learned combos in every upgraded Mirror duel',()=>{
 for(const mode of ['normal','terminator']){const bosses=[];const run=play(mode,11,{reaction:.2,maxDeaths:60,onEntry:g=>{if(g.encounter==='boss'&&g.wave>=20)bosses.push(g.robots[0]);}});assert.equal(run.status,'complete');assert.ok(bosses.length>=4);for(const r of bosses)assert.ok(Object.values(r.comboCounts??{}).some(n=>n>0),mode+' '+r.id);assert.ok(bosses.some(r=>r.attacks.some(n=>n>0)));}
});
