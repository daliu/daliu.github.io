import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {createBossFeedback,feedbackRules,recordBossHit,trackBossAttack,updateBossFeedback,updateBossReposition,takeBossAttackSwitch} from '../countermeasure/boss-feedback.mjs';
function game(mode='normal',wave=30){const g=new ExpeditionArena({difficulty:mode,random:()=>.99});g.mechTier=mode==='terminator'?5:3;g.plan=g.makePlan(wave,g.memory,'super');g.state='between';g.startWave();return g;}
function repeated(g,r,key='weapon:3'){for(let i=0;i<feedbackRules(g.difficulty).hits;i++)recordBossHit(g,r,key,key+':'+i);}
test('repeat-hit learning is per delivery, family, time window and core; retries reset it',()=>{
 const g=game(),r=g.robots[0];recordBossHit(g,r,'water','same');recordBossHit(g,r,'water','same');assert.equal(r.feedback.incoming.count,1);
 recordBossHit(g,r,'sword','next');assert.equal(r.feedback.incoming.count,1);g.clock+=9;recordBossHit(g,r,'sword','later');assert.equal(r.feedback.incoming.count,1);
 repeated(g,r);assert.ok(r.feedback.movePending);assert.equal(r.feedback.moves,0);const other=g.spawn('overseer',7);assert.equal(other.feedback.movePending,null);
 g.state='dead';g.retry();assert.equal(g.robots[0].feedback.movePending,null);assert.equal(g.robots[0].feedback.moves,0);
});
test('real successful attack delivery queues a movement response without counting corrosion ticks',()=>{
 const g=game('easy',10),r=g.robots[0];g.player.x=r.x-40;g.player.facing=1;g.weapon=3;
 for(let n=0;n<feedbackRules(g.difficulty).hits;n++){g.player.attackCd=0;g.attack();g.hit(r,3);}
 assert.ok(r.feedback.movePending);const count=r.feedback.incoming.count;for(let n=0;n<20;n++)g.statusDamage(r,.02);assert.equal(r.feedback.incoming.count,count);
});
test('physical repositions rotate with a visible warning and respect damage, bounds and disabling',()=>{
 const g=game(),r=g.robots[0];r.x=930;r.y=220;r.windup=0;r.combo=null;r.laser=null;
 const hp=r.hp,shield=r.shield;for(const expected of ['break-range','cross-over','change-height']){
  r.feedback.moveCooldown=0;repeated(g,r);assert.equal(updateBossReposition(g,r,.02),true);assert.equal(r.feedback.lastMove,expected);const x=r.x;assert.equal(r.feedback.motion.phase,'tell');assert.equal(r.x,x);
  for(const status of ['emp','radio','root','paralyzed','stun','confused','glueGround']){r[status]=1;const age=r.feedback.motion.age;assert.equal(updateBossReposition(g,r,.02),false,status);assert.equal(r.feedback.motion.age,age);r[status]=0;}
  for(let n=0;n<90;n++)updateBossReposition(g,r,.02);assert.equal(r.feedback.motion,null);assert.ok(r.x>=35&&r.x<=965);assert.equal(r.hp,hp);assert.equal(r.shield,shield);
 }assert.equal(r.feedback.moves,3);
});
test('a spread volley is one attempt, held safe fire is no attempt, real armor damage is a success',()=>{
 const g=game(),r=g.robots[0];r.combo=null;r.comboPolicy.weights=[];r.windup=.01;r.lockX=g.player.x;r.lockY=g.player.y-26;g.synchronized=false;g.updateSuperboss(r,.02);
 assert.equal(g.shots.length,3);assert.equal(r.feedback.attempts.length,1);assert.ok(g.shots.every(s=>s.feedbackAttack===r.feedback.attempts[0]));
 const ticket=g.shots[0].feedbackAttack;g.player.invulnerable=1;g.botHurt(r,10,r.x,0,'test',false,ticket);assert.equal(ticket.landed,false);
 g.player.invulnerable=0;const armor=g.player.mechaShield;g.botHurt(r,10,r.x,0,'test',false,ticket);assert.ok(g.player.mechaShield<armor);assert.equal(ticket.landed,true);
 const safe=game('normal',20),boss=safe.robots[0];boss.combo=null;boss.comboPolicy.weights=[];boss.x=800;boss.y=420;boss.windup=.01;boss.lockX=100;boss.lockY=394;safe.player.x=100;safe.synchronized=true;
 const ally=safe.spawn('guard',8);ally.x=600;ally.y=420;safe.robots.push(ally);safe.updateSuperboss(boss,.02);assert.equal(safe.shots.length,0);assert.equal(boss.feedback.attempts.length,0);
});
test('projectile collisions report actual human damage, independently of structural friendly fire',()=>{
 const g=game('terminator'),r=g.robots[0];g.robots=[r];r.radio=100;r.x=800;g.player.x=300;g.player.y=420;g.player.invulnerable=0;
 const ticket=trackBossAttack(g,r,'core-volley',1);g.shots.push({feedbackAttack:ticket,x:340,y:394,vx:-1000,life:1,owner:r.id,damage:10});g.update(.04,{});assert.equal(ticket.landed,true);
 const structural=trackBossAttack(g,r,'laser',1),cover=g.spawn('buttonGuard',2);const hp=cover.hp;g.friendlyDamage(r.id,cover,30);assert.ok(cover.hp<hp);assert.equal(structural.landed,false);
});
test('missed families produce a different real combo even with no learned player samples',()=>{
 const g=game('normal',20),r=g.robots[0];r.combo=null;r.comboPolicy.weights=[];r.windup=0;r.cooldown=0;g.player.y=200;r.comboCd=0;
 for(let i=0;i<3;i++)trackBossAttack(g,r,'combo-pursuit',.1);g.clock+=.2;updateBossFeedback(g,r,.2);assert.ok(r.feedback.attackPending);
 r.comboCd=1;assert.equal(takeBossAttackSwitch(g,r),null);r.comboCd=0;
 g.updateSuperboss(r,.02);assert.equal(r.combo.id,'airstrike');assert.equal(r.feedback.lastSwitch.from,'combo-pursuit');assert.equal(r.feedback.lastSwitch.to,'combo-airstrike');
 for(let i=0;i<50;i++)g.updateSuperboss(r,.02);assert.ok(r.combo.fired>0);assert.ok(r.x!==700||r.y!==420);
});
test('successful attempts break miss streaks; outcomes are bounded and local to each core',()=>{
 const g=game(),r=g.robots[0];for(let i=0;i<2;i++)trackBossAttack(g,r,'laser',.1);trackBossAttack(g,r,'laser',.1).landed=true;g.clock+=.2;updateBossFeedback(g,r,.2);assert.equal(r.feedback.missStreak,0);assert.equal(r.feedback.attackPending,null);
 for(let i=0;i<40;i++)trackBossAttack(g,r,'core-volley',.1);assert.equal(r.feedback.attempts.length,8);g.clock+=.2;updateBossFeedback(g,r,.2);assert.ok(r.feedback.recent.length<=12);
 assert.equal(takeBossAttackSwitch(g,{...r,feedback:createBossFeedback()}),null);
});
test('laser recovery and objective reboot retain priority over queued learning responses',()=>{
 const g=game('hard'),r=g.robots[0];repeated(g,r);r.combo=null;r.windup=0;r.laserCd=0;g.player.invulnerable=100;g.update(.02,{});assert.equal(r.laser.phase,'charge');assert.equal(r.feedback.moves,0);
 for(let i=0;i<90;i++)g.update(.02,{});assert.equal(r.laser.phase,'recharge');assert.equal(r.feedback.moves,0);
 g.robots=g.robots.filter(o=>!o.structure);g.player.x=g.emergency.x;g.player.y=g.emergency.y+30;assert.ok(g.pressEmergency());assert.equal(r.feedback.attempts.length,0);for(let i=0;i<300;i++)g.update(.02,{});assert.equal(r.feedback.moves,0);assert.ok(r.objectiveReboot>1);assert.ok(r.emp>1);
});
test('difficulty changes response patience, with bounded reaction tells and offline support',()=>{
 const modes=['easy','normal','hard','terminator'];assert.deepEqual(modes.map(d=>feedbackRules(d).hits),[7,6,5,4]);for(const d of modes)assert.ok(feedbackRules(d).tell>=.6);
 assert.ok(readFileSync(new URL('../countermeasure/sw.js',import.meta.url),'utf8').includes("'./boss-feedback.mjs'"));
});

 test('a queued attack revision waits for recovery without being starved by a fresh laser',()=>{
  const g=game('hard',20),r=g.robots[0];r.comboPolicy.weights=[];r.combo=null;r.comboCd=1;r.windup=0;r.cooldown=.2;r.laserCd=0;g.player.invulnerable=100;g.player.y=200;
  for(let n=0;n<3;n++)trackBossAttack(g,r,'core-volley',.1);g.clock+=.2;updateBossFeedback(g,r,.2);
  for(let n=0;n<160&&r.feedback.switches===0;n++)g.update(.02,{});
  assert.equal(r.feedback.switches,1);assert.ok(r.combo);assert.equal(r.laserShots??0,0);assert.ok(!r.laser);
 });
