import {weaponCopies,loanCount} from './weapon-loot.mjs';
import {weaponAt} from './engine.mjs';
import {lampLocked} from './opening-escape.mjs';
export const weaponHolder=(g,index)=>(g.companions??[]).find(a=>a.hp>0&&a.loanedWeapon===index)??null;
export const weaponAvailable=(g,index)=>Number.isInteger(index)&&index>=0&&index<4&&!(index===0&&lampLocked(g))&&loanCount(g,index)<weaponCopies(g,index);
export function ensurePlayerWeapon(g){if(!weaponAvailable(g,g.weapon))g.weapon=[0,1,2,3].find(i=>weaponAvailable(g,i));}
function recordLoan(g,a){
 for(const squad of [g.entrySquad,g.entryCheckpoint?.squad]){const entry=squad?.allies.find(e=>e.id===a.id);if(!entry)continue;delete entry.loanedWeapon;if(Number.isInteger(a.loanedWeapon)){entry.loanedWeapon=a.loanedWeapon;const others=squad.allies.filter(e=>e!==entry&&e.loanedWeapon===a.loanedWeapon);while(others.length>=weaponCopies(g,a.loanedWeapon))delete others.shift().loanedWeapon;}}
 if(g.entryCheckpoint)g.entryCheckpoint.weapon=g.weapon;
}
export function lendWeapon(g,id,index=null){
 if(!['paused','traveling'].includes(g.state))return false;
 const a=g.companions.find(a=>a.id===id&&a.hp>0);if(!a||index!==null&&(!Number.isInteger(index)||index<0||index>3))return false;
 if(index!==null&&a.loanedWeapon!==index&&!weaponAvailable(g,index))return false;
 if(index===null)delete a.loanedWeapon;else a.loanedWeapon=index;
 ensurePlayerWeapon(g);g.cancelCharge();g.player.spinQueue=0;g.player.spinTime=0;a.think=0;a.cooldown=Math.max(a.cooldown??0,.5);recordLoan(g,a);
 g.event(index===null?'WEAPON RETURNED':weaponAt(index,g.weaponTiers[index]).name.toUpperCase()+' / '+a.name,'#9ce5e3');return true;
}
export function borrowedLoadout(g,a){
 if(!Number.isInteger(a.loanedWeapon))return null;
 const w=weaponAt(a.loanedWeapon,g.weaponTiers[a.loanedWeapon]);return {weapon:a.loanedWeapon,w,role:a.loanedWeapon<2?'fighter':a.loanedWeapon===3?'douser':'gunner',range:w.range,cooldown:Math.max(.25,w.cooldown)};
}
