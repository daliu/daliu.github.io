import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,weaponAt} from '../countermeasure/engine.mjs';
import {CampaignArena} from '../countermeasure/campaign.mjs';
import {CampaignStore} from '../countermeasure/campaign-saves.mjs';
import {ExpeditionArena,POWERS} from '../countermeasure/expedition.mjs';
import {expeditionCheckpoint,ExpeditionStore} from '../countermeasure/expedition-saves.mjs';
import {bossRules,roomIndex} from '../countermeasure/expedition-plan.mjs';
import {scrollView} from '../countermeasure/expedition-view.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
function game(wave=1,encounter=null,random=()=>.99){const g=new ExpeditionArena({random});g.mechTier=Math.floor((wave-1)/10);g.plan=g.makePlan(wave,g.memory,encounter);g.state='between';g.startWave();return g;}
function step(g,time,input={}){for(let t=0;t<time;t+=.02)g.update(.02,input);}
function clear(g){for(let guard=0;guard<600&&g.state==='playing';guard++){for(const r of [...g.robots])if(r.hp>0)g.damageRobot(r,1e8);g.update(.02);}}
function walk(g){for(let i=0;i<300&&g.state==='traveling';i++)g.update(.02,{right:true});}
function hidden(){const g=game(50,'hidden');g.journey={cleared:50,flawless:true,secretQualified:true};g.mechTier=5;g.player.mecha=true;g.player.mechaShield=400;return g;}
test('weapon families upgrade once per unlock while earlier counter tools remain freely selectable',()=>{
 const g=game(6);assert.deepEqual(g.weaponTiers,[1,1,1,1]);assert.equal(g.setTier(3,0),true);g.autoUpgrade();assert.equal(g.weaponTiers[3],0);g.plan=g.makePlan(16,g.memory);g.mechTier=1;g.state='between';g.startWave();assert.deepEqual(g.weaponTiers,[2,2,2,2]);g.setTier(3,0);const h=new ExpeditionArena();assert.ok(h.resume(g.snapshot()));assert.equal(h.weaponTiers[3],0);
 const d=new Arena();d.wave=3;assert.equal(d.autoUpgrade(),true);assert.deepEqual(d.weaponTiers,[1,1,1,1]);d.setTier(3,0);assert.equal(d.autoUpgrade(),false);
});
test('cleared rooms open a door and require actual rightward travel, without a pause overlay',()=>{
 const g=game();clear(g);assert.equal(g.state,'traveling');assert.equal(g.next.wave,2);assert.equal(g.wave,1);const x=g.player.x;step(g,.2);assert.equal(g.player.x,x);assert.ok(g.door>0);walk(g);assert.equal(g.wave,2);assert.equal(g.state,'playing');assert.equal(g.room,1);assert.ok(g.player.x<50);
});
test('walking doors can be paused and freeze all movement, then resume the same traversal',()=>{
 const g=game();clear(g);g.pause();assert.equal(g.pausedFrom,'traveling');const x=g.player.x,d=g.door;step(g,1,{right:true});assert.equal(g.player.x,x);assert.equal(g.door,d);g.pause();step(g,.2,{right:true});assert.ok(g.player.x>x);
});
test('room rebasing keeps world positions and camera scrolling continuous',()=>{
 const g=game();clear(g);g.door=1;g.player.x=1018;const before=g.roomOffset+g.player.x;const view=scrollView(g,300,null);g.update(.02,{right:true});const after=g.roomOffset+g.player.x;assert.ok(Math.abs(after-before)<12);const next=scrollView(g,300,view.left,.02);assert.ok(Math.abs(next.left-view.left)<15);assert.equal(roomIndex(10,'boss')+1,roomIndex(10,'super'));
});
test('regular boss and superboss pairs occur at every ten-level milestone',()=>{
 for(const wave of [10,20,30,40,50]){const g=game(wave);assert.equal(g.encounter,'boss');assert.equal(g.robots[0].type,'mirror');clear(g);assert.equal(g.next.encounter,'super');assert.equal(g.next.wave,wave);assert.ok(g.player.mecha);assert.equal(g.mechTier,wave/10);walk(g);assert.equal(g.encounter,'super');assert.equal(g.wave,wave);assert.ok(g.robots.some(r=>r.super));}
});
test('milestone pairs round-trip both encounter phases without losing current builds',()=>{
 const s=new ExpeditionStore();for(const wave of [10,20,30,40,50]){const g=game(wave);assert.ok(s.save(g.snapshot()));clear(g);const next=g.nextCheckpoint();assert.ok(s.save(next));const h=new ExpeditionArena();assert.ok(h.resume(s.get(wave)));assert.equal(h.encounter,'super');assert.equal(h.player.mecha,true);assert.equal(h.wave,wave);}
});
test('v2 Campaign imports migrate every unlocked level and cannot grant a deathless secret',()=>{
 const old=new CampaignStore();for(const w of [1,10,24,49,50]){const g=new CampaignArena();g.mechTier=Math.floor((w-1)/10);g.plan=g.makePlan(w,g.memory);g.state='between';g.startWave();old.save(g.snapshot());}
 const store=new ExpeditionStore(old.export());assert.equal(store.entries.size,5);for(const c of store.entries.values()){assert.equal(c.version,3);assert.equal(c.journey.flawless,false);assert.equal(c.journey.secretQualified,false);}assert.equal(store.get(50).encounter,'boss');assert.ok(new ExpeditionStore(store.export()).get(24));
});
test('invalid migration and secret equipment imports fail atomically',()=>{
 const g=game(),s=new ExpeditionStore();s.save(g.snapshot());const before=s.export();for(const patch of [c=>c.encounter='hidden',c=>c.tiers=[3,3,3,3],c=>c.journey.cleared=50,c=>c.module=5,c=>c.journey.flawless='yes',c=>c.carry={hp:-2,shield:9}]){const c=g.snapshot();patch(c);assert.equal(expeditionCheckpoint(c),null);assert.throws(()=>s.import(JSON.stringify({version:3,mode:'campaign',latest:1,deaths:0,levels:[c]})));assert.equal(s.export(),before);}
});
test('superbosses resist every weapon without immunity, and critical hits still deal additional damage',()=>{
 for(let i=0;i<4;i++){const g=game(30,'super'),r=g.robots[0];r.evadeRate=0;r.hp=10000;g.player.mecha=false;g.player.x=r.x-30;g.hit(r,i);assert.ok(r.hp<10000,'weapon '+i);}
 const strike=random=>{const g=game(20,'super',random),r=g.robots[0];g.player.x=r.x-50;r.hp=10000;g.hit(r,1);return 10000-r.hp;};assert.ok(strike(()=>0)>strike(()=>.99)*1.6);
});
test('second superboss flies while the first can only jump',()=>{
 const a=game(10,'super'),b=game(20,'super');for(const g of [a,b]){g.player.y=140;g.player.mecha=true;step(g,1,{up:true});}assert.equal(a.robots[0].flies,false);assert.equal(b.robots[0].flies,true);assert.ok(b.robots[0].y<300);
});
test('button protection is a real destructible barrier and stays anchored above the floor',()=>{
 const g=game(20,'super'),cover=g.robots.find(r=>r.type==='buttonGuard');g.player.x=900;g.player.y=130;assert.equal(g.nearEmergency(),false);assert.equal(g.pressEmergency(),false);step(g,2);assert.equal(cover.y,170);assert.ok(g.player.x<=795);g.damageRobot(cover,100000);g.player.x=900;g.player.y=130;assert.equal(g.pressEmergency(),true);assert.ok(g.robots[0].emp>7);
});
test('anticipation deterministically dodges 10, 20 and 30 percent of attack commitments with distinct animations',()=>{
 for(const [wave,count] of [[30,3],[40,6],[50,9]]){const g=game(wave,'super'),r=g.robots[0];let dodges=0;for(let i=0;i<30;i++)if(g.anticipate(r,['impact','cutting','electric','liquid','laser','flame'][i%6]))dodges++;assert.equal(dodges,count);assert.ok(g.effects.every(e=>e.kind==='evasion'&&e.attackKind));}
 const g=game(30,'super'),r=g.robots[0];r.evadeCredit=.9;const hp=r.hp,wet=r.wet;g.hit(r,3);assert.equal(r.hp,hp);assert.equal(r.wet,wet);
});
test('fourth antenna reboots every robot then permanently removes synchronization',()=>{
 const g=game(40,'super'),a=g.robots.find(r=>r.type==='antenna');assert.ok(a);g.damageRobot(a,100000);assert.equal(g.synchronized,false);assert.ok(g.robots.filter(r=>!r.structure&&r.hp>0).every(r=>r.radio===8&&r.desynchronized));g.player.invulnerable=20;step(g,7);assert.ok(g.robots[0].radio>0);step(g,2);assert.equal(g.robots[0].radio,0);assert.ok(g.robots[0].hp>0);
});
test('fifth fortress and antenna are much tougher and backup waves stay bounded',()=>{
 assert.ok(bossRules(5).antenna>bossRules(4).antenna*5);assert.ok(bossRules(5).cover>bossRules(4).cover);const g=game(50,'super');g.player.invulnerable=100;step(g,40);assert.ok(g.robots.some(r=>!r.super&&!r.structure));assert.ok(g.robots.filter(r=>!r.structure&&r.hp>0).length<=5);
});
test('a full flawless route opens the hidden room only after all fifty levels and boss pairs',()=>{
 const g=game();let encounters=0;while(encounters++<60){assert.ok(expeditionCheckpoint(g.snapshot()));clear(g);if(g.next?.encounter==='hidden')break;assert.equal(g.state,'traveling');walk(g);}assert.equal(g.wave,50);assert.equal(g.encounter,'super');assert.equal(g.journey.cleared,50);assert.equal(g.journey.secretQualified,true);assert.equal(encounters,55);const save=g.nextCheckpoint();assert.ok(expeditionCheckpoint(save));walk(g);assert.equal(g.encounter,'hidden');assert.equal(g.robots.filter(r=>r.super).length,3);assert.deepEqual(g.weaponTiers,[3,3,3,3]);assert.equal(g.player.mechaShield,400);
});
test('death and jumping to a late checkpoint both prevent the flawless secret unlock',()=>{
 for(const died of [false,true]){const g=game(50,'super');g.journey={cleared:died?49:0,flawless:!died,secretQualified:false};g.runDeaths=died?1:0;clear(g);assert.equal(g.state,'escaping');assert.equal(g.journey.secretQualified,false);}
 const g=game();g.player.invulnerable=0;g.hurt(10000,900);assert.equal(g.journey.flawless,false);g.retry();assert.equal(g.journey.flawless,false);
});
test('hidden checkpoint validation retains resources, qualification and retry deaths',()=>{
 const g=hidden();g.resources.fuel=40;g.resources.ammo=9;g.selectModule(4);g.carry={hp:80,shield:250};const s=new ExpeditionStore();assert.ok(s.save(g.snapshot()));const h=new ExpeditionArena();assert.ok(h.resume(s.get(50)));assert.equal(h.encounter,'hidden');assert.equal(h.resources.fuel,40);assert.equal(h.resources.ammo,9);assert.equal(h.module,4);assert.equal(h.player.mechaShield,250);h.player.invulnerable=0;h.player.mechaShield=0;h.hurt(10000,100);assert.ok(expeditionCheckpoint(h.snapshot()));h.retry();assert.equal(h.journey.secretQualified,true);assert.equal(h.resources.fuel,100);assert.equal(h.resources.ammo,18);
});
test('localized EMP, radio and electric attacks disable their respective cores; EMP locks electric weapons',()=>{
 const g=hidden(),[a,b,c]=g.robots;g.player.x=450;g.player.y=a.y;a.evadeRate=b.evadeRate=c.evadeRate=0;g.selectModule(4);assert.ok(g.useModule());assert.ok(a.emp>5);assert.equal(b.emp,0);assert.equal(c.emp,0);assert.equal(g.resources.electricLock,5);g.selectModule(0);g.useModule();assert.ok(b.emp>3);const hp=c.hp;g.hit(c,2);assert.equal(c.hp,hp);g.resources.electricLock=0;g.hit(c,2);assert.ok(c.emp>2);assert.ok(c.hp<hp);
});
test('ultimate lamp is slow and heavy; acid glue slows even a resistant core',()=>{
 const g=hidden(),r=g.robots[0];r.evadeRate=0;assert.ok(weaponAt(0,3).cooldown>1);assert.ok(weaponAt(0,3).range>=300);g.player.x=r.x-50;const x=r.x;g.hit(r,0);assert.ok(r.stun>=.8);assert.ok(r.x>x);r.emp=r.stun=0;const hp=r.hp;g.hit(r,3);assert.ok(r.glue>=1.8);assert.ok(r.hp<hp);assert.equal(r.corrosionTier,2);
});
test('double-tap thermite consumes finite fuel and exposes struck armor to physical follow-ups',()=>{
 const g=hidden(),r=g.robots[0];g.player.x=r.x;g.player.y=200;r.y=300;r.evadeRate=0;g.jump();g.update(.1);g.jump();assert.equal(g.resources.fuel,80);assert.ok(g.boostTime>0);g.update(.02);assert.ok(r.boostExposed>0);const hp=r.hp;g.hit(r,1);const exposed=hp-r.hp;r.boostExposed=0;const next=r.hp;g.hit(r,1);assert.ok(exposed>next-r.hp);g.resources.fuel=0;g.lastJumpTap=g.clock;g.jump();assert.equal(g.resources.fuel,0);
});
test('armor-piercing explosive rounds have finite ammunition and damage the resistant core',()=>{
 const g=hidden(),r=g.robots[0];r.x=300;r.y=420;r.evadeRate=0;g.player.x=200;g.player.y=420;g.player.facing=1;g.selectModule(5);const hp=r.hp;assert.ok(g.useModule());assert.equal(g.resources.ammo,17);step(g,.2);assert.ok(r.hp<hp);g.resources.ammo=0;g.moduleCooldowns[5]=0;assert.equal(g.useModule(),false);
});
test('ultra armor reduces impact, heat, shock, liquid and projectile damage',()=>{
 for(const cause of ['impact','heat','shock','liquid','projectile']){const g=hidden();g.player.invulnerable=0;g.hurt(30,900,0,cause);assert.equal(g.player.hp,100);assert.ok(g.player.mechaShield>385);g.player.mechaShield=0;g.player.invulnerable=0;g.hurt(30,900,0,cause);assert.equal(g.player.hp,70);}
});
test('new runtime files and mode URLs all reload offline without touching other site paths',async()=>{
 const root='https://example.test/countermeasure/',handlers={},files=new Map();let pending,fetches=0;const caches={open:async()=>({addAll:async urls=>{for(const u of urls)files.set(u,await readFile(new URL('../countermeasure/'+(new URL(u).pathname.slice('/countermeasure/'.length)||'index.html'),import.meta.url)));},match:async key=>files.get(key)}),keys:async()=>[],delete:async()=>{}};
 const self={location:{href:root+'sw.js'},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f};vm.runInNewContext(await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8'),{self,caches,URL,fetch:()=>{fetches++;throw Error('Offline');}});handlers.install({waitUntil:p=>pending=p});await pending;for(const path of ['?mode=campaign','expedition.mjs','expedition-plan.mjs','expedition-saves.mjs','expedition-view.mjs']){handlers.fetch({request:{method:'GET',url:root+path,mode:path.startsWith('?')?'navigate':'cors'},respondWith:p=>pending=p});assert.ok((await pending).length>0);}assert.equal(fetches,0);
});
test('first superboss can be beaten through flight, the real EMP interaction and weapon counterplay',()=>{
 const g=game(10,'super');g.skills.voltage=3;g.skills.agility=2;let pressed=false;
 for(let i=0;i<9000&&g.state==='playing';i++){
  const p=g.player,r=g.robots.find(r=>r.super&&r.hp>0);if(!r)break;
  if(!pressed){const right=p.x<890;g.update(.02,{right,up:true,attack:g.nearEmergency()});pressed=!!g.emergency.activated;}
  else{const dx=r.x-p.x;p.facing=Math.sign(dx)||1;g.weapon=r.wet>0?2:3;g.weaponTiers[3]=0;g.update(.02,{right:dx>170,left:dx< -170,up:p.y>r.y-45,attack:Math.abs(dx)<260});}
 }
 assert.equal(pressed,true);assert.equal(g.state,'traveling');assert.equal(g.next.wave,11);assert.ok(g.player.hp>0);
});
test('every boss, superboss and hidden room remains finite with bounded backup and effects',()=>{
 for(const wave of [10,20,30,40,50])for(const encounter of ['boss','super',...(wave===50?['hidden']:[])]){const g=game(wave,encounter);g.player.invulnerable=50;for(let i=0;i<1000&&g.state==='playing';i++)g.update(.02,{up:true,right:i%200<100,left:i%200>=100,attack:true,module:true});for(const r of g.robots)assert.ok([r.x,r.y,r.hp].every(Number.isFinite));assert.ok(g.robots.length<12);assert.ok(g.shots.length<90);assert.ok(g.effects.length<80);}
});
test('migration copies to a new storage key without overwriting saves held by older live clients',async()=>{
 const {EXPEDITION_SAVE_KEY,campaignSaveFrom}=await import('../countermeasure/expedition-saves.mjs');const g=new CampaignArena();g.startWave();const old=new CampaignStore();old.save(g.snapshot());const values=new Map([['countermeasure.campaign.v1',old.export()]]),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};const original=values.get('countermeasure.campaign.v1');const migrated=new ExpeditionStore(campaignSaveFrom(storage));storage.setItem(EXPEDITION_SAVE_KEY,migrated.export());assert.equal(values.get('countermeasure.campaign.v1'),original);assert.equal(JSON.parse(campaignSaveFrom(storage)).version,3);values.set('countermeasure.campaign.v1','an older running client saved again');assert.equal(JSON.parse(campaignSaveFrom(storage)).version,3);assert.equal(campaignSaveFrom({getItem(){throw Error('Blocked');}}),null);
});
test('new-run and death handling retain unlocks without resurrecting an older perfect prefix',()=>{
 const old=game(50,'super');old.journey={cleared:49,flawless:true,secretQualified:false};const store=new ExpeditionStore();assert.ok(store.save(old.snapshot()));store.setDeaths(1);assert.equal(store.get(50).journey.flawless,false);const fresh=new ExpeditionArena();assert.ok(store.beginRun(fresh.snapshot(1)));assert.equal(store.latest,1);assert.equal(store.deaths,0);assert.equal(store.entries.size,2);assert.equal(store.get(1).journey.flawless,true);assert.equal(store.get(50).journey.flawless,false);const restored=new ExpeditionArena();assert.ok(restored.resume(store.get(50),store.deaths));clear(restored);assert.equal(restored.state,'escaping');assert.equal(restored.journey.secretQualified,false);
});
