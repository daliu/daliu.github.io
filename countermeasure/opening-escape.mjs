export const freshOpening=subject=>({story:true,lamp:false,decontaminated:false,cell:String(3491+Number(String(subject??'').replace(/\D/g,'').slice(-4)||0)%6000)});
export const legacyOpening=()=>({story:false,lamp:true,decontaminated:true,cell:'3491'});
export function validateOpening(v,wave){
 if(!v||typeof v.story!=='boolean'||typeof v.lamp!=='boolean'||typeof v.decontaminated!=='boolean'||!/^\d{4,5}$/.test(v.cell)||v.decontaminated&&!v.lamp||wave>=3&&!v.lamp||!v.story&&!v.lamp)return null;
 return {story:v.story,lamp:v.lamp,decontaminated:v.decontaminated,cell:v.cell};
}
export const lampLocked=g=>g.opening?.story===true&&!g.opening.lamp;
export function beginOpeningRoom(g){
 g.cellScene=null;if(!g.opening?.story)return;
 if(g.wave>=3){g.opening.lamp=true;g.opening.decontaminated=true;return;}
 if(g.wave===2&&g.encounter==='room')g.cellScene={picked:g.opening.lamp,ambushed:false};
}
export const openingBlocksExit=g=>g.wave===2&&g.opening?.story&&(!g.cellScene?.ambushed||lampLocked(g));
export function updateOpening(g){
 if(!['playing','traveling'].includes(g.state)||!g.opening?.story)return;
 const p=g.player;
 if(g.wave===2&&g.encounter==='room'){
  const s=g.cellScene;if(!s)return;
  if(!s.picked&&Math.hypot(p.x-430,p.y-420)<65){s.picked=true;g.opening.lamp=true;g.weapon=0;g.inventoryRevision++;g.event('DESK LAMP / RECOVERED','#f2b966');}
  if(s.picked&&!s.ambushed&&g.state==='playing'){
   s.ambushed=true;const r=g.spawn('sealed',g.spawnSequence++);r.x=Math.max(35,p.x-155);r.y=420;r.facing=1;r.cooldown=1.15;r.hp=r.maxHp=145*g.profile.count;r.cellAmbusher=true;g.robots.push(r);g.event('BEHIND YOU','#efad79');
   g.effects.push({kind:'number',x:r.x,y:310,text:'!',life:1.1,max:1.1,color:'#efad79'});
  }
  if(g.state==='traveling'&&p.x>650&&!g.opening.decontaminated){g.opening.decontaminated=true;g.event('CELL '+g.opening.cell+' EXTERMINATION IN PROGRESS / PLEASE STAND BY','#c4dc7e');}
 }
}
export function drawOpeningCell(ctx,g,room,t){
 if(room!==1||!g.opening?.story)return;
 const o=g.opening;ctx.save();ctx.fillStyle='#142a31';ctx.fillRect(280,170,290,240);ctx.strokeStyle='#81988e';ctx.lineWidth=3;ctx.strokeRect(280,170,290,240);
 ctx.fillStyle='#c0cfb5';ctx.font='14px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('CELL '+o.cell,425,192);
 ctx.fillStyle='#667b75';ctx.fillRect(355,352,150,9);ctx.fillRect(367,361,6,57);ctx.fillRect(487,361,6,57);ctx.fillRect(302,388,35,23);
 if(!o.lamp){ctx.strokeStyle='#f2b966';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(420,351);ctx.lineTo(420,320);ctx.lineTo(440,300);ctx.stroke();ctx.fillStyle='#efc584';ctx.beginPath();ctx.moveTo(434,291);ctx.lineTo(456,309);ctx.lineTo(425,316);ctx.fill();ctx.globalAlpha=.2+.15*Math.sin(t*3)**2;ctx.fillRect(389,315,83,33);ctx.globalAlpha=1;ctx.font='12px ui-monospace,monospace';ctx.fillText('LAMP ↓',430,276);}
 if(o.decontaminated){ctx.fillStyle='#97c66e66';ctx.fillRect(282,197,286,211);ctx.strokeStyle='#c5ec7b';ctx.lineWidth=3;for(let i=0;i<9;i++){const x=295+i*30,y=202+(t*95+i*29)%190;ctx.beginPath();ctx.moveTo(x,198);ctx.lineTo(x+Math.sin(t*9+i)*12,y);ctx.stroke();}ctx.fillStyle='#c8e7a0';ctx.font='12px ui-monospace,monospace';ctx.fillText('EXTERMINATION IN PROGRESS',425,240);}
 ctx.restore();
}
