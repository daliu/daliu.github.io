import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,TRAINING_WAVES,BOSS_WAVE,FINAL_WAVE,makePlan,emptyMemory} from '../countermeasure/engine.mjs';
function mirrorExit({mecha=true,hp=73,shield=27}={}){const a=new Arena({random:()=>.99});a.wave=TRAINING_WAVES;a.state='between';a.points=12;a.weaponTiers=[2,2,2,2];a.memory={...emptyMemory(),waves:9};a.plan=makePlan(BOSS_WAVE,a.memory);a.startWave();Object.assign(a.player,{hp,mecha,mechaShield:mecha?shield:0});a.robots[0].hp=0;a.update(.02);return a;}
function finale(options){const a=mirrorExit(options);a.startWave();return a;}
function advance(a,seconds,input={}){for(let t=0;t<seconds;t+=.02)a.update(.02,input);}
function button(a){a.player.x=a.emergency.x;a.player.y=a.emergency.y+30;a.player.vy=0;a.player.grounded=false;a.attack();}

test('Mirror defeat opens the secret boss without recording survival or retraining the learner',()=>{
 const a=mirrorExit();assert.equal(a.state,'between');assert.equal(a.plan.wave,FINAL_WAVE);assert.deepEqual(a.plan.units,['overseer']);assert.equal(a.subject.status,'active');assert.equal(a.memory.waves,9);assert.equal(a.register.records.length,0);
});
test('the Mirror suit, remaining armor, health, skills and weapon stages carry into the emergency chamber',()=>{
 const a=mirrorExit();a.allocate('force',1);const tiers=[...a.weaponTiers],memory=structuredClone(a.memory);a.startWave();assert.equal(a.player.mecha,true);assert.equal(a.player.mechaShield,27);assert.equal(a.player.hp,73);assert.equal(a.skills.force,1);assert.deepEqual(a.weaponTiers,tiers);assert.deepEqual(a.memory,memory);assert.equal(a.mechaDrop,null);
});
test('missing the original pod cannot softlock flight: the recovered drop remains available at entry',()=>{
 const a=finale({mecha:false});assert.equal(a.player.mecha,false);assert.ok(a.mechaDrop.landed);assert.equal(a.mechaDrop.x,a.player.x);a.update(.02);assert.equal(a.player.mecha,true);assert.equal(a.player.mechaShield,60);assert.equal(a.player.hp,73);
});
test('hold up flies with the mecha; releasing it restores gravity and ordinary humans cannot fly',()=>{
 const a=finale();advance(a,1.5,{up:true});assert.equal(a.player.y,86);assert.equal(a.player.flying,true);assert.equal(a.player.grounded,false);const y=a.player.y;advance(a,.6);assert.ok(a.player.y>y+30);assert.equal(a.player.flying,false);
 const b=new Arena({random:()=>.99});b.startWave();b.jump();let min=420;for(let i=0;i<100;i++){b.update(.02,{up:true});min=Math.min(min,b.player.y);}assert.ok(min>300);assert.equal(b.player.y,420);
});
test('the secret boss counters every weapon stage and ground corrosion before the EMP',()=>{
 const a=finale(),r=a.robots[0];for(let weapon=0;weapon<4;weapon++)for(let tier=0;tier<3;tier++){a.weaponTiers[weapon]=tier;a.hit(r,weapon);assert.equal(r.hp,r.maxHp);assert.equal(r.paralyzed,0);assert.equal(r.corrosion,0);}assert.ok(a.effects.some(e=>e.text==='COUNTERED'));a.addPool(r.x,2);r.cooldown=100;advance(a,.5);assert.equal(r.hp,r.maxHp);
});
test('Overseer chases and jumps ballistically, returns to the floor and never reaches button height',()=>{
 const a=finale(),r=a.robots[0];a.player.x=900;let min=420;for(let i=0;i<250;i++){a.update(.02,{up:true});min=Math.min(min,r.y);}assert.ok(r.jumps>=2);assert.ok(min>250);assert.ok(a.player.y<r.y-100);assert.ok(r.x>800);assert.ok(a.player.hp>0);
 // Removing the aerial target cannot leave the machine hovering.
 a.player.y=420;a.player.vy=0;a.player.hp=10000;advance(a,1.5);assert.equal(r.y,420);
});
test('Enter/click action is proximity-gated and takes priority over an active weapon cooldown',()=>{
 const a=finale();a.player.x=900;a.player.y=420;a.attack();assert.equal(a.emergency.activated,false);a.player.x=200;a.player.y=138;a.player.attackCd=0;a.attack();assert.equal(a.emergency.activated,false);a.player.attackCd=10;button(a);assert.equal(a.emergency.activated,true);assert.equal(a.emergency.uses,1);a.attack();assert.equal(a.emergency.uses,1);
});
test('EMP clears hazards, disables counters and attacks, keeps flight online, and starts a real backup countdown',()=>{
 const a=finale(),r=a.robots[0];a.addPool(200,2);a.shots.push({x:300,y:390,vx:1,life:3});r.windup=.1;r.action='counter-strike';button(a);assert.equal(r.disabled,true);assert.equal(r.hp,240);assert.equal(a.emergency.backup,12);assert.equal(a.pools.length,0);assert.equal(a.shots.length,0);assert.equal(a.state,'playing');assert.equal(a.player.mecha,true);assert.equal(a.player.mechaShield,27);const x=r.x;a.update(.02,{up:true});assert.equal(r.x,x);assert.ok(a.emergency.backup<12);assert.equal(a.player.flying,true);assert.equal(a.subject.status,'active');
});
test('EMP and backup timing freeze on pause, while an expired backup restores counters and rearms the button',()=>{
 const a=finale(),r=a.robots[0];button(a);a.state='paused';const before=structuredClone({e:a.emergency,p:a.player,r});advance(a,2,{up:true,attack:true});assert.deepEqual({e:a.emergency,p:a.player,r},before);a.state='playing';advance(a,12.1,{up:true});assert.equal(r.disabled,false);assert.equal(a.emergency.activated,false);const hp=r.hp;a.hit(r,1);assert.equal(r.hp,hp);button(a);assert.equal(r.disabled,true);assert.equal(a.emergency.uses,2);
});
test('destroying the disabled core opens the escape; walking out records the survivor',()=>{
 const a=finale(),r=a.robots[0];button(a);assert.equal(a.state,'playing');a.player.x=r.x-70;a.player.y=420;a.player.facing=1;a.weapon=1;for(let i=0;i<500&&a.state==='playing';i++)a.update(.02,{attack:true});assert.equal(a.state,'escaping');assert.equal(a.subject.status,'active');advance(a,4,{left:true});assert.equal(a.state,'complete');assert.ok(r.hp<=0);assert.equal(a.subject.status,'survived');assert.match(a.subject.cause,/EMP/);assert.equal(a.memory.waves,9);assert.equal(a.register.records.length,1);assert.equal(a.startWave(),false);
});
test('a failed finale retries its own checkpoint with the carried suit, and resets EMP and backup state',()=>{
 const a=finale();const name=a.subject.name;button(a);a.player.mechaShield=0;a.player.invulnerable=0;a.hurt(1000,500);assert.equal(a.state,'dead');a.retry();assert.equal(a.wave,FINAL_WAVE);assert.equal(a.player.mecha,true);assert.equal(a.player.mechaShield,27);assert.equal(a.player.hp,73);assert.equal(a.emergency.activated,false);assert.equal(a.emergency.uses,0);assert.equal(a.emergency.backup,0);assert.equal(a.robots[0].disabled,false);assert.notEqual(a.subject.name,name);assert.equal(a.memory.waves,9);a.reset();assert.equal(a.emergency,null);assert.equal(a.finaleCheckpoint,null);assert.equal(a.player.mecha,false);
});
test('real movement and attacks can fly to the button, trigger EMP, descend and destroy the backup core',()=>{
 const a=finale({hp:100,shield:60});a.weapon=1;a.skills.force=3;let pressed=false,minPlayer=420,minRobot=420;
 for(let tick=0;tick<2000&&a.state==='playing';tick++){const p=a.player,r=a.robots[0];let up=false,right=false,left=false,attack=false;
  if(!pressed){up=true;right=p.x<880;attack=a.nearEmergency();}
  else {const dx=r.x-p.x;p.facing=Math.sign(dx)||1;right=dx>75;left=dx< -75;attack=true;}
  a.update(.02,{up,right,left,attack});pressed ||= a.emergency.activated;minPlayer=Math.min(minPlayer,p.y);minRobot=Math.min(minRobot,r.y);
 }
 assert.equal(a.state,'escaping');advance(a,4,{left:true});assert.equal(a.state,'complete',`HP ${a.player.hp}, core ${a.robots[0].hp}`);assert.equal(pressed,true);assert.ok(minPlayer<160);assert.ok(minRobot>250);assert.ok(a.emergency.backup>0);assert.equal(a.player.mecha,true);
});

test('after the EMP, each weapon family can destroy the exposed core within the backup window',()=>{
 for(let weapon=0;weapon<4;weapon++){const a=finale({hp:100,shield:60}),r=a.robots[0];button(a);a.weapon=weapon;a.player.x=r.x-70;a.player.y=420;a.player.facing=1;for(let i=0;i<500&&a.state==='playing';i++)a.update(.02,{attack:true});assert.equal(a.state,'escaping',`weapon ${weapon} should finish the core`);advance(a,4,{left:true});assert.equal(a.state,'complete');assert.ok(a.emergency.backup>0);}
});
