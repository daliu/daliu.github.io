import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,TYPES,emptyStats} from '../countermeasure/engine.mjs';
import {CampaignArena,MODULES} from '../countermeasure/campaign.mjs';
import {campaignPlan,campaignMemory,learnCampaign,campaignCognition} from '../countermeasure/campaign-plan.mjs';
import {CampaignStore,campaignCheckpoint} from '../countermeasure/campaign-saves.mjs';
import {ProgressStore} from '../countermeasure/saves.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
function arena(wave=1){const g=new CampaignArena({random:()=>.99});g.mechTier=Math.floor((wave-1)/10);g.plan=campaignPlan(wave,g.memory);g.state='between';g.startWave();return g;}
function robot(g,type,x=260,y=420){const r=g.spawn(type,0);r.x=x;r.y=y;g.robots=[r];g.player.x=200;g.player.y=y;g.player.invulnerable=0;return r;}
function step(g,seconds,input={}){for(let t=0;t<seconds;t+=.02)g.update(.02,input);}
test('Campaign has fifty varied encounters, ordered learning and mandatory flight after its first mech',()=>{
 const m=campaignMemory(),signatures=new Set();for(let w=1;w<=50;w++){const p=campaignPlan(w,m);assert.ok(p.units.every(t=>TYPES[t]));assert.ok(p.units.length<=7);signatures.add(p.units.join(','));if(w<=10)assert.ok(!p.units.some(t=>TYPES[t].flying));}
 assert.ok(signatures.size>44);assert.match(campaignPlan(1,m).phase,/Defensive/);assert.match(campaignPlan(4,m).phase,/Movement/);assert.match(campaignPlan(7,m).phase,/Offensive/);assert.deepEqual(campaignPlan(49,m).units,['mirror']);assert.deepEqual(campaignPlan(50,m).units,['overseer']);
});
test('all fifty checkpoint entries round trip without Demo boss transitions at ten or eleven',()=>{
 const g=arena(),store=new CampaignStore();for(let wave=1;wave<=50;wave++){
  assert.equal(g.wave,wave);assert.ok(store.save(g.snapshot()),'checkpoint '+wave);assert.ok(campaignCheckpoint(g.snapshot()));
  if(wave<50){for(const r of g.robots)g.damageRobot(r,100000);g.update(.02);assert.equal(g.state,'between');assert.equal(g.plan.wave,wave+1);assert.ok(store.save(g.snapshot(wave+1)));g.startWave();}
 }
 const copy=new CampaignStore(store.export());assert.equal(copy.entries.size,50);assert.equal(copy.latest,50);assert.equal(copy.get(49).mechTier,4);assert.equal(g.player.mecha,true);
});
test('Campaign and Demo imports cannot cross, even on an empty first wave',()=>{
 const c=new CampaignStore(),d=new ProgressStore(),g=arena(),demo=new Arena();demo.startWave();c.save(g.snapshot());d.save(demo.snapshot());assert.throws(()=>c.import(d.export()));assert.throws(()=>d.import(c.export()));assert.equal(c.get(1).mode,'campaign');assert.equal(d.get(1).version,1);
});
test('malformed, oversized and future equipment imports fail atomically',()=>{
 const g=arena(),s=new CampaignStore();s.save(g.snapshot());const original=s.export();for(const change of [c=>c.mechTier=5,c=>c.points=99,c=>c.tiers=[2,2,2,2],c=>c.memory.weapon=[NaN,0,0,0],c=>c.memory.outcomes=Array(13).fill({})]){const c=g.snapshot();change(c);assert.equal(campaignCheckpoint(c),null);assert.throws(()=>s.import(JSON.stringify({version:2,mode:'campaign',latest:1,deaths:0,levels:[c]})));assert.equal(s.export(),original);}assert.throws(()=>s.import(' '.repeat(600001)));
});
test('actual effective hits and deaths change next attempt hardware, not the active robots',()=>{
 const g=arena(8),original=g.robots.map(r=>r.type);g.robots.forEach(r=>r.hp=10000);for(let n=0;n<22;n++){g.player.attackCd=0;g.weapon=2;g.hit(g.robots[0],2);g.stats.attacks[2]++;}assert.deepEqual(g.robots.map(r=>r.type),original);g.player.mechaShield=0;g.player.invulnerable=0;g.hurt(10000,900);assert.equal(g.state,'dead');assert.equal(g.memory.failures,1);assert.equal(g.memory.attempts,1);assert.equal(g.plan.units.at(-1),'insulated');g.retry();assert.equal(g.robots.at(-1).type,'insulated');assert.equal(g.memory.attempts,1);
});
test('learner weights successful damage above attack spam and keeps bounded retry history',()=>{
 let m=campaignMemory();const s=emptyStats();s.attacks=[0,2,40,0];s.damage=[0,500,1,0];s.time=20;for(let i=0;i<100;i++)m=learnCampaign(m,s,{wave:20,won:false});assert.equal(campaignPlan(22,m).units.at(-1),'plated');assert.equal(m.outcomes.length,12);assert.equal(m.history.length,12);assert.equal(m.failures,100);
});
test('cognition accelerates gradually and retains readable late reactions and windups',()=>{
 const a=campaignCognition(1),b=campaignCognition(2),c=campaignCognition(48);assert.ok(b.speed-a.speed<.01);assert.ok(c.speed>2);assert.ok(c.reaction>=.16);assert.ok(c.windup>=.65);for(let w=2;w<=50;w++)assert.ok(campaignCognition(w).reaction<=campaignCognition(w-1).reaction);
});
test('mech pods arrive during milestone fights and missed pods are salvaged before mandatory flight',()=>{
 const g=arena(10);for(const r of g.robots)r.hp*=.3;g.checkMechaDrop();assert.equal(g.mechaDrop.tier,1);g.mechaDrop.y=420;g.mechaDrop.landed=true;g.player.x=500;g.updateMecha(.02);assert.equal(g.mechTier,1);assert.equal(g.player.mecha,true);
 const h=arena(20);h.robots.forEach(r=>r.hp=0);h.update(.02);assert.equal(h.mechTier,2);h.startWave();assert.equal(h.wave,21);assert.equal(h.player.mechaShield,h.armorCapacity);
});
test('radio freezes grounded robots and makes flyers fall; pause freezes power cooldowns',()=>{
 const g=arena(11),r=robot(g,'flyer',260,180);g.player.mecha=true;assert.ok(g.useModule());const x=r.x,y=r.y;step(g,1);assert.equal(r.x,x);assert.ok(r.y>y+100);const cd=g.moduleCooldowns[0];g.pause();step(g,1);assert.equal(g.moduleCooldowns[0],cd);assert.equal(g.useModule(),false);
});
test('glue buildup slows, then binds on its third burst and eventually releases',()=>{
 const g=arena(21),r=robot(g,'orchestrator');r.hp=1000;g.selectModule(1);for(let n=0;n<3;n++){g.moduleCooldowns[1]=0;assert.ok(g.useModule());}assert.equal(r.glue,3);assert.ok(r.root>3);const x=r.x;step(g,1);assert.equal(r.x,x);step(g,3);assert.equal(r.root,0);
});
test('flame melts plastic coatings and opens wet electricity as an alternative counter',()=>{
 const a=arena(31),r=robot(a,'plasticDrone');r.hp=1000;a.hit(r,2);const shuntDamage=1000-r.hp;r.hp=1000;a.selectModule(2);a.useModule();assert.equal(r.shell,false);r.hp=1000;a.hit(r,3);r.hp=1000;a.hit(r,2);assert.ok(1000-r.hp>shuntDamage*5);
});
test('magnetic corruption punishes conductive plating more than insulation',()=>{
 const run=type=>{const g=arena(41),r=robot(g,type);r.hp=10000;g.selectModule(3);g.useModule();return {damage:10000-r.hp,corruption:r.corruption};};const a=run('plated'),b=run('insulated');assert.ok(a.damage>b.damage*5);assert.ok(a.corruption>b.corruption*5);
});
test('powers respect unlocks, per-power cooldowns and the Overseer counter',()=>{
 const g=arena(11);assert.equal(g.selectModule(3),false);assert.ok(g.selectModule(0));assert.ok(g.useModule());assert.equal(g.useModule(),false);const f=arena(50),r=f.robots[0],hp=r.hp;f.selectModule(3);f.useModule();assert.equal(r.hp,hp);assert.equal(r.corruption,0);
});
test('electricity detonates metal drones and the blast damages nearby robots',()=>{
 const g=arena(21),r=robot(g,'metalDrone',400,420),o=g.spawn('guard',1);o.x=440;o.y=420;g.robots.push(o);const hp=o.hp;g.hit(r,2);assert.ok(r.hp<=0);assert.ok(r.exploded);assert.ok(o.hp<hp);
});
test('plastic drones shunt electricity until cut open, without pure immunity',()=>{
 const g=arena(24),r=robot(g,'plasticDrone');r.hp=1000;g.hit(r,2);const first=1000-r.hp;assert.ok(first>0);g.hit(r,1);assert.equal(r.shell,false);r.hp=1000;g.hit(r,3);r.hp=1000;g.hit(r,2);assert.ok(1000-r.hp>first*5);
});
test('plain water disarms chemical fuses while acid fails to dilute them',()=>{
 const g=arena(24),r=robot(g,'chemDrone');r.hp=1000;g.weaponTiers[3]=2;g.hit(r,3);assert.equal(r.dilution,0);g.weaponTiers[3]=0;for(let i=0;i<3;i++)g.hit(r,3);assert.equal(r.disarmed,true);assert.equal(r.exploded,undefined);
 const h=arena(24),c=robot(h,'chemDrone',700,250);c.fuse=.1;step(h,.2);assert.equal(c.exploded,true);assert.ok(h.pools.some(p=>p.fluid===2));
});
test('floor shock is telegraphed, boots protect bots, flight protects humans, wet body remains vulnerable',()=>{
 const g=arena(12),s=robot(g,'shocker',800);g.addPool(g.player.x);g.addPool(s.x);s.cooldown=0;step(g,.04);assert.equal(s.action,'floor-shock');assert.ok(s.windup>1);g.player.y=220;g.player.mecha=true;const hp=g.player.hp;step(g,1.5,{up:true});assert.equal(g.player.hp,hp);assert.equal(s.hp,s.maxHp);s.x=260;s.y=420;s.wet=5;s.hp=1000;g.hit(s,2);const wet=1000-s.hp;s.wet=0;s.hp=1000;g.hit(s,2);assert.ok(wet>(1000-s.hp)*2.5);
});
test('dash strike is a real melee contact combo, once per robot per dash',()=>{
 const g=arena(5),r=robot(g,'guard',230);g.weapon=1;g.dash();g.update(.02);const hp=r.hp;assert.ok(hp<r.maxHp);g.update(.02);assert.equal(r.hp,hp);
});
test('orchestrators synchronize allies, then their destruction interrupts attacks and causes confusion',()=>{
 const g=arena(42),c=g.robots.find(r=>r.type==='orchestrator');c.orderCd=0;g.update(.02);assert.ok(g.command);assert.ok(g.robots.some(r=>r!==c&&r.windup>0));g.damageRobot(c,100000);assert.equal(g.command,null);assert.ok(g.robots.filter(r=>r.hp>0).every(r=>r.confused>3&&r.windup===0));const positions=g.robots.map(r=>r.x);step(g,1);assert.deepEqual(g.robots.map(r=>r.x),positions);
});
test('late Mirror copies the build and follows flight without changing the saved blueprint',()=>{
 const g=arena(49),r=g.robots[0];assert.deepEqual(r.build.skills,g.skills);assert.deepEqual(r.build.tiers,g.weaponTiers);g.player.y=150;step(g,1,{up:true});assert.ok(r.y<400);g.skills.force=3;assert.equal(r.build.skills.force,0);
});
test('Campaign finale carries armor, counters all modules, permits flight EMP and a real left-door escape',()=>{
 const g=arena(49);g.player.mechaShield=75;g.robots.forEach(r=>r.hp=0);g.update(.02);assert.equal(g.plan.wave,50);g.startWave();assert.equal(g.player.mecha,true);assert.equal(g.player.mechaShield,75);const r=g.robots[0];g.player.x=900;g.player.y=130;assert.ok(g.pressEmergency());assert.equal(r.disabled,true);g.player.x=r.x-30;g.player.y=r.y;g.player.facing=1;g.weapon=1;for(let i=0;i<15&&r.hp>0;i++){g.player.attackCd=0;g.attack();}g.update(.02);assert.equal(g.state,'escaping');assert.equal(g.mechTier,5);step(g,7,{left:true});assert.equal(g.state,'complete');
});
test('every campaign room simulates finite positions and no unbounded projectiles or effects',()=>{
 for(let w=1;w<=50;w++){const g=arena(w);for(let i=0;i<600&&g.state==='playing';i++){g.player.invulnerable=1;g.update(.02,{right:i%200<100,left:i%200>=100,up:w>10&&i%120<60});}for(const r of g.robots)assert.ok([r.x,r.y,r.hp].every(Number.isFinite),'wave '+w);assert.ok(g.shots.length<100);assert.ok(g.effects.length<100);assert.ok(g.pools.length<=18);}
});
test('all Campaign modules and both query-mode launches are cached for offline home-screen play',async()=>{
 const root='https://test.example/countermeasure/',handlers={},entries=new Map();let pending,network=0;
 const caches={open:async()=>({addAll:async urls=>{for(const request of urls){const url=typeof request==='string'?request:request.url;entries.set(url,await readFile(new URL('../countermeasure/'+(new URL(url).pathname.slice(16)||'index.html'),import.meta.url)));}},match:async key=>entries.get(key)}),keys:async()=>[],delete:async()=>{}};
 const self={location:{href:root+'sw.js'},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f};vm.runInNewContext(await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8'),{self,caches,URL,Request,fetch:()=>{network++;throw Error('Offline');}});handlers.install({waitUntil:p=>pending=p});await pending;
 for(const path of ['?mode=campaign&launch=homescreen','?mode=demo','campaign.mjs','campaign-plan.mjs','campaign-saves.mjs']){handlers.fetch({request:{method:'GET',url:root+path,mode:path.startsWith('?')?'navigate':'cors'},respondWith:p=>pending=p});assert.ok((await pending).length>0);}assert.equal(network,0);
});
test('independent module holds work alongside movement, flight and attack, and clear on pause',async()=>{
 const {HeldControls}=await import('../countermeasure/controls.mjs');const g=arena(41),c=new HeldControls();for(const [id,action] of [[1,'right'],[2,'up'],[3,'attack'],[4,'module']])c.hold('pointer:'+id,action);g.selectModule(3);g.update(.02,c.state);assert.ok(g.player.flying);assert.ok(g.player.vx>0);assert.ok(g.stats.attacks[0]>0);assert.ok(g.moduleCooldowns[3]>0);c.release('pointer:4');assert.equal(c.state.module,false);assert.equal(c.state.attack,true);g.pause();c.clear();assert.ok(Object.values(c.state).every(v=>!v));
});
test('restored Mirror keeps its frozen mech module after the human rewires',()=>{
 const g=arena(49);g.mirrorBlueprint.module=2;const c=campaignCheckpoint(g.snapshot());assert.ok(c);const h=new CampaignArena();assert.ok(h.resume(c));h.selectModule(3);assert.equal(h.robots[0].build.module,2);assert.equal(h.robots[0].build.mechTier,4);
});
