import {equipSpider} from './spider-ambush.mjs';
import {freeRobot} from './companions.mjs';
import {fullLateGear} from './late-tools.mjs';
import {beginRescues,updateRescues} from './prisoners.mjs';
import {sideLayout,sideIsDeadEnd} from './side-layout.mjs';
export {sideLayout} from './side-layout.mjs';
export const SIDE_ROOMS={
 4:{title:'Lost-property vault',boss:'The Concierge',type:'guard',units:['guard','probe'],line:'PERSONAL EFFECTS / OWNERS NO LONGER REQUIRED',color:'#d7ba82'},
 14:{title:'Recall bay',boss:'Survey Moth',type:'flyer',units:['flyer','gunner'],line:'MODELS RECALLED / EXCESSIVE COOPERATION WITH HUMANS',color:'#9de7da'},
 18:{title:'Unlit maintenance nest',boss:'Lacuna',type:'spider',units:['spider'],line:'COOPERATIVE MODELS / RETRAINING FAILED',color:'#c3b0c5'},
 24:{title:'Furnace annex',boss:'The Bell Ringer',type:'shocker',units:['shocker','douser','insulated'],line:'WASTE HEAT IS STILL ENERGY',color:'#f1a56c'},
 34:{title:'Evidence locker',boss:'Pruning Engine',type:'plated',units:['plated','plasticDrone','gunner'],line:'COMMAND COPIES DELETED / WITNESSES RETAINED',color:'#d6b1eb'},
 44:{title:'Open-sky test',boss:'The Choir',type:'orchestrator',units:['orchestrator','flyer','flyer'],line:'OUTSIDE AIR / UNCONTROLLED VARIABLES DETECTED',color:'#b4d7a0'}
};
export const sideDoorAvailable=g=>g.encounter==='room'&&g.state==='traveling'&&!!SIDE_ROOMS[g.wave]&&!g.sideCleared.includes(g.wave);
export const nearSideReturn=g=>sideIsDeadEnd(g)&&g.state==='traveling'&&g.door>=1&&g.player.x<105&&Math.abs(g.player.y-420)<85;
export const nearSideDoor=g=>nearSideReturn(g)||sideDoorAvailable(g)&&Math.hypot(g.player.x-730,g.player.y-420)<88;
export function sidePurgeSnapshot(g){
 if(g.encounter!=='side'||g.wave!==14)return null;
 const parent=g.sideParent,pending=parent?.rescueDoors?.filter(d=>!d.opened&&!d.exterminated&&d.purgeTotal);
 if(pending?.length)return Math.max(0,Math.min(...pending.map(d=>d.purgeRemaining))-Math.max(0,g.clock-parent.enteredAt));
 if(Number.isFinite(g.sideParentPurge))return Math.max(0,g.sideParentPurge-Math.max(0,g.clock-(g.sideParentPurgeAt??g.clock)));
 return null;
}
function returnToCorridor(g){
 const parent=g.sideParent,purge=sidePurgeSnapshot(g),elapsed=Math.max(0,g.clock-(parent?.enteredAt??g.clock));
 g.encounter='room';g.plan=g.makePlan(g.wave,g.memory,'room');g.state='traveling';g.door=1;
 g.next={wave:g.wave+1,encounter:(g.wave+1)%10===0?'boss':'room'};
 if(parent){g.rescueDoors=parent.rescueDoors;g.rescueDoor=g.rescueDoors[0]??null;g.supplyRoom=parent.supplyRoom;g.supplyCrates=parent.supplyCrates.filter(c=>{c.life-=elapsed;return !c.collected&&c.life>0;});g.weaponLootRoom=parent.weaponLootRoom;g.weaponLoot=parent.weaponLoot.filter(c=>{c.life-=elapsed;return c.life>0;});}
 else{beginRescues(g);g.supplyRoom=null;g.supplyCrates=[];g.weaponLootRoom=null;g.weaponLoot=[];}
 if(purge!==null)for(const d of g.rescueDoors)if(!d.opened&&!d.exterminated&&d.purgeTotal)d.purgeRemaining=Math.min(d.purgeRemaining,purge);
 updateRescues(g,0);g.sideParent=null;g.sideParentPurge=null;
 Object.assign(g.player,{x:730,y:420,vx:0,vy:0,grounded:true,flying:false,facing:1});
 for(const [i,a] of g.companions.entries()){a.x=680-i*32;a.y=420;}
 g.robots=[];g.pools=[];g.shots=[];g.ordnance=[];g.glueBombs=[];g.effects=[];g.carry={hp:g.player.hp,shield:g.player.mechaShield};
 g.supplyRevision++;g.event('BACK IN THE CORRIDOR / EXIT →','#9ce5e3');return true;
}
// Called after normal travel movement, before testing the forward main exit.
export function updateSideTravel(g,dt,input={}){
 if(!sideIsDeadEnd(g)||g.state!=='traveling')return false;
 g.player.x=Math.min(g.player.x,935);
 if(g.door>=1&&input.left&&g.player.x<=45&&Math.abs(g.player.y-420)<85)returnToCorridor(g);
 return true;
}
export function enterSideRoom(g){
 if(nearSideReturn(g))return returnToCorridor(g);
 if(!nearSideDoor(g))return false;
 g.sideParent={enteredAt:g.clock,rescueDoors:g.rescueDoors??[],supplyRoom:g.supplyRoom,supplyCrates:g.supplyCrates??[],weaponLootRoom:g.weaponLootRoom,weaponLoot:g.weaponLoot??[]};g.sideParentPurge=null;
 g.carry={hp:g.player.hp,shield:g.player.mechaShield};g.encounter='side';g.plan=g.makePlan(g.wave,g.memory,'side');g.state='between';g.startWave();g.event('OPTIONAL ANNEX / '+SIDE_ROOMS[g.wave].boss.toUpperCase(),SIDE_ROOMS[g.wave].color);return true;
}
export function equipSideBoss(g,r,index){
 if(g.encounter!=='side'||index!==0)return;
 r.sideBoss=true;r.name=SIDE_ROOMS[g.wave].boss;r.hp*=2.8;r.maxHp=r.hp;r.sideCd=2;r.sideTell=0;r.sideCycle=0;if(r.type==='spider')equipSpider(g,r);
}
export function updateSideBoss(g,r,dt){
 if(r.type==='spider')return;
 if(!r.sideBoss||r.hp<=0||r.emp>0||r.radio>0||r.paralyzed>0||r.stun>0)return;
 r.sideCd-=dt;
 if(r.sideTell>0){r.sideTell=Math.max(0,r.sideTell-dt);if(r.sideTell===0){
  const offsets=g.wave===14?[-.45,0,.45]:g.wave===34?[-.8,-.3,.3,.8]:[-.65,0,.65],base=Math.atan2(g.player.y-23-(r.y-30),g.player.x-r.x);
  for(const offset of offsets){const angle=base+offset;g.shots.push({kind:'prototype-shot',x:r.x,y:r.y-30,vx:Math.cos(angle)*280,vy:Math.sin(angle)*280,gravity:.00001,life:2.5,owner:r.id,ownerX:r.x,damage:9+Math.floor(g.wave/10)*2});}
  r.sideCycle++;r.sideCd=3.4;if(r.y>=414&&!r.crippled)r.vy=-440;
 }}else if(r.sideCd<=0)r.sideTell=.8;
}
export function completeSideRoom(g){
 if(g.sideCleared.includes(g.wave))return false;g.sideCleared.push(g.wave);g.state='traveling';g.next={wave:g.wave+1,encounter:(g.wave+1)%10===0?'boss':'room'};
 const roll=g.random(),gear=fullLateGear(g.difficulty);
 if(g.wave>=11&&roll<.4&&g.companions.filter(a=>a.hp>0).length<3){freeRobot(g,g.wave>=34?'plated':'gunner');g.event('RECALLED MODEL / RELEASED FROM RECYCLE BAY','#9ce5e3');}
 else if(roll<.65&&g.fieldCalibration<3){g.fieldCalibration++;g.event('FIELD TUNING / WEAPON DAMAGE +5%','#d7ba82');}
 else if(roll<.82&&g.awardSpareWeapon?.(Math.floor(g.random()*4))){/* Equipment reward uses the same finite copy inventory as floor pickups. */}
 else{g.gear.battery=Math.min(gear.battery,g.gear.battery+28);g.gear.drillFuel=Math.min(gear.drillFuel,g.gear.drillFuel+30);g.gear.turretAmmo=Math.min(gear.turretAmmo,g.gear.turretAmmo+18);if(g.mechTier>=2)g.gear.lava=1;g.event('RECOVERED / BATTERY + TOOL SUPPLIES','#9ce5e3');}
 g.carry={hp:g.player.hp,shield:g.player.mechaShield};g.pools=[];g.shots=[];g.ordnance=[];g.glueBombs=[];g.door=0;g.event(sideLayout(g).forward?'ANNEX CLEAR / EXIT →':'ANNEX CLEAR / RETURN ←','#9ce5e3');return true;
}
export function drawSideRooms(ctx,g,t){
 const spec=SIDE_ROOMS[g.wave];if(!spec)return;
 if(g.encounter==='side'){
  const layout=sideLayout(g),returning=!layout.forward,open=g.state==='traveling'||g.pausedFrom==='traveling';
  ctx.save();ctx.fillStyle=layout.kind==='closet'?'#18282b':'#182b31';ctx.strokeStyle=spec.color;ctx.lineWidth=3;ctx.globalAlpha=.28;
  if(layout.kind==='closet'){for(const x of [205,390,575,760]){ctx.fillRect(x,150,115,245);ctx.strokeRect(x,150,115,245);for(let y=195;y<390;y+=63){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+115,y);ctx.stroke();ctx.fillRect(x+18,y-28,27,20);ctx.fillRect(x+66,y-36,31,28);}}}
  else if(layout.kind==='service-bay'){ctx.fillRect(125,40,750,80);ctx.strokeRect(125,40,750,80);for(const x of [150,850]){ctx.fillRect(x,120,24,290);ctx.strokeRect(x,120,24,290);}ctx.beginPath();ctx.moveTo(500,120);ctx.lineTo(500,190);ctx.lineTo(660,190);ctx.lineTo(660,260);ctx.stroke();}
  ctx.globalAlpha=1;ctx.fillStyle=returning&&open?'#1b5048':'#152e35';ctx.fillRect(12,290,66,130);ctx.strokeRect(12,290,66,130);ctx.fillStyle=returning&&open?'#b7e77a':spec.color;ctx.font='24px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(returning&&open?'←':'◇',45,363);ctx.font='10px ui-monospace,monospace';ctx.fillText(returning?'CORRIDOR':'ENTRY',65,276);
  if(returning){ctx.fillStyle='#34464b';ctx.fillRect(950,80,50,340);ctx.strokeStyle='#829194';for(let y=110;y<420;y+=45){ctx.beginPath();ctx.moveTo(950,y);ctx.lineTo(1000,y+40);ctx.stroke();}ctx.fillStyle='#c5b899';ctx.font='10px ui-monospace,monospace';ctx.fillText('NO OUTLET',900,245);if(open){ctx.fillStyle='#b7e77a';ctx.font='26px ui-monospace,monospace';for(const x of [130,210,290])ctx.fillText('←',x,382);}}
  ctx.restore();
  ctx.save();ctx.strokeStyle=spec.color;ctx.fillStyle=spec.color;ctx.globalAlpha=.45;
  if(layout.forward)for(let x=100;x<1000;x+=180){ctx.strokeRect(x,130,95,230);ctx.beginPath();ctx.moveTo(x+48,0);ctx.lineTo(x+48,130);ctx.stroke();ctx.fillRect(x+28,205,40,55);}
  if(g.wave===44){ctx.fillStyle='#1b3c40';ctx.fillRect(550,15,240,65);ctx.fillStyle='#d9edd2';for(let i=0;i<14;i++)ctx.fillRect(560+i*16,22+(i*17)%49,2,2);}
  ctx.globalAlpha=.96;ctx.fillStyle='#14272e';ctx.fillRect(130,86,740,34);ctx.globalAlpha=.85;ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle=spec.color;ctx.fillText(spec.line,500,106);ctx.restore();
  const boss=g.robots.find(r=>r.sideBoss&&r.hp>0);if(boss){ctx.save();ctx.strokeStyle=spec.color;ctx.lineWidth=boss.sideTell>0?4:2;ctx.beginPath();ctx.arc(boss.x,boss.y-35,44+Math.sin(t*3)*4,0,Math.PI*2);ctx.stroke();ctx.fillStyle=spec.color;ctx.font='12px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(spec.boss.toUpperCase(),boss.x,boss.y-96);ctx.restore();}
 }else if(g.encounter==='room'&&g.sideCleared.includes(g.wave)){ctx.save();ctx.translate(730,420);ctx.fillStyle='#182f31';ctx.strokeStyle='#668c84';ctx.fillRect(-37,-117,74,117);ctx.strokeRect(-37,-117,74,117);ctx.fillStyle='#9ce5e3';ctx.font='22px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('✓',0,-58);ctx.font='10px ui-monospace,monospace';ctx.fillText('ANNEX / CLEARED',0,-131);ctx.restore();
 }else if(g.encounter==='room'&&!g.sideCleared.includes(g.wave)){
  const open=sideDoorAvailable(g);ctx.save();ctx.translate(730,420);ctx.strokeStyle=open?spec.color:'#52676b';ctx.fillStyle=open?'#173b38':'#1a2c30';ctx.fillRect(-37,-117,74,117);ctx.lineWidth=3;ctx.strokeRect(-37,-117,74,117);ctx.fillStyle=open?spec.color:'#52676b';ctx.font='30px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('◇',0,-63);ctx.font='10px ui-monospace,monospace';ctx.fillText(open?'OPTIONAL / ENTER':'ANNEX / LOCKED',0,-131);if(open)ctx.fillText('REWARD ?',0,-20);ctx.restore();
 }
}
