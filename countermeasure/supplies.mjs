import {powerRefill} from './special-stock.mjs';
import {fullLateGear} from './late-tools.mjs';
import {overdriveEnabled} from './overdrive.mjs';

export function validSupplyLedger(value,wave=50){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>67)return false;
 return Object.entries(value).every(([key,n])=>{const m=key.match(/^(\d{1,2}):(room|boss|super|hidden|side)$/);if(!m||!Number.isInteger(n)||n<0||n>4)return false;const w=Number(m[1]),phase=m[2];return w>=1&&w<=wave&&w<=50&&(phase==='room'?w%10!==0:phase==='side'?[4,14,18,24,34,44].includes(w):phase==='hidden'?w===50:w%10===0);});
}
const LABELS={battery:'BATTERY',lava:'LAVA ×1',turret:'AMMO',ap:'AP ×2'};
function changes(g,type){
 const max=fullLateGear(g.difficulty),small=g.difficulty==='terminator';
 const rows=type==='battery'?[
  ...(overdriveEnabled(g)?[[g.gear,'battery',max.battery,small?16:24,'CELLS']]:[]),
  ...(g.mechTier>=3?[[g.gear,'drillFuel',max.drillFuel,small?14:22,'DRILL']]:[]),
  ...(g.ultra?[[g.resources,'fuel',g.profile.fuel,small?10:16,'FUEL']]:[])
 ]:type==='lava'&&g.mechTier>=2?[[g.gear,'lava',1,1,'LAVA']]
 :type==='turret'&&g.mechTier>=2?[[g.gear,'turretAmmo',max.turretAmmo,small?8:12,'AMMO']]
 :type==='ap'&&g.ultra?[[g.resources,'ammo',g.profile.ammo,2,'AP']]:[];
 const result=rows.map(([object,key,cap,amount,label])=>({object,key,amount:Math.max(0,Math.min(amount,cap-object[key])),label})).filter(row=>row.amount>0);
 const charge=type==='battery'?powerRefill(g):null;if(charge)result.push(charge);return result;
}
export function beginSupplyRoom(g){
 const key=g.wave+':'+g.encounter;
 // Retry cannot mint another room's supply allowance. Checkpoints store the
 // resulting equipment amounts; loose crates belong only to the current room.
 g.supplyLedger??={};if(g.supplyRoom?.key!==key)g.supplyRoom={key,dropped:g.supplyLedger[key]??0,kills:0,time:0,lastDrop:0,lastKill:0};
 g.supplyCrates=[];g.supplyNotice='';
}
export function supplyRobotDown(g,r){if(!r.structure&&r.faction!=='ally'&&g.supplyRoom)g.supplyRoom.kills++;}
export function collectSupply(g,crate){
 if(!['playing','traveling'].includes(g.state)||g.player.hp<=0||crate.collected||Math.hypot(g.player.x-crate.x,g.player.y-22-crate.y)>=46)return false;
 const rows=changes(g,crate.type);if(!rows.length)return false;
 for(const row of rows)row.object[row.key]+=row.amount;
 crate.collected=true;g.supplyRevision=(g.supplyRevision??0)+1;g.supplyNotice=rows.map(row=>'+'+Math.round(row.amount)+' '+row.label).join(' · ');
 g.event(g.supplyNotice,'#9ce5e3');return true;
}
export function updateSupplies(g,dt){
 if(!['playing','traveling'].includes(g.state)||g.player.hp<=0||!g.supplyRoom)return;
 const s=g.supplyRoom;s.time+=dt;
 for(const crate of g.supplyCrates){crate.life-=dt;if(Math.hypot(g.player.x-crate.x,g.player.y-22-crate.y)<46)collectSupply(g,crate);}
 g.supplyCrates=g.supplyCrates.filter(crate=>!crate.collected&&crate.life>0);
 const boss=g.encounter!=='room',limit=boss?(g.difficulty==='terminator'?3:4):2;
 if(g.state!=='playing'||s.dropped>=limit||g.supplyCrates.length||s.time-s.lastDrop<12)return;
 if(s.time-s.lastDrop<28&&s.kills-s.lastKill<3)return;
 const kinds=s.dropped%2?['lava','ap','turret','battery']:['battery','turret','ap','lava'];
 const type=kinds.find(kind=>changes(g,kind).length);if(!type)return;
 const x=Math.max(90,Math.min(910,g.player.x+(g.player.x<500?180:-180)));
 g.supplyCrates.push({type,x,y:403,life:40,collected:false});s.dropped++;g.supplyLedger[s.key]=s.dropped;g.supplyRevision=(g.supplyRevision??0)+1;s.lastDrop=s.time;s.lastKill=s.kills;
 g.supplyNotice=LABELS[type]+' ↓ WALK OVER TO COLLECT';g.event(g.supplyNotice,'#9ce5e3');
}
export function drawSupplies(ctx,g,t){
 for(const c of g.supplyCrates??[]){
  const battery=c.type==='battery',color=battery?'#9ce5e3':'#f1cb85',y=c.y+Math.sin(t*3)*3;
  ctx.save();ctx.translate(c.x,y);ctx.fillStyle='#112b2bea';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.shadowColor=color;ctx.shadowBlur=8;
  ctx.fillRect(-16,-17,32,25);ctx.strokeRect(-16,-17,32,25);ctx.fillStyle=color;
  if(battery){ctx.fillRect(-7,-21,14,4);ctx.fillRect(-2,-12,4,15);ctx.fillRect(-7,-7,14,4);}
  else for(let i=0;i<3;i++)ctx.fillRect(-9+i*7,-12,4,14);
  ctx.shadowBlur=0;ctx.font='bold 10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(LABELS[c.type],0,-30);ctx.fillText('↓',0,-43);ctx.restore();
 }
}
