import {weaponAt} from './engine.mjs';
export const weaponCopies=(g,index)=>g.weaponStock?.[index]??1;
export const loanCount=(g,index)=>(g.companions??[]).filter(a=>a.hp>0&&a.loanedWeapon===index).length;
export function awardSpareWeapon(g,index){
 if(!Number.isInteger(index)||index<0||index>3||weaponCopies(g,index)>=3)return false;
 g.weaponStock??=[1,1,1,1];g.weaponStock[index]++;g.inventoryRevision=(g.inventoryRevision??0)+1;
 if(g.entryCheckpoint)g.entryCheckpoint.weaponStock=[...g.weaponStock];
 g.event(weaponAt(index,g.weaponTiers[index]).name.toUpperCase()+' / SPARE +1','#9ce5e3');return true;
}
export function beginWeaponLootRoom(g){const key=g.wave+':'+g.encounter;if(g.weaponLootRoom?.key!==key)g.weaponLootRoom={key,dropped:0};g.weaponLoot=[];}
function family(r){if(['douser','chemDrone','chemicalDrone'].includes(r.type))return 3;if(['shocker','gunner','flyer','plasticDrone','artillery','orchestrator'].includes(r.type))return 2;if(['plated','lancer','interceptor','feinter'].includes(r.type))return 1;return 0;}
export function weaponLootDown(g,r){
 if(!g.weaponLootRoom||g.wave<4||r.structure||r.sideBoss||r.super||r.humanPilot||r.type==='mirror'||r.faction==='ally'||g.weaponLootRoom.dropped>=2||g.weaponLoot.length)return false;
 const index=family(r);if(weaponCopies(g,index)>=3||g.random()>=.25)return false;
 g.weaponLootRoom.dropped++;g.weaponLoot.push({index,x:Math.max(45,Math.min(955,r.x)),y:402,life:60});return true;
}
export function updateWeaponLoot(g,dt){if(!['playing','traveling'].includes(g.state)||g.player.hp<=0)return;for(const item of g.weaponLoot??[]){item.life-=dt;if(Math.hypot(g.player.x-item.x,g.player.y-22-item.y)<46&&awardSpareWeapon(g,item.index))item.life=0;}g.weaponLoot=(g.weaponLoot??[]).filter(item=>item.life>0);}
export function drawWeaponLoot(ctx,g,t){for(const item of g.weaponLoot??[]){const w=weaponAt(item.index,g.weaponTiers[item.index]);ctx.save();ctx.translate(item.x,item.y+Math.sin(t*4)*3);ctx.strokeStyle=w.color;ctx.fillStyle='#0c2529';ctx.lineWidth=3;ctx.shadowColor=w.color;ctx.shadowBlur=9;ctx.fillRect(-20,-14,40,24);ctx.strokeRect(-20,-14,40,24);ctx.beginPath();ctx.moveTo(-12,3);ctx.lineTo(10,-8);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#c7ece8';ctx.font='bold 10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(w.name.toUpperCase(),0,-27);ctx.fillText('SPARE ↓',0,-40);ctx.restore();}}
