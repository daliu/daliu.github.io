import {weaponAt} from './engine.mjs';
import {structureHitFraction} from './objective-geometry.mjs';
export const overdriveEnabled=g=>['hard','terminator'].includes(g.difficulty)&&g.overdrive!==false;
export const CHARGE_COST=20;
export function cancelCharge(g){g.chargeState=null;g.attackChargeBlocked=true;}
// Attack taps fire immediately. A sustained hold charges and automatically releases
// a heavy shot, then repeats; legacy C holds still release on key-up.
export function updateCharge(g,dt,input){
 const p=g.player,held=!!(input.attack||input.charge);
 if(!held)g.attackChargeBlocked=false;
 if(g.weaponAvailable&&!g.weaponAvailable(g.weapon)||!overdriveEnabled(g)||g.weapon===3||g.resources.electricLock>0&&g.weapon===2||g.nearEmergency?.()||p.paralyzed>0||p.drilling>0||p.spinTime>0||p.spinQueue>0){cancelCharge(g);return;}
 let c=g.chargeState;
 if(c&&c.weapon!==g.weapon){cancelCharge(g);return;}
 if(held){
  if(g.attackChargeBlocked)return;
  if(!c){
   if(g.gear.battery<CHARGE_COST)return;
   if(!input.attack&&p.attackCd>0)return;
   if(input.attack)g.attack();
   c=g.chargeState={weapon:g.weapon,time:0,active:true,automatic:!!input.attack};
  }
  c.time=Math.min(1,c.time+dt/.9);
  if(!c.automatic||c.time<1)return;
 }else if(!c)return;
 g.chargeState=null;
 if(c.time<1||c.weapon!==g.weapon||g.gear.battery<CHARGE_COST||p.attackCd>0)return;
 g.gear.battery-=CHARGE_COST;p.attackCd=.55;g.stats.attacks[g.weapon]++;
 const electric=g.weapon===2,w=weaponAt(g.weapon,g.weaponTiers[g.weapon]),range=electric?740:Math.max(180,w.range);
 g.effects.push({kind:'attack',source:'player',x:p.x,y:p.y-24,dir:p.facing,range,weapon:g.weapon,energy:electric,life:.35,max:.35,color:electric?'#c4f5ff':'#fff0ae'});
 const targets=g.robots.filter(r=>r.hp>0&&(r.structure?structureHitFraction(r,p.x,p.y-24,p.x+p.facing*range,p.y-24)!==null:Math.abs(r.y-p.y)<(electric?50:95)&&(r.x-p.x)*p.facing>-20&&(r.x-p.x)*p.facing<range));
 for(const r of targets)g.hit(r,g.weapon,electric?4:5);
 if(electric)g.stats.energyAttacks++;if(w.type==='electric')g.electrify(targets);
}

export function resourceRows(g){
 if(!overdriveEnabled(g))return [];
 const gear=g.gear,term=g.difficulty==='terminator',rows=[{id:'cells',label:g.weapon===2?'TASER':'CELLS',value:Math.floor(gear.battery),max:term?80:100,color:'#a2e5ee'},{id:'boost',label:'BOOST',value:Math.ceil(g.resources.fuel),max:g.profile.fuel,color:'#ffbb7e'}];
 if(g.mechTier>=2){const i=gear.selected;rows.push(i===0?{id:'tool',label:'GUN',value:gear.turretAmmo,max:term?45:g.difficulty==='hard'?65:90,color:'#e8d49b'}:i===1?{id:'tool',label:'LAVA',value:gear.lava,max:1,color:'#ff9c6a'}:{id:'tool',label:'DRILL',value:Math.ceil(gear.drillFuel),max:term?90:140,color:'#c5e6ee'});}
 return rows;
}
