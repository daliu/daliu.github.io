import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,emptyMemory,learn,makePlan,TRAINING_WAVES,BOSS_WAVE} from '../countermeasure/engine.mjs';
import {SubjectRegister,NAME_COUNT} from '../countermeasure/subjects.mjs';

test('defense, movement and offense unlock in order and the Mirror follows wave nine',()=>{
 const m={...emptyMemory(),jumpRate:.4,stationaryRatio:.9,weapon:[0,0,1,0]};
 for(let wave=1;wave<=3;wave++){const p=makePlan(wave,m);assert.equal(p.phase,'Defensive learning');assert.ok(!p.units.some(t=>['interceptor','bulwark','feinter','bombardier','flak','lancer','gunner'].includes(t)));}
 for(let wave=4;wave<=6;wave++){const p=makePlan(wave,m);assert.equal(p.phase,'Movement learning');assert.ok(p.units.includes('bulwark'));assert.ok(!p.units.some(t=>['bombardier','flak','lancer','gunner'].includes(t)));}
 for(let wave=7;wave<=TRAINING_WAVES;wave++){const p=makePlan(wave,m);assert.equal(p.phase,'Offensive learning');assert.ok(p.units.includes('flak'));assert.ok(p.units.includes('insulated'));assert.ok(p.units.includes('bulwark'));}
 assert.deepEqual(makePlan(BOSS_WAVE,m).units,['mirror']);
});
test('actual stationary versus moving combat selects different offensive capabilities',()=>{
 const memories=[];
 for(const moving of [false,true]){const a=new Arena({random:()=>.99});a.startWave();a.player.x=650;for(let i=0;i<120;i++)a.update(.02,{attack:true,left:moving&&i%20<10,right:moving&&i%20>=10});memories.push(learn(emptyMemory(),a.stats));}
 assert.ok(memories[0].stationaryRatio>.9);assert.ok(memories[1].stationaryRatio<.1);assert.ok(makePlan(7,memories[0]).units.includes('bombardier'));assert.ok(makePlan(7,memories[1]).units.includes('lancer'));
});
test('grounded electrical attack traces cause rubber boots; wet direct hits alone do not',()=>{
 for(const pools of [true,false]){const a=new Arena({random:()=>.99});a.startWave();a.player.x=600;const r=a.spawn('plated',0);r.x=700;r.wet=5;a.robots=[r];if(pools)a.addPool(700);a.weapon=2;a.attack();a.player.attackCd=0;a.attack();a.update(.02);assert.equal(a.state,'between');assert.equal(a.plan.boots,pools);assert.equal(a.memory.groundShockHits,pools?2:0);if(pools){a.startWave();assert.ok(a.robots.some(r=>r.boots));assert.ok(a.robots.some(r=>!r.boots));}}
});
test('rubber boots block floor conduction and the grounded wet multiplier, not direct damage',()=>{
 const a=new Arena({random:()=>.99});a.startWave();a.player.x=200;a.weapon=2;const r=a.spawn('probe',0);r.x=300;r.boots=true;r.wet=5;a.robots=[r];const pool=a.addPool(300);a.attack();assert.equal(r.maxHp-r.hp,23);assert.equal(pool.charged,0);
 r.hp=r.maxHp;r.y=300;a.hit(r,2);assert.equal(r.maxHp-r.hp,69);
});
test('Bulwark resistance stops beam penetration and jumping physically intercepts aerial fire',()=>{
 const a=new Arena({random:()=>.99});a.wave=5;a.state='playing';a.player.x=200;a.setTier(2,2);a.weapon=2;const front=a.spawn('bulwark',0),rear=a.spawn('gunner',1);front.x=400;rear.x=550;a.robots=[front,rear];a.attack();assert.ok(front.hp<front.maxHp);assert.equal(rear.hp,rear.maxHp);
 front.y=250;a.player.attackCd=0;a.attack();assert.ok(rear.hp<rear.maxHp);
 const b=new Arena({random:()=>.99});b.wave=4;b.state='playing';const r=b.spawn('bulwark',0);b.robots=[r];r.cooldown=0;b.player.y=300;b.player.grounded=false;for(let i=0;i<20;i++)b.update(.02);assert.ok(r.y<420);assert.ok(Number.isFinite(r.vy));
});
test('arcing shells keep their marked landing positions after the human moves',()=>{
 const a=new Arena({random:()=>.99});a.wave=7;a.state='playing';const r=a.spawn('bombardier',0);r.x=750;r.target=250;a.player.x=250;a.robots=[r];a.bombard(r);assert.equal(a.shots.length,3);assert.ok(a.shots.every(s=>s.vy<0&&s.gravity>0));const marks=a.shots.map(s=>s.targetX);a.player.x=550;a.player.invulnerable=0;r.cooldown=100;for(let i=0;i<80;i++)a.update(.02);assert.equal(a.player.hp,100);assert.deepEqual(marks,[202,250,298]);assert.equal(a.shots.length,0);
});
test('bombardment damages a stationary human while an airborne human avoids the ground blast',()=>{
 for(const airborne of [false,true]){const a=new Arena({random:()=>.99});a.wave=7;a.state='playing';const r=a.spawn('bombardier',0);r.x=750;r.target=250;r.cooldown=100;a.robots=[r];a.player.x=250;a.player.invulnerable=0;a.bombard(r);for(let i=0;i<65;i++){if(airborne){a.player.y=260;a.player.vy=-25;a.player.grounded=false;}a.update(.02);}assert.equal(a.player.hp<100,!airborne);}
});
test('lancer commits to a direction and flak uses real angled trajectories',()=>{
 const a=new Arena({random:()=>.99});a.wave=7;a.state='playing';const r=a.spawn('lancer',0);r.x=500;r.cooldown=0;a.player.x=350;a.robots=[r];a.update(.02);assert.equal(r.action,'charge-windup');assert.equal(r.lockDir,-1);a.player.x=700;for(let i=0;i<38;i++)a.update(.02);assert.ok(r.x<500);assert.equal(a.player.hp,100);
 const b=new Arena({random:()=>.99});b.startWave();const f=b.spawn('flak',0);b.flak(f);assert.equal(new Set(b.shots.map(s=>s.vy)).size,3);assert.ok(b.shots.every(s=>s.gravity>0));
});
test('the name pool is large and produces every identity once before repeating',()=>{
 assert.ok(NAME_COUNT>18000);const r=new SubjectRegister({seed:42,sequence:0,records:[]}),names=new Set();for(let i=0;i<NAME_COUNT;i++)names.add(r.issue().name);assert.equal(names.size,NAME_COUNT);
});
test('death records the named subject once; replacement and reset issue different identities',()=>{
 const a=new Arena({register:new SubjectRegister({seed:123,sequence:0,records:[]})});const first=a.subject.name;a.startWave();a.player.hp=5;a.player.invulnerable=0;a.hurt(20,a.player.x,0,'arcing bombardment');assert.equal(a.subject.name,first);assert.equal(a.subject.status,'terminated');assert.equal(a.register.records.length,1);assert.equal(a.register.records[0].cause,'arcing bombardment');const memory=structuredClone(a.memory);a.retry();assert.notEqual(a.subject.name,first);assert.deepEqual(a.memory,memory);const second=a.subject.name;a.reset();assert.notEqual(a.subject.name,second);assert.equal(a.register.records[1].status,'reassigned');
});
test('the bounded subject register survives restoration without persisting combat memory',()=>{
 const r=new SubjectRegister({seed:12,sequence:0,records:[]});for(let i=0;i<40;i++){r.issue();r.close('terminated',i%9+1,'combat trauma');}assert.equal(r.records.length,24);const restored=new SubjectRegister(JSON.parse(JSON.stringify(r.snapshot())));assert.equal(restored.issue().name,r.peek().name);assert.equal(restored.records.length,24);assert.equal(new Arena({register:restored}).memory.waves,0);
});
