import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {laserRules,laserContact} from '../countermeasure/boss-laser.mjs';
import {beginCombo} from '../countermeasure/boss-combos.mjs';
import {HeldControls,bindAttackControl,bindPointerControl,bindWeaponSwitch} from '../countermeasure/controls.mjs';
function game(mode='hard',wave=20,phase='super') {const g=new ExpeditionArena({difficulty:mode,random:()=>.99});g.mechTier=mode==='terminator'?5:Math.floor((wave-1)/10)+(phase==='super'?1:0);g.plan=g.makePlan(wave,g.memory,phase);g.state='between';g.startWave();return g;}
function step(g,seconds,input={}){for(let n=0;n<Math.ceil(seconds/.02);n++)g.update(.02,input);}
function prime(g){const r=g.robots[0];r.laserCd=0;r.combo=null;r.windup=0;g.player.invulnerable=100;g.update(.02);assert.equal(r.laser?.phase,'charge');return r;}
test('friendly damage chances decrease by mode, with zero allied damage on Terminator',()=>{
 for(const [mode,count] of [['easy',1000],['normal',700],['hard',300],['terminator',0]]){const g=game(mode,21,'room'),r=g.robots[0];r.hp=r.maxHp=10000;let n=0;g.random=()=>n++/1000;for(let k=0;k<1000;k++)g.friendlyDamage('other-robot',r,1);assert.equal(10000-r.hp,count,mode);}
});
test('Terminator shots pass through allies and still hit the human; allowed friendly shots hit the ally once',()=>{
 for(const [mode,random,expectAlly] of [['terminator',0,false],['hard',.99,false],['hard',0,true],['normal',0,true]]){const g=game(mode,21,'room');g.random=()=>random;const a=g.spawn('guard',1),s=g.spawn('gunner',2);g.robots=[a,s];a.x=500;s.x=700;a.y=s.y=420;a.radio=s.radio=100;g.player.x=300;g.player.y=420;g.player.mechaShield=0;g.player.mecha=false;g.player.invulnerable=0;const hp=a.hp,human=g.player.hp;g.shots=[{x:650,y:394,vx:-1000,life:1,owner:s.id,damage:12}];step(g,.4);assert.equal(a.hp<hp,expectAlly);assert.equal(g.player.hp<human,!expectAlly);}
});
test('friendly projectile policy is sampled once instead of rerolling for each body/frame',()=>{const g=game('hard');let n=0;g.random=()=>{n++;return .8;};const shot={};for(let i=0;i<200;i++)assert.equal(g.robotShotHitsAlly(shot),false);assert.equal(n,1);});
test('Terminator robot blasts and chemical residue cannot damage allied hardware; human acid still can',()=>{
 const g=game('terminator',21,'room'),r=g.robots[0];r.x=500;r.y=420;const hp=r.hp;g.friendlyDamage('drone-owner',r,100,true);const pool=g.addPool(500,2,'drone-owner');g.statusDamage(r,.02);assert.equal(r.hp,hp);g.pools=[];g.addPool(500,2);r.hazardCd=0;g.statusDamage(r,.02);assert.ok(r.hp<hp);assert.equal(r.corrosionOwner,null);assert.equal(pool.owner,'drone-owner');
});
test('Easy/Normal do not gain lasers and Terminator timings are faster than Hard',()=>{assert.equal(laserRules('easy'),null);assert.equal(laserRules('normal'),null);for(const key of ['charge','recharge','cooldown'])assert.ok(laserRules('terminator')[key]<laserRules('hard')[key]);const g=game('normal');step(g,8);assert.ok(!g.robots[0].laser);});
test('laser locks its direction during a visible charge, leaving time to jump clear',()=>{
 const g=game(),r=prime(g),locked={...r.laser};assert.ok(r.windup>1);g.player.y=200;step(g,.7,{up:true});assert.equal(r.laser.dx,locked.dx);assert.equal(r.laser.dy,locked.dy);assert.equal(r.laser.x,locked.x);assert.equal(r.laser.y,locked.y);assert.equal(r.laser.phase,'charge');assert.equal(laserContact(r.laser,g.player),false);step(g,.7,{up:true});assert.equal(r.laser.phase,'blast');assert.ok(!r.laser.hits.has('human'));
});
test('laser reaches across the room and applies at most one human hit per blast',()=>{
 const g=game(),r=prime(g);g.player.x=r.x-450;g.player.y=420;g.player.invulnerable=0;g.player.mechaShield=0;g.player.mecha=false;const hp=g.player.hp;step(g,1.4);assert.equal(r.laser.phase,'blast');assert.ok(g.player.hp<hp);const after=g.player.hp;step(g,.2);assert.equal(g.player.hp,after);assert.equal(r.laserShots,1);
});
test('recharge disables attacks, exposes the core to damage, and ends with bounded cooldown',()=>{
 for(const mode of ['hard','terminator']){const g=game(mode),r=prime(g),rules=laserRules(mode);step(g,rules.charge+rules.blast);assert.equal(r.laser.phase,'recharge');assert.ok(r.disabled);assert.equal(r.combo,null);assert.equal(r.windup,0);const hp=r.hp;g.damageRobot(r,100);assert.ok(Math.abs(hp-r.hp-85)<1e-6);const x=r.x;step(g,rules.recharge-.08);assert.equal(r.laser.phase,'recharge');assert.equal(r.x,x);assert.equal(r.laserShots,1);step(g,.1);assert.equal(r.laser,null);assert.equal(r.disabled,false);assert.ok(r.laserCd>rules.cooldown-.15);assert.ok(r.comboCd>0);}
});
test('EMP, radio and glue interrupt a charge rather than leaving an invisible delayed laser',()=>{
 for(const status of ['emp','radio','glueGround']){const g=game(),r=prime(g);r[status]=2;step(g,.04);assert.equal(r.laser,null,status);assert.ok(r.laserCd>8);assert.ok(!r.laserShots);}
});
test('pausing freezes charge and recharge; resumes in the same phase',()=>{const g=game(),r=prime(g),time=r.laser.time;g.pause();step(g,2);assert.equal(r.laser.time,time);g.pause();g.update(.02);assert.ok(r.laser.time<time);});
test('Hard Mirror warning and recovery are longer while copied affinities and powered pursuit remain',()=>{
 for(const mode of ['normal','hard']){const g=game(mode,30,'boss'),r=g.robots[0];r.comboPolicy.weights=[{id:'airstrike',weight:1}];beginCombo(g,r,'airstrike');assert.equal(r.combo.windup,mode==='hard'?.72:.6);step(g,1.9,{up:true});assert.equal(r.combo,null);assert.ok(r.comboCd>2);assert.ok(r.y>=145);}
});
class Pad extends EventTarget{classList={toggle(){}};setPointerCapture(){};emit(type,id,extra={}){const e=new Event(type,{cancelable:true});for(const [k,v] of Object.entries({pointerId:id,button:0,clientY:100,clientX:100,...extra}))Object.defineProperty(e,k,{value:v});this.dispatchEvent(e);}}
test('phone multi-pointer flight/fire/steering and weapon switches survive charge and recovery at all boss milestones',()=>{
 for(const mode of ['hard','terminator'])for(const wave of [10,20,30,40,50]){const g=game(mode,wave),r=prime(g),c=new HeldControls(),fire=new Pad(),left=new Pad(),bar=new Pad();bindAttackControl(fire,{controls:c,canStart:()=>g.state==='playing',canFly:()=>true,onJump:()=>g.jump(),onPress:()=>g.attack()});bindPointerControl(left,{controls:c,action:'left',canStart:()=>g.state==='playing'});bindWeaponSwitch(bar,n=>g.weapon=n);left.emit('pointerdown',1);fire.emit('pointerdown',2);fire.emit('pointermove',2,{clientY:60});bar.emit('pointerdown',3,{target:{closest:()=>({dataset:{weapon:'3'}})}});step(g,.3,c.state);assert.ok(g.player.y<400);assert.ok(c.state.up&&c.state.left&&c.state.attack);assert.equal(g.weapon,3);fire.emit('pointercancel',2);assert.equal(c.state.attack,false);assert.equal(c.state.up,false);assert.ok(c.state.left);left.emit('pointerup',1);assert.ok(Object.values(c.state).every(v=>!v));step(g,laserRules(mode).charge+laserRules(mode).blast);assert.equal(r.laser.phase,'recharge');}
});

test('an extra electrical stun cannot cancel the earned recharge vulnerability',()=>{const g=game(),r=prime(g);step(g,1.7);assert.equal(r.laser.phase,'recharge');const before=r.laser.time;r.paralyzed=.8;g.update(.02);assert.equal(r.laser.phase,'recharge');assert.ok(r.laser.time<before);assert.ok(r.disabled);const hp=r.hp;g.damageRobot(r,100);assert.ok(Math.abs(hp-r.hp-85)<1e-6);});
