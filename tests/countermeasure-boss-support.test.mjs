import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {supportRules,observedHabit,updateBossSupport} from '../countermeasure/boss-support.mjs';
import {rng} from './helpers/countermeasure-pilot.mjs';
function game(wave=20,encounter='super',difficulty='normal'){
 const g=new ExpeditionArena({difficulty,random:rng(97)});g.mechTier=difficulty==='terminator'?5:Math.floor(wave/10);g.plan=g.makePlan(wave,g.memory,encounter);g.startWave();return g;
}
function sample(g,seconds,pose='crouch'){
 for(let t=0;t<seconds-.001;t+=.25){const p=g.player;p.x=pose==='air'?50+(g.bossSupport.elapsed*175)%900:200;p.y=pose==='air'||pose==='hover'?120:420;p.grounded=p.y===420;p.rollTime=0;updateBossSupport(g,.25,{down:pose==='crouch'});}
}
test('each difficulty scales observation time, support size, live cap and finite budget',()=>{
 const profiles=['easy','normal','hard','terminator'].map(d=>supportRules(d,3));for(let i=1;i<4;i++){assert.ok(profiles[i].observe<profiles[i-1].observe);assert.ok(profiles[i].interval<=profiles[i-1].interval);assert.ok(profiles[i].cap>=profiles[i-1].cap);assert.ok(profiles[i].budget>=profiles[i-1].budget);}assert.equal(profiles[0].batch,1);assert.equal(profiles[3].batch,2);assert.ok(supportRules('terminator',5).budget<=16);
});
test('sustained crouching calls a warned ground charger, not an instant spawn',()=>{
 const g=game();sample(g,4.75);assert.equal(g.bossSupport.warning,null);sample(g,.25);const w=g.bossSupport.warning;assert.equal(w.reason,'crouch');assert.deepEqual(w.units,['lancer']);assert.ok(w.xs.every(x=>Math.abs(x-g.player.x)>200));assert.equal(g.robots.filter(r=>r.supportReason).length,0);sample(g,1.5);assert.equal(g.bossSupport.spent,0);sample(g,.5);assert.equal(g.bossSupport.spent,1);assert.equal(g.robots.find(r=>r.supportReason).type,'lancer');
});
test('airtime while moving calls drones; stationary ceiling hover calls airburst artillery',()=>{
 for(const pose of ['air','hover','stand']){const g=game();sample(g,5,pose);const w=g.bossSupport.warning;assert.equal(w.reason,pose==='air'?'air':'camp');assert.deepEqual(w.units,pose==='air'?['metalDrone']:['bombardier']);assert.equal(w.side,pose==='air'?'air':'right');}
});
test('brief ducks and varied movement do not trigger an early perfect counter; old habits decay',()=>{
 const samples=Array.from({length:32},(_,i)=>({x:30+i*30,y:420,crouch:i<8,air:false}));assert.equal(observedHabit(samples),null);
 const g=game();sample(g,7);assert.equal(g.bossSupport.history[0].reason,'crouch');sample(g,14,'air');assert.equal(g.bossSupport.history[1].reason,'air');assert.ok(g.bossSupport.samples.length<=32);
});
test('support cannot exceed its live cap or finite budget, even in an indefinitely stalled fight',()=>{
 for(const difficulty of ['easy','normal','hard','terminator']){const g=game(50,'super',difficulty);sample(g,100);assert.ok(g.robots.filter(r=>r.supportReason&&r.hp>0).length<=g.bossSupport.rules.cap);for(let n=0;n<800;n++){for(const r of g.robots)if(r.supportReason)r.hp=0;sample(g,.25);}assert.equal(g.bossSupport.spent,g.bossSupport.rules.budget);assert.ok(g.bossSupport.history.length<=16);assert.equal(new Set(g.robots.map(r=>r.id)).size,g.robots.length);}
});
test('killing the boss cancels a pending call; pause and objective reboots freeze observations',()=>{
 const g=game();sample(g,5);const elapsed=g.bossSupport.elapsed,w=g.bossSupport.warning;g.pause();sample(g,2);assert.equal(g.bossSupport.elapsed,elapsed);assert.equal(g.bossSupport.warning.remaining,w.remaining);g.pause();for(const r of g.robots)if(r.super)r.objectiveReboot=8;sample(g,2);assert.equal(g.bossSupport.elapsed,elapsed);for(const r of g.robots)if(r.super)r.hp=0;sample(g,.25);assert.equal(g.bossSupport.warning,null);assert.equal(g.bossSupport.spent,0);
});
test('pressing the real emergency button cancels support and protects its reboot window',()=>{
 const g=game(10);sample(g,5);assert.ok(g.bossSupport.warning);g.player.x=g.emergency.x;g.player.y=g.emergency.y+30;assert.ok(g.pressEmergency());assert.equal(g.bossSupport.warning,null);const elapsed=g.bossSupport.elapsed;for(let n=0;n<100;n++)g.update(.02,{up:true});assert.equal(g.bossSupport.elapsed,elapsed);assert.equal(g.bossSupport.spent,0);
});
test('ordinary rooms never create adaptive boss support; retries clear the observation window',()=>{
 const g=game(11,'room');assert.equal(g.bossSupport,null);const b=game();sample(b,7);assert.ok(b.bossSupport.spent);b.hurt(1e6,0,0,'combat trauma',{hazard:true});assert.equal(b.state,'dead');b.retry();assert.equal(b.bossSupport.spent,0);assert.equal(b.bossSupport.samples.length,0);assert.equal(b.bossSupport.warning,null);
});
test('a support charger can be jumped and live support must be defeated before the suit unlocks',()=>{
 for(const jumping of [false,true]){const g=game(10,'boss');const boss=g.robots[0];boss.emp=20;const r=g.spawn('lancer',99);r.supportReason='crouch';r.x=100;r.action='charge';r.chargeTime=.3;r.lockDir=1;r.contactHits=[];g.robots.push(r);g.player.x=300;g.player.y=420;g.player.mecha=false;g.player.mechaShield=0;g.player.invulnerable=0;if(jumping)g.jump();const hp=g.player.hp;for(let n=0;n<14;n++)g.update(.02,{});if(jumping)assert.equal(g.player.hp,hp);else assert.ok(g.player.hp<hp);g.damageRobot(boss,1e9);g.update(.02);assert.equal(g.state,'playing');assert.equal(g.mechaDrop.locked,true);g.damageRobot(r,1e9);g.update(.02);assert.equal(g.state,'traveling');assert.equal(g.mechaDrop.locked,false);}
});
test('crouching is no longer immunity to delayed core aim; changing posture after lock can evade',()=>{
 for(const lateDuck of [false,true]){const g=game(10);g.bossSupport=null;g.robots=g.robots.filter(r=>r.super);const r=g.robots[0];r.x=550;r.y=420;r.comboPolicy.weights=[];r.cooldown=0;g.player.x=250;g.player.y=420;g.player.mechaShield=0;g.player.invulnerable=0;const hp=g.player.hp;g.update(.02,{down:!lateDuck});assert.ok(r.windup>0);assert.equal(r.lockY,lateDuck?398:411);for(let t=0;t<2;t+=.02)g.update(.02,{down:true});if(lateDuck)assert.equal(g.player.hp,hp);else assert.ok(g.player.hp<hp);}
});
test('airburst artillery damages a stationary high flyer and a locked mark can be escaped',()=>{
 for(const escape of [false,true]){const g=game(20),boss=g.robots.find(r=>r.super);boss.emp=20;const r=g.spawn('bombardier',99);r.supportReason='camp';r.x=850;r.cooldown=0;g.robots.push(r);g.player.x=200;g.player.y=86;g.player.mecha=true;g.player.mechaShield=0;g.player.invulnerable=0;const hp=g.player.hp;g.update(.02,{up:true});assert.equal(r.action,'airburst');assert.ok(r.airburstMark.y<100);const targetX=r.airburstMark.x;
  for(let t=0;t<2.1;t+=.02)g.update(.02,{up:true,right:escape});if(escape){assert.ok(g.player.x>targetX+100);assert.equal(g.player.hp,hp);}else assert.ok(g.player.hp<hp);
 }
});
test('a robot wandering into a committed airburst still takes friendly fire',()=>{
 const g=game(10),boss=g.robots[0],r=g.spawn('bombardier',98),ally=g.spawn('probe',99);boss.emp=20;r.emp=20;ally.emp=20;r.x=850;ally.x=200;ally.y=203;g.robots.push(r,ally);const hp=ally.hp,shooter=r.hp;g.shots.push({kind:'mortar',airburst:true,burstTime:.01,targetX:200,targetY:180,x:200,y:180,vx:0,vy:0,gravity:1,life:1,owner:r.id,ownerX:r.x,critical:false});g.update(.02);assert.ok(ally.hp<hp);assert.equal(r.hp,shooter);assert.ok(!g.shots.length);
});
test('support pressure reaches a stationary duck in ordinary combat',()=>{
 const g=game(10,'boss');g.player.x=200;g.player.invulnerable=0;const hp=g.player.hp;for(let t=0;t<25&&g.state==='playing';t+=.02)g.update(.02,{down:true});assert.ok(g.bossSupport.history.some(h=>h.reason==='crouch'));assert.ok(g.player.hp<hp);
});
test('offline application precaches the adaptive director',async()=>{const sw=await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8');assert.ok(sw.includes("'./boss-support.mjs'"));});

test('antenna loss staggers late Hard/Terminator support while keeping its finite budget and live cap',()=>{
 for(const difficulty of ['easy','normal','hard','terminator']){
  const g=game(50,'super',difficulty),r=g.robots.find(r=>r.super),a=g.robots.find(r=>r.type==='antenna'),rules={...g.bossSupport.rules};g.player.invulnerable=100;g.damageRobot(a,1e9);assert.ok(r.desynchronized);
  for(let i=0;i<405;i++)g.update(.02,{up:true});sample(g,rules.observe);
  const staggered=['hard','terminator'].includes(difficulty);assert.equal(g.bossSupport.warning.units.length,staggered?1:rules.batch);sample(g,2);const factor=difficulty==='hard'?1.5:difficulty==='terminator'?1.25:1;
  assert.ok(g.bossSupport.cooldown>rules.interval*factor-.6);assert.equal(g.bossSupport.rules.cap,rules.cap);assert.equal(g.bossSupport.rules.budget,rules.budget);
 }
});
