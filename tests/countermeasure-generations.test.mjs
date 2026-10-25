import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {enemyGeneration,upgradedBombard,blockGuardCrossing,updateGenerationRobot} from '../countermeasure/enemy-generations.mjs';
import {comboPolicy,beginCombo} from '../countermeasure/boss-combos.mjs';
import {learnCampaign} from '../countermeasure/campaign-plan.mjs';
import {expeditionCheckpoint} from '../countermeasure/expedition-saves.mjs';
function game(wave=21,type='guard',difficulty='normal'){
 const g=new ExpeditionArena({difficulty,random:()=>.99});g.mechTier=difficulty==='terminator'?5:Math.floor((wave-1)/10);g.plan=g.makePlan(wave,g.memory,'room');g.state='between';g.startWave();g.deployments=[];g.deploymentWarning=null;g.robots=[g.spawn(type,0)];g.player.x=200;g.player.invulnerable=100;return g;
}
function step(g,t,input={}){for(let n=0;n<t;n+=.02)g.update(.02,input);}
function boss(){const g=game(30,'mirror');const r=g.robots[0];r.build.style.history=[{total:100}];r.comboPolicy=comboPolicy({...g.memory,history:[{total:100}],effective:[0,0,1,0],rollRate:.3,airDashRate:.3},3);return {g,r};}
test('enemy generations advance only after each completed ten-level sector',()=>{assert.deepEqual([1,10,11,20,21,30,31,40,41,50].map(enemyGeneration),[1,1,2,2,3,3,4,4,5,5]);});
test('every ordinary chassis gains generation hardware and mobility, not just a larger squad',()=>{
 for(const type of ['probe','guard','plated','insulated','sealed','interceptor','gunner','feinter','bulwark','bombardier','flak','lancer','douser','shocker','flyer','metalDrone','plasticDrone','chemDrone','orchestrator']){const a=game(11,type).robots[0],b=game(41,type).robots[0];assert.ok(b.hp>a.hp,type);assert.ok(b.cognition.speed>a.cognition.speed,type);assert.ok(b.upgrade.attack>a.upgrade.attack,type);assert.equal(b.generation,5);}
});
test('later rooms grow substantially and reserves respect bounded live populations',()=>{
 for(const difficulty of ['easy','normal','hard','terminator']){const g=new ExpeditionArena({difficulty}),plans=[11,21,31,41].map(w=>g.makePlan(w,g.memory,'room'));assert.ok(plans.at(-1).units.length>plans[0].units.length);for(const p of plans){assert.ok(p.units.length<=30);assert.ok(p.openingUnits.length<=p.activeCap);assert.equal(p.units.length,p.openingUnits.length+p.deployments.reduce((n,d)=>n+d.units.length,0));}}
 const g=game(41);g.deployments=[{at:0,side:'left',units:['gunner','guard','flyer']}];g.plan.activeCap=3;g.robots=[g.spawn('guard',1),g.spawn('guard',2)];g.updateDeployments(2);assert.equal(g.robots.length,2);assert.ok(g.deploymentWarning);g.robots[0].hp=0;g.robots[1].hp=0;g.updateDeployments(.02);assert.equal(g.robots.filter(r=>r.hp>0).length,3);
});
test('upgraded mortar arcs are higher, quicker, lock their target and hold fire over allies',()=>{
 const shots=[];for(const wave of [11,41]){const g=game(wave,'bombardier'),r=g.robots[0];r.x=750;r.target=250;assert.ok(upgradedBombard(g,r));shots.push(g.shots[1]);const s=g.shots[1];assert.ok(Math.abs(s.x+s.vx*s.flight-250)<.001);assert.ok(Math.abs(s.y+s.vy*s.flight+.5*s.gravity*s.flight*s.flight-412)<.001);}
 assert.ok(shots[1].flight<shots[0].flight);assert.ok(shots[1].vy**2/(2*shots[1].gravity)>shots[0].vy**2/(2*shots[0].gravity));
 const g=game(41,'bombardier'),r=g.robots[0];r.target=250;const ally=g.spawn('probe',1);ally.x=250;g.robots.push(ally);assert.equal(upgradedBombard(g,r),false);assert.equal(g.shots.length,0);
});
test('linear shooters gain fast multi-shot bursts while holding unsafe friendly lanes',()=>{
 const g=game(41,'gunner'),r=g.robots[0];r.x=750;r.cooldown=0;g.player.x=200;step(g,.7);assert.ok(g.shots.length>=2);assert.ok(g.shots.every(s=>Math.abs(s.vx)>=500));
 const h=game(41,'gunner'),s=h.robots[0],ally=h.spawn('guard',1);s.x=750;s.targetX=200;s.sense=10;s.burst=1;s.burstClock=0;ally.x=500;h.robots.push(ally);updateGenerationRobot(h,s,.02);assert.equal(h.shots.length,0);assert.ok(s.vy<0);assert.equal(s.burst,1);
});
test('armored guards resist rear hits without immunity and physically block a low crossing',()=>{
 const damage=armored=>{const g=game(21),r=g.robots[0];r.fullArmor=armored;r.x=450;g.player.x=400;r.facing=1;const hp=r.hp;g.hit(r,1);return hp-r.hp;};assert.ok(damage(true)>0);assert.ok(damage(true)<damage(false));
 const g=game(21),r=g.robots[0];r.x=450;g.player.x=430;blockGuardCrossing(g,390);assert.equal(g.player.x,396);g.player.y=280;g.player.x=475;blockGuardCrossing(g,390);assert.equal(g.player.x,475);
 g.player.y=420;g.player.x=460;g.player.invulnerable=0;r.shove=.2;r.lockDir=1;updateGenerationRobot(g,r,.02);assert.ok(g.player.x>500);assert.ok(g.player.vy<0);
});
test('conductor dive slide launches a standing human; a roll or jump evades it',()=>{
 for(const posture of ['stand','roll','jump']){const g=game(21,'shocker'),r=g.robots[0];r.x=250;r.lockDir=1;r.slide=.4;g.player.x=280;g.player.mechaShield=0;g.player.invulnerable=0;g.player.grounded=posture!=='jump';g.player.rollTime=posture==='roll'?.3:0;if(posture==='jump')g.player.y=350;const hp=g.player.hp;updateGenerationRobot(g,r,.02);if(posture==='stand'){assert.ok(g.player.hp<hp);assert.equal(g.player.vy,-540);}else assert.equal(g.player.hp,hp);}
});
test('drone dives telegraph a fixed target, accelerate by generation and can miss',()=>{
 const speeds=[];for(const wave of [21,41]){const g=game(wave,'plasticDrone'),r=g.robots[0];r.x=700;r.y=200;r.specialCd=0;updateGenerationRobot(g,r,.02);assert.equal(r.dive.phase,'windup');const x=r.dive.x;g.player.x=900;for(let i=0;i<37;i++)updateGenerationRobot(g,r,.02);assert.equal(r.dive.x,x);assert.equal(r.dive.phase,'dive');speeds.push(Math.hypot(r.dive.vx,r.dive.vy));for(let i=0;i<45;i++)updateGenerationRobot(g,r,.02);assert.equal(r.dive,null);assert.ok(r.hp>0);}
 assert.ok(speeds[1]>speeds[0]);
});
test('drone explosion aftermath lasts longer in later generations and misses add no status',()=>{
 const durations=[];for(const wave of [21,41]){const g=game(wave,'metalDrone'),r=g.robots[0];g.player.invulnerable=0;g.player.x=r.x;g.player.y=r.y;g.explodeDrone(r);assert.equal(g.player.blastAftermath.kind,'static');durations.push(g.player.blastAftermath.time);}
 assert.ok(durations[1]>durations[0]);const g=game(41,'chemDrone'),r=g.robots[0];g.player.x=30;g.explodeDrone(r);assert.ok(!g.player.blastAftermath);assert.ok(g.pools.some(p=>p.life>=22));
});
test('roll and air-dash affinities learn separately, survive saves and default safely for older saves',()=>{
 const g=game(21,'probe');g.stats.time=10;g.stats.attacks[0]=10;g.stats.damage[0]=100;g.player.crouching=true;g.player.grounded=true;g.dash();g.player.dashCd=0;g.player.grounded=false;g.dash();assert.equal(g.stats.rolls,1);assert.equal(g.stats.airDashes,1);g.memory=learnCampaign(g.memory,g.stats,{wave:21,won:true});assert.ok(g.memory.rollRate>0);assert.ok(g.memory.airDashRate>0);const c=g.snapshot();assert.equal(expeditionCheckpoint(c).memory.rollRate,g.memory.rollRate);delete c.memory.rollRate;delete c.memory.airDashRate;assert.equal(expeditionCheckpoint(c).memory.airDashRate,0);c.memory.rollRate=Infinity;assert.equal(expeditionCheckpoint(c),null);
});
test('learned affinities bias customized move families rather than a recorded input sequence',()=>{
 const {g,r}=boss(),base={...g.memory,history:[{total:100}]},a=comboPolicy({...base,rollRate:.4,duckRatio:.5},3),b=comboPolicy({...base,airDashRate:.4,jumpRate:.4},3);const weight=(p,id)=>p.weights.find(w=>w.id===id).weight;assert.ok(weight(a,'roll')>weight(b,'roll'));assert.ok(weight(b,'airstrike')>weight(a,'airstrike'));assert.ok(a.weights.some(w=>w.id==='screen'));assert.ok(!('sequence' in r.comboPolicy));
});
test('mirror roll lowers its actual hitbox, then ends with a punish and recovery',()=>{
 const {g,r}=boss();r.x=430;g.player.x=300;beginCombo(g,r,'roll');step(g,.66);assert.ok(r.crouching&&r.rollTime>0);const hp=r.hp;g.player.facing=1;g.weapon=2;g.attack();assert.equal(r.hp,hp);step(g,1.2);assert.equal(r.rollTime,0);assert.equal(r.crouching,false);assert.equal(r.combo,null);assert.ok(r.comboCd>0);
});
test('predictive guard reduces one matching front attack; switching families defeats the prediction',()=>{
 const loss=index=>{const {g,r}=boss();r.x=450;r.facing=-1;g.player.x=350;beginCombo(g,r,'screen');step(g,.66);assert.ok(r.predictBlock>0);const hp=r.hp;g.hit(r,index);return {damage:hp-r.hp,g,r};};const a=loss(2);assert.equal(a.r.predictBlock,0);step(a.g,.02);assert.equal(a.r.predictBlock,0);assert.ok(a.g.effects.some(e=>e.text==='PREDICTED BLOCK'));const b=loss(1);assert.ok(b.r.predictBlock>0);assert.ok(!b.g.effects.some(e=>e.text==='PREDICTED BLOCK'));assert.ok(a.damage>0);
});
test('air-dash critical attempts have real movement and finite follow-up projectiles',()=>{
 const {g,r}=boss();r.x=750;g.player.x=200;g.player.y=250;beginCombo(g,r,'airstrike');step(g,1,{up:true});assert.ok(r.x<600);assert.ok(r.y<420);assert.ok(g.shots.length<=12);step(g,.9);assert.equal(r.combo,null);assert.ok(r.comboCd>0);assert.ok([r.x,r.y,r.vy].every(Number.isFinite));
});
test('an air-dash follow-up really attempts a critical hit and damages armor when it connects',()=>{
 const {g,r}=boss();r.x=600;g.player.x=250;g.player.y=420;g.player.invulnerable=0;g.random=()=>.2;const before=g.player.mechaShield,calls=[],hurt=g.botHurt;g.botHurt=function(...args){calls.push(args);return hurt.apply(this,args);};beginCombo(g,r,'airstrike');step(g,1.3);assert.ok(calls.some(args=>args[4]==='learned combo'&&args[5]===true));assert.ok(g.player.mechaShield<before);
});
test('dive movement remains substantially slowed after the grounding interval ends',()=>{
 const distance=glue=>{const g=game(41,'plasticDrone'),r=g.robots[0];r.x=700;r.y=200;r.glue=glue;r.dive={phase:'dive',age:0,distanceTime:0,sx:700,sy:200,vx:-600,vy:0};updateGenerationRobot(g,r,.1);return 700-r.x;};assert.ok(distance(2)<distance(0)*.6);
});
test('EMP/radio cancellation and leg injury interrupt the new committed attacks',()=>{
 const g=game(41,'shocker'),r=g.robots[0];r.slide=.5;r.radio=1;g.updateSpecialRobot(r,.02);assert.equal(r.slide,0);r.radio=0;r.crippled=true;r.slide=.5;updateGenerationRobot(g,r,.02);assert.equal(r.slide,0);
 const h=game(41,'plasticDrone'),d=h.robots[0];d.dive={phase:'windup',age:.5,x:200,y:420};d.radio=1;h.updateSpecialRobot(d,.02);assert.equal(d.dive,null);const q=game(41,'gunner'),gun=q.robots[0];gun.burst=2;gun.emp=1;q.updateSpecialRobot(gun,.02);assert.equal(gun.burst,0);assert.equal(q.shots.length,0);
});
test('a late projectile still damages an ally that enters its already-fired path',()=>{
 const g=game(41,'gunner'),r=g.robots[0];r.x=750;r.cooldown=0;step(g,.7);assert.ok(g.shots.length);const s=g.shots[0],ally=g.spawn('guard',1);ally.x=s.x-45;ally.y=s.y+26;ally.cooldown=100;g.robots.push(ally);const hp=ally.hp;step(g,.15);assert.ok(ally.hp<hp);
});
test('upgraded Mirrors break a sustained disable chain into a visible, damaging learned combo',()=>{
 const {g,r}=boss();r.radio=5;step(g,1.4);assert.ok(r.controlRecovery>0);assert.equal(r.radio,0);assert.ok(r.combo);const hp=r.hp;g.hit(r,2);assert.ok(r.hp<hp);assert.equal(r.paralyzed,0);assert.equal(r.stun,0);step(g,1.7);assert.ok(r.attacks.some(n=>n>0));assert.ok(r.comboCounts.screen>0);assert.equal(r.combo,null);
 const h=game(10,'mirror'),m=h.robots[0];m.radio=5;step(h,1.4);assert.ok(m.radio>3);assert.equal(m.controlRecovery,0);
});
