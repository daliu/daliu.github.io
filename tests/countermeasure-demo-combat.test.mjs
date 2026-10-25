import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,cognitionAt,weaponAt} from '../countermeasure/engine.mjs';

function arena(wave=5,random=()=>.99){const a=new Arena({random});a.wave=wave;a.state='playing';a.player.invulnerable=0;return a;}
function robot(a,type='probe',x=650,index=0){const r=a.spawn(type,index);r.x=x;r.hp=r.maxHp=10000;r.cooldown=100;a.robots.push(r);return r;}
function advance(a,seconds,input={}){for(let time=0;time<seconds;time+=.02)a.update(.02,input);}

test('wave progression makes small initial speed gains and increasingly large late gains',()=>{
 const profiles=Array.from({length:9},(_,i)=>cognitionAt(i+1));
 for(let i=1;i<9;i++){assert.ok(profiles[i].speed>profiles[i-1].speed);assert.ok(profiles[i].reaction<profiles[i-1].reaction);assert.ok(profiles[i].crit>profiles[i-1].crit);if(i>1)assert.ok(profiles[i].speed-profiles[i-1].speed>profiles[i-1].speed-profiles[i-2].speed);}
 assert.ok(profiles[1].speed<1.04);assert.equal(profiles[8].speed,1.85);assert.ok(profiles[8].reaction<.14);
 const distances=[];for(const wave of [2,9]){const a=arena(wave),r=robot(a,'guard',800);a.player.x=100;advance(a,.4);distances.push(800-r.x);}assert.ok(distances[1]>distances[0]*1.7);
});
test('early guards can be flanked for longer; late guards turn and refresh target position quickly',()=>{
 const turns=[];for(const wave of [2,9]){const a=arena(wave),r=robot(a,'guard',500);a.player.x=400;a.update(.02);assert.equal(r.facing,-1);a.player.x=650;let elapsed=0;while(r.facing<0&&elapsed<3){a.update(.02);elapsed+=.02;}turns.push(elapsed);}
 assert.ok(turns[0]>.8);assert.ok(turns[1]<.4);assert.ok(turns[0]>turns[1]*3);
});
test('later robots dodge observed attacks; idle humans do not trigger dodges',()=>{
 for(const wave of [2,9]){const a=arena(wave,()=>.5),r=robot(a,'plated',420);a.player.x=200;a.weapon=2;a.weaponTiers[2]=2;
 a.update(.02);assert.equal(r.dodgeTime,0);r.sense=0;a.attack();a.update(.02);assert.equal(r.dodgeTime>0,wave===9);if(wave===9)assert.ok(r.vy<0,'late robot jumps a visible ranged attack');}
});
test('chemical and acid pools damage both sides; acid is stronger and faster despite hit invulnerability',()=>{
 const totals=[];for(const fluid of [0,1,2]){const a=arena(1),r=robot(a,'probe',500);a.player.x=500;a.player.invulnerable=20;a.addPool(500,fluid);const ticks=[];let prior=a.player.hp;for(let i=0;i<50;i++){a.update(.02);if(a.player.hp!==prior){ticks.push(i);prior=a.player.hp;}}totals.push(100-a.player.hp);assert.equal(100-a.player.hp,r.maxHp-r.hp);if(fluid===1)assert.equal(ticks.length,2);if(fluid===2)assert.ok(ticks.length>=4);}
 assert.equal(totals[0],0);assert.ok(totals[2]>totals[1]*2);
});
test('overlapping pools do not stack damage; jumping avoids contact and pause freezes hazard timers',()=>{
 const a=arena(1),r=robot(a);a.player.x=500;a.addPool(480,1);a.addPool(520,2);a.update(.02);assert.equal(a.player.hp,95);a.state='paused';const hp=a.player.hp,cd=a.player.hazardCd;advance(a,1);assert.equal(a.player.hp,hp);assert.equal(a.player.hazardCd,cd);
 const b=arena(1);robot(b);b.addPool(500,2);b.player.x=500;b.player.y=300;b.player.grounded=false;b.update(.02);assert.equal(b.player.hp,100);
});
test('cuts amplify every fluid tier, dents slightly amplify electricity, and combo windows expire',()=>{
 for(let tier=0;tier<3;tier++){const a=arena(),normal=robot(a),cut=robot(a,'probe',700,1);a.weaponTiers[3]=tier;a.hit(cut,1);const before=cut.hp;a.hit(cut,3);a.hit(normal,3);assert.ok(Math.abs((before-cut.hp)-(normal.maxHp-normal.hp)*1.75)<1e-8);}
 const a=arena(1),dry=robot(a),dent=robot(a,'probe',700,1);a.hit(dent,0);const before=dent.hp;a.hit(dent,2);a.hit(dry,2);assert.ok(Math.abs((before-dent.hp)-(dry.maxHp-dry.hp)*1.08)<1e-8);advance(a,6.2);assert.equal(dent.dented,0);
});
test('wet shock is extreme while boots still protect grounded conduction',()=>{
 const a=arena(),dry=robot(a),wet=robot(a,'probe',700,1),boots=robot(a,'probe',750,2);wet.wet=boots.wet=5;boots.boots=true;for(const r of [dry,wet,boots])a.hit(r,2);assert.equal(wet.maxHp-wet.hp,(dry.maxHp-dry.hp)*3);assert.equal(boots.maxHp-boots.hp,dry.maxHp-dry.hp);
});
test('electrical paralysis is probabilistic, easier when wet, and freezes movement and attacks temporarily',()=>{
 for(const wet of [false,true]){let calls=0;const a=arena(5,()=>++calls%2===1?.99:.3),r=robot(a,'guard',550);r.wet=wet?5:0;r.cooldown=0;a.player.x=500;a.hit(r,2);assert.equal(r.paralyzed>0,wet);if(wet){r.stun=0;const x=r.x;advance(a,.5);assert.equal(r.x,x);assert.equal(r.windup,0);advance(a,.6);assert.ok(r.x!==x||r.windup>0);}}
});
test('every weapon stage can crit, with extra chances during dashes and against paralyzed targets',()=>{
 for(let weapon=0;weapon<4;weapon++)for(let tier=0;tier<3;tier++){const normal=arena(),crit=arena(5,()=>0),r=robot(normal),c=robot(crit);normal.weaponTiers[weapon]=crit.weaponTiers[weapon]=tier;normal.hit(r,weapon);crit.hit(c,weapon);assert.ok(Math.abs((c.maxHp-c.hp)-(r.maxHp-r.hp)*1.65)<1e-8,weaponAt(weapon,tier).name);assert.match(crit.effects.find(e=>e.kind==='number').text,/CRIT/);}
 for(const boost of ['none','dash','paralyzed']){const a=arena(5,()=>.2),r=robot(a);if(boost==='dash')a.dash();if(boost==='paralyzed')r.paralyzed=.5;a.hit(r,1);assert.equal(a.effects.some(e=>e.text?.startsWith('CRIT')),boost!=='none');}
});
test('critical windows end; late robot attacks gain critical hits at rolls early bots miss',()=>{
 const a=arena(1,()=>.2),r=robot(a);a.dash();advance(a,.5);a.hit(r,1);assert.ok(!a.effects.some(e=>e.text?.startsWith('CRIT')));
 const damage=[];for(const wave of [2,9]){const b=arena(wave,()=>.1),r=robot(b);b.botHurt(r,10);damage.push(100-b.player.hp);}assert.ok(Math.abs(damage[1]-damage[0]*1.65)<1e-8);
});
test('bashing a front shield wears it down, drops it once, and removes front protection',()=>{
 const a=arena(),r=robot(a,'guard',500);a.player.x=450;a.player.facing=1;r.facing=-1;const hp=r.hp;a.hit(r,0);const protectedDamage=hp-r.hp;assert.ok(r.shield<r.maxShield);a.hit(r,0);a.hit(r,0);assert.equal(r.shield,0);assert.equal(a.effects.filter(e=>e.kind==='shield-drop').length,1);const before=r.hp;a.hit(r,0);assert.ok(before-r.hp>protectedDamage*2);assert.equal(a.effects.filter(e=>e.kind==='shield-drop').length,1);
 const b=arena(),guard=robot(b,'guard',500);b.player.x=550;b.hit(guard,0);assert.equal(guard.shield,90,'rear attacks bypass the shield');
});
test('robot bullets collide with the first ally in their path and can kill it',()=>{
 const a=arena(2),source=robot(a,'gunner',700),ally=robot(a,'probe',500,1);a.player.x=200;ally.hp=10;a.shots.push({x:700,y:394,vx:-260,life:4,owner:source.id,critical:false});advance(a,1);assert.ok(ally.hp<=0);assert.equal(a.kills,1);assert.equal(a.player.hp,100);assert.equal(a.shots.length,0);
});
test('late shooters hold obstructed fire and try to clear allies; friendly damage remains possible',()=>{
 for(const wave of [2,9]){const a=arena(wave),source=robot(a,'gunner',650),ally=robot(a,'guard',550,1);a.player.x=200;source.action='shoot';source.windup=.01;source.facing=-1;a.update(.02);assert.equal(a.shots.length,wave===2?1:0);if(wave===9){assert.ok(source.vy<0);const hp=ally.hp;a.friendlyDamage(source.id,ally,12);assert.equal(ally.hp,hp-12);}}
});
test('mortar blasts, melee, leaps, and charges hurt other robots with bounded kill accounting',()=>{
 const a=arena(2),source=robot(a,'bombardier',700),ally=robot(a,'probe',400,1);a.player.x=100;a.shots.push({kind:'mortar',x:400,y:413,vx:0,vy:0,gravity:760,targetX:400,life:1,owner:source.id,ownerX:700});a.update(.02);assert.equal(ally.maxHp-ally.hp,20);
 for(const action of ['strike','airborne','charge']){const b=arena(2),r=robot(b,'lancer',500),friend=robot(b,'probe',470,1);b.player.x=100;r.facing=-1;r.action=action;r.target=450;r.contactHits=[];r.contactCritical=false;r.lockDir=-1;r.chargeTime=.3;if(action==='strike')r.windup=.01;else {r.y=410;r.vy=-5;}b.update(.02);assert.ok(friend.hp<friend.maxHp,action);}
});
test('corrosion deaths are counted once and retries clear combo, paralysis and hazard state',()=>{
 const a=arena(2),r=robot(a);r.hp=1;a.addPool(r.x,2);a.update(.02);assert.equal(a.kills,1);advance(a,.5);assert.equal(a.kills,1);
 a.state='dead';Object.assign(a.player,{exposed:5,dented:5,paralyzed:.5,hazardCd:.4,dashCrit:.3});a.retry();for(const key of ['exposed','dented','paralyzed','hazardCd','dashCrit'])assert.equal(a.player[key],0,key);assert.equal(a.pools.length,0);
});
