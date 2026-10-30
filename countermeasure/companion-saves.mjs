import {rescueScene,rescueScenes} from './prisoners.mjs';
import {TYPES} from './engine.mjs';
import {isSurvivor,survivorFields} from './survivor.mjs';
const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
export const emptySquad=()=>({sequence:0,recruited:0,allies:[]});
export function squadSnapshot(g){return {sequence:g.squadSequence??0,recruited:g.recruited??0,allies:(g.companions??[]).filter(a=>a.hp>0).map(a=>({id:a.id,type:a.type,role:a.role,hp:a.hp,maxHp:a.maxHp,rank:a.rank,kills:a.kills,boots:a.boots,flying:a.flying,generation:a.generation,...(Number.isInteger(a.loanedWeapon)?{loanedWeapon:a.loanedWeapon}:{}),...(a.kind==='human'?{kind:'human',rescueRoom:a.rescueRoom,rescueSlot:a.rescueSlot??0,...(isSurvivor(a)?{survivor:'iris',hair:a.hair,armor:a.armor}:{})}:{})}))};}
export function validateSquad(value){
 if(!value||!integer(value.sequence,0,1000000000)||!integer(value.recruited,0,1000000000)||value.recruited>value.sequence||!Array.isArray(value.allies)||value.allies.length>3||value.allies.length>value.recruited)return null;
 const ids=new Set(),allies=[];
 for(const a of value.allies){
  if(a?.loanedWeapon!==undefined){if(!integer(a.loanedWeapon,0,3))return null;}
  if(a?.kind==='human'){const slot=a.rescueSlot??0;if(!integer(slot,0,3)||!rescueScenes(a.rescueRoom,'easy')[slot])return null;const special=survivorFields(a);if(!special)return null;const n=Number(a.id?.match(/^ally-([1-9][0-9]*)$/)?.[1]);if(a.type!=='human'||a.role!=='gunner'||!integer(n,1,value.sequence)||ids.has(a.id)||!integer(a.rescueRoom,11,43)||!rescueScene(a.rescueRoom,'easy')||a.maxHp!==160||!finite(a.hp,Number.MIN_VALUE,40)||!integer(a.rank,0,5)||!integer(a.kills,0,1000000000)||a.rank>a.kills||a.boots!==false||a.flying!==false||a.generation!==1)return null;ids.add(a.id);allies.push({id:a.id,type:'human',kind:'human',rescueRoom:a.rescueRoom,rescueSlot:slot,role:'gunner',...special,hp:a.hp,maxHp:160,rank:a.rank,kills:a.kills,boots:false,flying:false,generation:1,...(a.loanedWeapon!==undefined?{loanedWeapon:a.loanedWeapon}:{})});continue;}
  if(a?.survivor!==undefined||a?.hair!==undefined||a?.armor!==undefined)return null;if(a?.kind!==undefined&&a.kind!=='robot')return null;const n=Number(a?.id?.match(/^ally-([1-9][0-9]*)$/)?.[1]);if(!a||!TYPES[a.type]||['mirror','overseer','spider','antenna','buttonGuard','trialPilot'].includes(a.type)||!['fighter','gunner','douser'].includes(a.role)||!integer(n,1,value.sequence)||ids.has(a.id)||!finite(a.maxHp,1,TYPES[a.type].hp*(1+Math.min(50,a.generation*10)*.055)*1.15*(1+.07*(a.generation-1))+.001)||!finite(a.hp,Number.MIN_VALUE,a.maxHp*.25)||!integer(a.rank,0,5)||!integer(a.kills,0,1000000000)||a.rank>a.kills||typeof a.boots!=='boolean'||typeof a.flying!=='boolean'||!integer(a.generation,1,5))return null;
  ids.add(a.id);allies.push({id:a.id,type:a.type,role:a.role,hp:a.hp,maxHp:a.maxHp,rank:a.rank,kills:a.kills,boots:a.boots,flying:a.flying,generation:a.generation,...(a.loanedWeapon!==undefined?{loanedWeapon:a.loanedWeapon}:{})});
 }
 return {sequence:value.sequence,recruited:value.recruited,allies};
}
export function restoreSquad(g,squad){g.squadSequence=squad.sequence;g.recruited=squad.recruited;g.companions=squad.allies.map((a,i)=>({...a,faction:'ally',name:isSurvivor(a)?'Iris':a.kind==='human'?rescueScenes(a.rescueRoom,'easy')[a.rescueSlot??0].name:'UNIT '+String(a.id.slice(5)).padStart(3,'0'),x:45+i*35,y:a.flying?280:420,facing:1,cooldown:.7}));}
