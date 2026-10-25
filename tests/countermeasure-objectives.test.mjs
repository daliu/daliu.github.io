import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {structureBounds,structureHitFraction} from '../countermeasure/objective-geometry.mjs';
import {laserContact} from '../countermeasure/boss-laser.mjs';
function game(mode='terminator',wave=50){const g=new ExpeditionArena({difficulty:mode,random:()=>.99});g.mechTier=mode==='terminator'?5:wave/10;g.plan=g.makePlan(wave,g.memory,'super');g.state='between';g.startWave();g.player.invulnerable=100;return g;}
function step(g,seconds,input={}){for(let n=0;n<Math.ceil(seconds/.02);n++)g.update(.02,input);}
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('emergency button is spent once; backup returns after the eight-second shutdown with permanently reduced shields on every difficulty',()=>{
 for(const mode of ['easy','normal','hard','terminator']){const g=game(mode,10),r=g.robots[0];r.laserCd=1000;g.player.x=900;g.player.y=138;assert.ok(g.pressEmergency());assert.equal(g.emergency.uses,1);assert.ok(r.emp>=8);assert.equal(g.nearEmergency(),false);assert.equal(g.pressEmergency(),false);step(g,7);assert.ok(r.emp>.9);assert.ok(!r.shieldReduced);step(g,.9);assert.ok(!g.emergency.rerouted);step(g,.2);assert.ok(g.emergency.rerouted);assert.ok(g.emergency.activated);assert.equal(g.emergency.backup,0);assert.ok(r.shieldReduced);assert.equal(r.emp,0);g.player.x=900;g.player.y=138;assert.equal(g.pressEmergency(),false);assert.equal(g.emergency.uses,1);step(g,15);assert.ok(r.shieldReduced);assert.ok(g.emergency.activated);}
});
test('backup mode reduces active resistance from82% to40%, without changing HP or removing critical/weakness windows',()=>{
 const g=game('normal',10),r=g.robots[0],maxHp=r.maxHp;let hp=r.hp;g.damageRobot(r,100);approx(hp-r.hp,18);g.player.x=900;g.player.y=138;assert.ok(g.pressEmergency());hp=r.hp;g.damageRobot(r,100);approx(hp-r.hp,85);step(g,12.1);hp=r.hp;g.damageRobot(r,100);approx(hp-r.hp,60);assert.equal(r.maxHp,maxHp);r.paralyzed=1;hp=r.hp;g.damageRobot(r,100);approx(hp-r.hp,85);
});
test('spent switch cannot consume attacks near its old activation area; retry starts a fresh full fight',()=>{
 const g=game('normal',10),r=g.robots[0];g.player.x=900;g.player.y=138;g.pressEmergency();r.x=850;r.y=138;g.player.facing=-1;g.weapon=1;g.player.attackCd=0;const hp=r.hp;g.attack();assert.ok(r.hp<hp);assert.equal(g.emergency.uses,1);g.player.invulnerable=0;g.hurt(100000,0);assert.equal(g.state,'dead');g.retry();assert.equal(g.emergency.activated,false);assert.equal(g.emergency.uses,0);assert.ok(!g.robots[0].shieldReduced);
});
test('Terminator defenses accept robot attacks while allied mobile robots remain immune',()=>{
 const g=game(),r=g.robots[0],wall=g.robots.find(r=>r.type==='buttonGuard'),antenna=g.robots.find(r=>r.type==='antenna');const ally=g.spawn('guard',100);g.robots.push(ally);for(const target of [wall,antenna,ally]){const hp=target.hp;g.friendlyDamage(r.id,target,100);approx(hp-target.hp,target.structure?100:0);}const shot={friendlyFire:false};assert.equal(g.robotShotHitsAlly(shot,wall),true);assert.equal(g.robotShotHitsAlly(shot,antenna),true);assert.equal(g.robotShotHitsAlly(shot,ally),false);
});
test('visible mast and thick fortress plates have full hitboxes, including vertical and fast crossing shots',()=>{
 const a={type:'antenna',structure:true,x:160,y:420,maxHp:5500},b={type:'buttonGuard',structure:true,x:900,y:170,maxHp:14000};const bounds=structureBounds(b);assert.equal(bounds.left,808);assert.equal(bounds.bottom,239);assert.notEqual(structureHitFraction(a,0,160,300,160),null);assert.notEqual(structureHitFraction(b,700,50,1000,50),null);assert.notEqual(structureHitFraction(b,900,0,900,300),null);assert.equal(structureHitFraction(a,0,80,300,80),null);assert.equal(structureHitFraction(b,700,260,1000,260),null);
 assert.ok(laserContact({x:500,y:160,dx:-1,dy:0},a));assert.ok(laserContact({x:500,y:220,dx:1,dy:0},b));
});
test('a Terminator projectile passes allied robots and hits the upper antenna instead of tunneling through it',()=>{
 const g=game(),source=g.robots[0],a=g.robots.find(r=>r.type==='antenna'),ally=g.spawn('guard',100);g.robots.push(ally);ally.x=300;ally.y=200;ally.radio=100;source.radio=100;g.player.x=80;g.player.y=200;const hp=a.hp,other=ally.hp;g.shots=[{x:650,y:180,vx:-1400,life:1,owner:source.id,damage:36}];step(g,.45,{up:true});approx(hp-a.hp,36);assert.equal(ally.hp,other);assert.equal(g.shots.length,0);
});
test('baited fortress lasers deal a quarter armor on Hard and Terminator, once per blast',()=>{
 for(const mode of ['hard','terminator']){const g=game(mode),r=g.robots[0],b=g.robots.find(r=>r.type==='buttonGuard'),ally=g.spawn('guard',100);r.x=500;r.y=200;r.laserCd=0;r.combo=null;r.windup=0;g.player.x=680;g.player.y=200;ally.x=760;ally.y=200;ally.radio=100;g.robots.push(ally);const hp=b.hp,other=ally.hp;g.update(.02);assert.equal(r.laser.phase,'charge');const dx=r.laser.dx,dy=r.laser.dy;step(g,mode==='hard'?1.4:1.1,{up:true});assert.equal(r.laser.dx,dx);assert.equal(r.laser.dy,dy);approx(hp-b.hp,b.maxHp*.25);assert.equal(ally.hp,other);assert.ok(r.laser.hits.has(b.id));step(g,.15,{up:true});approx(hp-b.hp,b.maxHp*.25);}
});
test('destroying antenna armor through enemy damage still grants its full reboot and desynchronization',()=>{
 const g=game(),r=g.robots[0],a=g.robots.find(r=>r.type==='antenna');r.controlRecovery=5;g.friendlyDamage(r.id,a,a.maxHp);assert.ok(a.hp<=0);assert.equal(g.synchronized,false);assert.equal(r.emp,8);assert.equal(r.objectiveReboot,8);assert.equal(r.controlRecovery,0);step(g,7);assert.ok(r.emp>.9);
});
test('human weapons can strike visible upper objective armor as well as its center',()=>{
 const g=game(),a=g.robots.find(r=>r.type==='antenna');g.player.x=290;g.player.y=185;g.player.facing=-1;g.weapon=1;const hp=a.hp;g.attack();assert.ok(a.hp<hp);assert.equal(g.emergency.uses,0);
});
