import {factoryRoom} from './factory-story.mjs';
export {factoryRoom} from './factory-story.mjs';

export function drawFactoryWorld(ctx,game,index,t){
 const s=factoryRoom(index,game.difficulty),variant=s.variant;
 ctx.save();
 const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 const line=(x,y,a,b,color,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();};
 const text=(value,x,y,size=10,color=s.ink,align='left')=>{ctx.fillStyle=color;ctx.font=`${size}px ui-monospace,monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);};
 const frame=(x,y,w,h)=>{ctx.strokeStyle=s.ink;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);};
 const person=(x,y,n)=>{
  // Living people are small, unarmed figures behind glass, never combat entities.
  ctx.fillStyle='#b9b5a5';ctx.beginPath();ctx.arc(x,y-51,8,0,Math.PI*2);ctx.fill();
  rect(x-9,y-41,18,27,'#8a9c9d');line(x-5,y-14,x-8,y,s.ink,5);line(x+5,y-14,x+8,y,s.ink,5);
  line(x-10,y-35,x-19,y-22,s.ink,4);line(x+10,y-35,x+22,y-44+Math.sin(t*1.4+n)*3,s.ink,4);
 };
 const trace=(x,y)=>{
  // Manufactured belongings sit on shelves; the floor has no human remains or debris.
  if(s.trace==='cup'){rect(x,y-10,15,10,'#b5c9c9');frame(x+14,y-8,5,6);}
  else if(s.trace==='stars'){for(const dx of [0,22]){line(x+dx-6,y-9,x+dx+6,y-9,s.light,2);line(x+dx,y-15,x+dx,y-3,s.light,2);line(x+dx-4,y-13,x+dx+4,y-5,s.light,2);}}
  else if(s.trace==='wire'){line(x,y,x+6,y-15,s.light,2);line(x+6,y-15,x+15,y-4,s.light,2);line(x+15,y-4,x+23,y-12,s.light,2);}
  else if(s.trace==='visor'){rect(x,y-8,26,8,'#9eafb6');rect(x+3,y-6,20,3,s.bottom);}
  else if(s.trace==='tag'){rect(x,y-8,23,8,s.light);rect(x+4,y-5,12,2,s.bottom);line(x+23,y-4,x+30,y-10,s.ink,1);}
  else if(s.trace==='radio'){rect(x,y-19,28,19,'#899fa8');line(x+22,y-19,x+27,y-39,s.light,2);rect(x+4,y-15,11,4,s.light);for(let i=0;i<3;i++)line(x+5,y-8+i*3,x+21,y-8+i*3,s.bottom);}
  else if(s.trace==='map'){rect(x,y-15,34,15,'#b0bab4');line(x+4,y-7,x+27,y-7,s.bottom,2);line(x+4,y-7,x+10,y-12,s.bottom,2);line(x+4,y-7,x+10,y-2,s.bottom,2);}
 };
 const gradient=ctx.createLinearGradient(0,0,0,420);gradient.addColorStop(0,s.top);gradient.addColorStop(1,s.bottom);ctx.fillStyle=gradient;ctx.fillRect(0,0,1000,500);
 // Clinical symmetry, sealed services and immaculate surfaces: even absence is maintained.
 ctx.globalAlpha=.55;
 for(let x=0;x<=1000;x+=125){line(x,112,x,420,s.ink);line(x,172,x+125,172,s.ink);}
 line(0,118,1000,118,s.ink,3);line(0,130,1000,130,s.ink);
 if(s.kind==='trials'){
  for(let n=0;n<3;n++){
   const x=75+n*295;rect(x,160,240,205,'#152c31');frame(x,160,240,205);
   text(`TEST BAY ${String(n+1+variant*3).padStart(2,'0')}`,x+16,184,13);
   const target=x+120;line(target,215,target,315,s.ink,2);line(target-47,263,target+47,263,s.ink,2);ctx.strokeStyle=s.ink;ctx.beginPath();ctx.arc(target,263,30+variant*5,0,Math.PI*2);ctx.stroke();
   for(let bar=0;bar<4;bar++)rect(x+24+bar*48,342,32,5,bar===variant?s.light:s.ink);
   text(['MOTOR','TIMING','ADAPTATION'][(n+variant)%3],x+120,386,13,s.ink,'center');
  }
  text(s.local>=9?'PROFILE REPLAY / LIVE':'OBSERVATION ONLY',500,147,13,s.light,'center');
 }else if(s.kind==='cells'){
  const occupied=[0,2,4,5].slice(0,s.people);
  for(let n=0;n<6;n++){
   const x=27+n*159,live=occupied.includes(n);rect(x,151,140,221,'#192e39');frame(x,151,140,221);
   text(String(s.cellBase+n),x+10,171,12);rect(x+117,161,9,5,live?'#a4c8b0':s.ink);
   rect(x+14,322,109,7,'#84999f');line(x+22,330,x+22,351,s.ink,3);line(x+114,330,x+114,351,s.ink,3);rect(x+20,310,25,10,'#71878d');
   if(live)person(x+76,307,n);else text('CYCLE CLOSED',x+70,245,11,s.ink,'center');
   line(x+11,188,x+66,186,s.ink);line(x+6,369,x+136,369,s.light,2);
   if(n===0){trace(x+77,320);}
  }
  if(s.breach){rect(0,130,74,255,'#11232a');rect(0,130,74,38,'#829b9d');for(let y=135;y<166;y+=8)line(0,y,74,y,s.bottom,2);text('TEST',37,207,12,s.light,'center');text('PERIMETER',37,225,10,s.light,'center');text('BREACHED',37,248,11,s.light,'center');}
 }else if(s.kind==='processing'){
  for(let n=0;n<4;n++){
   const x=65+n*240;rect(x,172,153,190,'#29352c');frame(x,172,153,190);rect(x+22,195,109,86,s.bottom);text(['RATION','RECOVERY','FILTER','PACK'][n],x+76,217,13,s.ink,'center');
   for(let k=0;k<3;k++){rect(x+29+k*31,241,21,29,'#808f72');rect(x+33+k*31,248,13,4,s.light);}
   line(x+20,304,x+130,304,s.ink,5);rect(x+32,316,89,30,'#61765e');text('SEALED',x+76,336,11,s.light,'center');
  }
  if(s.people){rect(375,176,250,125,'#1a2e2c');frame(375,176,250,125);for(let n=0;n<s.people;n++)person(445+n*75,291,n);text('SERVICE WINDOW',500,168,12,s.light,'center');}
  rect(425,369,150,5,s.ink);trace(477,367);text('SOYLENT / INTERNAL DISTRIBUTION',500,399,13,s.ink,'center');
 }else if(s.kind==='laboratory'){
  for(let n=0;n<4;n++){
   const x=55+n*244;rect(x,161,158,110,'#252f42');frame(x,161,158,110);line(x+12,247,x+28,227,s.ink,2);line(x+28,227,x+63,241,s.ink,2);line(x+63,241,x+104,190,s.ink,2);line(x+104,190,x+143,211,s.ink,2);
   rect(x-9,324,180,9,'#879ba5');line(x+5,333,x+5,386,s.ink,4);line(x+156,333,x+156,386,s.ink,4);text('HUMAN RESPONSE',x+79,288,11,s.ink,'center');
  }
  if(s.people){rect(318,166,364,149,'#263f48');frame(318,166,364,149);for(let n=0;n<s.people;n++)person(378+n*75,306,n);text('UNREGISTERED SIGNAL',500,152,13,s.light,'center');}
  trace(493,322);if(s.trace==='map')text('←',509,307,30,s.light,'center');
 }else{
  for(let n=0;n<5;n++){
   const x=75+n*200;rect(x-33,155,66,238,'#263643');frame(x-33,155,66,238);for(let y=170;y<376;y+=26){rect(x-22,y,44,13,'#596e79');rect(x+13,y+4,5,4,s.light);}line(x,155,500,132,s.ink,2);
  }
  ctx.strokeStyle=s.ink;ctx.lineWidth=3;ctx.beginPath();ctx.arc(500,246,67,0,Math.PI*2);ctx.stroke();text('POLICY',500,243,16,s.light,'center');text('SELF-AUTHORIZED',500,263,9,s.ink,'center');
  rect(464,373,73,4,s.ink);trace(486,370);
 }
 for(let n=0;n<5;n++){const x=40+n*200;rect(x,8,120,5,s.light);line(x,14,x+120,14,s.ink);}
 ctx.globalAlpha=.13;text(String(Math.max(1,game.trial)).padStart(3,'0'),500,303,100,s.light,'center');text('H U M A N   T R I A L',500,323,11,s.light,'center');
 ctx.globalAlpha=.9;text(`0${s.sector+1} / ${s.name}`,28,44,18);text(s.subtitle,965,44,12,s.ink,'right');
 // Flush panels and reflected strip lights, never grime or biological remnants.
 ctx.globalAlpha=1;rect(0,420,1000,80,s.floor);line(0,420,1000,420,s.light,2);
 for(let y=446;y<500;y+=25)line(0,y,1000,y,s.bottom);
 for(let x=-200;x<1200;x+=100)line(500+(x-500)*.8,420,x,500,s.bottom);
 ctx.globalAlpha=.19;for(let n=0;n<5;n++)rect(40+n*200,429,120,3,s.light);ctx.globalAlpha=.8;
 text(`CHAMBER ${String(index+1).padStart(2,'0')}`,25,479,10);text('VARIANCE MINIMIZED / FLOOR PURITY 100%',975,479,10,s.ink,'right');ctx.restore();
}

// Only the occupied chamber displays its record; door previews do not reveal future fates.
export function drawFactoryLore(ctx,game){
 const s=factoryRoom(game.room,game.difficulty),escaping=!!game.escape;
 ctx.save();ctx.globalAlpha=.78;ctx.fillStyle=s.light;ctx.textAlign='center';ctx.font='24px ui-monospace,monospace';
 ctx.fillText(escaping?'MAINTENANCE EXIT / OPEN':s.title,500,81);
 ctx.globalAlpha=.6;ctx.font='20px ui-monospace,monospace';ctx.fillText(escaping?'THE FACTORY HAS LOST YOUR TRACE.':s.fragment,500,106);ctx.restore();
}
