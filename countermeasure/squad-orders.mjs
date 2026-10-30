import {isSurvivor,drawSurvivor,SURVIVOR_ARMOR} from './survivor.mjs';
import {weaponAt} from './engine.mjs';
// Shared command surface: buttons, keys and optional speech all call issue().
export const SQUAD_COMMANDS=[
 {id:'follow',label:'Follow',key:'z',code:'KeyZ',icon:'↪',detail:'Regroup and fight near you.'},
 {id:'hold',label:'Hold',key:'x',code:'KeyX',icon:'⌖',detail:'Stay here and defend.'},
 {id:'focus',label:'Focus',key:'u',code:'KeyU',icon:'◎',detail:'Concentrate on the marked hostile.'},
 {id:'cover',label:'Cover',key:'i',code:'KeyI',icon:'◇',detail:'Protect you from nearby threats.'},
 {id:'retreat',label:'Retreat',key:'o',code:'KeyO',icon:'↶',detail:'Fall back; stop firing.'}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const hostileTargets=g=>(g.robots??[]).filter(r=>r.hp>0&&!r.structure&&r.faction!=='ally');
export function focusTarget(g){const p=g.player;return hostileTargets(g).filter(r=>g.aimAssist||(r.x-p.x)*p.facing>=-25).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]??null;}
export class SquadOrders{
 constructor(){this.command='follow';this.targetId=null;this.serial=0;this.ack='';this.ackLeft=0;}
 issue(g,id){
  if(g.state!=='playing'||!SQUAD_COMMANDS.some(c=>c.id===id))return {ok:false,message:'Orders unavailable'};
  const allies=(g.companions??[]).filter(a=>a.hp>0);if(!allies.length)return {ok:false,message:'No active companions'};
  const target=id==='focus'?focusTarget(g):null;if(id==='focus'&&!target)return {ok:false,message:'No hostile in that direction'};
  this.command=id;this.targetId=target?.id??null;this.serial++;this.ack=SQUAD_COMMANDS.find(c=>c.id===id).label+(target?' · '+(target.name??target.type):'');this.ackLeft=2.5;
  for(const a of allies){a.anchor={x:a.x,y:a.y};a.think=0;}
  return {ok:true,message:this.ack};
 }
 update(g,dt,{attack=()=>{},speed=175,getLoadout=()=>null}={}){
  if(g.state!=='playing')return;dt=clamp(dt,0,.04);this.ackLeft=Math.max(0,this.ackLeft-dt);
  const allies=(g.companions??[]).filter(a=>a.hp>0),enemies=hostileTargets(g),p=g.player;
  if(this.command==='focus'&&!enemies.some(r=>r.id===this.targetId)){this.command='follow';this.targetId=null;this.ack='Target down · Follow';this.ackLeft=2.5;}
  allies.forEach((a,i)=>{const loadout=getLoadout(a),role=loadout?.role??a.role;
   a.cooldown=Math.max(0,(a.cooldown??0)-dt);a.duck=Math.max(0,(a.duck??0)-dt);a.dodgeCd=Math.max(0,(a.dodgeCd??0)-dt);a.crouching=a.duck>0;a.think=(a.think??0)-dt;
   if(a.think<=0){if(a.dodgeCd===0&&(g.shots??[]).some(s=>s.life>0&&(a.x-s.x)*(s.vx??0)>0&&Math.abs(a.x-s.x)<150&&Math.abs(a.y-26-s.y)<22)){a.duck=.3;a.dodgeCd=(isSurvivor(a)?.65:2)/(1+.05*(a.rank??0));a.crouching=true;}a.think=Math.max(.1,(isSurvivor(a)?.12:.25)/(1+.05*(a.rank??0)));
    const closest=to=>{const ranked=[...enemies].filter(r=>r.id!==g.hackAttempt?.target).sort((x,y)=>Math.hypot(x.x-to.x,x.y-to.y)-Math.hypot(y.x-to.x,y.y-to.y));if(!ranked.length)return null;const near=ranked.filter(r=>Math.hypot(r.x-to.x,r.y-to.y)<=Math.hypot(ranked[0].x-to.x,ranked[0].y-to.y)+140);return near[i%near.length];};
    let target=this.command==='focus'?enemies.find(r=>r.id===this.targetId):closest(this.command==='cover'?p:a);
    if(this.command==='cover'&&target&&Math.hypot(target.x-p.x,target.y-p.y)>340)target=null;
    if(this.command==='retreat')target=null;
    a.targetId=target?.id??null;
    const behind=clamp(p.x-p.facing*(65+i*46),25,975);
    const reach=loadout?.range??(role==='douser'?230:role==='fighter'?90:320),engage=target&&Math.hypot(target.x-p.x,target.y-p.y)<550;
    const attackGoal=target?clamp(target.x-Math.sign(target.x-a.x||1)*Math.min(reach*.7,role==='fighter'?64:240)+(i-1)*18,25,975):behind;
    a.goal=this.command==='hold'?(a.anchor?.x??a.x):this.command==='retreat'?clamp(p.x-p.facing*(150+i*40),25,975):this.command==='cover'&&target?clamp(p.x+Math.sign(target.x-p.x)*95+(i-1)*25,25,975):this.command==='focus'||engage?attackGoal:behind;
    if(['follow','focus'].includes(this.command)&&target&&role==='fighter'&&target.type==='guard'&&Math.abs(target.x-a.x)<200)a.goal=clamp(target.x-target.facing*58,25,975);
   }
   a.jumpCd=Math.max(0,(a.jumpCd??0)-dt);const jumpTarget=enemies.find(r=>r.id===a.targetId);if(!a.flying&&a.y>=420&&a.jumpCd===0&&this.command!=='hold'&&this.command!=='retreat'&&jumpTarget&&jumpTarget.y<335&&Math.abs(jumpTarget.x-a.x)<210){a.vy=-610;a.jumpCd=1.5;}
   if(a.flying){const y=this.command==='hold'?(a.anchor?.y??a.y):clamp(p.y-60-i*24,140,350);a.y+=clamp(y-a.y,-speed*dt,speed*dt);}
   const walking=speed*(Math.abs(p.x-a.x)>300&&this.command!=='hold'?1.8:1),step=clamp((a.goal??a.x)-a.x,-walking*dt,walking*dt);a.x=clamp(a.x+step,25,975);if(Math.abs(step)>.01)a.facing=Math.sign(step);
   const target=enemies.find(r=>r.id===a.targetId);if(target&&Math.hypot(target.x-a.x,target.y-a.y)<(loadout?.range??(role==='douser'?230:role==='fighter'?90:320))&&a.cooldown===0){a.facing=Math.sign(target.x-a.x)||a.facing;a.cooldown=loadout?.cooldown??(role==='douser'?.8:.65);attack(a,target);}
  });
 }
}
export function drawCompanions(ctx,g){const t=g.clock??0;
 for(const a of g.companions??[]){if(a.hp<=0)continue;ctx.save();ctx.translate(a.x,a.y);ctx.save();ctx.strokeStyle='#9cfff1';ctx.lineWidth=a.joinFlash>0?4:2;ctx.fillStyle='#5ce8d422';ctx.beginPath();ctx.ellipse(0,3,25+(a.joinFlash>0?Math.sin(t*12)*3:0),7,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();if(a.crouching)ctx.scale(1,.6);ctx.strokeStyle='#9ce5e3';ctx.lineWidth=2;ctx.setLineDash([3,3]);ctx.strokeRect(-22,-64,44,66);ctx.setLineDash([]);if(isSurvivor(a)){drawSurvivor(ctx,a,t);}else if(a.kind==='human'){ctx.fillStyle='#d7c6ac';ctx.beginPath();ctx.arc(0,-53,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#829c9b';ctx.fillRect(-10,-42,20,27);ctx.strokeStyle='#d7c6ac';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-5,-15);ctx.lineTo(-9,0);ctx.moveTo(5,-15);ctx.lineTo(9,0);ctx.stroke();ctx.fillStyle='#d4fff2';ctx.fillRect(a.facing>0?7:-28,-32,21,5);}else{ctx.fillStyle=a.role==='douser'?'#537f91':'#628b83';ctx.fillRect(-15,-42,30,27);ctx.fillRect(-12,-62,24,17);ctx.fillStyle='#d4fff2';ctx.fillRect(-7,-56,14,4);ctx.fillRect(-12,-13,8,13);ctx.fillRect(4,-13,8,13);ctx.fillRect(a.facing>0?12:-34,-34,22,7);}ctx.beginPath();ctx.moveTo(-7,-76);ctx.lineTo(0,-69);ctx.lineTo(7,-76);ctx.stroke();ctx.fillStyle='#142b28';ctx.fillRect(-20,6,40,4);ctx.fillStyle='#9ce5e3';ctx.fillRect(-20,6,40*a.hp/a.maxHp,4);if(isSurvivor(a)){ctx.fillStyle='#283c4c';ctx.fillRect(-20,12,40,4);ctx.fillStyle='#e6c082';ctx.fillRect(-20,12,40*a.armor/SURVIVOR_ARMOR,4);}ctx.font='9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(a.dodgeFlash>0?'EVADE':'◆ ALLY',0,-98);ctx.fillText(a.name??'ALLY',0,-84);if(Number.isInteger(a.loanedWeapon)){ctx.fillStyle=weaponAt(a.loanedWeapon,g.weaponTiers[a.loanedWeapon]).color;ctx.fillRect(22,-42,8,22);ctx.fillText(String(a.loanedWeapon+1),26,-48);}ctx.restore();
 }
 const target=g.orders?.targetId&&hostileTargets(g).find(r=>r.id===g.orders.targetId);if(target){ctx.save();ctx.strokeStyle='#a6f0ed';ctx.lineWidth=2;ctx.beginPath();ctx.arc(target.x,target.y-30,47,0,Math.PI*2);ctx.stroke();ctx.font='12px ui-monospace,monospace';ctx.fillStyle='#a6f0ed';ctx.textAlign='center';ctx.fillText('◎ FOCUS',target.x,target.y-92);ctx.restore();}
}
