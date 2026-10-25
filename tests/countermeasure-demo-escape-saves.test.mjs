import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,makePlan,learn,emptyStats,emptyMemory,FINAL_WAVE} from '../countermeasure/engine.mjs';
import {ProgressStore,checkpoint} from '../countermeasure/saves.mjs';
import {SubjectRegister} from '../countermeasure/subjects.mjs';
function level(wave=1){const a=new Arena({random:()=>.99});for(let w=1;w<wave&&w<10;w++){const s=emptyStats();s.attacks=[0,0,12,0];s.time=10;a.memory=learn(a.memory,s);}a.points=Math.min(12,4+wave);a.plan=makePlan(wave,a.memory);a.state='between';a.startWave();return a;}
function finish(a){for(let i=0;i<220&&a.state==='escaping';i++)a.update(.02,{left:true});}

test('trial number counts current-run deaths, not old register casualties, and does not increment twice',()=>{
 const register=new SubjectRegister({seed:1,sequence:0,records:[]});register.issue();register.close('terminated',5,'old run');const a=new Arena({register,random:()=>.99});assert.equal(a.trial,1);a.startWave();a.player.invulnerable=0;a.hurt(1000,700);assert.equal(a.trial,2);a.hurt(1000,700);assert.equal(a.trial,2);a.retry();assert.equal(a.trial,2);a.player.invulnerable=0;a.hurt(1000,700);assert.equal(a.trial,3);a.reset();assert.equal(a.trial,1);assert.equal(register.records.filter(r=>r.status==='terminated').length,3);
});
test('core destruction does not count as escape; explosion sequence opens a physical left door',()=>{
 const a=level(FINAL_WAVE);a.beginEscape();a.player.x=500;for(let i=0;i<50;i++)a.update(.02,{left:true});assert.ok(a.escape.blasts.length>0);assert.ok(a.escape.door<1);assert.ok(a.player.x>=75);assert.equal(a.subject.status,'active');finish(a);assert.equal(a.state,'complete');assert.ok(a.player.x<0);assert.equal(a.subject.status,'survived');assert.match(a.subject.cause,/factory escape/);
});
test('escape needs stage-left ground exit, and pause freezes door and explosions without entering combat',()=>{
 const a=level(FINAL_WAVE);a.player.mecha=true;a.beginEscape();for(let i=0;i<150;i++)a.update(.02,{right:true});assert.equal(a.state,'escaping');a.pause();const frozen=structuredClone({p:a.player,e:a.escape});for(let i=0;i<30;i++)a.update(.02,{left:true});assert.deepEqual({p:a.player,e:a.escape},frozen);a.pause();assert.equal(a.state,'escaping');for(let i=0;i<200;i++)a.update(.02,{left:true,up:true});assert.equal(a.state,'escaping');assert.ok(a.player.y<350);finish(a);assert.equal(a.state,'complete');
});
test('saved levels survive JSON restoration and replay the real learned defense and assigned build',()=>{
 const a=level(4);a.allocate('force',1);a.allocate('breaker',1);a.weaponTiers[2]=1;a.weapon=2;a.runDeaths=3;const store=new ProgressStore();assert.ok(store.save(a.snapshot()));const restored=new ProgressStore(store.export()),b=new Arena({random:()=>.99});assert.ok(b.resume(restored.get(4),restored.deaths));assert.equal(b.wave,4);assert.equal(b.skills.breaker,1);assert.equal(b.weaponTiers[2],1);assert.equal(b.weapon,2);assert.equal(b.trial,4);assert.deepEqual(b.plan.units,a.plan.units);assert.equal(b.memory.waves,3);
});
test('Mirror saved entry retains the frozen enemy copy, and finale saves retain suit health and armor',()=>{
 const a=level(10);a.mirrorBlueprint.skills.force=2;const saved=checkpoint(a.snapshot());assert.ok(saved);const b=level();assert.ok(b.resume(saved));assert.equal(b.robots[0].build.skills.force,2);assert.notEqual(b.robots[0].build.skills,b.skills);
 const c=level(FINAL_WAVE);c.finaleCheckpoint={hp:31.5,mecha:true,mechaShield:17};const d=level();assert.ok(d.resume(c.snapshot()));assert.equal(d.player.hp,31.5);assert.equal(d.player.mecha,true);assert.equal(d.player.mechaShield,17);
});
test('progress stays bounded to eleven levels and latest run deaths override an older level checkpoint',()=>{
 const store=new ProgressStore();for(let wave=1;wave<=11;wave++)assert.ok(store.save(level(wave).snapshot()));assert.equal(store.entries.size,11);store.setDeaths(7);const a=level();a.resume(store.get(3),store.deaths);assert.equal(a.trial,8);store.setDeaths(0);a.resume(store.get(2),store.deaths);assert.equal(a.trial,1);assert.equal(store.entries.size,11);assert.ok(store.export().length<50000);
});
test('malformed saves are rejected atomically and never partially change the current run',()=>{
 const a=level(3),store=new ProgressStore();store.save(a.snapshot());const before=store.export();for(const mutate of [s=>s.levels[0].wave=99,s=>s.levels[0].skills.force=-1,s=>s.levels[0].tiers=[9,9,9,9],s=>s.levels[0].memory.weapon=[1,1,1,1],s=>s.levels[0].memory.waves=0,s=>s.levels.push(s.levels[0])]){const data=JSON.parse(before);mutate(data);assert.throws(()=>store.import(JSON.stringify(data)));assert.equal(store.export(),before);}const bad={...a.snapshot(),wave:90},state=structuredClone(a.player);assert.equal(a.resume(bad),false);assert.deepEqual(a.player,state);assert.equal(new ProgressStore('not json').entries.size,0);
});
