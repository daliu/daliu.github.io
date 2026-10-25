import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Arena} from '../countermeasure/engine.mjs';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {Statistics,STATS_KEY,aggregate,deathCell,MAX_ATTEMPTS} from '../countermeasure/statistics.mjs';
import {Telemetry,SHARING_KEY,eventParameters} from '../countermeasure/telemetry.mjs';
import {communitySummary} from '../countermeasure/community-statistics.mjs';
import {rng,equip,decide} from './helpers/countermeasure-pilot.mjs';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function observer(g,store=storage(),mode='campaign'){const events=[];const s=new Statistics({storage:store,mode,release:'19 · OBSERVATION LOG',onEvent:(...e)=>events.push(e)});s.observe(g);return {s,events,store};}
test('pauses do not duplicate starts, death and retry are distinct, death cause and cell are retained',()=>{
 const g=new ExpeditionArena({random:rng(1)});g.startWave();const {s,events}=observer(g);for(let i=0;i<8;i++)s.observe(g,.04);g.pause();s.observe(g,.04);g.pause();s.observe(g,.04);assert.equal(events.length,1);g.hurt(10000,0,0,'projectile impact',{hazard:true});s.observe(g);s.observe(g);assert.equal(s.attempts.length,1);assert.equal(s.attempts[0].outcome,'death');assert.equal(s.attempts[0].deathCause,'projectile impact');assert.match(s.attempts[0].deathCell,/^\d:[0-4]$/);g.retry();s.observe(g);assert.equal(events.filter(e=>e[0]==='cm_attempt_start').length,2);assert.equal(s.active.entry.source,'retry');assert.equal(s.attempts[0].seconds,.4);
});
test('a real input-driven route counts clears once, excludes travel and keeps boss phases distinct',()=>{
 const g=new ExpeditionArena({difficulty:'easy',random:rng(2)});equip(g);g.startWave();const {s,events}=observer(g);let input={},think=0;
 for(let i=0;i<160000&&!(g.wave===10&&g.encounter==='super'&&g.state==='playing');i++){
  if(g.state==='dead'){g.retry();s.observe(g);continue;}if(g.state==='traveling'){g.update(.04,{right:true});s.observe(g,.04);continue;}
  if(think<=0){equip(g);input=decide(g,i*.04);think=.14;}g.update(.04,input);think-=.04;s.observe(g,.04);
 }
 assert.equal(g.wave,10);assert.equal(g.encounter,'super');assert.ok(s.attempts.some(a=>a.wave===10&&a.encounter==='boss'&&a.outcome==='clear'));assert.equal(s.active.entry.encounter,'super');assert.equal(events.filter(e=>e[0]==='cm_attempt_end').length,s.attempts.length);assert.ok(s.attempts.some(a=>a.combos.wetElectric>0));assert.ok(s.attempts.some(a=>Object.values(a.criticals).some(n=>n>0)));assert.ok(s.attempts.every(a=>a.seconds>0));
});
test('real combo hits, anatomy criticals and module activations are counted without changing combat',()=>{
 const g=new ExpeditionArena({random:()=>0});g.startWave();const r=g.robots[0];g.hit(r,1,.01);g.hit(r,3,.01);g.hit(r,0,.01);g.hit(r,2,.01);assert.ok(g.stats.combos.exposedLiquid);assert.ok(g.stats.combos.wetElectric);assert.ok(g.stats.combos.dentedElectric);assert.equal(Object.values(g.stats.criticals).reduce((a,b)=>a+b),4);g.upgradeMech(1);g.player.mecha=true;assert.ok(g.useModule());assert.equal(g.stats.modules[0],1);g.useModule();assert.equal(g.stats.modules[0],1);
});
test('reset and level select abandon the prior attempt, imported history creates no analytics',()=>{
 const g=new Arena();g.startWave();const {s,events}=observer(g,storage(),'demo');s.startFrom('level_select',g);g.reset();g.startWave();s.observe(g);assert.equal(s.attempts[0].outcome,'abandoned');assert.equal(s.active.entry.source,'level_select');assert.equal(events.length,3);const next=new Statistics({storage:storage()});assert.equal(next.attempts.length,0);
});
test('an encounter clear and actually walking out emit different events, once each',()=>{
 const g=new Arena();g.startWave();const {s,events}=observer(g,storage(),'demo');g.beginEscape();s.observe(g);assert.equal(events.filter(e=>e[0]==='cm_escape').length,0);for(let i=0;i<500&&g.state!=='complete';i++){g.update(.04,{left:true});s.observe(g,.04);}s.observe(g);assert.equal(g.state,'complete');assert.equal(events.filter(e=>e[0]==='cm_attempt_end').length,1);assert.equal(events.filter(e=>e[0]==='cm_escape').length,1);
});
test('local statistics persist across tabs, stay bounded and clear without touching game saves',()=>{
 const store=storage();store.setItem('countermeasure.campaign.v5','saved');const g=new Arena();g.startWave();const a=observer(g,store,'demo'),b=observer(g,store,'demo');a.s.startFrom('new_run',g);b.s.startFrom('new_run',g);assert.equal(JSON.parse(store.getItem(STATS_KEY)).attempts.length,2);b.s.clear();assert.equal(store.getItem('countermeasure.campaign.v5'),'saved');assert.equal(JSON.parse(store.getItem(STATS_KEY)).attempts.length,0);
 const record=a.s.attempts[0];store.setItem(STATS_KEY,JSON.stringify({version:1,attempts:Array.from({length:MAX_ATTEMPTS+20},(_,i)=>({...record,id:String(i)}))}));assert.equal(new Statistics({storage:store}).attempts.length,MAX_ATTEMPTS);
});
test('rates exclude abandonments, filters isolate difficulty and heatmaps clamp arena positions',()=>{
 const g=new Arena();g.startWave();const {s}=observer(g,storage(),'demo');s.startFrom('new_run',g);const base=s.attempts[0],rows=[{...base,outcome:'death',deathCell:'9:4'},{...base,outcome:'clear'},base,{...base,difficulty:'hard',outcome:'death'}];const summary=aggregate(rows,{difficulty:'normal'});assert.equal(summary.attempts,3);assert.equal(summary.deaths,1);assert.equal(summary.clears,1);assert.equal(summary.abandoned,1);assert.equal(summary.cells[49],1);assert.equal(deathCell({x:-100,y:1000}),'0:4');
 const report={outcomes:[{dimensions:['campaign','normal','10-boss','death','retry','19'],metrics:[2,20,3,4,5]},{dimensions:['campaign','hard','10-super','clear','level_select','19'],metrics:[1,30,0,2,1]}]};assert.equal(communitySummary(report,{difficulty:'normal'}).totals.death,2);assert.equal(communitySummary(report,{entry:'progression'}).levels.length,0);assert.equal(communitySummary(report,{entry:'replay'}).totals.clear,1);
});
function environment({enabled=false,origin='https://daliu.github.io',online=true,dnt='0',gpc=false,test=false}={}){
 const store=storage(),listeners={},scripts=[],cookies=[];if(enabled)store.setItem(SHARING_KEY,'on');const win={location:{origin,hostname:new URL(origin).hostname,search:test?'?analytics_test=1':''},addEventListener:(n,f)=>listeners[n]=f};const doc={get cookie(){return 'cm_ga=test; _ga=other-site';},set cookie(v){cookies.push(v);},createElement:()=>({}),head:{append:s=>scripts.push(s)}};const nav={onLine:online,doNotTrack:dnt,globalPrivacyControl:gpc};const t=new Telemetry({window:win,document:doc,navigator:nav,storage:store});return {t,win,doc,nav,store,listeners,scripts,cookies};
}
test('no analytics script or event without opt-in, on preview, offline or with privacy signals',()=>{
 for(const config of [{},{enabled:true,origin:'http://127.0.0.1:4200'},{enabled:true,online:false},{enabled:true,dnt:'1'},{enabled:true,gpc:true}]){const e=environment(config);e.t.send('cm_attempt_start',{});assert.equal(e.scripts.length,0);assert.equal(e.win.dataLayer,undefined);}
});
test('online opt-in loads asynchronously, whitelists parameters, and revocation stops pending and future events',()=>{
 const e=environment();e.t.setEnabled(true);assert.equal(e.scripts.length,1);const malicious={mode:'campaign',difficulty:'hard',wave:10,encounter:'super',source:'retry',release:'19',ip:'1.2.3.4',name:'Private name',save:'private',outcome:'death',strategy:'wet_electric',deathCause:'private text',deathCell:'5:4',attacks:[1,2,3,4]};e.t.send('cm_attempt_end',malicious);e.scripts[0].onload();const event=e.win.dataLayer.find(args=>args[0]==='event');assert.ok(event);const payload=event[2];assert.ok(Object.keys(payload).length<=25);assert.ok(!JSON.stringify(payload).includes('Private'));assert.ok(!JSON.stringify(payload).includes('1.2.3.4'));assert.equal(payload.cm_death_cause,'other');const length=e.win.dataLayer.length;e.t.setEnabled(false);e.t.send('cm_attempt_end',malicious);assert.equal(e.win.dataLayer.length,length);assert.ok(e.win['ga-disable-G-GR5Z815VXW']);assert.ok(e.cookies.some(c=>c.startsWith('cm_ga=')));assert.ok(e.cookies.every(c=>!c.startsWith('_ga=')));
 const race=environment();race.t.setEnabled(true);race.t.send('cm_attempt_start',malicious);race.t.setEnabled(false);race.scripts[0].onload();assert.equal(race.win.dataLayer,undefined);assert.equal(race.t.pending.length,0);
});
test('test events are explicitly excluded from the community sample and retained data is never backfilled',()=>{
 const e=environment({enabled:true,test:true});e.scripts[0].onload();e.t.send('cm_attempt_start',{mode:'demo',difficulty:'normal',wave:1,encounter:'room',source:'new_run',release:'19'});const event=e.win.dataLayer.find(a=>a[0]==='event');assert.equal(event[2].cm_entry,'qa');assert.equal(event[2].debug_mode,true);assert.ok(Object.keys(event[2]).length<=25);assert.equal(e.t.pending.length,0);assert.ok(!('id' in eventParameters({id:'local-only'})));
});
test('offline cache includes statistics screens while the independent daily job keeps its existing schedule',async()=>{
 const sw=await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8');for(const file of ['statistics.mjs','statistics-view.mjs','telemetry.mjs','statistics.html','community-statistics.mjs'])assert.ok(sw.includes(file));assert.ok(sw.includes('url.origin!==ROOT.origin'));const html=await readFile(new URL('../countermeasure/index.html',import.meta.url),'utf8');assert.ok(!html.includes('<script async src="https://www.googletagmanager'));assert.ok(html.includes('id="statistics-menu"'));assert.ok(!html.includes('call an LLM, upload your play'));const script=await readFile(new URL('../scripts/fetch_analytics.py',import.meta.url),'utf8');assert.ok(script.includes('"countermeasure": game_statistics'));
});
