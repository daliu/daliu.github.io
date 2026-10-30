import {validateOpening,legacyOpening} from './opening-escape.mjs';
import {SIDE_ROOMS} from './side-rooms.mjs';
import {rescueScene,rescueScenes,cellId} from './prisoners.mjs';
import {roomIndex} from './expedition-plan.mjs';
import {emptySquad,validateSquad} from './companion-saves.mjs';
import {validateLateGear,fullLateGear} from './late-tools.mjs';
import {profileFor,fullResources,validDifficulty} from './difficulty.mjs';
export const EXPEDITION_SAVE_KEY='countermeasure.campaign.v10';
export function campaignSaveFrom(storage){try{return storage.getItem(EXPEDITION_SAVE_KEY)??storage.getItem('countermeasure.campaign.v9')??storage.getItem('countermeasure.campaign.v8')??storage.getItem('countermeasure.campaign.v7')??storage.getItem('countermeasure.campaign.v6')??storage.getItem('countermeasure.campaign.v5')??storage.getItem('countermeasure.campaign.v4')??storage.getItem('countermeasure.campaign.v3')??storage.getItem('countermeasure.campaign.v1');}catch{return null;}}
import {campaignCheckpoint,campaignSkillPoints,legacySkillPoints} from './campaign-saves.mjs';
import {milestone} from './expedition-plan.mjs';
const integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b,finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
export function expeditionCheckpoint(data){try{
 const legacy=data?.version===2;if(!legacy&&![3,4,5,6].includes(data?.version))return null;
 const encounter=legacy?(milestone(data.wave)?'boss':'room'):data.encounter;
 if(!['room','boss','super','hidden','side'].includes(encounter)||encounter==='room'&&milestone(data.wave)||['boss','super'].includes(encounter)&&!milestone(data.wave)||encounter==='hidden'&&data.wave!==50||encounter==='side'&&!SIDE_ROOMS[data.wave])return null;
 const difficulty=data.difficulty??'normal';if(!validDifficulty(difficulty))return null;const profile=profileFor(difficulty),earlyUltra=difficulty==='terminator'&&data.wave>=10&&(data.wave>10||encounter!=='boss'||data.mechTier===5),ultimate=encounter==='hidden',ultra=ultimate||earlyUltra;
 const tierLimit=ultra?3:data.wave>=16?2:data.wave>=6?1:0,regularMech=Math.floor(data.wave/10);if(earlyUltra?data.mechTier!==5:!integer(data.mechTier,Math.floor((data.wave-1)/10),regularMech))return null;
 if(!Array.isArray(data.tiers)||!data.tiers.every(t=>integer(t,0,tierLimit))||!integer(data.module,0,ultra?5:3))return null;
 if(!ultra&&data.module>=Math.max(1,data.mechTier))return null;
 const bp=data.mirrorBlueprint;
 if(!legacy&&bp&&(!integer(bp.mechTier,0,5)||!integer(bp.module,0,earlyUltra?5:3)||bp.mechTier>(earlyUltra?5:regularMech)||!Array.isArray(bp.tiers)||!bp.tiers.every(t=>integer(t,0,tierLimit))))return null;
 // Reuse the published combat/build validator without changing the v2 contract.
 const normalTier=data.wave>=16?2:data.wave>=6?1:0,normalized={...data,version:2,mechTier:earlyUltra?regularMech:data.mechTier,tiers:data.tiers.map(t=>Math.min(normalTier,t)),module:Math.min(3,Math.max(0,(earlyUltra?regularMech:data.mechTier)-1),data.module),mirrorBlueprint:bp?{...bp,tiers:bp.tiers.map(t=>Math.min(2,t)),module:Math.min(3,bp.module),mechTier:4}:null};
 const floor=data.version>=6?data.skillFloor:data.points;if(!integer(floor,0,16))return null;
 const c=campaignCheckpoint(normalized,{pointLimit:data.version>=6?Math.max(floor,campaignSkillPoints(data.wave)):legacySkillPoints(data.wave),pointMinimum:data.version>=6?1:5});if(!c)return null;
 c.version=6;c.skillFloor=floor;c.opening=data.version>=6?validateOpening(data.opening,data.wave):legacyOpening();if(!c.opening||!c.opening.lamp&&data.weapon===0)return null;c.difficulty=difficulty;c.mechTier=data.mechTier;c.encounter=encounter;c.tiers=[...data.tiers];c.module=data.module;c.mirrorBlueprint=encounter==='boss'&&bp?{...c.mirrorBlueprint,mechTier:legacy?Math.min(4,Math.floor((data.wave-1)/10)):bp.mechTier,module:bp.module,tiers:[...bp.tiers]}:null;
 const j=legacy?{cleared:0,flawless:false,secretQualified:false}:data.journey;
 if(!j||!integer(j.cleared,0,ultimate?50:encounter==='side'?data.wave:data.wave-1)||typeof j.flawless!=='boolean'||typeof j.secretQualified!=='boolean'||j.flawless&&data.runDeaths>0||j.secretQualified&&j.cleared!==50||ultimate&&!j.secretQualified)return null;
 c.journey={cleared:j.cleared,flawless:j.flawless,secretQualified:j.secretQualified};
 c.carry=null;if(!legacy&&data.carry){const v=data.carry;if(!(v.hp>0)||!finite(v.hp,0,profile.health)||!finite(v.shield,0,Math.round((ultra?400:40+data.mechTier*28)*profile.armor)))return null;c.carry={hp:v.hp,shield:v.shield};}
 c.cooldowns=[0,0,0,0,0,0];if(data.cooldowns!==undefined){if(!Array.isArray(data.cooldowns)||data.cooldowns.length!==6||!data.cooldowns.every(n=>finite(n,0,30)))return null;c.cooldowns=[...data.cooldowns];}
 c.resources=fullResources(difficulty);if(!legacy&&data.resources){const r=data.resources;if(!finite(r.fuel,0,profile.fuel)||!integer(r.ammo,0,profile.ammo)||!finite(r.electricLock,0,5))return null;c.resources={fuel:r.fuel,ammo:r.ammo,electricLock:r.electricLock};}
 c.hacking=data.version>=4?data.hacking:false;c.squad=data.version>=4?validateSquad(data.squad):emptySquad();if(typeof c.hacking!=='boolean'||!c.squad||c.hacking&&(data.wave<11||!c.skills.voltage)||Object.values(c.skills).reduce((a,b)=>a+b,0)+Number(c.hacking)>c.points||data.wave<11&&c.squad.allies.length||encounter==='hidden'&&c.squad.allies.length)return null;
 c.weaponStock=data.weaponStock??[1,1,1,1];if(!Array.isArray(c.weaponStock)||c.weaponStock.length!==4||!c.weaponStock.every(n=>integer(n,1,3)))return null;c.weaponStock=[...c.weaponStock];for(let i=0;i<4;i++){const loans=c.squad.allies.filter(a=>a.loanedWeapon===i).length;if(loans>c.weaponStock[i]||c.weapon===i&&loans===c.weaponStock[i])return null;}
 c.rescuedRooms=data.version>=5?data.rescuedRooms:[];
 if(!Array.isArray(c.rescuedRooms)||c.rescuedRooms.length>20||new Set(c.rescuedRooms).size!==c.rescuedRooms.length||c.rescuedRooms.some(room=>!integer(room,11,43)||room>roomIndex(c.wave,c.encounter)||!rescueScene(room,'easy')))return null;
 c.pilotOutcome=data.pilotOutcome??null;if(c.pilotOutcome!==null&&(!['spared','defeated'].includes(c.pilotOutcome)||encounter!=='hidden'))return null;
 c.rescuedRooms=[...c.rescuedRooms];c.rescuedCells=data.version>=6?data.rescuedCells:c.rescuedRooms.map(room=>cellId(room));c.lostCells=data.version>=6?data.lostCells:[];
 const validCells=v=>Array.isArray(v)&&v.length<=80&&new Set(v).size===v.length&&v.every(id=>{const m=typeof id==='string'&&id.match(/^(\d{1,2}):([0-3])$/);if(!m)return false;const room=Number(m[1]),slot=Number(m[2]);return room<=roomIndex(c.wave,c.encounter)&&!!rescueScenes(room,'easy')[slot]&&id===cellId(room,slot);});
 if(!validCells(c.rescuedCells)||!validCells(c.lostCells)||c.lostCells.some(id=>c.rescuedCells.includes(id))||c.rescuedRooms.some(room=>!c.rescuedCells.some(id=>id.startsWith(room+':')))||c.rescuedCells.some(id=>!c.rescuedRooms.includes(Number(id.split(':')[0]))))return null;
 c.rescuedCells=[...c.rescuedCells];c.lostCells=[...c.lostCells];const humanCells=c.squad.allies.filter(a=>a.kind==='human').map(a=>cellId(a.rescueRoom,a.rescueSlot??0));
 if(data.version<5&&humanCells.length||new Set(humanCells).size!==humanCells.length||humanCells.some(id=>!c.rescuedCells.includes(id)))return null;
 // Backfill earned points only after the original build and resources validate.
 c.sideCleared=data.sideCleared??[];if(!Array.isArray(c.sideCleared)||c.sideCleared.length>Object.keys(SIDE_ROOMS).length||new Set(c.sideCleared).size!==c.sideCleared.length||c.sideCleared.some(w=>!Number.isInteger(w)||!SIDE_ROOMS[w]||w>data.wave||encounter==='side'&&w===data.wave))return null;c.sideCleared=[...c.sideCleared];c.fieldCalibration=data.fieldCalibration??0;if(!integer(c.fieldCalibration,0,Math.min(3,c.sideCleared.length)))return null;
 c.points=Math.max(c.skillFloor,campaignSkillPoints(c.wave));
 c.gear=validateLateGear(data.gear,difficulty);if(!c.gear)return null;
 return c;
 }catch{return null;}}
export class ExpeditionStore{
 constructor(saved=null){this.finale=null;this.entries=new Map();this.latest=1;this.deaths=0;this.revision=0;if(saved)try{this.import(saved);}catch{}}
 save(data){const c=expeditionCheckpoint(data);if(!c)return false;this.entries.set(c.wave,c);if(c.encounter==='hidden')this.unlockFinale(c);this.latest=c.wave;this.deaths=c.runDeaths;this.revision++;return true;}
 setDeaths(n){if(integer(n,0,1000000)&&n!==this.deaths){if(n>this.deaths)for(const c of this.entries.values())c.journey.flawless=false;this.deaths=n;this.revision++;}}
 beginRun(checkpoint){const fresh=expeditionCheckpoint(checkpoint);if(!fresh||fresh.wave!==1||fresh.journey.cleared!==0)return false;for(const c of this.entries.values())c.journey.flawless=false;this.deaths=0;return this.save(fresh);}
 unlockFinale(data){const c=expeditionCheckpoint(data);if(!c||c.encounter!=='hidden')return false;if(!this.finale){this.finale=c;if(!this.entries.size){this.entries.set(50,structuredClone(c));this.latest=50;this.deaths=c.runDeaths;}this.revision++;}return true;}
 finaleFor(difficulty=this.finale?.difficulty){if(!this.finale||!validDifficulty(difficulty))return null;const c=structuredClone(this.finale),p=profileFor(difficulty);c.difficulty=difficulty;c.carry={hp:p.health,shield:Math.round(400*p.armor)};c.resources=fullResources(difficulty);c.gear=fullLateGear(difficulty);c.cooldowns=[0,0,0,0,0,0];c.squad=emptySquad();c.runDeaths=0;c.mechTier=5;c.tiers=[3,3,3,3];return c;}
 get(w){return this.entries.has(w)?structuredClone(this.entries.get(w)):null;}
 export(){return JSON.stringify({mode:'campaign',version:6,latest:this.latest,deaths:this.deaths,finale:this.finale,levels:[...this.entries.values()].sort((a,b)=>a.wave-b.wave)});}
 import(text){if(typeof text!=='string'||text.length>600000)throw Error('Invalid Campaign save');const s=JSON.parse(text);if(s?.mode!=='campaign'||![2,3,4,5,6].includes(s.version)||!Array.isArray(s.levels)||!integer(s.levels.length,1,50)||!integer(s.latest,1,50)||!integer(s.deaths,0,1000000))throw Error('Invalid Campaign save');const levels=s.levels.map(expeditionCheckpoint);if(levels.some(c=>!c)||new Set(levels.map(c=>c.wave)).size!==levels.length||!levels.some(c=>c.wave===s.latest))throw Error('Invalid Campaign checkpoint');const finale=s.finale?expeditionCheckpoint(s.finale):levels.find(c=>c.encounter==='hidden');if(s.finale&&(!finale||finale.encounter!=='hidden'))throw Error('Invalid finale unlock');this.entries=new Map(levels.map(c=>[c.wave,c]));this.latest=s.latest;this.deaths=s.deaths;if(finale)this.unlockFinale(finale);this.revision++;return true;}
}

// Restarting at another difficulty preserves damage and spent resources; changing options cannot heal the pilot.
export function retuneCheckpoint(data,difficulty,{mirror=false}={}){
 const source=expeditionCheckpoint(data);if(!source||!validDifficulty(difficulty))return null;const c=structuredClone(source),p=profileFor(difficulty);
 if(mirror&&milestone(c.wave)){c.encounter='boss';c.journey={cleared:Math.min(c.wave-1,c.journey.cleared),flawless:false,secretQualified:false};}
 c.difficulty=difficulty;const ultra=c.encounter==='hidden'||difficulty==='terminator'&&c.wave>=10&&(c.wave>10||c.encounter!=='boss'||c.mechTier===5);
 c.mechTier=ultra?5:Math.min(c.mechTier,Math.floor(c.wave/10));const tier=ultra?3:c.wave>=16?2:c.wave>=6?1:0;c.tiers=c.tiers.map(t=>Math.min(t,tier));c.module=Math.min(c.module,ultra?5:Math.min(3,Math.max(0,c.mechTier-1)));c.mirrorBlueprint=null;
 if(c.carry)c.carry={hp:Math.min(c.carry.hp,p.health),shield:Math.min(c.carry.shield,Math.round((ultra?400:c.mechTier?40+c.mechTier*28:0)*p.armor))};
 const gearMax=fullLateGear(difficulty);for(const key of ['turretAmmo','lava','drillFuel','battery'])c.gear[key]=Math.min(c.gear[key],gearMax[key]);
 c.resources.fuel=Math.min(c.resources.fuel,p.fuel);c.resources.ammo=Math.min(c.resources.ammo,p.ammo);return expeditionCheckpoint(c);
}
