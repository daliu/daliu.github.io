import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,TRAINING_WAVES,BOSS_WAVE,emptyMemory,makePlan} from '../countermeasure/engine.mjs';
function duel({style={},weapon=1,skills={},tiers=[2,2,2,2]}={}){const a=new Arena({random:()=>.99});a.wave=TRAINING_WAVES;a.state='between';a.points=12;Object.assign(a.skills,skills);a.weapon=weapon;a.weaponTiers=[...tiers];a.memory={...emptyMemory(),waves:TRAINING_WAVES,...style};a.plan=makePlan(BOSS_WAVE,a.memory);a.startWave();return a;}

test('mirror takes a deep copy of assigned skills, weapon stages, selected weapon and learned style',()=>{
 const a=duel({weapon:2,skills:{force:2,voltage:3,agility:2,plating:1},style:{weapon:[.1,.2,.6,.1],farRatio:.8,jumpRate:.4,dashRate:.2,attackRate:2}}),r=a.robots[0];
 assert.equal(r.type,'mirror');assert.equal(r.hp,600);assert.deepEqual(r.build.skills,a.skills);assert.deepEqual(r.build.tiers,a.weaponTiers);assert.equal(r.weapon,2);assert.deepEqual(r.build.style,a.memory);
 const frozen=structuredClone(r.build);a.respec();a.setTier(2,0);a.memory.weapon[2]=0;assert.deepEqual(r.build,frozen);assert.equal(r.build.skills.voltage,3);
});
test('different learned habits produce different weapon, jump, dash and duck behaviors',()=>{
 const melee=duel({weapon:0,style:{weapon:[1,0,0,0],farRatio:0,attackRate:2}}),ranged=duel({weapon:2,style:{weapon:[0,0,1,0],farRatio:.9,attackRate:2,jumpRate:.4,dashRate:.3,duckRatio:.5}});
 for(const a of [melee,ranged]){a.player.hp=10000;a.player.x=450;for(let i=0;i<1600;i++)a.update(.02,{});}
 const m=melee.robots[0],r=ranged.robots[0];assert.ok(m.attacks[0]>0);assert.equal(m.attacks[2],0);assert.ok(r.attacks[2]>0);assert.equal(r.attacks[0],0);assert.equal(m.jumps,0);assert.ok(r.jumps>0);assert.equal(m.dashes,0);assert.ok(r.dashes>0);assert.ok(Math.abs(r.x-ranged.player.x)>Math.abs(m.x-melee.player.x));
});
test('mirror attacks have a windup; copied skill ranks change attack damage',()=>{
 const a=duel({weapon:0,skills:{force:3},tiers:[0,0,0,0],style:{weapon:[1,0,0,0]}}),r=a.robots[0];a.player.x=500;a.player.invulnerable=0;r.x=560;r.cooldown=0;
 a.update(.02);assert.ok(r.windup>0);assert.equal(a.player.hp,100);for(let i=0;i<30;i++)a.update(.02);assert.ok(a.player.hp<100);
 const b=duel({weapon:0,tiers:[0,0,0,0]}),s=b.robots[0];b.player.x=500;b.player.invulnerable=0;s.x=560;s.facing=-1;b.mirrorAttack(s);assert.ok(100-a.player.hp>100-b.player.hp);
});
test('the mecha drops once at 35 percent, falls physically, freezes on pause and requires pickup',()=>{
 const a=duel(),r=a.robots[0];r.cooldown=100;r.hp=216;a.update(.02);assert.equal(a.mechaDrop,null);r.hp=210;a.update(.02);assert.ok(a.mechaDrop);assert.equal(a.player.mecha,false);const drop=a.mechaDrop,y=drop.y;
 a.state='paused';a.update(.04);assert.equal(drop.y,y);a.state='playing';for(let i=0;i<70;i++)a.update(.02);assert.equal(drop.landed,true);assert.equal(a.player.mecha,false);a.player.x=drop.x;const hp=a.player.hp;a.update(.02);assert.equal(a.player.mecha,true);assert.equal(a.player.mechaShield,60);assert.equal(a.player.hp,hp);a.player.mechaShield=31;for(let i=0;i<10;i++)a.update(.02);assert.equal(a.player.mechaShield,31);assert.equal(a.mechaDrop,drop);
});
test('mecha changes damage, movement, jump and damage absorption without healing via respec',()=>{
 const a=duel({tiers:[0,0,0,0]}),r=a.robots[0];a.hit(r,1);const base=r.maxHp-r.hp;r.hp=r.maxHp;a.player.mecha=true;a.player.mechaShield=60;a.hit(r,1);assert.ok(Math.abs((r.maxHp-r.hp)-base*1.65)<1e-8);
 a.player.invulnerable=0;a.hurt(20,a.player.x);assert.equal(a.player.hp,100);assert.equal(a.player.mechaShield,46);a.player.invulnerable=0;a.hurt(100,a.player.x);assert.ok(a.player.hp<100);assert.equal(a.player.mechaShield,0);
 a.respec();a.setTier(1,0);assert.equal(a.player.mechaShield,0);a.player.x=200;a.update(.02,{right:true});assert.ok(a.player.vx>320);a.player.grounded=true;a.jump();assert.equal(a.player.vy,-620);
});
test('death resets the pod and suit but retains the same mirror copy and permits a new human build',()=>{
 const a=duel({skills:{force:3}}),copy=structuredClone(a.robots[0].build);a.player.mecha=true;a.player.mechaShield=10;a.mechaDrop={x:500,y:420,landed:true,collected:true};a.player.invulnerable=0;a.hurt(1000,900);assert.equal(a.state,'dead');a.respec();a.allocate('voltage',1);a.retry();assert.deepEqual(a.robots[0].build,copy);assert.equal(a.player.mecha,false);assert.equal(a.player.mechaShield,0);assert.equal(a.mechaDrop,null);assert.equal(a.player.hp,100);assert.equal(a.skills.voltage,1);assert.equal(a.memory.waves,TRAINING_WAVES);
});
test('corrosion can trigger the late drop and wet mirror takes electrical amplification',()=>{
 const a=duel({tiers:[0,0,0,0]}),r=a.robots[0];r.hp=211;r.corrosion=3;r.cooldown=100;for(let i=0;i<20;i++)a.update(.02);assert.ok(a.mechaDrop);
 const b=duel({tiers:[0,0,0,0]}),dry=b.robots[0];b.hit(dry,2);const damage=dry.maxHp-dry.hp;dry.hp=dry.maxHp;dry.wet=5;b.hit(dry,2);assert.equal(dry.maxHp-dry.hp,damage*3);
});
test('boss weapon hazards obey electrical versus laser semantics and its own self-shock can defeat it',()=>{
 const a=duel({weapon:2,tiers:[0,0,0,0],style:{weapon:[0,0,1,0]}}),r=a.robots[0];r.x=400;r.hp=10;a.player.x=200;a.addPool(400);a.mirrorAttack(r);a.update(.02);assert.equal(a.state,'between');assert.equal(a.kills,1);assert.equal(a.memory.waves,TRAINING_WAVES);
 const b=duel({weapon:2}),s=b.robots[0];s.x=400;b.player.x=200;b.addPool(400);b.mirrorAttack(s);assert.equal(b.pools[0].charged,0);
});
test('real counterplay defeats Mirror, carries the collected suit, and finishes the EMP ending',()=>{
 const a=duel({weapon:1,skills:{force:3,agility:1,plating:2},style:{weapon:[0,1,0,0],attackRate:1.5,farRatio:0}});let ticks=0,everCollected=false;
 // Change tactics after the copy: fight at range, then traverse to the drop.
 a.respec();a.allocate('voltage',1);a.allocate('voltage',1);a.allocate('voltage',1);a.allocate('agility',1);a.allocate('plating',1);a.allocate('plating',1);a.weapon=2;
 while(a.state==='playing'&&ticks++<18000){const r=a.robots[0],p=a.player;const drop=a.mechaDrop;let target=drop&&!drop.collected?500:r.x+(p.x<r.x?-300:300);target=Math.max(25,Math.min(975,target));p.facing=Math.sign(r.x-p.x)||1;a.update(.016,{left:p.x>target+10,right:p.x<target-10,attack:true});everCollected ||= p.mecha;}
 assert.equal(a.state,'between',`duel did not complete: HP ${a.player.hp}, mirror ${a.robots[0].hp}`);assert.equal(everCollected,true);assert.equal(a.memory.waves,TRAINING_WAVES);
 const carried=a.player.mechaShield;a.startWave();assert.equal(a.player.mecha,true);assert.equal(a.player.mechaShield,carried);let emp=false;for(let i=0;i<2000&&a.state==='playing';i++){const p=a.player,r=a.robots[0];if(!emp)a.update(.02,{up:true,right:p.x<880,attack:a.nearEmergency()});else{const dx=r.x-p.x;p.facing=Math.sign(dx)||1;a.update(.02,{left:dx< -140,right:dx>140,attack:true});}emp ||= a.emergency.activated;}assert.equal(a.state,'escaping');for(let i=0;i<200&&a.state==='escaping';i++)a.update(.02,{left:true});assert.equal(a.state,'complete');assert.ok(emp);assert.equal(a.subject.status,'survived');
});
