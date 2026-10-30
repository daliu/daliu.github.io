import {dryFloor} from './floor-heat.mjs';
import {TYPES,HIT_STUN_CHANCE} from './engine.mjs';
import {structureHitFraction} from './objective-geometry.mjs';
export const LATE_TOOLS=[
 {id:'turret',name:'Auto turret',unlock:2,hint:'B toggles · finite ammunition · collect Mech 2'},
 {id:'lava',name:'Lava Lamp',unlock:2,hint:'B throws · one contact explosive per suit · collect Mech 2'},
 {id:'drill',name:'Diamond jackhammer',unlock:3,hint:'Hold B · below you only · finite fuel · collect Mech 3'}
];
export function fullLateGear(difficulty='normal'){return {selected:0,turretOn:false,turretAmmo:difficulty==='terminator'?45:difficulty==='hard'?65:90,lava:1,drillFuel:difficulty==='terminator'?90:140,battery:difficulty==='terminator'?80:100};}
export function validateLateGear(value,difficulty){
 const max=fullLateGear(difficulty);if(value===undefined)return max;if(value&&value.battery===undefined)value={...value,battery:max.battery};
 if(!value||!Number.isInteger(value.selected)||value.selected<0||value.selected>2||typeof value.turretOn!=='boolean')return null;
 for(const key of ['turretAmmo','lava','drillFuel','battery'])if(!Number.isFinite(value[key])||value[key]<0||value[key]>max[key]||!['drillFuel','battery'].includes(key)&&!Number.isInteger(value[key]))return null;
 return Object.fromEntries(Object.keys(max).map(key=>[key,value[key]]));
}
export const toolAvailable=(g,index)=>!!LATE_TOOLS[index]&&g.mechTier>=LATE_TOOLS[index].unlock;
export function useLateTool(g){
 if(g.state!=='playing'||!g.player.mecha||!toolAvailable(g,g.gear.selected))return false;
 if(g.gear.selected===0){g.gear.turretOn=!g.gear.turretOn;return true;}
 if(g.gear.selected===2)return g.gear.drillFuel>0;
 if(g.gear.lava<=0)return false;g.gear.lava--;g.stats.heatBursts=(g.stats.heatBursts??0)+1;
 g.gearShots.push({kind:'lava',x:g.player.x+g.player.facing*24,y:g.player.y-32,vx:g.player.facing*380,vy:-80,life:2});return true;
}
function targetOnSegment(g,s,x,y){
 const dx=s.x-x,dy=s.y-y,len=dx*dx+dy*dy;
 return g.robots.filter(r=>r.hp>0).map(r=>{
  if(r.structure)return {r,t:structureHitFraction(r,x,y,s.x,s.y)};
  const t=len?Math.max(0,Math.min(1,((r.x-x)*dx+(r.y-26-y)*dy)/len)):0;
  return {r,t:Math.hypot(x+t*dx-r.x,y+t*dy-r.y+26)<30?t:null};
 }).filter(c=>c.t!==null).sort((a,b)=>a.t-b.t)[0]?.r;
}
export function updateLateTools(g,dt,input){
 const p=g.player,gear=g.gear;p.turretFlash=Math.max(0,(p.turretFlash??0)-dt);g.turretClock=Math.max(0,(g.turretClock??0)-dt);g.drillClock=Math.max(0,(g.drillClock??0)-dt);
 if(!input.hack&&p.mecha&&toolAvailable(g,0)&&gear.turretOn&&gear.turretAmmo>0&&g.turretClock===0){
  const r=g.robots.filter(r=>r.hp>0&&!r.structure&&Math.hypot(r.x-p.x,r.y-p.y)<480).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  if(r){const dx=r.x-p.x,dy=r.y-p.y+8,len=Math.hypot(dx,dy)||1;gear.turretAmmo--;g.stats.turretShots=(g.stats.turretShots??0)+1;g.turretClock=.45;p.turretFlash=.1;g.turretAim=Math.atan2(dy,dx);g.gearShots.push({kind:'turret',x:p.x,y:p.y-34,vx:dx/len*720,vy:dy/len*720,life:.85});}
 }
 if(p.mecha&&gear.selected===2&&toolAvailable(g,2)&&input.tool&&gear.drillFuel>0){
  gear.drillFuel=Math.max(0,gear.drillFuel-dt*9);p.drilling=.035;
  if(g.drillClock===0){g.drillClock=.08;g.effects.push({kind:'drill-impact',x:p.x,y:p.y,life:.07,max:.07,color:'#c7edf2'});g.stats.attacks[1]++;for(const r of g.robots)if(r.hp>0&&!r.structure&&Math.abs(r.x-p.x)<55&&r.y-p.y>18&&r.y-p.y<145)g.hit(r,1,1.05);}
 }else p.drilling=Math.max(0,(p.drilling??0)-dt);
 for(const s of g.gearShots){
  const x=s.x,y=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.kind==='lava')s.vy+=260*dt;
  const hit=targetOnSegment(g,s,x,y);if(!hit&&s.life>0&&s.y<420)continue;
  if(s.kind==='lava'){
   if(s.y>285)dryFloor(g,s.x-115,s.x+115);
   g.effects.push({kind:'blast',x:s.x,y:Math.min(420,s.y),life:.55,max:.55,color:'#ff9b62'});
   for(const r of g.robots)if(r.hp>0&&Math.hypot(r.x-s.x,r.y-25-s.y)<115){g.damageRobot(r,185,{fire:true,color:'#ff9b62',number:true,feedbackKey:'lava',feedbackSerial:'lava:'+g.wave});if(!r.structure&&g.random()<HIT_STUN_CHANCE.lava)g.disable(r,'lava',.9);}
  }else if(hit){const critical=g.random()<.1+(g.bossCriticalBonus?.(hit)??0);g.damageRobot(hit,28*(TYPES[hit.type].resistance.impact??1)*(critical?1.65:1),{critical,number:true,color:'#f8d89e',damageType:'impact',feedbackKey:'turret',feedbackSerial:'turret:'+g.clock});}
  s.life=0;
 }
 g.gearShots=g.gearShots.filter(s=>s.life>0&&s.x>=0&&s.x<=1000);
}

// New hardware arrives one full ten-level block after the corresponding suit.
export function equipCounterTools(g,r){
 if(r.structure||['mirror','overseer'].includes(r.type))return;
 const early=g.difficulty==='terminator';
 r.rapidCounter=g.wave>=(early?21:31)&&['gunner','flyer'].includes(r.type);
 r.glueCounter=g.wave>=(early?21:31)&&r.type==='shocker';
 r.jackhammer=g.wave>=(early?21:41)&&r.type==='plated';
 r.counterToolCd=2;r.counterHitCd=0;
}
export function updateCounterTools(g,r,dt){
 r.counterToolCd=Math.max(0,(r.counterToolCd??0)-dt);
 if(r.rapidCounter)r.cooldown-=dt*.3;
 if(r.glueCounter&&r.counterToolCd===0&&r.windup<=0){
  g.senseRobot(r,dt);r.counterToolCd=6;r.glueTell=.65;r.lockGlueX=r.targetX;r.lockGlueY=r.targetY-22;
 }
 if(r.glueTell>0){r.glueTell-=dt;if(r.glueTell<=0){const dx=r.lockGlueX-r.x,dy=r.lockGlueY-r.y+26,len=Math.hypot(dx,dy)||1;g.shots.push({kind:'robot-glue',x:r.x,y:r.y-26,vx:dx/len*340,vy:dy/len*340,gravity:.00001,life:3,damage:5,owner:r.id,ownerX:r.x});}return true;}
 if(!r.jackhammer)return false;
 g.senseRobot(r,dt);const p=g.player,dx=r.targetX-r.x;r.facing=Math.sign(dx)||r.facing;r.counterHitCd=Math.max(0,r.counterHitCd-dt);
 if(!r.crippled&&r.y>=420&&r.targetY<365&&r.counterToolCd===0){r.vy=-540;r.counterToolCd=2.2;}
 if(r.hammerTime>0){r.hammerTime-=dt;if(r.counterHitCd===0){r.counterHitCd=.14;const reach=110;r.action='hammer-side';g.effects.push({kind:'attack',x:r.x,y:r.y-27,dir:r.facing,range:reach,weapon:0,life:.12,max:.12,color:'#edbd86'});if(Math.abs(p.y-r.y)<52&&(p.x-r.x)*r.facing>=0&&Math.abs(p.x-r.x)<reach&&!(p.rollTime>0)){g.botHurt(r,15,r.x,0,'industrial jackhammer');p.x=Math.max(22,Math.min(978,p.x+r.facing*34));}for(const o of g.robots)if(o!==r&&o.hp>0&&Math.abs(o.y-r.y)<52&&(o.x-r.x)*r.facing>0&&Math.abs(o.x-r.x)<reach)g.friendlyDamage(r.id,o,20);}return true;}
 if(r.hammerTell>0){r.hammerTell-=dt;if(r.hammerTell<=0){r.hammerTime=.6;r.cooldown=2;}return true;}
 if(Math.abs(dx)<125&&Math.abs(r.targetY-r.y)<80&&r.cooldown<=0){r.hammerTell=.65;r.action='hammer-windup';}
 else if(Math.abs(dx)>70)r.x=Math.max(30,Math.min(970,r.x+Math.sign(dx)*90*r.cognition.speed*(r.crippled?.3:1)*dt));
 return true;
}

// A downward cone, measured from the boots to the target's torso. No damage above or beside it.
export const EXHAUST_LENGTH=180,EXHAUST_DPS=360;
export function exhaustExposure(player,target){
 const depth=target.y-24-player.y;
 return depth>=6&&depth<=EXHAUST_LENGTH&&Math.abs(target.x-player.x)<=22+depth*.35?1-.3*depth/EXHAUST_LENGTH:0;
}
export function updateRocketExhaust(g,dt){
 if(420-g.player.y<=EXHAUST_LENGTH)dryFloor(g,g.player.x-65,g.player.x+65);
 for(const r of g.robots)if(r.hp>0){const exposure=exhaustExposure(g.player,r);if(exposure){if(!r.structure)r.boostExposed=4;g.damageRobot(r,EXHAUST_DPS*exposure*dt,{fire:true,color:'#ffac65'});}}
 for(const a of g.companions??[])if(a.hp>0){const exposure=exhaustExposure(g.player,a);if(exposure)g.hurtCompanion(a,EXHAUST_DPS*exposure*dt,{continuous:true});}
}
export function drawRocketExhaust(ctx,p,t){
 ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=.55;ctx.fillStyle='#ff913f';ctx.beginPath();ctx.moveTo(-22,6);ctx.lineTo(-85,EXHAUST_LENGTH);ctx.lineTo(85,EXHAUST_LENGTH);ctx.lineTo(22,6);ctx.closePath();ctx.fill();
 for(let i=0;i<9;i++){const depth=12+i*18;ctx.fillStyle=i<3?'#fff0ad':'#ffb254';ctx.fillRect(-12-depth*.22+Math.sin(t*80+i)*4,depth,24+depth*.44,8);}
 ctx.restore();
}

export function drawDrillImpact(ctx,e,f){
 ctx.save();ctx.translate(e.x,e.y);ctx.strokeStyle=e.color;ctx.lineWidth=2;ctx.globalAlpha=1-f;
 // Downward motion lines and a spreading contact burst, never a melee sweep.
 for(const x of [-18,0,18]){ctx.beginPath();ctx.moveTo(x,42+f*24);ctx.lineTo(x,104+f*24);ctx.stroke();}
 for(let i=0;i<7;i++){const x=(i-3)*9;ctx.beginPath();ctx.moveTo(0,130);ctx.lineTo(x,130-Math.abs(x)*.6*(1-f));ctx.stroke();}
 ctx.restore();
}
export function drawJackhammer(ctx,x,y,t,active=false){
 ctx.save();ctx.translate(x+(active?Math.sin(t*157)*5:0),y+(active?Math.sin(t*191)*3:0));
 // T-grips, motor, cooling ribs, piston guides and diamond chisel.
 ctx.strokeStyle='#d4e9ec';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-22,4);ctx.lineTo(-22,-8);ctx.lineTo(22,-8);ctx.lineTo(22,4);ctx.stroke();
 ctx.fillStyle='#354951';ctx.fillRect(-27,-1,12,7);ctx.fillRect(15,-1,12,7);
 ctx.fillStyle='#edae53';ctx.fillRect(-12,-4,24,35);ctx.fillStyle='#f7cb77';ctx.fillRect(-8,-10,16,9);
 ctx.fillStyle='#263f49';for(let i=0;i<4;i++)ctx.fillRect(-9,5+i*6,18,2);
 ctx.fillStyle='#8faeb8';ctx.fillRect(-13,31,26,7);ctx.fillRect(-9,38,4,18);ctx.fillRect(5,38,4,18);
 const phase=(t*19)%1,stroke=active?(phase<.22?phase/.22:1-(phase-.22)/.78)*18:0;ctx.fillStyle='#d3edf0';ctx.fillRect(-3,38,6,30+stroke);
 ctx.beginPath();ctx.moveTo(-7,66+stroke);ctx.lineTo(0,79+stroke);ctx.lineTo(7,66+stroke);ctx.closePath();ctx.fill();
 if(active&&phase<.18){ctx.strokeStyle='#ffe5a3';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(0,79+stroke);ctx.lineTo(Math.sin(t*30+i*2)*20,85+stroke+i*3);ctx.stroke();}}
 ctx.restore();
}
export function drawLateTools(ctx,g,t){
 const p=g.player;ctx.save();
 if(p.mecha&&toolAvailable(g,0)){const on=g.gear.turretOn&&g.gear.turretAmmo>0,firing=g.gear.turretOn&&g.state==='playing'&&p.turretFlash>0;ctx.save();ctx.translate(p.x,p.y-79);ctx.fillStyle=on||firing?'#f4d194':'#667d77';ctx.fillRect(-11,-5,22,10);ctx.rotate(g.turretAim??(p.facing>0?0:Math.PI));ctx.fillRect(5,-3,22,6);if(on){ctx.fillStyle='#ffe5a3';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();}if(firing){ctx.fillStyle='#fff1c4';ctx.beginPath();ctx.moveTo(27,-7);ctx.lineTo(40,0);ctx.lineTo(27,7);ctx.fill();}ctx.restore();}
 if(p.mecha&&toolAvailable(g,1)&&g.gear.selected===1&&g.gear.lava>0){ctx.save();ctx.translate(p.x-p.facing*26,p.y-23);ctx.fillStyle='#ffad6c';ctx.shadowColor='#ff8f50';ctx.shadowBlur=8;ctx.fillRect(-6,-8,12,20);ctx.fillStyle='#f5d6a5';ctx.fillRect(-4,-12,8,4);ctx.shadowBlur=0;ctx.restore();}
 if(p.mecha&&toolAvailable(g,2)&&g.gear.selected===2)drawJackhammer(ctx,p.x,p.y-8,t,p.drilling>0);
 for(const s of g.gearShots??[]){ctx.fillStyle=s.kind==='lava'?'#ff9b62':'#ffdf9d';ctx.fillRect(s.x-5,s.y-5,s.kind==='lava'?12:8,s.kind==='lava'?17:4);}
 for(const r of g.robots)if(r.hp>0){
  if(r.glueTell>0){ctx.strokeStyle='#d9b0f0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x,r.y-26);ctx.lineTo(r.lockGlueX,r.lockGlueY);ctx.stroke();}
  if(r.jackhammer){ctx.save();ctx.translate(r.x+r.facing*18,r.y-30);ctx.rotate(-r.facing*Math.PI/2);ctx.scale(.65,.65);drawJackhammer(ctx,0,0,t,r.hammerTime>0);ctx.restore();if(r.hammerTell>0){ctx.strokeStyle='#efb46a';ctx.strokeRect(r.x+(r.facing>0?15:-125),r.y-51,110,48);}}
 }
 if(p.glueSlow>0){ctx.fillStyle='#d9b0f0';ctx.fillRect(p.x-20,p.y-8,40,6);}
 ctx.restore();
}
