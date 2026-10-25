export const EXPEDITION_SAVE_KEY='countermeasure.campaign.v3';
export function campaignSaveFrom(storage){try{return storage.getItem(EXPEDITION_SAVE_KEY)??storage.getItem('countermeasure.campaign.v1');}catch{return null;}}
import {campaignCheckpoint} from './campaign-saves.mjs';
import {milestone} from './expedition-plan.mjs';
const integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b,finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
export function expeditionCheckpoint(data){try{
 const legacy=data?.version===2;if(!legacy&&data?.version!==3)return null;
 const encounter=legacy?(milestone(data.wave)?'boss':'room'):data.encounter;
 if(!['room','boss','super','hidden'].includes(encounter)||encounter==='room'&&milestone(data.wave)||['boss','super'].includes(encounter)&&!milestone(data.wave)||encounter==='hidden'&&data.wave!==50)return null;
 const ultimate=encounter==='hidden';
 if(!Array.isArray(data.tiers)||!data.tiers.every(t=>integer(t,0,ultimate?3:2))||!integer(data.module,0,ultimate?5:3))return null;
 const bp=data.mirrorBlueprint;
 if(!legacy&&bp&&(!integer(bp.mechTier,0,5)||bp.module>3||bp.mechTier>Math.floor(data.wave/10)))return null;
 // Reuse the published combat/build validator without changing the v2 contract.
 const normalized={...data,version:2,tiers:data.tiers.map(t=>Math.min(2,t)),module:Math.min(3,data.module),mirrorBlueprint:bp?{...bp,mechTier:4}:null};
 const c=campaignCheckpoint(normalized);if(!c)return null;
 c.version=3;c.encounter=encounter;c.tiers=[...data.tiers];c.module=data.module;c.mirrorBlueprint=encounter==='boss'&&bp?{...c.mirrorBlueprint,mechTier:legacy?Math.min(4,Math.floor((data.wave-1)/10)):bp.mechTier,module:bp.module}:null;
 const j=legacy?{cleared:0,flawless:false,secretQualified:false}:data.journey;
 if(!j||!integer(j.cleared,0,ultimate?50:data.wave-1)||typeof j.flawless!=='boolean'||typeof j.secretQualified!=='boolean'||j.flawless&&data.runDeaths>0||j.secretQualified&&j.cleared!==50||ultimate&&!j.secretQualified)return null;
 c.journey={cleared:j.cleared,flawless:j.flawless,secretQualified:j.secretQualified};
 c.carry=null;if(!legacy&&data.carry){const v=data.carry;if(!finite(v.hp,1,100)||!finite(v.shield,0,ultimate?400:180))return null;c.carry={hp:v.hp,shield:v.shield};}
 c.resources={fuel:100,ammo:18,electricLock:0};if(!legacy&&data.resources){const r=data.resources;if(!finite(r.fuel,0,100)||!integer(r.ammo,0,18)||!finite(r.electricLock,0,5))return null;c.resources={fuel:r.fuel,ammo:r.ammo,electricLock:r.electricLock};}
 return c;
 }catch{return null;}}
export class ExpeditionStore{
 constructor(saved=null){this.entries=new Map();this.latest=1;this.deaths=0;this.revision=0;if(saved)try{this.import(saved);}catch{}}
 save(data){const c=expeditionCheckpoint(data);if(!c)return false;this.entries.set(c.wave,c);this.latest=c.wave;this.deaths=c.runDeaths;this.revision++;return true;}
 setDeaths(n){if(integer(n,0,1000000)&&n!==this.deaths){if(n>this.deaths)for(const c of this.entries.values())c.journey.flawless=false;this.deaths=n;this.revision++;}}
 beginRun(checkpoint){const fresh=expeditionCheckpoint(checkpoint);if(!fresh||fresh.wave!==1||fresh.journey.cleared!==0)return false;for(const c of this.entries.values())c.journey.flawless=false;this.deaths=0;return this.save(fresh);}
 get(w){return this.entries.has(w)?structuredClone(this.entries.get(w)):null;}
 export(){return JSON.stringify({mode:'campaign',version:3,latest:this.latest,deaths:this.deaths,levels:[...this.entries.values()].sort((a,b)=>a.wave-b.wave)});}
 import(text){if(typeof text!=='string'||text.length>600000)throw Error('Invalid Campaign save');const s=JSON.parse(text);if(s?.mode!=='campaign'||![2,3].includes(s.version)||!Array.isArray(s.levels)||!integer(s.levels.length,1,50)||!integer(s.latest,1,50)||!integer(s.deaths,0,1000000))throw Error('Invalid Campaign save');const levels=s.levels.map(expeditionCheckpoint);if(levels.some(c=>!c)||new Set(levels.map(c=>c.wave)).size!==levels.length||!levels.some(c=>c.wave===s.latest))throw Error('Invalid Campaign checkpoint');this.entries=new Map(levels.map(c=>[c.wave,c]));this.latest=s.latest;this.deaths=s.deaths;this.revision++;return true;}
}
