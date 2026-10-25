// Browser-local, bounded level checkpoints. No accounts or network storage.
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const ranks={force:3,breaker:2,voltage:3,cascade:2,agility:3,plating:2};
const build=b=>b&&Array.isArray(b.tiers)&&b.tiers.length===4&&b.tiers.every(t=>Number.isInteger(t)&&t>=0&&t<=2)&&Number.isInteger(b.weapon)&&b.weapon>=0&&b.weapon<4&&b.skills&&Object.entries(ranks).every(([k,max])=>Number.isInteger(b.skills[k])&&b.skills[k]>=0&&b.skills[k]<=max)&&(!b.skills.breaker||b.skills.force)&&(!b.skills.cascade||b.skills.voltage)&&(!b.skills.plating||b.skills.agility);
function memory(m){if(!m||!Number.isInteger(m.waves)||!finite(m.waves,0,9)||!Array.isArray(m.weapon)||m.weapon.length!==4||!m.weapon.every(v=>finite(v,0,1))||Math.abs(m.weapon.reduce((a,b)=>a+b,0)-1)>.001||!Array.isArray(m.history)||m.history.length>9)return null;const out={waves:m.waves,weapon:[...m.weapon],history:[]};for(const k of ['energyShare','groundShockShare','stationaryRatio','duckRatio','farRatio']){if(!finite(m[k],0,1))return null;out[k]=m[k];}for(const k of ['groundShockHits','attackRate','jumpRate','dashRate']){if(!finite(m[k],0,1000000))return null;out[k]=m[k];}for(const h of m.history){if(!h||!finite(h.total,0,1000000))return null;out.history.push({total:h.total});}return out;}
export function checkpoint(data){try{
 if(!data||data.version!==1||!Number.isInteger(data.wave)||!finite(data.wave,1,11)||!build(data)||!finite(data.points,5,12)||!Number.isInteger(data.points)||Object.values(ranks).length!==Object.keys(data.skills).length)return null;
 const skills=Object.fromEntries(Object.keys(ranks).map(k=>[k,data.skills[k]]));if(Object.values(skills).reduce((a,b)=>a+b,0)>data.points||data.tiers.some(t=>t>(data.wave>=5?2:data.wave>=3?1:0)))return null;
 const learned=memory(data.memory);if(!learned||learned.waves!==Math.min(9,data.wave-1))return null;
 const out={version:1,wave:data.wave,points:data.points,skills,tiers:[...data.tiers],weapon:data.weapon,memory:learned,kills:finite(data.kills,0,1000000)?Math.floor(data.kills):0,runDeaths:finite(data.runDeaths,0,1000000)?Math.floor(data.runDeaths):0,mirrorBlueprint:null,finaleCheckpoint:null};
 if(data.mirrorBlueprint){const b=data.mirrorBlueprint,style=memory(b.style);if(!build(b)||!style)return null;out.mirrorBlueprint={skills:Object.fromEntries(Object.keys(ranks).map(k=>[k,b.skills[k]])),tiers:[...b.tiers],weapon:b.weapon,style,subject:{name:String(b.subject?.name??'COPIED BUILD').slice(0,80)}};}
 if(data.finaleCheckpoint){const c=data.finaleCheckpoint;if(!(finite(c.hp,0,100)&&c.hp>0)||typeof c.mecha!=='boolean'||!finite(c.mechaShield,0,60))return null;out.finaleCheckpoint={hp:c.hp,mecha:c.mecha,mechaShield:c.mechaShield};}
 return out;
 }catch{return null;}}
export class ProgressStore{
 constructor(saved=null){this.entries=new Map();this.latest=1;this.deaths=0;this.revision=0;if(saved)try{this.import(saved);}catch{}}
 save(data){const c=checkpoint(data);if(!c)return false;this.entries.set(c.wave,c);this.latest=c.wave;this.deaths=c.runDeaths;this.revision++;return true;}
 setDeaths(n){if(Number.isInteger(n)&&finite(n,0,1000000)&&n!==this.deaths){this.deaths=n;this.revision++;}}
 get(wave){const c=this.entries.get(wave);return c?structuredClone(c):null;}
 snapshot(){return {version:1,latest:this.latest,deaths:this.deaths,levels:[...this.entries.values()].sort((a,b)=>a.wave-b.wave)};}
 export(){return JSON.stringify(this.snapshot());}
 import(text){if(typeof text!=='string'||text.length>150000)throw Error('Invalid save');const s=JSON.parse(text);if(s?.version!==1||!Array.isArray(s.levels)||!s.levels.length||s.levels.length>11||!Number.isInteger(s.latest)||!Number.isInteger(s.deaths)||!finite(s.deaths,0,1000000))throw Error('Invalid save');const levels=s.levels.map(checkpoint);if(levels.some(c=>!c)||new Set(levels.map(c=>c.wave)).size!==levels.length||!levels.some(c=>c.wave===s.latest))throw Error('Invalid save');this.entries=new Map(levels.map(c=>[c.wave,c]));this.latest=s.latest;this.deaths=s.deaths;this.revision++;return true;}
}
