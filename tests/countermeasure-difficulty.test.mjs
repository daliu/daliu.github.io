import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Arena,emptyStats} from '../countermeasure/engine.mjs';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {ExpeditionStore,expeditionCheckpoint} from '../countermeasure/expedition-saves.mjs';
import {DIFFICULTIES,fullResources} from '../countermeasure/difficulty.mjs';
import {campaignMemory,learnCampaign} from '../countermeasure/campaign-plan.mjs';
function start(difficulty='normal',wave=1,encounter=null){const g=new ExpeditionArena({difficulty,random:()=>.99});g.mechTier=difficulty==='terminator'&&wave>10?5:Math.floor((wave-1)/10);g.plan=g.makePlan(wave,g.memory,encounter);g.state='between';g.startWave();return g;}
function clear(g){for(let guard=0;guard<600&&g.state==='playing';guard++){for(const r of [...g.robots])if(r.hp>0)g.damageRobot(r,1e8);g.update(.02);}}
function walk(g){for(let i=0;i<300&&g.state==='traveling';i++)g.update(.02,{right:true});}
function qualified(){const g=start('normal',50,'hidden');g.journey={cleared:50,flawless:true,secretQualified:true};return g.snapshot();}
test('earned finale remains unlocked after death, new run, older-save import and reload',()=>{
 const s=new ExpeditionStore();assert.ok(s.save(qualified()));s.setDeaths(4);const fresh=new ExpeditionArena();s.beginRun(fresh.snapshot(1));assert.ok(s.finale);const old=new ExpeditionStore();old.save(fresh.snapshot(1));s.import(old.export());const reloaded=new ExpeditionStore(s.export());assert.ok(reloaded.finale);for(const difficulty of Object.keys(DIFFICULTIES)){const c=reloaded.finaleFor(difficulty);assert.ok(expeditionCheckpoint(c));const g=new ExpeditionArena();assert.ok(g.resume(c,0));assert.equal(g.robots.filter(r=>r.super).length,3);assert.equal(g.player.hp,DIFFICULTIES[difficulty].health);assert.deepEqual(g.resources,fullResources(difficulty));}
});
test('malformed permanent finale import is atomic and cannot erase the earned unlock',()=>{
 const s=new ExpeditionStore();s.save(qualified());const before=s.export(),bad=JSON.parse(before);bad.finale.encounter='room';assert.throws(()=>s.import(JSON.stringify(bad)));assert.equal(s.export(),before);assert.equal(s.unlockFinale(start().snapshot()),false);
});
test('difficulty changes health, learning rate, hardware adaptation, population and cognition',()=>{
 const stats=emptyStats();stats.attacks=[15,0,0,0];stats.damage=[200,0,0,0];stats.time=8;stats.samples=8;stats.stationaryTime=8;
 const games=Object.keys(DIFFICULTIES).map(d=>start(d,24));assert.deepEqual(games.map(g=>g.player.hp),[140,100,85,70]);assert.ok(games[0].robots.length<games[1].robots.length);assert.ok(games[3].robots.length>games[2].robots.length);
 const models=games.map(g=>learnCampaign(campaignMemory(),stats,{wave:24,won:true,learning:g.profile.learning}));assert.ok(models[0].weapon[0]<models[1].weapon[0]);assert.ok(models[2].weapon[0]<models[3].weapon[0]);assert.ok(games[0].cognition(24).reaction>games[3].cognition(24).reaction);assert.ok(games[0].cognition(24).speed<games[3].cognition(24).speed);
 const memory=campaignMemory();memory.history=[{total:4}];for(const g of games)g.memory=memory;assert.equal(games[0].makePlan(24,memory).adaptation,'Gathering evidence');assert.notEqual(games[3].makePlan(24,memory).adaptation,'Gathering evidence');
});
test('Terminator receives its full ultra suit only after the first Mirror has been defeated',()=>{
 const g=start('terminator',9);g.player.hp=23;clear(g);const c=g.nextCheckpoint();assert.ok(expeditionCheckpoint(c));const resume=new ExpeditionArena();assert.ok(resume.resume(c));assert.equal(resume.mechTier,0);assert.equal(resume.player.mecha,false);walk(g);assert.equal(g.wave,10);assert.equal(g.mechTier,0);assert.equal(g.player.hp,23);assert.ok(g.mechaDrop.locked);clear(g);assert.equal(g.mechTier,0);assert.equal(g.mechaDrop.locked,false);assert.ok(g.collectMechReward());assert.equal(g.mechTier,5);assert.equal(g.player.mechaShield,168);assert.equal(g.player.hp,23);walk(g);assert.equal(g.encounter,'super');assert.equal(g.player.mechaShield,168);g.player.mechaShield=15;clear(g);walk(g);assert.equal(g.wave,11);assert.equal(g.player.mechaShield,15);assert.equal(g.player.hp,23);assert.ok(expeditionCheckpoint(g.snapshot()));
});
test('each difficulty completes all 55 phases with valid gate checkpoints and retains a permanent finale',()=>{
 for(const difficulty of Object.keys(DIFFICULTIES)){const g=start(difficulty),s=new ExpeditionStore();let rooms=0;while(rooms++<56){assert.ok(expeditionCheckpoint(g.snapshot()),difficulty+' '+g.wave+' '+g.encounter);clear(g);const next=g.nextCheckpoint();assert.ok(next);assert.ok(s.save(next),difficulty+' next '+next.wave+' '+next.encounter);walk(g);if(g.ultimate)break;}assert.equal(rooms,55);assert.ok(s.finale);assert.equal(g.robots.filter(r=>r.super).length,3);}
});
test('Terminator high-tier mirror can copy and use localized EMP and AP powers without a runtime error',()=>{
 const g=start('terminator',20);g.selectModule(5);g.mirrorBlueprint=null;g.state='between';g.startWave();const r=g.robots[0];assert.equal(r.build.module,5);r.moduleWindup=.01;g.update(.02);assert.ok(Number.isFinite(r.moduleCd));assert.ok(expeditionCheckpoint(g.snapshot()));
});
test('roll has a low hitbox, longer grounded travel, freezes in pause and retains crit window',()=>{
 const g=start();g.player.crouching=true;g.dash();assert.ok(g.player.rollTime>0);const x=g.player.x;g.update(.04,{right:true,down:true});assert.ok(g.player.crouching);assert.ok(g.player.x>x);assert.ok(g.player.dashCrit>0);g.pause();const timer=g.player.rollTime;g.update(.04,{right:true});assert.equal(g.player.rollTime,timer);g.pause();for(let i=0;i<12;i++)g.update(.04);assert.equal(g.player.rollTime,0);
});
test('head/body/leg critical damage follows attack height and repeated leg crits cause crawling',()=>{
 const damage=(y,crouching=false)=>{const g=new Arena({random:()=>0});g.plan=g.makePlan(2,g.memory);g.state='between';g.startWave();const r=g.robots[0];r.hp=10000;r.shield=0;g.player.y=y;g.player.crouching=crouching;g.hit(r,1);return {damage:10000-r.hp,zone:r.lastCritical,r,g};};const head=damage(385),body=damage(420),legs=damage(420,true);assert.equal(head.zone,'head');assert.equal(body.zone,'body');assert.equal(legs.zone,'legs');assert.ok(head.damage>legs.damage&&legs.damage>body.damage);assert.ok(legs.r.crippled);assert.ok(legs.r.stun>=1.2);
 const g=start('normal',4),r=g.robots.find(r=>r.type==='guard');r.crippled=true;r.stun=0;r.shield=0;r.x=750;g.player.x=100;g.player.invulnerable=10;const x=r.x;g.update(.04);assert.ok(x-r.x<2);
});
test('armor break removes protection while booster flight remains functional',()=>{
 const g=start('terminator',12);g.player.mechaShield=1;g.player.invulnerable=0;g.hurt(20,900);assert.equal(g.player.mechaShield,0);assert.ok(g.effects.some(e=>e.kind==='armor-break'));g.player.invulnerable=0;const hp=g.player.hp;g.hurt(20,900);assert.equal(g.player.hp,hp-20);g.update(.02,{up:true});assert.equal(g.player.flying,true);assert.equal(g.player.mecha,true);assert.ok(g.player.vy<0);
});
test('invalid difficulty and excessive profile resources fail checkpoint validation',()=>{
 for(const change of [c=>c.difficulty='unknown',c=>c.resources.fuel=1000,c=>c.carry={hp:200,shield:0},c=>c.module=99]){const c=start('terminator',12).snapshot();change(c);assert.equal(expeditionCheckpoint(c),null);}
});
test('standalone local unlock can rebuild a transferable save after the run store is missing',()=>{
 const s=new ExpeditionStore();assert.ok(s.unlockFinale(qualified()));const restored=new ExpeditionStore(s.export());assert.ok(restored.finale);assert.ok(restored.finaleFor('normal'));assert.equal(restored.latest,50);
});
test('every profile maintains bounded finite coordinated finale combat and reinforcements',()=>{
 for(const difficulty of Object.keys(DIFFICULTIES)){const g=start(difficulty,50,'hidden');g.player.invulnerable=100;for(let n=0;n<2000;n++)g.update(.02,{up:n%250<125,right:n%300<150,left:n%300>=150});assert.ok(g.robots.length<20);assert.ok(g.shots.length<100);assert.ok(g.effects.length<100);for(const r of g.robots)assert.ok([r.hp,r.x,r.y,r.cooldown].every(Number.isFinite));assert.ok(g.syncClock<=5/g.profile.coordination);}
});
test('a barely surviving Terminator retains fractional health across gates and reloads',()=>{
 const g=start('terminator');g.player.hp=.25;clear(g);const c=g.nextCheckpoint();assert.ok(expeditionCheckpoint(c));const s=new ExpeditionStore();assert.ok(s.save(c));const h=new ExpeditionArena();assert.ok(h.resume(new ExpeditionStore(s.export()).get(2)));assert.equal(h.player.hp,.25);
});
