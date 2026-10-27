import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {laserRules,structureFeedbackRules,laserDefenseImpacts,drawSuperLaser} from '../countermeasure/boss-laser.mjs';
function game(mode='hard',wave=40){const g=new ExpeditionArena({difficulty:mode,random:()=>.99});g.mechTier=mode==='terminator'?5:wave/10;g.plan=g.makePlan(wave,g.memory,'super');g.state='between';g.startWave();return g;}
function prime(g){const r=g.robots[0];r.x=500;r.y=200;r.laserCd=0;r.combo=null;r.windup=0;g.player.x=680;g.player.y=200;g.player.invulnerable=0;g.update(.02,{});assert.equal(r.laser.phase,'charge');return r;}
function recharge(g,{tank=false}={}){const r=g.robots[0];for(let i=0;i<150&&r.laser?.phase!=='recharge';i++){if(tank){g.player.y=200;g.player.vy=0;}g.update(.02,{up:!tank});}assert.equal(r.laser.phase,'recharge');return r.laser;}
test('a clean late defense bait earns feedback, keeps quarter structural damage and does not refill the human',()=>{
 for(const mode of ['hard','terminator'])for(const wave of [30,40,50]){const g=game(mode,wave),wall=g.robots.find(r=>r.type==='buttonGuard'),r=prime(g),human=g.player.hp,armor=g.player.mechaShield,hp=r.hp;const beam=recharge(g),rules=structureFeedbackRules(mode,wave/10);
  assert.ok(beam.feedback);assert.ok(!beam.hits.has('human'));assert.ok(Math.abs(wall.hp-wall.maxHp*.75)<1e-6);assert.equal(beam.total,rules.recharge);assert.equal(r.hp,hp);assert.equal(g.player.hp,human);assert.equal(g.player.mechaShield,armor);assert.equal(g.emergency.uses,0);
 }
});
test('standing in the blast earns no feedback even when the same blast hits armor',()=>{
 for(const mode of ['hard','terminator']){const g=game(mode),r=prime(g),shield=g.player.mechaShield;const beam=recharge(g,{tank:true});assert.ok(beam.structureHit);assert.ok(beam.hits.has('human'));assert.equal(beam.feedback,null);assert.equal(beam.total,laserRules(mode).recharge);assert.ok(g.player.mechaShield<shield);}
});
test('empty, dead and undamaged defenses cannot farm the earned opening',()=>{
 for(const variant of ['absent','dead','undamaged']){const g=game();if(variant==='absent')g.robots=g.robots.filter(r=>!r.structure);if(variant==='dead')for(const r of g.robots)if(r.structure)r.hp=0;if(variant==='undamaged')g.friendlyDamage=()=>{};prime(g);const beam=recharge(g);assert.equal(beam.feedback,null,variant);assert.equal(beam.total,laserRules('hard').recharge);}
});
test('early fights and other modes retain their original laser rules',()=>{
 for(const mode of ['hard','terminator']){const g=game(mode,20);prime(g);const beam=recharge(g);assert.equal(beam.feedback,null);assert.equal(beam.total,laserRules(mode).recharge);}
 for(const mode of ['easy','normal'])assert.equal(structureFeedbackRules(mode,5),null);assert.equal(structureFeedbackRules('hard',2),null);assert.ok(structureFeedbackRules('terminator',5).recharge<structureFeedbackRules('hard',5).recharge);assert.ok(structureFeedbackRules('terminator',5).cooldown<structureFeedbackRules('hard',5).cooldown);
});
test('feedback interrupts live support without despawning robots, clearing hazards or changing their HP',()=>{
 const g=game(),ally=g.spawn('gunner',90);ally.x=50;ally.cooldown=100;g.robots.push(ally);const hp=ally.hp,pool=g.addPool(60,0);const shot={x:50,y:90,vx:0,life:10,owner:ally.id};g.shots.push(shot);prime(g);const beam=recharge(g);
 assert.ok(ally.confused>5.9);assert.equal(ally.hp,hp);assert.ok(g.shots.includes(shot));assert.ok(g.pools.includes(pool));const elapsed=g.bossSupport.elapsed,time=beam.time;g.pause();for(let i=0;i<50;i++)g.update(.02,{});assert.equal(beam.time,time);assert.equal(g.bossSupport.elapsed,elapsed);
});
test('earned recovery has a finite end and uses its shorter next-laser cooldown',()=>{
 for(const mode of ['hard','terminator']){const g=game(mode),r=prime(g),beam=recharge(g),rules=structureFeedbackRules(mode,4);r.paralyzed=.5;g.player.invulnerable=100;const hp=r.hp;g.damageRobot(r,100);assert.ok(Math.abs(hp-r.hp-85)<1e-6);for(let n=0;n<Math.ceil(rules.recharge/.02)+2;n++)g.update(.02,{up:true});assert.equal(r.laser,null);assert.ok(r.laserCd>rules.cooldown-.1&&r.laserCd<=rules.cooldown);assert.equal(r.disabled,false);assert.ok(beam.feedback);}
});
test('a later ordinary miss returns to normal recovery rather than retaining feedback forever',()=>{
 const g=game(),r=prime(g);recharge(g);g.player.invulnerable=100;while(r.laser)g.update(.02,{up:true});g.robots=g.robots.filter(r=>!r.structure);r.laserCd=0;r.windup=0;r.combo=null;r.feedback.attackPending=null;r.feedback.motion=null;g.player.x=680;g.player.y=200;g.update(.02,{});const beam=recharge(g);assert.equal(beam.feedback,null);assert.equal(beam.total,laserRules('hard').recharge);
});

test('visible defense impact marks match real charged-beam damage without changing the fight',()=>{
 const g=game(),r=prime(g),wall=g.robots.find(r=>r.type==='buttonGuard');
 const marks=laserDefenseImpacts(r.laser,g.robots);assert.ok(marks.some(m=>m.id===wall.id));assert.ok(marks.every(m=>Number.isFinite(m.x)&&Number.isFinite(m.y)));
 const before=JSON.stringify(g.snapshot()),coords=[];const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...a)=>coords.push(...a.filter(n=>typeof n==='number')),set:(o,k,v)=>{o[k]=v;return true;}});
 drawSuperLaser(ctx,r,g.robots);assert.equal(JSON.stringify(g.snapshot()),before);assert.ok(coords.every(Number.isFinite));
 recharge(g);assert.equal(wall.hp,wall.maxHp*.75);assert.deepEqual(laserDefenseImpacts(r.laser,g.robots),[]);
});
test('impact marks ignore ruins, missed armor and targets behind the muzzle',()=>{
 const g=game(),r=prime(g),wall=g.robots.find(r=>r.type==='buttonGuard'),beam=r.laser;
 assert.deepEqual(laserDefenseImpacts({...beam,dy:-1,dx:0},g.robots),[]);
 assert.deepEqual(laserDefenseImpacts({...beam,dx:-1},[wall]),[]);
 wall.hp=0;assert.deepEqual(laserDefenseImpacts(beam,[wall]),[]);
 assert.deepEqual(laserDefenseImpacts(null,g.robots),[]);
});
