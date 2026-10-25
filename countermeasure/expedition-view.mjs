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
 for(const r of g.robots.filter(r=>r.hp>0)){
  if(r.super){ctx.strokeStyle=r.disabled?'#9ee6ee':r.channel==='radio'?'#d9b5f5':r.channel==='electric'?'#b7e77a':'#ef9b8d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y-35,49,0,Math.PI*2);ctx.stroke();
   if(r.flies&&!r.disabled){ctx.fillStyle='#e6a078';ctx.fillRect(r.x-23,r.y,10,16+Math.sin(t*30)*6);ctx.fillRect(r.x+13,r.y,10,16+Math.sin(t*30+1)*6);}
   if(r.channel){ctx.fillStyle='#c8ded0';ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(r.channel.toUpperCase(),r.x,r.y-112);}
   if(r.windup>0){ctx.strokeStyle='#ef9b8d88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x,r.y-26);ctx.lineTo(r.lockX,r.lockY);ctx.stroke();ctx.strokeRect(r.lockX-15,r.lockY-15,30,30);}
   if(r.summonWindup>0){ctx.strokeStyle='#e9bc85';ctx.lineWidth=3;ctx.strokeRect(r.x>500?890:50,345,60,75);}
   if(r.boostExposed>0){ctx.fillStyle='#ffb576';ctx.font='10px ui-monospace,monospace';ctx.fillText('ARMOR OPEN',r.x,r.y-95);}
  }
 }
 for(const s of g.ordnance){ctx.fillStyle='#ffbd85';ctx.fillRect(s.x-9,s.y-3,18,6);}
 if(g.boostTime>0){ctx.fillStyle='#ff9a55';for(let n=0;n<7;n++)ctx.fillRect(g.player.x-22+n*6,g.player.y+8,5,45+Math.sin(t*25+n)*20);}
}
