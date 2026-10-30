import {drawRocketExhaust} from './late-tools.mjs';
import {drawScrambleTarget} from './magnetic-scramble.mjs';
import {drawBossIntegrity} from './boss-integrity.mjs';
import {drawButtonMaterial} from './button-material.mjs';
import {drawBossFeedback} from './boss-feedback.mjs';
import {drawSuperLaser} from './boss-laser.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function scrollView(game,width,previous=null,dt=.016){
 const maximum=game.roomOffset+(game.state==='traveling'||game.pausedFrom==='traveling'?2000:1000)-width;
 const target=clamp(game.roomOffset+game.player.x-width/2,0,Math.max(0,maximum));
 const snap=previous===null||Math.abs(target-previous)>1800;
 return {width,left:snap?target:previous+(target-previous)*Math.min(1,dt*8)};
}
export function roomShell(ctx,game,index,t){
 const current=index===game.room,open=index<game.room||current&&game.state==='traveling'||current&&game.pausedFrom==='traveling',amount=index<game.room?1:open?game.door:0;

 ctx.fillStyle='#28372f';ctx.fillRect(974,58,26,362);ctx.fillStyle=open?'#9de7b2':'#d88d77';ctx.fillRect(980,60,3,360);ctx.fillStyle='#4d6256';ctx.fillRect(984,60,16,360*(1-amount));
 if(open){ctx.fillStyle='#b7e77a';ctx.font='28px ui-monospace,monospace';ctx.textAlign='center';for(let x=810;x<=950;x+=65)ctx.fillText('→',x,365);}
}
export function drawStructure(ctx,r,t){
 if(!r.structure)return false;ctx.save();ctx.translate(r.x,r.y);
 if(r.type==='antenna'){
  ctx.fillStyle='#263b3d';ctx.fillRect(-45,-23,90,23);ctx.strokeStyle=r.maxHp>1000?'#abb9c4':'#d9be77';ctx.lineWidth=r.maxHp>1000?14:7;ctx.beginPath();ctx.moveTo(-30,0);ctx.lineTo(0,-285);ctx.lineTo(30,0);ctx.moveTo(-20,-95);ctx.lineTo(20,-95);ctx.moveTo(-10,-195);ctx.lineTo(10,-195);ctx.stroke();
  if(r.maxHp>1000)for(let y=-40;y>-230;y-=45){ctx.fillStyle='#798c97';ctx.fillRect(-32,y,64,20);}
  ctx.strokeStyle='#f1c778';ctx.lineWidth=3;for(let n=0;n<3;n++){const radius=20+(t*40+n*30)%100;ctx.globalAlpha=1-radius/130;ctx.beginPath();ctx.arc(0,-280,radius,Math.PI*1.1,Math.PI*1.9);ctx.stroke();}ctx.globalAlpha=1;
 }else{
  const layers=r.maxHp>5000?5:r.maxHp>800?3:1;
  for(let i=layers-1;i>=0;i--){ctx.fillStyle=i%2?'#627583':'#3e505c';ctx.fillRect(-60-i*8,-115-i*6,120+i*16,160+i*12);ctx.strokeStyle='#96a5ac';ctx.lineWidth=3;ctx.strokeRect(-60-i*8,-115-i*6,120+i*16,160+i*12);}
  ctx.fillStyle='#191f24';ctx.fillRect(-30,-90,60,60);ctx.fillStyle='#e7776c';ctx.beginPath();ctx.arc(0,-60,16,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c0c8cc';ctx.lineWidth=9;for(const x of [-22,0,22]){ctx.beginPath();ctx.moveTo(x,-105);ctx.lineTo(x,-14);ctx.stroke();}
  drawButtonMaterial(ctx,r,t);
  ctx.fillStyle='#f1bc9c';ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('DO NOT PRESS',0,-130-layers*6);
 }
 ctx.restore();const y=r.type==='antenna'?r.y-330:r.y+65;ctx.fillStyle='#273d37';ctx.fillRect(r.x-55,y,110,5);ctx.fillStyle=r.flash>0?'#fff0a3':r.type==='antenna'?'#f1c778':'#b6cad6';ctx.fillRect(r.x-55,y,110*Math.max(0,r.hp/r.maxHp),5);return true;
}
export function drawEvasion(ctx,e,f){
 const x=e.x,y=e.y,kind=e.attackKind;ctx.save();ctx.translate(x,y);ctx.strokeStyle=e.color;ctx.fillStyle=e.color;ctx.lineWidth=3;
 const line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();};
 if(kind==='impact'){for(let n=0;n<4;n++)line(-55+f*55+n*12,20, -30+f*55+n*12,20);ctx.strokeRect(30*Math.sin(f*Math.PI)-18,0,36,20);}
 else if(kind==='cutting'){ctx.translate(Math.sin(f*Math.PI)*30,-Math.sin(f*Math.PI)*55);ctx.rotate(f*Math.PI*2);ctx.strokeRect(-20,-20,40,40);ctx.beginPath();ctx.arc(0,0,46,0,f*Math.PI*2);ctx.stroke();}
 else if(kind==='explosive'||kind==='rounds'){for(let n=0;n<3;n++){ctx.beginPath();ctx.ellipse(f*65,-f*50,15+n*14,9+n*8,f*8,0,Math.PI*2);ctx.stroke();}line(0,0,f*90,-f*90);}
 else if(kind==='glue'){for(let n=0;n<5;n++){line(-45+n*20,-30,-35+n*20,30);line(-30+n*20,30,-20+n*20,-30);}line(-40-f*30,-45,40+f*30,35);}
 else if(kind==='water'||kind==='liquid'){ctx.beginPath();ctx.arc(0,-30,48,Math.PI,Math.PI*2);ctx.stroke();for(let n=0;n<6;n++)line(-50+n*20,-35,-58+n*23,-50-f*40);}
 else if(kind==='laser'){line(-25,-50,25,30);line(0,-10,80*f,-80*f);ctx.strokeStyle='#ffffff';line(-15,-40,15,10);}
 else if(kind==='magnet'){ctx.rotate(f*Math.PI);ctx.beginPath();ctx.arc(0,-10,38,0,Math.PI);ctx.stroke();line(-38,-10,-38,-45);line(38,-10,38,-45);line(-50,0,50,0);}
 else if(kind==='electric'){for(let n=0;n<3;n++){ctx.beginPath();ctx.ellipse(0,-15,25+n*14,45+n*7,f*3,0,Math.PI*2);ctx.stroke();}line(-30,20,-40,40);line(30,20,40,40);}
 else if(kind==='emp'){ctx.rotate(f);for(let n=0;n<3;n++)ctx.strokeRect(-25-n*8,-40-n*8,50+n*16,65+n*16);}
 else if(kind==='radio'){for(let n=0;n<3;n++){ctx.beginPath();ctx.arc(0,-10,25+n*14+f*20,0,Math.PI*2);ctx.stroke();}line(-45,-55,45,35);}
 else{for(let n=0;n<5;n++)line(-40+n*20,-40,Math.sin(n+f*8)*40,35);}
 ctx.restore();
}
export function drawExpeditionExtras(ctx,g,t){
 drawScrambleTarget(ctx,g);
 const support=g.state==='playing'?g.bossSupport?.warning:null;if(support){ctx.save();ctx.strokeStyle='#f0bd77';ctx.fillStyle='#f0bd7722';ctx.lineWidth=3;for(const x of support.xs){const y=support.side==='air'?75:335;ctx.fillRect(x-38,y,76,85);ctx.strokeRect(x-38,y,76,85);ctx.fillStyle='#f0bd77';ctx.font='26px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(support.side==='air'?'↓':support.side==='left'?'→':'←',x,y+48);ctx.font='10px ui-monospace,monospace';ctx.fillText('ENEMY INBOUND',x,y-25);ctx.fillText({crouch:'GROUND',air:'DRONES',camp:'ARTILLERY',mixed:'BACKUP'}[support.reason],x,y-13);ctx.fillRect(x-38,y+83,76*(1-support.remaining/support.total),4);ctx.fillStyle='#f0bd7722';}ctx.restore();}
 for(const r of g.robots)if(r.hp>0&&r.supportReason){ctx.save();ctx.fillStyle='#f0bd77';ctx.font='13px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText({crouch:'↓',air:'↑',camp:'⌖',mixed:'+'}[r.supportReason],r.x,r.y-103);ctx.restore();}
 const marks=[...g.robots.filter(r=>r.hp>0&&r.action==='airburst'&&r.airburstMark).map(r=>r.airburstMark),...g.shots.filter(s=>s.airburst&&s.life>0).map(s=>({x:s.targetX,y:s.targetY}))];for(const m of marks){ctx.save();ctx.strokeStyle='#f0ad79';ctx.lineWidth=2;ctx.beginPath();ctx.arc(m.x,m.y,62,0,Math.PI*2);ctx.moveTo(m.x-78,m.y);ctx.lineTo(m.x+78,m.y);ctx.moveTo(m.x,m.y-78);ctx.lineTo(m.x,m.y+78);ctx.stroke();ctx.restore();}
 const warning=g.deploymentWarning;if(warning){ctx.save();ctx.strokeStyle='#efad79';ctx.fillStyle='#efad7922';ctx.lineWidth=3;const xs=warning.side==='air'?warning.units.map((_,i)=>420+i*100):[warning.side==='left'?100:900];for(const x of xs){ctx.fillRect(x-42,warning.side==='air'?75:335,84,85);ctx.strokeRect(x-42,warning.side==='air'?75:335,84,85);ctx.fillStyle='#efad79';ctx.font='25px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(warning.side==='air'?'↓':warning.side==='left'?'→':'←',x,warning.side==='air'?125:390);ctx.fillStyle='#efad7922';}ctx.restore();}

 const aftermath=g.player.blastAftermath;if(aftermath){ctx.strokeStyle=aftermath.kind==='chemical'?'#caed7055':'#e9a16555';ctx.lineWidth=8;ctx.strokeRect(5,5,990,490);ctx.fillStyle='#e9bc85';ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(aftermath.kind.toUpperCase()+' '+Math.ceil(aftermath.time),g.player.x,g.player.y-105);}
 for(const b of g.glueBombs??[]){ctx.fillStyle='#d8b6f4';ctx.beginPath();ctx.arc(b.x,b.y,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff2cf';ctx.strokeRect(b.x-4,b.y-5,8,10);}
 for(const r of g.robots.filter(r=>r.hp>0)){
  drawBossIntegrity(ctx,r,t);drawSuperLaser(ctx,r,g.robots);drawBossFeedback(ctx,r);
  if(r.generation>1&&!r.structure){ctx.fillStyle='#e9bc85';for(let n=0;n<r.generation;n++)ctx.fillRect(r.x-14+n*6,r.y-88,3,5);}
  if(r.fullArmor){ctx.save();ctx.strokeStyle='#d8ad68';ctx.lineWidth=4;ctx.strokeRect(r.x-21,r.y-70,42,56);ctx.strokeRect(r.x-17,r.y-66,34,18);ctx.strokeRect(r.x-23,r.y-19,17,17);ctx.strokeRect(r.x+6,r.y-19,17,17);ctx.restore();}
  if(['slide-windup','dive-slide','shove-windup','shove'].includes(r.action)){ctx.strokeStyle=r.type==='shocker'?'#eff08a':'#e6ad60';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r.x,r.y-10);ctx.lineTo(r.x+(r.lockDir??r.facing)*130,r.y-10);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='22px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(r.type==='shocker'?'↑':'⇥',r.x+(r.lockDir??r.facing)*130,r.y-20);}
  if(r.dive?.phase==='windup'){ctx.strokeStyle='#efad79';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.dive.x,r.dive.y-20,32,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(r.x,r.y-24);ctx.lineTo(r.dive.x,r.dive.y-20);ctx.stroke();}
  if(r.dive?.phase==='dive'){ctx.strokeStyle='#efad7977';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(r.x-r.dive.vx*.12,r.y-r.dive.vy*.12);ctx.lineTo(r.x,r.y);ctx.stroke();}
  if(r.combo){ctx.save();ctx.strokeStyle='#e9a8d1';ctx.fillStyle='#e9a8d1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x,r.y-32,53,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,r.combo.age/(r.combo.windup??.6)));ctx.stroke();ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText({rebound:'↔ CIRCUIT',pursuit:'↗ PURSUIT',feint:'↯ FEINT',riposte:'↓ COUNTER',roll:'↻ ROLL',airstrike:'↗ CRITICAL',screen:'◈ PREDICT'}[r.combo.id],r.x,r.y-102);ctx.restore();}
  if(r.type==='mirror'&&r.controlRecovery>0){ctx.strokeStyle='#f1c778';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y-32,48,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f1c778';ctx.font='9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('CONTROL RECOVERY',r.x,r.y-120);}
  if(r.predictBlock>0){ctx.strokeStyle='#e9a8d1';ctx.lineWidth=5;ctx.beginPath();ctx.arc(r.x,r.y-30,40,r.facing>0?-1.2:Math.PI-1.2,r.facing>0?1.2:Math.PI+1.2);ctx.stroke();}

  if(r.glueGround>0||r.glueSlow>0){ctx.strokeStyle='#d8b6f4';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(r.x-28,r.y-7);ctx.lineTo(r.x+28,r.y-7);ctx.stroke();ctx.fillStyle='#d8b6f4';ctx.font='9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(r.glueGround>0?'GROUNDED '+r.glueGround.toFixed(1):'SLOWED '+r.glueSlow.toFixed(1),r.x,r.y-120);}

  if(r.super){ctx.setLineDash(r.shieldReduced?[7,9]:[]);ctx.strokeStyle=r.shieldReduced?'#f1c778':r.controlRecovery>0?'#f1c778':r.disabled?'#9ee6ee':r.channel==='radio'?'#d9b5f5':r.channel==='electric'?'#b7e77a':'#ef9b8d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y-35,49,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
   if(r.flies&&!r.disabled&&!(r.glueGround>0)){ctx.fillStyle='#e6a078';ctx.fillRect(r.x-23,r.y,10,16+Math.sin(t*30)*6);ctx.fillRect(r.x+13,r.y,10,16+Math.sin(t*30+1)*6);}
   if(r.channel){ctx.fillStyle='#c8ded0';ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(r.channel.toUpperCase(),r.x,r.y-112);}
   if(r.windup>0&&!r.combo){ctx.strokeStyle='#ef9b8d88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x,r.y-26);ctx.lineTo(r.lockX,r.lockY);ctx.stroke();ctx.strokeRect(r.lockX-15,r.lockY-15,30,30);}
   if(r.controlRecovery>0){ctx.fillStyle='#f1c778';ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('CONTROL RESIST',r.x,r.y-95);}
   else if(r.boostExposed>0){ctx.fillStyle='#ffb576';ctx.font='10px ui-monospace,monospace';ctx.fillText('ARMOR OPEN',r.x,r.y-95);}
  }
 }
 for(const s of g.ordnance){ctx.fillStyle='#ffbd85';ctx.fillRect(s.x-9,s.y-3,18,6);}
 if(g.boostTime>0)drawRocketExhaust(ctx,g.player,t);
}
