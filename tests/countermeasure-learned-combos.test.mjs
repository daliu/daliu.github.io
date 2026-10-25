import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {expeditionCheckpoint} from '../countermeasure/expedition-saves.mjs';
import {comboPolicy,chooseCombo,beginCombo} from '../countermeasure/boss-combos.mjs';
import {Chiptune} from '../countermeasure/music.mjs';
import {campaignMemory} from '../countermeasure/campaign-plan.mjs';
function game(wave=20,encounter='boss',difficulty='normal',learned=false){const g=new ExpeditionArena({difficulty,random:()=>.99});g.mechTier=difficulty==='terminator'&&wave>10?5:Math.floor((wave-1)/10)+(encounter==='super'?1:0);if(learned){g.memory.history=[{total:80}];g.memory.outcomes=[{wave:wave-1,won:true,damageTaken:0,attacks:30,seconds:5}];g.memory.jumpRate=.3;g.memory.dashRate=.2;}g.plan=g.makePlan(wave,g.memory,encounter);g.state='between';g.startWave();return g;}
function step(g,t,input={}){for(let n=0;n<t;n+=.02)g.update(.02,input);}
function clear(g){for(const r of g.robots)g.damageRobot(r,1e8);g.update(.02);}
test('visible suit crates cannot be collected during combat; clear unlocks full armor without an automatic equip',()=>{
 for(const difficulty of ['easy','normal','hard','terminator']){const g=game(20,'boss',difficulty);g.player.mechaShield=13;const shield=g.player.mechaShield;g.player.x=500;g.player.y=420;assert.ok(g.mechaDrop.locked);assert.equal(g.collectMechReward(),false);step(g,.1);assert.equal(g.player.mechaShield,shield);clear(g);assert.equal(g.state,'traveling');assert.equal(g.mechaDrop.locked,false);assert.equal(g.player.mechaShield,shield);const hp=g.player.hp;assert.ok(g.collectMechReward());assert.equal(g.player.mechaShield,g.armorCapacity);assert.equal(g.player.hp,hp);assert.ok(g.mechaDrop.collected);assert.equal(g.collectMechReward(),false);}
});
test('a saved checkpoint after a cleared milestone includes its earned full suit even before pickup',()=>{
 const g=game(10,'boss','terminator');assert.equal(g.player.mecha,false);assert.equal(g.mechTier,0);const before=g.snapshot();assert.ok(expeditionCheckpoint(before));clear(g);assert.equal(g.mechTier,0);const c=g.nextCheckpoint();assert.ok(expeditionCheckpoint(c));assert.equal(c.encounter,'super');assert.equal(c.mechTier,5);assert.equal(c.carry.shield,168);const h=new ExpeditionArena();assert.ok(h.resume(c));assert.equal(h.player.mechaShield,168);assert.equal(h.mechaDrop,null);
});
test('travel animates effects and carries held movement straight into the next fight',()=>{
 const g=new ExpeditionArena();g.startWave();clear(g);g.effects.push({kind:'burst',life:.6,max:.6,x:300,y:300,color:'#fff'});const clock=g.clock;step(g,.2,{right:true});assert.equal(g.state,'traveling');assert.ok(g.clock>clock);assert.ok(g.effects[0].life<.5);for(let n=0;n<200&&g.wave===1;n++)g.update(.02,{right:true,attack:true});assert.equal(g.wave,2);assert.equal(g.state,'playing');const x=g.player.x;g.update(.02,{right:true});assert.ok(g.player.x>x);
});
test('music keeps scheduling through travel without muting or resetting the phrase',async()=>{
 const gains=[],notes=[];class Context{constructor(){this.currentTime=0;this.sampleRate=100;this.destination={};}createGain(){return {connect(){},gain:{value:0,setTargetAtTime:v=>gains.push(v)}};}createBuffer(_,n){return {getChannelData:()=>new Float32Array(n)};}async resume(){}}
 const m=new Chiptune(Context);m.tone=(...args)=>notes.push(args);m.drum=()=>{};await m.setEnabled(true);m.update('playing',9,'room');const step=m.step;m.ctx.currentTime=.2;m.update('traveling',9,'room');assert.ok(m.step>step);assert.equal(m.mode,'arena');assert.equal(gains.at(-1),m.volume);const count=notes.length;m.ctx.currentTime=.4;m.update('playing',10,'boss');assert.ok(notes.length>count);assert.equal(m.mode,'boss');m.update('paused',10,'boss');assert.equal(gains.at(-1),0);
});
test('continuous industrial acid damages a flying superboss without adding stun, glue, roots or grounding',()=>{
 const g=game(20,'super','terminator'),r=g.robots[0];r.hp=r.maxHp=1e6;r.evadeRate=0;g.player.x=r.x-100;g.weaponTiers[3]=3;for(let n=0;n<40;n++)g.hit(r,3);assert.ok(r.hp<r.maxHp);assert.equal(r.glue,0);assert.equal(r.root,0);assert.equal(r.stun,0);assert.ok(!(r.glueGround>0));g.player.y=160;g.player.invulnerable=100;step(g,.5,{up:true});assert.ok(r.y<400);
});
test('industrial glue bomb grounds for two seconds, slows for three more, and cannot repeat until ten seconds',()=>{
 for(const difficulty of ['normal','terminator']){const g=game(20,'super',difficulty),r=g.robots[0];g.player.x=250;g.player.y=250;g.player.facing=1;g.player.invulnerable=100;r.x=440;r.y=270;assert.ok(g.selectModule(1));assert.ok(g.useModule());assert.equal(g.moduleCooldowns[1],10);assert.equal(g.glueBombs.length,1);for(let n=0;n<33;n++)g.updateGlueBombs(.02);assert.equal(g.glueBombs.length,0);assert.equal(r.glueGround,2);assert.equal(r.glueSlow,5);assert.equal(r.root,0);step(g,1.8,{up:true});assert.ok(r.glueGround>0);assert.equal(r.y,420);step(g,.4,{up:true});assert.equal(r.glueGround,0);assert.ok(r.glueSlow>2.7);assert.ok(r.y<420);step(g,3,{up:true});assert.equal(r.glueSlow,0);assert.equal(r.glue,0);assert.ok(g.moduleCooldowns[1]>4);assert.equal(g.useModule(),false);step(g,5,{up:true});assert.equal(g.moduleCooldowns[1],0);assert.equal(g.useModule(),true);}
});
test('learning weights respond to efficient dispatches and weapon/movement habits rather than level alone',()=>{
 const a=campaignMemory();assert.equal(comboPolicy(a,5).weights.length,0);a.history=[{total:80}];a.outcomes=[{won:true,seconds:30}];const slow=comboPolicy(a,3);a.outcomes=[{won:true,seconds:4}];a.effective=[0,0,1,0];a.jumpRate=.4;const fast=comboPolicy(a,3);assert.ok(fast.pace>slow.pace);assert.ok(fast.weights.find(w=>w.id==='rebound').weight>slow.weights.find(w=>w.id==='rebound').weight);assert.notEqual(chooseCombo(fast,()=>0),chooseCombo(fast,()=>.999));assert.ok(!comboPolicy(a,1).weights.some(w=>w.id==='feint'));
});
test('combo lessons freeze during a fight and update when the next duel starts',()=>{
 const g=game(30,'boss','normal',true),r=g.robots[0],before=structuredClone(r.comboPolicy);g.memory.outcomes=[{won:true,seconds:80}];g.memory.effective=[1,0,0,0];assert.deepEqual(r.comboPolicy,before);g.mirrorBlueprint=null;g.state='between';g.startWave();assert.notDeepEqual(g.robots[0].comboPolicy,before);
});
test('rebound circuit has a readable windup and fires real projectiles in both directions',()=>{
 const g=game(30,'super','normal',true),r=g.robots[0];g.player.invulnerable=100;beginCombo(g,r,'rebound');step(g,.4);assert.equal(g.shots.length,0);assert.ok(r.windup>0);step(g,.3);assert.ok(g.shots.some(s=>s.kind==='mirror-circuit'&&s.vx<0));assert.ok(g.shots.some(s=>s.kind==='mirror-circuit'&&s.vx>0));assert.ok(r.y<420);step(g,1.2);assert.equal(r.combo,null);assert.ok(r.comboCd>0);
});
test('duck counter actually evades a level horizontal shot before its follow-up',()=>{
 const g=game(20,'boss','normal',true),r=g.robots[0];r.x=400;g.player.x=300;g.player.y=r.y;g.weapon=2;g.player.invulnerable=100;beginCombo(g,r,'riposte');step(g,.2);assert.ok(r.crouching);const hp=r.hp;g.attack();assert.equal(r.hp,hp);step(g,.9);assert.ok(r.comboCounts.riposte>0);assert.ok(g.effects.some(e=>e.kind==='attack')||g.shots.some(s=>s.kind==='mirror-circuit'));
});
test('all learned moves remain finite and finish with bounded recovery rather than endless pursuit',()=>{
 for(const id of ['rebound','pursuit','riposte','feint']){const g=game(40,'super','normal',true),r=g.robots[0];g.player.invulnerable=100;g.player.y=180;beginCombo(g,r,id);const x=r.x;step(g,1.8,{left:true,up:true});assert.equal(r.combo,null);assert.ok(r.comboCd>0);assert.ok([r.x,r.y,r.vy].every(Number.isFinite));assert.ok(g.shots.length<=12);if(id==='pursuit'||id==='feint')assert.notEqual(r.x,x);}
});

test('learned combos cannot give the first superboss flight through the copied player suit',()=>{const g=game(10,'super','normal',true),r=g.robots[0];g.player.y=100;g.player.invulnerable=100;beginCombo(g,r,'rebound');step(g,1.5,{up:true});assert.equal(r.flies,false);assert.ok(r.y>=290);assert.ok(r.jumps>0);});
