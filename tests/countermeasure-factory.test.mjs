import {test} from 'node:test';
import assert from 'node:assert/strict';
import {factoryRoom,drawFactoryWorld,drawFactoryLore} from '../countermeasure/factory-world.mjs';
import {updateMirrorFlight} from '../countermeasure/mirror-flight.mjs';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {beginCombo} from '../countermeasure/boss-combos.mjs';
import {roomIndex} from '../countermeasure/expedition-plan.mjs';
import {readFileSync} from 'node:fs';
const model=()=>({build:{mechTier:2},y:260,vy:0,flightSense:0,glueGround:0});
test('each ten-level sector and its superboss share an identity; lore deepens within it',()=>{
 const colors=new Set(),kinds=new Set();for(let sector=0;sector<5;sector++){const first=factoryRoom(sector*11),last=factoryRoom(sector*11+10);assert.equal(first.name,last.name);assert.notEqual(first.fragment,last.fragment);assert.equal(new Set(Array.from({length:11},(_,i)=>factoryRoom(sector*11+i).fragment)).size,11);colors.add(first.top);kinds.add(first.kind);assert.equal(first.sector,sector);}assert.equal(colors.size,5);assert.equal(kinds.size,5);assert.equal(factoryRoom(55).sector,4);assert.equal(factoryRoom(NaN).sector,0);
});
test('all difficulty/chamber backgrounds render finite geometry, retain trials, preserve state and hide preview records',()=>{
 for(const difficulty of ['easy','normal','hard','terminator'])for(let index=0;index<56;index++){
  const texts=[],coords=[],gradient={addColorStop(){}};const c=new Proxy({createLinearGradient:()=>gradient,fillText:(text,...args)=>{texts.push(text);coords.push(...args);}}, {get(o,k){return k in o?o[k]:(...args)=>coords.push(...args.filter(n=>typeof n==='number'));},set(o,k,v){o[k]=v;return true;}});
  const game={room:index,trial:17,difficulty,random(){throw Error('Rendering must not consume combat randomness');}},s=factoryRoom(index,difficulty);
  drawFactoryWorld(c,game,index,144.2);assert.ok(coords.every(Number.isFinite));assert.ok(texts.includes('017'));assert.ok(!texts.includes(s.fragment));assert.ok(!texts.includes(s.title));
  drawFactoryLore(c,game);assert.ok(texts.includes(s.fragment));assert.ok(texts.includes(s.title));assert.equal(game.room,index);assert.equal(game.trial,17);
  texts.length=0;drawFactoryWorld(c,{...game,room:index-1},index,144.2);assert.ok(!texts.includes(s.fragment));
  texts.length=0;drawFactoryLore(c,{...game,escape:{door:1}});assert.ok(texts.includes('MAINTENANCE EXIT / OPEN'));assert.ok(!texts.includes(s.fragment));
 }
});
test('the first Mirror and superboss remain trials; containment starts only after that milestone',()=>{
 for(let wave=1;wave<10;wave++)assert.equal(factoryRoom(roomIndex(wave,'room')).kind,'trials');
 for(const phase of ['boss','super'])assert.equal(factoryRoom(roomIndex(10,phase)).kind,'trials');
 assert.equal(factoryRoom(roomIndex(11,'room')).kind,'cells');assert.ok(factoryRoom(roomIndex(11,'room')).breach);
 assert.equal(factoryRoom(roomIndex(21,'room')).kind,'processing');assert.equal(factoryRoom(roomIndex(31,'room')).kind,'laboratory');assert.equal(factoryRoom(roomIndex(41,'room')).kind,'core');assert.equal(factoryRoom(roomIndex(50,'hidden')).title,'THREE PERFECT PREDICTIONS');
});
test('harder stories leave fewer people and matching manufactured traces, while a last lab survivor remains',()=>{
 const totals=[0,0,0,0];for(let i=0;i<56;i++){const rooms=['easy','normal','hard','terminator'].map(d=>factoryRoom(i,d));for(let n=0;n<4;n++){assert.ok(Number.isInteger(rooms[n].people)&&rooms[n].people>=0);totals[n]+=rooms[n].people;if(n)assert.ok(rooms[n].people<=rooms[n-1].people);}}
 assert.ok(totals[0]>totals[1]&&totals[1]>totals[2]&&totals[2]>totals[3]&&totals[3]>0);
 const normal=factoryRoom(12,'normal'),hard=factoryRoom(12,'hard'),term=factoryRoom(12,'terminator');assert.equal(normal.people,1);assert.equal(hard.people,0);assert.equal(term.people,0);assert.equal(normal.cellBase,3491);assert.equal(term.cellBase,normal.cellBase);assert.equal(normal.trace,'cup');assert.equal(term.trace,normal.trace);assert.notEqual(normal.fragment,term.fragment);assert.equal(normal.floor,term.floor);
 assert.equal(factoryRoom(35,'terminator').people,1);assert.equal(factoryRoom(35,'terminator').trace,'radio');
 assert.equal(factoryRoom(17).fragment,'SOYLENT GREEN / HUMAN RATIONS.');
});
test('flight closes relative altitude in both directions and uses delayed target samples',()=>{
 const r=model();r.y=180;updateMirrorFlight(r,{y:300},.02);assert.ok(r.vy>0,'must descend toward a lower opponent');r.y=350;r.flightSense=0;updateMirrorFlight(r,{y:200},.02);assert.ok(r.vy<0);const target=r.flightTarget;updateMirrorFlight(r,{y:420},.02);assert.equal(r.flightTarget,target);updateMirrorFlight(r,{y:420},.25);assert.equal(r.flightTarget,420);
});
test('sustained aerial pursuit includes recovery descents and respects the upper arena limit',()=>{
 const r=model();let descents=0,min=420;for(let n=0;n<1000;n++){r.vy+=1250*.02;r.y=Math.min(420,r.y+r.vy*.02);updateMirrorFlight(r,{y:95},.02);if(r.flightRest>0)descents++;min=Math.min(min,r.y);assert.ok([r.y,r.vy].every(Number.isFinite));}assert.ok(descents>100);assert.ok(min>=145);assert.ok(r.y>130);
});
test('unpowered and glue-grounded copies do not gain thrust',()=>{
 for(const powered of [false,true]){const r=model();r.build.mechTier=powered?2:0;r.glueGround=powered?2:0;r.vy=177;updateMirrorFlight(r,{y:90},.02);assert.equal(r.vy,177);}
});
test('actual Mirror controller and authored flight combos cannot camp outside the top boundary',()=>{
 for(const combo of [null,'rebound','pursuit','feint','airstrike']){const g=new ExpeditionArena({random:()=>.99});g.mechTier=2;g.memory.history=[{total:80}];g.plan=g.makePlan(30,g.memory,'boss');g.state='between';g.startWave();const r=g.robots[0];r.y=96;if(combo)beginCombo(g,r,combo);g.player.y=100;g.update(.02,{up:true});assert.ok(r.y>=145,combo??'normal flight');}
});
test('new background and flight modules are available in the offline precache',()=>{
 const worker=readFileSync(new URL('../countermeasure/sw.js',import.meta.url),'utf8');for(const file of ['factory-world.mjs','factory-story.mjs','mirror-flight.mjs'])assert.ok(worker.includes(`'./${file}'`));
});
