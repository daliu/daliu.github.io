import {SKILLS} from './engine.mjs';
const finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b,integer=(v,a,b)=>Number.isInteger(v)&&finite(v,a,b);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function build(b){if(!b||!exact(b.skills,SKILLS.map(s=>s.id))||!SKILLS.every(s=>integer(b.skills[s.id],0,s.max)&&(!b.skills[s.id]||!s.parent||b.skills[s.parent]>0))||!Array.isArray(b.tiers)||b.tiers.length!==4||!b.tiers.every(v=>integer(v,0,2))||!integer(b.weapon,0,3))return null;return {skills:{...b.skills},tiers:[...b.tiers],weapon:b.weapon};}
function memory(m){
 if(!m||!integer(m.waves,0,1000000)||!integer(m.attempts,0,1000000)||!integer(m.failures,0,m.attempts)||m.waves+m.failures!==m.attempts)return null;
 const out={waves:m.waves,attempts:m.attempts,failures:m.failures};
 for(const k of ['weapon','effective']){if(!Array.isArray(m[k])||m[k].length!==4||!m[k].every(v=>finite(v,0,1))||Math.abs(m[k].reduce((a,b)=>a+b,0)-1)>.001)return null;out[k]=[...m[k]];}
 for(const k of ['energyShare','groundShockShare','stationaryRatio','duckRatio','farRatio']){if(!finite(m[k],0,1))return null;out[k]=m[k];}
 for(const k of ['groundShockHits','attackRate','jumpRate','dashRate']){if(!finite(m[k],0,1000000))return null;out[k]=m[k];}
 for(const k of ['rollRate','airDashRate']){if(m[k]!==undefined&&!finite(m[k],0,1000000))return null;out[k]=m[k]??0;}
 if(!Array.isArray(m.history)||m.history.length>12||!m.history.every(h=>h&&finite(h.total,0,1000000))||!Array.isArray(m.outcomes)||m.outcomes.length>12)return null;
 out.history=m.history.map(h=>({total:h.total}));out.outcomes=[];
 for(const h of m.outcomes){if(!h||!integer(h.wave,1,50)||typeof h.won!=='boolean'||!finite(h.damageTaken,0,1000000)||!finite(h.attacks,0,1000000)||!finite(h.seconds,0,1000000))return null;out.outcomes.push({wave:h.wave,won:h.won,damageTaken:h.damageTaken,attacks:h.attacks,seconds:h.seconds});}return out;
}
export function campaignCheckpoint(data){try{
 if(data?.mode!=='campaign'||data.version!==2||!integer(data.wave,1,50)||!integer(data.points,5,Math.min(12,5+Math.floor((data.wave-1)/4)))||!integer(data.runDeaths,0,1000000)||!integer(data.kills,0,1000000)||!integer(data.mechTier,Math.floor((data.wave-1)/10),Math.floor(data.wave/10))||!integer(data.module,0,3))return null;
 const b=build(data),m=memory(data.memory);if(!b||!m||Object.values(b.skills).reduce((a,v)=>a+v,0)>data.points||b.tiers.some(t=>t>(data.wave>=16?2:data.wave>=6?1:0))||data.module>=Math.max(1,data.mechTier))return null;
 const out={version:2,mode:'campaign',wave:data.wave,points:data.points,...b,memory:m,runDeaths:data.runDeaths,kills:data.kills,mechTier:data.mechTier,module:data.module,mirrorBlueprint:null,finaleCheckpoint:null};
 if(data.mirrorBlueprint){const bb=build(data.mirrorBlueprint),style=memory(data.mirrorBlueprint.style);if(!bb||!style||!integer(data.mirrorBlueprint.mechTier,4,4)||!integer(data.mirrorBlueprint.module,0,3))return null;out.mirrorBlueprint={...bb,style,mechTier:4,module:data.mirrorBlueprint.module,subject:{name:String(data.mirrorBlueprint.subject?.name??'COPIED BUILD').slice(0,80)}};}
 if(data.finaleCheckpoint){const c=data.finaleCheckpoint;if(!finite(c.hp,1,100)||c.mecha!==true||!finite(c.mechaShield,0,180))return null;out.finaleCheckpoint={hp:c.hp,mecha:true,mechaShield:c.mechaShield};}return out;
 }catch{return null;}}
export class CampaignStore{
 constructor(saved=null){this.entries=new Map();this.latest=1;this.deaths=0;this.revision=0;if(saved)try{this.import(saved);}catch{}}
 save(data){const c=campaignCheckpoint(data);if(!c)return false;this.entries.set(c.wave,c);this.latest=c.wave;this.deaths=c.runDeaths;this.revision++;return true;}
 setDeaths(n){if(integer(n,0,1000000)&&n!==this.deaths){this.deaths=n;this.revision++;}}
 get(wave){const c=this.entries.get(wave);return c?structuredClone(c):null;}
 export(){return JSON.stringify({version:2,mode:'campaign',latest:this.latest,deaths:this.deaths,levels:[...this.entries.values()].sort((a,b)=>a.wave-b.wave)});}
 import(text){if(typeof text!=='string'||text.length>600000)throw Error('Campaign save too large');const s=JSON.parse(text);if(s?.version!==2||s.mode!=='campaign'||!Array.isArray(s.levels)||!integer(s.levels.length,1,50)||!integer(s.latest,1,50)||!integer(s.deaths,0,1000000))throw Error('Use a Campaign save');const levels=s.levels.map(campaignCheckpoint);if(levels.some(c=>!c)||new Set(levels.map(c=>c.wave)).size!==levels.length||!levels.some(c=>c.wave===s.latest))throw Error('Invalid Campaign save');this.entries=new Map(levels.map(c=>[c.wave,c]));this.latest=s.latest;this.deaths=s.deaths;this.revision++;return true;}
}
