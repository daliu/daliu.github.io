const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function scrollView(game,width,previous=null,dt=.016){
 const maximum=game.roomOffset+(game.state==='traveling'||game.pausedFrom==='traveling'?2000:1000)-width;
 const target=clamp(game.roomOffset+game.player.x-width/2,0,Math.max(0,maximum));
 const snap=previous===null||Math.abs(target-previous)>1800;
 return {width,left:snap?target:previous+(target-previous)*Math.min(1,dt*8)};
}
export function roomShell(ctx,game,index,t){
 const current=index===game.room,open=index<game.room||current&&game.state==='traveling'||current&&game.pausedFrom==='traveling',amount=index<game.room?1:open?game.door:0;
 ctx.fillStyle=index%2?'#63a9b4':'#adbb72';ctx.globalAlpha=.16;ctx.fillRect(0,0,1000,3);ctx.globalAlpha=1;
 ctx.fillStyle='#718a7b';ctx.font='12px ui-monospace,monospace';ctx.textAlign='left';ctx.fillText('CHAMBER '+String(index+1).padStart(2,'0'),35,45);
 drawTrainingFactory(ctx,game,index,t);
 ctx.fillStyle='#28372f';ctx.fillRect(974,58,26,362);ctx.fillStyle=open?'#9de7b2':'#d88d77';ctx.fillRect(980,60,3,360);ctx.fillStyle='#4d6256';ctx.fillRect(984,60,16,360*(1-amount));
 if(open){ctx.fillStyle='#b7e77a';ctx.font='28px ui-monospace,monospace';ctx.textAlign='center';for(let x=810;x<=950;x+=65)ctx.fillText('→',x,365);}
}
function drawTrainingFactory(ctx,game,index,t){
 const stage=Math.min(4,Math.floor(index/11)),ink=['#67796c','#778776','#7f7771','#767482','#85717b'][stage];
 ctx.save();ctx.globalAlpha=.62;ctx.fillStyle='#0c1513';ctx.fillRect(48,125,116,142);ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.strokeRect(48,125,116,142);
 // Retained human silhouettes sit behind observation glass, never in combat space.
 for(let n=0;n<3;n++){const x=67+n*34;ctx.fillStyle='#26342f';ctx.fillRect(x,160,20,92);ctx.fillStyle=ink;ctx.beginPath();ctx.arc(x+10,181,5,0,Math.PI*2);ctx.fill();ctx.fillRect(x+5,189,10,25);ctx.fillRect(x+4,214,4,22);ctx.fillRect(x+12,214,4,22);ctx.strokeStyle='#627f7a';ctx.beginPath();ctx.moveTo(x+8,160);ctx.lineTo(x+8,174);ctx.stroke();}
 ctx.fillStyle=ink;ctx.font='8px ui-monospace,monospace';ctx.textAlign='left';ctx.fillText(['RETAIN SAMPLES','HUMAN DATASET','ERROR CORRECTION','REPEAT UNTIL LEARNED','NO SAMPLE WASTED'][stage],50,118);
 // The same camera becomes a larger array as the experiment progresses.
 for(let n=0;n<=stage;n++){const x=690+n*46;ctx.fillStyle='#384740';ctx.fillRect(x,85,23,12);ctx.fillStyle=Math.sin(t*(1+n*.2)+n)>-.25?'#d67e72':'#65473f';ctx.fillRect(x+15,89,5,4);ctx.strokeStyle='#56665c';ctx.beginPath();ctx.moveTo(x+6,85);ctx.lineTo(x+6,70);ctx.lineTo(x-5,70);ctx.stroke();}
 ctx.fillStyle='#15211d';ctx.fillRect(700,152,195,108);ctx.strokeStyle=ink;ctx.strokeRect(700,152,195,108);
 for(let n=0;n<14;n++){const height=8+((n*29+index*13)%57);ctx.fillStyle=n%3===0?'#925f5a':'#49695b';ctx.fillRect(712+n*12,236-height,6,height);}
 ctx.fillStyle=ink;ctx.fillText('TRAINING / '+String(Math.max(1,game.trial)).padStart(3,'0'),712,171);ctx.fillText(['OBSERVE','CLASSIFY','PREDICT','SYNCHRONIZE','REPLACE'][stage],712,251);
 if(stage>=2){ctx.strokeStyle='#714e4d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(220,60);ctx.lineTo(220,115);ctx.lineTo(310,115);ctx.lineTo(310,165);ctx.stroke();for(let n=0;n<stage;n++){ctx.fillStyle='#26332e';ctx.fillRect(242+n*40,310,28,103);ctx.fillStyle='#9c6e69';ctx.fillRect(248+n*40,320+(Math.floor(t+n)%4)*16,16,4);}}
 // A slow scan stays in the background, with no flashes or obstruction.
 ctx.globalAlpha=.07;ctx.fillStyle='#e1a59b';ctx.fillRect(0,75+(t*9+index*17)%260,970,2);ctx.restore();
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
  ctx.fillStyle='#f1bc9c';ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('DO NOT PRESS',0,-130-layers*6);
 }
 ctx.restore();const y=r.type==='antenna'?r.y-330:r.y+65;ctx.fillStyle='#273d37';ctx.fillRect(r.x-55,y,110,5);ctx.fillStyle=r.type==='antenna'?'#f1c778':'#b6cad6';ctx.fillRect(r.x-55,y,110*Math.max(0,r.hp/r.maxHp),5);return true;
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
 const warning=g.deploymentWarning;if(warning){ctx.save();ctx.strokeStyle='#efad79';ctx.fillStyle='#efad7922';ctx.lineWidth=3;const xs=warning.side==='air'?warning.units.map((_,i)=>420+i*100):[warning.side==='left'?100:900];for(const x of xs){ctx.fillRect(x-42,warning.side==='air'?75:335,84,85);ctx.strokeRect(x-42,warning.side==='air'?75:335,84,85);ctx.fillStyle='#efad79';ctx.font='25px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(warning.side==='air'?'↓':warning.side==='left'?'→':'←',x,warning.side==='air'?125:390);ctx.fillStyle='#efad7922';}ctx.restore();}

 const aftermath=g.player.blastAftermath;if(aftermath){ctx.strokeStyle=aftermath.kind==='chemical'?'#caed7055':'#e9a16555';ctx.lineWidth=8;ctx.strokeRect(5,5,990,490);ctx.fillStyle='#e9bc85';ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(aftermath.kind.toUpperCase()+' '+Math.ceil(aftermath.time),g.player.x,g.player.y-105);}
 for(const b of g.glueBombs??[]){ctx.fillStyle='#d8b6f4';ctx.beginPath();ctx.arc(b.x,b.y,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff2cf';ctx.strokeRect(b.x-4,b.y-5,8,10);}
 for(const r of g.robots.filter(r=>r.hp>0)){
  if(r.generation>1&&!r.structure){ctx.fillStyle='#e9bc85';for(let n=0;n<r.generation;n++)ctx.fillRect(r.x-14+n*6,r.y-88,3,5);}
  if(r.fullArmor){ctx.save();ctx.strokeStyle='#d8ad68';ctx.lineWidth=4;ctx.strokeRect(r.x-21,r.y-70,42,56);ctx.strokeRect(r.x-17,r.y-66,34,18);ctx.strokeRect(r.x-23,r.y-19,17,17);ctx.strokeRect(r.x+6,r.y-19,17,17);ctx.restore();}
  if(['slide-windup','dive-slide','shove-windup','shove'].includes(r.action)){ctx.strokeStyle=r.type==='shocker'?'#eff08a':'#e6ad60';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r.x,r.y-10);ctx.lineTo(r.x+(r.lockDir??r.facing)*130,r.y-10);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='22px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(r.type==='shocker'?'↑':'⇥',r.x+(r.lockDir??r.facing)*130,r.y-20);}
  if(r.dive?.phase==='windup'){ctx.strokeStyle='#efad79';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.dive.x,r.dive.y-20,32,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(r.x,r.y-24);ctx.lineTo(r.dive.x,r.dive.y-20);ctx.stroke();}
  if(r.dive?.phase==='dive'){ctx.strokeStyle='#efad7977';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(r.x-r.dive.vx*.12,r.y-r.dive.vy*.12);ctx.lineTo(r.x,r.y);ctx.stroke();}
  if(r.combo){ctx.save();ctx.strokeStyle='#e9a8d1';ctx.fillStyle='#e9a8d1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x,r.y-32,53,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,r.combo.age/.6));ctx.stroke();ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText({rebound:'↔ CIRCUIT',pursuit:'↗ PURSUIT',feint:'↯ FEINT',riposte:'↓ COUNTER',roll:'↻ ROLL',airstrike:'↗ CRITICAL',screen:'◈ PREDICT'}[r.combo.id],r.x,r.y-102);ctx.restore();}
  if(r.predictBlock>0){ctx.strokeStyle='#e9a8d1';ctx.lineWidth=5;ctx.beginPath();ctx.arc(r.x,r.y-30,40,r.facing>0?-1.2:Math.PI-1.2,r.facing>0?1.2:Math.PI+1.2);ctx.stroke();}

  if(r.glueGround>0||r.glueSlow>0){ctx.strokeStyle='#d8b6f4';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(r.x-28,r.y-7);ctx.lineTo(r.x+28,r.y-7);ctx.stroke();ctx.fillStyle='#d8b6f4';ctx.font='9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(r.glueGround>0?'GROUNDED '+r.glueGround.toFixed(1):'SLOWED '+r.glueSlow.toFixed(1),r.x,r.y-120);}

  if(r.super){ctx.strokeStyle=r.controlRecovery>0?'#f1c778':r.disabled?'#9ee6ee':r.channel==='radio'?'#d9b5f5':r.channel==='electric'?'#b7e77a':'#ef9b8d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y-35,49,0,Math.PI*2);ctx.stroke();
   if(r.flies&&!r.disabled&&!(r.glueGround>0)){ctx.fillStyle='#e6a078';ctx.fillRect(r.x-23,r.y,10,16+Math.sin(t*30)*6);ctx.fillRect(r.x+13,r.y,10,16+Math.sin(t*30+1)*6);}
   if(r.channel){ctx.fillStyle='#c8ded0';ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(r.channel.toUpperCase(),r.x,r.y-112);}
   if(r.windup>0&&!r.combo){ctx.strokeStyle='#ef9b8d88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x,r.y-26);ctx.lineTo(r.lockX,r.lockY);ctx.stroke();ctx.strokeRect(r.lockX-15,r.lockY-15,30,30);}
   if(r.summonWindup>0){ctx.strokeStyle='#e9bc85';ctx.lineWidth=3;ctx.strokeRect(r.x>500?890:50,345,60,75);}
   if(r.controlRecovery>0){ctx.fillStyle='#f1c778';ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('CONTROL RESIST',r.x,r.y-95);}
   else if(r.boostExposed>0){ctx.fillStyle='#ffb576';ctx.font='10px ui-monospace,monospace';ctx.fillText('ARMOR OPEN',r.x,r.y-95);}
  }
 }
 for(const s of g.ordnance){ctx.fillStyle='#ffbd85';ctx.fillRect(s.x-9,s.y-3,18,6);}
 if(g.boostTime>0){ctx.fillStyle='#ff9a55';for(let n=0;n<7;n++)ctx.fillRect(g.player.x-22+n*6,g.player.y+8,5,45+Math.sin(t*25+n)*20);}
}
