import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,WEAPONS,SKILLS,TYPES,TRAINING_WAVES,BOSS_WAVE,FINAL_WAVE,emptyStats,emptyMemory,learn,makePlan} from '../countermeasure/engine.mjs';

function fightWith(weapon,{jump=false,dash=false}={}){
  const a=new Arena({random:()=>.99});a.startWave();a.weapon=weapon;a.player.x=650;
  for(let tick=0;tick<3000&&a.state==='playing';tick++){
    if(jump&&tick%50===0)a.jump();if(dash&&tick%90===0)a.dash();
    const r=a.robots.find(r=>r.hp>0);if(!r)break;
    const dx=r.x-a.player.x;a.player.facing=Math.sign(dx)||1;
    a.update(.016,{left:dx< -65,right:dx>65,attack:true});
  }
  assert.equal(a.state,'between','real attacks should finish the calibration encounter');return a;
}
test('actual combat traces teach different next-wave defenses for all four weapons',()=>{
  const expected=['guard','plated','insulated','sealed'];
  for(let i=0;i<4;i++){const a=fightWith(i);assert.equal(a.memory.waves,1);assert.ok(a.stats.hits[i]>0);assert.equal(a.memory.weapon[i],1);assert.equal(a.plan.units[0],expected[i]);assert.equal(a.plan.wave,2);assert.match(a.plan.reason,new RegExp(WEAPONS[i].name));}
});
test('actual repeated jumps and dashes select different tactical specialists',()=>{
  const jumping=fightWith(3,{jump:true}),dodging=fightWith(3,{dash:true});
  assert.ok(jumping.memory.jumpRate>.15);assert.ok(makePlan(4,jumping.memory).units.includes('bulwark'));
  assert.ok(dodging.memory.dashRate>.12);assert.ok(makePlan(4,dodging.memory).units.includes('feinter'));
});
test('recent behavior can overcome an old weapon preference',()=>{
  let m=emptyMemory(),s=emptyStats();s.attacks=[20,0,0,0];s.time=10;m=learn(m,s);
  s.attacks=[0,0,20,0];m=learn(m,s);assert.equal(makePlan(3,m).units[0],'insulated');assert.equal(m.weapon[2],.65);assert.equal(m.weapon[0],.35);
});
test('idle time outside engagement range does not become a ranged tactic',()=>{
  const a=new Arena({random:()=>.99});a.startWave();for(let i=0;i<300;i++)a.update(.016,{});assert.equal(a.stats.time,0);assert.equal(a.stats.samples,0);a.update(.016,{right:true});assert.ok(a.stats.time>0);assert.equal(a.stats.samples,0);a.update(.016,{attack:true});assert.ok(a.stats.samples>0);
});
test('ranged positioning and mixed weapons cause independent responses',()=>{
  const s=emptyStats();s.attacks=[0,0,15,0];s.time=10;s.samples=10;s.far=9;let m=learn(emptyMemory(),s);assert.ok(makePlan(7,m).units.includes('gunner'));
  s.attacks=[8,8,8,8];s.far=0;m=learn(emptyMemory(),s);assert.equal(makePlan(2,m).phase,'Defensive learning');assert.ok(!makePlan(2,m).units.includes('feinter'));
});
test('learning runs once per completed wave and never rewrites active hardware',()=>{
  const a=new Arena({random:()=>.99});a.startWave();const before=structuredClone(a.plan);for(let i=0;i<50;i++)a.update(.016,{attack:true});assert.deepEqual(a.plan,before);assert.equal(a.memory.waves,0);
  for(const r of a.robots)r.hp=0;a.update(.016);assert.equal(a.memory.waves,1);for(let i=0;i<50;i++)a.update(.016);assert.equal(a.memory.waves,1);
});
test('free skill allocation respects point budgets, dependencies and rank caps',()=>{
  const a=new Arena({random:()=>.99});assert.equal(a.allocate('breaker',1),false);assert.equal(a.allocate('force',1),true);assert.equal(a.allocate('breaker',1),true);assert.equal(a.allocate('force',-1),false);assert.equal(a.allocate('breaker',1),true);assert.equal(a.allocate('breaker',1),false);a.allocate('force',1);a.allocate('force',1);assert.equal(a.spent,5);assert.equal(a.allocate('voltage',1),false);assert.equal(a.allocate('bogus',1),false);assert.equal(a.allocate('force',9),false);
  a.startWave();a.player.hp=51;a.player.dashCd=.7;a.player.attackCd=.2;a.respec();assert.equal(a.spent,0);assert.equal(a.player.hp,51);assert.equal(a.player.dashCd,.7);assert.equal(a.player.attackCd,.2);
});
test('every tool deals damage to every chassis; counters offer meaningful advantages',()=>{
  for(const type of Object.keys(TYPES).filter(t=>t!=='overseer'))for(let w=0;w<4;w++){const a=new Arena({random:()=>.99});a.startWave();const r=a.spawn(type,0),before=r.hp;a.hit(r,w);assert.ok(r.hp<before,`${type} must not be immune to ${WEAPONS[w].name}`);assert.ok(Number.isFinite(r.hp));}
  const a=new Arena({random:()=>.99});a.startWave();let r=a.spawn('plated',0);a.hit(r,1);const sword=r.maxHp-r.hp;r=a.spawn('plated',0);a.hit(r,2);assert.ok(r.maxHp-r.hp>sword);
});
test('water triples electrical damage and chain skill reaches only wet neighbors',()=>{
  const a=new Arena({random:()=>.99});a.startWave();const dry=a.spawn('probe',0);a.hit(dry,2);const base=dry.maxHp-dry.hp;const wet=a.spawn('probe',0);a.hit(wet,3);const before=wet.hp;a.hit(wet,2);assert.equal(before-wet.hp,base*3);
  a.skills.voltage=1;a.skills.cascade=1;a.weapon=2;a.player.x=400;a.player.facing=1;
  const first=a.spawn('plated',0),second=a.spawn('plated',1),third=a.spawn('plated',2);first.x=500;second.x=550;third.x=580;first.wet=second.wet=5;a.robots=[first,second,third];a.attack();assert.ok(second.hp<second.maxHp);assert.equal(third.hp,third.maxHp);
});
test('pause freezes combat, damage, wet timers and cooldowns',()=>{
  const a=new Arena({random:()=>.99});a.startWave();a.state='paused';a.player.attackCd=.3;a.player.dashCd=.8;a.robots[0].wet=3;const before=structuredClone({p:a.player,r:a.robots,s:a.stats});a.jump();a.dash();a.attack();for(let i=0;i<100;i++)a.update(.016,{right:true,attack:true});assert.deepEqual({p:a.player,r:a.robots,s:a.stats},before);
});
test('death and retry preserve the announced enemy and memory, restore health',()=>{
  const a=fightWith(0);a.startWave();const before=structuredClone(a.memory),types=a.robots.map(r=>r.type);a.player.invulnerable=0;a.hurt(1000,900);assert.equal(a.state,'dead');assert.deepEqual(a.memory,before);a.retry();assert.equal(a.player.hp,100);assert.equal(a.state,'playing');assert.deepEqual(a.robots.map(r=>r.type),types);assert.deepEqual(a.memory,before);
});
test('nine waves lead into one mirror duel; its defeat opens the emergency encounter',()=>{
  const a=new Arena({random:()=>.99});for(let w=1;w<=TRAINING_WAVES;w++){assert.equal(a.startWave(),true);assert.equal(a.wave,w);a.robots.forEach(r=>r.hp=0);a.stats.attacks[w%4]=12;a.stats.time=10;a.update(.016);assert.equal(a.memory.waves,w);assert.equal(a.points,Math.min(12,5+w));assert.equal(a.state,'between');}assert.equal(a.plan.wave,BOSS_WAVE);assert.deepEqual(a.plan.units,['mirror']);assert.equal(a.startWave(),true);a.robots[0].hp=0;a.update(.016);assert.equal(a.state,'between');assert.equal(a.plan.wave,FINAL_WAVE);assert.equal(a.memory.waves,TRAINING_WAVES);assert.equal(a.startWave(),true);assert.equal(a.wave,FINAL_WAVE);a.reset();assert.equal(a.memory.waves,0);assert.equal(a.wave,0);assert.equal(a.points,5);assert.equal(a.plan.units[0],'probe');
});
test('every chassis can simulate attack cycles without nonfinite positions',()=>{
  for(const type of Object.keys(TYPES)){const a=new Arena({random:()=>.99});a.wave=3;a.state='playing';a.robots=[a.spawn(type,0)];a.player.x=650;a.player.hp=10000;for(let i=0;i<1600;i++){a.update(.016,{});assert.ok(Number.isFinite(a.robots[0].x));assert.ok(Number.isFinite(a.robots[0].y));}assert.ok(a.stats.damageTaken>0,`${type} must pose a combat threat`);}
});

test('an adaptive counter-using player can complete all nine waves through real combat',()=>{
  const a=new Arena({random:()=>.99});
  for(let wave=1;wave<=TRAINING_WAVES;wave++){
    a.respec();for(let i=0;i<3;i++)a.allocate('force',1);for(let i=0;i<3&&a.spent<a.points;i++)a.allocate('voltage',1);
    for(let i=0;i<2&&a.spent<a.points;i++){if(!a.skills.agility)a.allocate('agility',1);a.allocate('plating',1);}
    a.startWave();let ticks=0;
    while(a.state==='playing'&&ticks++<15000){
      const p=a.player,r=a.robots.filter(r=>r.hp>0).sort((x,y)=>Math.abs(x.x-p.x)-Math.abs(y.x-p.x))[0];if(!r)break;
      a.weapon=({probe:1,guard:1,plated:2,insulated:1,sealed:0,interceptor:2,gunner:1,feinter:2,bulwark:2,bombardier:1,flak:1,lancer:2})[r.type];
      const dx=r.x-p.x;p.facing=Math.sign(dx)||1;const range=a.weapon===2?170:62;
      a.update(.016,{left:dx< -range,right:dx>range,attack:true});
    }
    assert.equal(a.state,'between',`counterplay should clear wave ${wave}`);assert.ok(a.player.hp>0);
  }
  assert.equal(a.memory.waves,TRAINING_WAVES);assert.ok(a.kills>=15);
});

test('water attacks leave bounded ground pools; standing in one makes taser self-shock',()=>{
 const a=new Arena({random:()=>.99});a.startWave();a.player.invulnerable=0;a.weapon=3;a.attack();assert.ok(a.pools.length>0);const pool=a.pools[0];a.player.x=pool.x;a.weapon=2;a.player.attackCd=0;const hp=a.player.hp;a.attack();assert.equal(a.player.hp,hp-18);assert.ok(pool.charged>0);
 for(let i=0;i<70;i++)a.addPool(30+i*13);assert.ok(a.pools.length<=18);
});
test('dry ground and jumping above a pool prevent self-shock; connected pools conduct',()=>{
 const a=new Arena({random:()=>.99});a.startWave();a.player.invulnerable=0;a.player.x=400;const one=a.addPool(400),two=a.addPool(480),separate=a.addPool(700);a.weapon=2;a.player.facing=-1;a.attack();assert.ok(one.charged>0&&two.charged>0);assert.equal(separate.charged,0);assert.equal(a.player.hp,82);
 for(const airborne of [false,true]){const b=new Arena({random:()=>.99});b.startWave();b.player.invulnerable=0;b.weapon=2;b.player.x=airborne?400:200;b.player.y=airborne?340:420;b.addPool(400);b.attack();assert.equal(b.player.hp,100);}
});
test('expired pools cannot hurt, pause freezes fluids, and retries clear the floor',()=>{
 const a=new Arena({random:()=>.99});a.startWave();a.player.invulnerable=0;const p=a.addPool(a.player.x);p.charged=.5;p.life=.01;a.update(.02);assert.equal(a.player.hp,100);assert.equal(a.pools.length,0);
 const q=a.addPool(a.player.x);q.charged=.5;a.state='paused';a.update(.04);assert.equal(q.life,10);assert.equal(q.charged,.5);a.state='dead';a.retry();assert.equal(a.pools.length,0);
});
test('weapon stages unlock at waves three and five and stay freely reversible',()=>{
 const a=new Arena({random:()=>.99});assert.equal(a.setTier(2,1),false);a.wave=2;a.state='between';a.plan=makePlan(3,emptyMemory());assert.equal(a.maxTier,1);assert.equal(a.setTier(0,1),true);assert.equal(a.setTier(0,2),false);a.plan=makePlan(5,emptyMemory());assert.equal(a.setTier(0,2),true);a.player.hp=57;a.player.attackCd=.3;assert.equal(a.setTier(0,0),true);assert.equal(a.player.hp,57);assert.equal(a.player.attackCd,.3);assert.equal(a.setTier(0,3),false);assert.equal(a.setTier(-1,1),false);
});
test('laser pierces without electrifying pools or multiplying wet damage, and teaches a laser counter',()=>{
 const a=new Arena({random:()=>.99});a.wave=5;a.state='playing';a.setTier(2,2);a.weapon=2;a.player.x=200;a.player.invulnerable=0;a.addPool(200);const dry=a.spawn('probe',0),wet=a.spawn('probe',1);dry.x=450;wet.x=550;wet.wet=5;a.robots=[dry,wet];a.attack();assert.equal(dry.maxHp-dry.hp,wet.maxHp-wet.hp);assert.ok(wet.hp<wet.maxHp);assert.equal(a.player.hp,100);assert.equal(a.pools[0].charged,0);assert.equal(a.stats.energyAttacks,1);const plan=makePlan(6,learn(emptyMemory(),a.stats));assert.equal(plan.units[0],'plated');assert.match(plan.reason,/Laser/);
});
test('acid causes corrosion, weakens resistance, and burns the human on contact',()=>{
 const a=new Arena({random:()=>.99});a.wave=5;a.state='playing';a.setTier(3,2);a.weapon=3;a.player.x=500;a.player.invulnerable=0;const r=a.spawn('plated',0);r.x=580;a.robots=[r];a.attack();assert.ok(r.corrosion>0);assert.ok(a.pools.some(p=>p.corrosive));a.player.x=a.pools[0].x;const hp=a.player.hp,robotHp=r.hp;a.update(.04);assert.ok(a.player.hp<hp);assert.ok(r.hp<robotHp);
 const b=new Arena({random:()=>.99});b.startWave();const normal=b.spawn('plated',0),corroded=b.spawn('plated',0);corroded.corrosion=1;b.hit(normal,1);b.hit(corroded,1);assert.ok(corroded.maxHp-corroded.hp>normal.maxHp-normal.hp);
});
test('faster movement and ducking change the human simulation',()=>{
 const a=new Arena({random:()=>.99});a.startWave();const x=a.player.x;a.update(.02,{right:true});assert.ok(Math.abs((a.player.x-x)-6.4)<.0001);a.update(.02,{down:true,right:true});assert.equal(a.player.crouching,true);assert.ok(a.player.vx<320);a.jump();a.update(.02,{down:true});assert.equal(a.player.crouching,false);
});
