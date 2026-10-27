// Encounter summaries only: no names, save files, IPs or input recordings.
export const STATS_KEY='countermeasure.statistics.v1';
export const MAX_ATTEMPTS=500,MAX_AGE=90*86400000;
export const FAMILIES=['impact','cutting','electric','liquid'];
const bounded=(n,max=1000000)=>Math.max(0,Math.min(max,Number.isFinite(n)?n:0));
const round=n=>Math.round(bounded(n)*10)/10;
const four=a=>FAMILIES.map((_,i)=>round(a?.[i]));
const part=(value,size,count)=>Math.min(count-1,Math.floor(bounded(value,size)/size*count));
export const deathCell=p=>`${part(p.x,1000,10)}:${part(p.y,500,5)}`;
export function strategyFor(s){
 const a=four(s.attacks),total=a.reduce((n,v)=>n+v,0);
 if(!total)return 'no_attacks';
 if(s.combos?.wetElectric>0)return 'wet_electric';
 if(s.combos?.exposedLiquid>0)return 'cut_then_liquid';
 if((s.rolls??0)+(s.airDashes??0)>=3)return 'evasive';
 const top=Math.max(...a);return top/total>=.6?FAMILIES[a.indexOf(top)]:'mixed';
}
export function encounterOf(g){return g.encounter??(g.wave===g.finalWave?'super':g.wave===g.bossWave?'boss':'room');}
export function summarizeAttempt(g,entry,outcome,seconds){
 const s=g.stats,p=g.player,crit=s.criticals??{},combo=s.combos??{};
 return {...entry,outcome,seconds:round(seconds),attacks:four(s.attacks),hits:four(s.hits),
  damage:four(s.damage),damageTaken:round(s.damageTaken),jumps:round(s.jumps),rolls:round(s.rolls),airDashes:round(s.airDashes),dashes:round(s.dashes),
  criticals:{head:round(crit.head),body:round(crit.body),legs:round(crit.legs)},
  combos:{wetElectric:round(combo.wetElectric),exposedLiquid:round(combo.exposedLiquid),dentedElectric:round(combo.dentedElectric)},
  modules:Array.from({length:6},(_,i)=>round(s.modules?.[i])),strategy:strategyFor(s),
  kills:Math.max(0,g.kills-entry.killsAtStart),hp:round(p.hp),armor:round(p.mechaShield),fuel:round(g.resources?.fuel),ammo:round(g.resources?.ammo),
  deathCell:outcome==='death'?deathCell(p):null,deathCause:outcome==='death'?(g.register.current?.cause??'combat trauma'):null};
}
export class Statistics{
 constructor({storage,mode='demo',release='unknown',now=Date.now,onEvent=()=>{}}={}){
  this.storage=storage;this.mode=mode;this.release=release;this.now=now;this.onEvent=onEvent;this.active=null;this.lastStats=null;this.source='new_run';this.attempts=[];this.clearedAt=0;this.escapeEntry=null;
  try{const data=JSON.parse(storage?.getItem(STATS_KEY));if(data?.version===1&&Array.isArray(data.attempts)){this.clearedAt=data.clearedAt??0;this.attempts=data.attempts.filter(a=>validAttempt(a,now())).slice(-MAX_ATTEMPTS);}}catch{}
 }
 startFrom(source,g){this.observe(g);if(this.active)this.finish(g,'abandoned');this.source=source;}
 observe(g,dt=0){
  if(g.state==='complete'&&this.escapeEntry){this.emit('cm_escape',this.escapeEntry);this.escapeEntry=null;}
  if(g.state==='playing'&&g.wave>0&&this.lastStats!==g.stats){
   if(this.active)this.finish(null,'abandoned');
   this.escapeEntry=null;this.lastStats=g.stats;this.active={entry:{id:globalThis.crypto?.randomUUID?.()??`${this.now()}-${Math.random()}`,date:new Date(this.now()).toISOString(),mode:this.mode,release:this.release,wave:g.wave,encounter:encounterOf(g),difficulty:this.mode==='demo'?'normal':g.difficulty,source:this.source,boosted:!!(g.premiumBoosts?.armor||g.premiumBoosts?.thrusters),killsAtStart:g.kills},seconds:0};this.source='continuation';
   this.emit('cm_attempt_start',{...this.active.entry});
  }
  if(!this.active)return;
  if(g.state==='playing')this.active.seconds+=Math.max(0,Math.min(.04,dt));
  this.active.summary=summarizeAttempt(g,this.active.entry,'abandoned',this.active.seconds);
  if(g.state==='dead'){this.finish(g,'death');this.source='retry';}
  else if(['between','traveling','escaping','complete'].includes(g.state)){if(g.state==='escaping')this.escapeEntry={...this.active.entry};this.finish(g,'clear');}
 }
 finish(g,outcome){
  if(!this.active)return;const a=g?summarizeAttempt(g,this.active.entry,outcome,this.active.seconds):{...this.active.summary,outcome};this.active=null;
  if(!a)return;delete a.killsAtStart;this.attempts=this.attempts.filter(x=>Date.parse(x.date)>=this.now()-MAX_AGE);this.attempts.push(a);this.attempts=this.attempts.slice(-MAX_ATTEMPTS);this.save();this.emit('cm_attempt_end',a);
 }
 emit(name,value){try{this.onEvent(name,value);}catch{/* Analytics must never interrupt play. */}}
 save(){try{const prior=JSON.parse(this.storage?.getItem(STATS_KEY));this.clearedAt=Math.max(this.clearedAt,prior?.clearedAt??0);const rows=[...(prior?.attempts??[]),...this.attempts].filter(a=>validAttempt(a,this.now())&&Date.parse(a.date)>this.clearedAt);this.attempts=[...new Map(rows.map(a=>[a.id,a])).values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(-MAX_ATTEMPTS);this.storage?.setItem(STATS_KEY,JSON.stringify({version:1,clearedAt:this.clearedAt,attempts:this.attempts}));}catch{}}
 clear(){this.clearedAt=this.now();this.attempts=[];this.save();}
 export(){return JSON.stringify({version:1,scope:'this_browser',retention:'latest 500 attempts within 90 days',attempts:this.attempts},null,2);}
}
function validAttempt(a,now){return a&&['demo','campaign'].includes(a.mode)&&['easy','normal','hard','terminator'].includes(a.difficulty)&&['room','boss','super','hidden'].includes(a.encounter)&&['clear','death','abandoned'].includes(a.outcome)&&Number.isInteger(a.wave)&&a.wave>=1&&a.wave<=50&&Number.isFinite(Date.parse(a.date))&&Date.parse(a.date)>=now-MAX_AGE&&Date.parse(a.date)<=now+60000&&['attacks','hits','damage'].every(k=>Array.isArray(a[k])&&a[k].length===4&&a[k].every(n=>Number.isFinite(n)&&n>=0&&n<=1000000));}
export function aggregate(attempts,{mode='all',difficulty='all',loadout='standard'}={}){
 const rows=attempts.filter(a=>(mode==='all'||a.mode===mode)&&(difficulty==='all'||a.difficulty===difficulty)&&(loadout==='all'||(loadout==='boosted'?a.boosted===true:a.boosted!==true)));
 const result={attempts:rows.length,clears:0,deaths:0,abandoned:0,seconds:0,attacks:[0,0,0,0],strategies:{},levels:[],cells:Array(50).fill(0),criticals:0,combos:0};const levels=new Map();
 for(const a of rows){result[a.outcome==='clear'?'clears':a.outcome==='death'?'deaths':'abandoned']++;result.seconds+=bounded(a.seconds);four(a.attacks).forEach((v,i)=>result.attacks[i]+=v);result.strategies[a.strategy]=(result.strategies[a.strategy]??0)+1;result.criticals+=Object.values(a.criticals??{}).reduce((n,v)=>n+bounded(v),0);result.combos+=Object.values(a.combos??{}).reduce((n,v)=>n+bounded(v),0);
  const key=[a.mode,a.difficulty,a.wave,a.encounter].join('/');if(!levels.has(key))levels.set(key,{key,mode:a.mode,difficulty:a.difficulty,wave:a.wave,encounter:a.encounter,attempts:0,deaths:0,clears:0,seconds:0});const l=levels.get(key);l.attempts++;l.deaths+=a.outcome==='death'?1:0;l.clears+=a.outcome==='clear'?1:0;l.seconds+=bounded(a.seconds);
  if(a.outcome==='death'&&/^\d:[0-4]$/.test(a.deathCell)){const [x,y]=a.deathCell.split(':').map(Number);result.cells[y*10+x]++;}
 }
 result.levels=[...levels.values()].sort((a,b)=>b.deaths/Math.max(1,b.deaths+b.clears)-a.deaths/Math.max(1,a.deaths+a.clears)||b.deaths-a.deaths||a.wave-b.wave);return result;
}
