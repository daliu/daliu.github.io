import {factoryRoom} from './factory-story.mjs';
import {SURVIVOR_ROOM,SURVIVOR_ARMOR,survivorHair,drawSurvivor} from './survivor.mjs';
export const LOCKS={circuit:{label:'CIRCUIT / ϟ OR ≈',symbol:'ϟ',color:'#9ce5e3',weapons:[2,3]},padlock:{label:'PADLOCK / IMPACT OR CUT',symbol:'⚒',color:'#e6bb80',weapons:[0,1]},mesh:{label:'MESH / CUT',symbol:'╳',color:'#e1dfbc',weapons:[1]},brittle:{label:'BRITTLE / IMPACT',symbol:'◇',color:'#efb889',weapons:[0]}};
const names=['Neri','Sana','Oren','Imani','Pavel','Ada','Jun','Rafi'];
export const cellId=(room,slot=0)=>room+':'+slot;
export function cellState(g,room,slot=0){const id=cellId(room,slot);return g.rescuedCells?.includes(id)||!g.rescuedCells&&slot===0&&g.rescuedRooms?.includes(room)?'released':g.lostCells?.includes(id)?'lost':'occupied';}
export function rescueScenes(room,difficulty){
 if(room===SURVIVOR_ROOM)return [{room,slot:0,cellId:cellId(room),x:500,y:420,name:'Iris',cell:806,survivor:'iris',lock:'circuit'}];
 const s=factoryRoom(room,difficulty);if(!Number.isInteger(room)||room<11||room>43||!s.people||!['cells','processing','data'].includes(s.kind))return [];
 const first=room===12?'Mara':room===14?'Elias':room===35?'Vale':names[room%5];
 return Array.from({length:s.people},(_,slot)=>{const bay=[0,2,4,5][slot];return {room,slot,cellId:cellId(room,slot),x:s.kind==='cells'?97+bay*159:s.kind==='processing'?360+slot*180:330+slot*150,y:420,name:slot===0?first:names[(room+slot)%names.length],cell:s.cellBase+(s.kind==='cells'?bay:slot),lock:['circuit','padlock','mesh','brittle'][slot]};});
}
export const rescueScene=(room,difficulty)=>rescueScenes(room,difficulty)[0]??null;
const doors=g=>g.rescueDoors??(g.rescueDoor?[g.rescueDoor]:[]);
export function rescueTarget(g,{near=false}={}){
 if(!['playing','traveling'].includes(g.state)||g.encounter!=='room'||g.player.hp<=0)return null;
 const p=g.player,range=near?100:g.activeWeapon.range*(p.mecha?1.15:1);
 return doors(g).filter(d=>!d.opened&&!d.exterminated&&cellState(g,d.room,d.slot)!=='lost'&&Math.abs(p.y-d.y)<85&&Math.abs(p.x-d.x)<range&&(near||(d.x-p.x)*p.facing>=-20)).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0]??null;
}
export const nearRescue=g=>!!rescueTarget(g,{near:true});
export function rescueWeapon(g,d=rescueTarget(g,{near:true})){if(!d)return null;return [g.weapon,...LOCKS[d.lock??'circuit'].weapons].find(i=>LOCKS[d.lock??'circuit'].weapons.includes(i)&&g.weaponAvailable(i))??null;}
export function beginRescues(g){
 g.rescueDoors=g.encounter==='room'?rescueScenes(g.room,g.difficulty):[];g.rescueDoor=g.rescueDoors[0]??null;
 const seconds=g.difficulty==='hard'?38:g.difficulty==='terminator'?24:0;
 for(const d of g.rescueDoors){const state=cellState(g,d.room,d.slot);d.opened=state==='released';d.exterminated=state==='lost';d.purgeTotal=d.survivor?0:seconds;d.purgeRemaining=d.purgeTotal;}
}
export function updateRescues(g,dt){
 if(!['playing','traveling'].includes(g.state))return;
 for(const d of doors(g)){if(d.opened||d.exterminated||!d.purgeTotal)continue;d.purgeRemaining=Math.max(0,d.purgeRemaining-dt);
  if(d.purgeRemaining===0){d.exterminated=true;g.lostCells.push(d.cellId);g.supplyRevision++;g.event('CELL '+d.cell+' / DISINFECTION COMPLETE','#d1bc8a');}
 }
}
export function releasePrisoner(g){
 const d=rescueTarget(g),p=g.player;if(!d||p.attackCd>0||!g.weaponAvailable(g.weapon)||g.rescuedCells?.includes(d.cellId))return false;
 if(!LOCKS[d.lock??'circuit'].weapons.includes(g.weapon)){if(g.clock>=(g.lockNoticeAt??0)){g.lockNoticeAt=g.clock+1;g.event(LOCKS[d.lock??'circuit'].label,LOCKS[d.lock??'circuit'].color);}return false;}
 if(g.weapon===2&&g.resources.electricLock>0)return false;
 const full=g.companions.filter(a=>a.hp>0).length>=3;if(full&&d.survivor){g.event('SQUAD FULL / MAKE ROOM FOR IRIS IN SKILLS','#9ce5e3');return false;}
 p.attackCd=g.activeWeapon.cooldown;d.opened=true;g.rescuedCells??=[];g.rescuedCells.push(d.cellId);if(!g.rescuedRooms.includes(d.room))g.rescuedRooms.push(d.room);
 if(g.weapon<2)g.effects.push({kind:'attack',source:'player',x:p.x,y:p.y-30,dir:p.facing,range:Math.max(40,Math.abs(d.x-p.x)),weapon:g.weapon,life:.2,max:.2,color:LOCKS[d.lock??'circuit'].color});else g.effects.push({kind:'arc',x:p.x,y:p.y-30,x2:d.x,y2:d.y-70,life:.25,max:.25,color:LOCKS[d.lock??'circuit'].color});g.supplyRevision++;
 if(full){d.escaped=true;g.event(d.name.toUpperCase()+' / ESCAPED THROUGH SERVICE VENT','#9ce5e3');return true;}
 const id='ally-'+(++g.squadSequence);g.companions=g.companions.filter(a=>a.hp>0);g.companions.push({id,type:'human',kind:'human',rescueRoom:d.room,rescueSlot:d.slot??0,name:d.name,role:'gunner',faction:'ally',x:d.x,y:420,hp:40,maxHp:160,rank:0,kills:0,boots:false,flying:false,generation:1,facing:p.facing,cooldown:.7,joinFlash:1.2,...(d.survivor?{survivor:'iris',hair:survivorHair(g.subject?.id),armor:SURVIVOR_ARMOR}:{})});g.recruited++;
 g.event(d.name.toUpperCase()+' / WITH YOU','#9ce5e3');return true;
}
export function drawRescueDoor(ctx,g,t){
 for(const d of doors(g)){
 const cleared=g.state==='traveling',open=d.opened,lost=d.exterminated,lock=LOCKS[d.lock??'circuit'];
 ctx.save();ctx.translate(d.x,d.y);ctx.strokeStyle=lost?'#8f8661':open?'#9ce5e3':lock.color;ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;ctx.strokeRect(-57,-260,114,212);
 if(!open&&!lost){ctx.save();ctx.translate(0,-60);if(d.survivor)drawSurvivor(ctx,{hair:survivorHair(g.subject?.id),armor:SURVIVOR_ARMOR,facing:1},t);else{ctx.fillStyle='#d8c3a4';ctx.fillRect(-7,-60,14,16);ctx.fillStyle='#748c8a';ctx.fillRect(-10,-43,20,26);ctx.fillRect(-8,-17,6,17);ctx.fillRect(2,-17,6,17);}ctx.restore();}
 if(!open){ctx.globalAlpha=cleared?.8:.45;for(let x=-43;x<55;x+=24){ctx.beginPath();ctx.moveTo(x,-248);ctx.lineTo(x,-58);ctx.stroke();}ctx.globalAlpha=1;ctx.fillStyle=lock.color;ctx.fillRect(37,-91,22,35);ctx.fillStyle='#182d36';ctx.font='21px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(lock.symbol,48,-66);}
 else{ctx.beginPath();ctx.moveTo(-57,-260);ctx.lineTo(-82,-246);ctx.lineTo(-82,-38);ctx.lineTo(-57,-48);ctx.stroke();}
 ctx.fillStyle=lost?'#c4c190':open?'#9ce5e3':lock.color;ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(lost?'CELL '+d.cell+' / SANITIZED':open?'RELEASED':d.survivor?'IRIS / SURVIVOR':'CELL '+d.cell,0,-222);
 ctx.fillText(lost?'NO ORGANIC MATERIAL':open?'':lock.label,0,-20);
 if(d.purgeTotal&&!open&&!lost){ctx.fillStyle='#de9f83';ctx.fillText('PURGE '+Math.ceil(d.purgeRemaining)+'s',0,-203);ctx.fillRect(-45,-192,90*d.purgeRemaining/d.purgeTotal,4);}
 if(d.survivor&&cleared&&!open)ctx.fillText('ARMOR + EVASION',0,-3);
 if(lost){ctx.fillStyle='#9ec36555';ctx.fillRect(-54,-250,108,200);}
 ctx.restore();
 }
}
