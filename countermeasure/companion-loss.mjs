import {isSurvivor} from './survivor.mjs';
import {squadSnapshot} from './companion-saves.mjs';
import {ensurePlayerWeapon} from './weapon-lending.mjs';
// Keep explicit story identities, never a caller-supplied "essential" flag.
export function loseOrdinaryCompanions(g){
 const ordinary=g.companions.filter(a=>!isSurvivor(a)&&a.hp>0).length;
 g.companions=g.companions.filter(isSurvivor).map(a=>({...a,hp:Math.max(1,a.hp),hurtCd:0}));
 ensurePlayerWeapon(g);g.hackAttempt=null;g.entrySquad=squadSnapshot(g);g.companionDeathHandled=true;
 if(ordinary)g.event('SQUAD LOST / '+ordinary+' SIGNALS CLOSED','#b8bda4');
 return g.entrySquad;
}
