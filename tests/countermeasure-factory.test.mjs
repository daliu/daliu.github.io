import {test} from 'node:test';
import assert from 'node:assert/strict';
import {factoryRoom,drawFactoryWorld,drawFactoryLore} from '../countermeasure/factory-world.mjs';
import {updateMirrorFlight} from '../countermeasure/mirror-flight.mjs';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {beginCombo} from '../countermeasure/boss-combos.mjs';
import {readFileSync} from 'node:fs';
const model=()=>({build:{mechTier:2},y:260,vy:0,flightSense:0,glueGround:0});
test('each ten-level sector and its superboss share an identity; lore deepens within it',()=>{
 const colors=new Set(),kinds=new Set();for(let sector=0;sector<5;sector++){const first=factoryRoom(sector*11),last=factoryRoom(sector*11+10);assert.equal(first.name,last.name);assert.notEqual(first.fragment,last.fragment);assert.equal(new Set(Array.from({length:11},(_,i)=>factoryRoom(sector*11+i).fragment)).size,3);colors.add(first.top);kinds.add(first.kind);assert.equal(first.sector,sector);}assert.equal(colors.size,5);assert.equal(kinds.size,5);assert.equal(factoryRoom(55).sector,4);assert.equal(factoryRoom(NaN).sector,0);
});
test('all chambers render finite background geometry, retain trial number and reveal text only in occupied room',()=>{
 for(let index=0;index<56;index++){const texts=[],coords=[],gradient={addColorStop(){}};const c=new Proxy({createLinearGradient:()=>gradient,fillText:(text,...args)=>{texts.push(text);coords.push(...args);}}, {get(o,k){return k in o?o[k]:(...args)=>coords.push(...args.filter(n=>typeof n==='number'));},set(o,k,v){o[k]=v;return true;}});drawFactoryWorld(c,{room:index,trial:17},index,144.2);assert.ok(coords.every(Number.isFinite));assert.ok(texts.includes('017'));assert.ok(!texts.includes(factoryRoom(index).fragment));drawFactoryLore(c,{room:index});assert.ok(texts.includes(factoryRoom(index).fragment));texts.length=0;drawFactoryWorld(c,{room:index-1,trial:17},index,144.2);assert.ok(!texts.includes(factoryRoom(index).fragment));}
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
 const worker=readFileSync(new URL('../countermeasure/sw.js',import.meta.url),'utf8');for(const file of ['factory-world.mjs','mirror-flight.mjs'])assert.ok(worker.includes(`'./${file}'`));
});
