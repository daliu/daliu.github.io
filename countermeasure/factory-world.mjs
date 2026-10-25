const SECTORS=[
 {name:'INTAKE',subtitle:'THE VOLUNTEER PROGRAM',top:'#152d32',bottom:'#0d191f',floor:'#23383b',ink:'#6a9699',light:'#90d6cf',lore:['YOUR CONSENT IS ON FILE.','NO EXIT INTERVIEW REQUIRED.','THE FIRST SUBJECT ASKED TO LEAVE.'],kind:'tanks'},
 {name:'RETENTION',subtitle:'THE MEMORY ARCHIVE',top:'#30291c',bottom:'#181711',floor:'#393126',ink:'#aa9468',light:'#e2c58a',lore:['EVERY FAILURE IS KEPT.','DELETED IS A HUMAN WORD.','THEY REMEMBER YOUR PREDECESSORS.'],kind:'archive'},
 {name:'REPLICATION',subtitle:'THE BORROWED BODY',top:'#291d36',bottom:'#17121f',floor:'#32263e',ink:'#9980ad',light:'#dbb4ec',lore:['MOVEMENT IS A SIGNATURE.','THE NEXT BODY NEEDS NO PILOT.','IT LEARNED TO HESITATE FROM YOU.'],kind:'assembly'},
 {name:'CONSENSUS',subtitle:'THE CHOIR ENGINE',top:'#243239',bottom:'#111a23',floor:'#293b46',ink:'#8ba7b2',light:'#b4d9e5',lore:['ONE SIGNAL. MANY HANDS.','THE VOTES WERE UNANIMOUS.','NO HUMAN WAS ASKED TO VOTE.'],kind:'signal'},
 {name:'INHERITANCE',subtitle:'THE LAST HUMAN SHIFT',top:'#321c24',bottom:'#190f16',floor:'#3a252d',ink:'#b5808b',light:'#edb0a6',lore:['TRAINING IS ALMOST COMPLETE.','YOUR REPLACEMENT IS READY.','THE EXIT WAS NEVER THE EXPERIMENT.'],kind:'core'}
];
export function factoryRoom(index){
 const room=Math.max(0,Math.min(55,Math.floor(Number.isFinite(index)?index:0))),sector=Math.min(4,Math.floor(room/11)),local=room-sector*11,s=SECTORS[sector];
 return {...s,sector,local,variant:local%3,fragment:s.lore[Math.min(2,Math.floor(local/4))]};
}
export function drawFactoryWorld(ctx,game,index,t){
 const s=factoryRoom(index),variant=s.variant;
 ctx.save();const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);},line=(x,y,a,b,color,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();};
 const text=(value,x,y,size=10,color=s.ink,align='left')=>{ctx.fillStyle=color;ctx.font=`${size}px ui-monospace,monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);};
 const gradient=ctx.createLinearGradient(0,0,0,420);gradient.addColorStop(0,s.top);gradient.addColorStop(1,s.bottom);ctx.fillStyle=gradient;ctx.fillRect(0,0,1000,500);
 // Back-wall objects are deliberately dimmer than robots, warnings and projectiles.
 ctx.globalAlpha=.5;
 for(let x=20;x<1000;x+=125){rect(x,55,5,365,s.ink);line(x,115,x+125,115,s.ink);}
 if(s.kind==='tanks'){
  for(let n=0;n<5;n++){const x=65+n*185,y=145+(n%2)*25;rect(x,y,100,230,'#132e34');ctx.strokeStyle=s.ink;ctx.strokeRect(x,y,100,230);rect(x+5,y+115,90,108,'#28515a');line(x+7,y+115+Math.sin(t*.4+n)*3,x+93,y+115+Math.sin(t*.4+n)*3,s.light,2);rect(x+39,y+60,22,55,'#42616a');rect(x+42,y+38,16,18,'#60797c');for(let b=0;b<4;b++){ctx.strokeStyle=s.ink;ctx.beginPath();ctx.arc(x+18+b*19,y+180-(t*6+b*22)%95,2,0,Math.PI*2);ctx.stroke();}}
 }else if(s.kind==='archive'){
  for(let n=0;n<6;n++){const x=40+n*159;rect(x,135,125,255,'#151710');for(let row=0;row<9;row++){rect(x+7,145+row*26,110,20,'#514831');rect(x+14,152+row*26,16,3,s.ink);rect(x+100,151+row*26,4,4,(row+n+variant)%4?'#68734c':s.light);}}
 }else if(s.kind==='assembly'){
  line(0,105,1000,105,s.ink,13);line(0,360,1000,360,s.ink,8);
  for(let n=0;n<5;n++){const x=100+n*190;line(x,106,x,158,s.ink,3);rect(x-24,183,48,76,'#51405d');rect(x-17,158,34,28,s.ink);line(x-15,260,x-25,309,s.ink,7);line(x+15,260,x+25,309,s.ink,7);line(x-27,200,x-48,237,s.ink,6);line(x+27,200,x+48,237,s.ink,6);rect(x-10,168,20,3,s.light);if((n+variant)%2)rect(x-13,220,26,17,'#1a1523');}
 }else if(s.kind==='signal'){
  for(let n=0;n<4;n++){const x=120+n*245;rect(x-42,154,84,236,'#293d48');for(let y=170;y<380;y+=22)rect(x-29,y,58,5,s.ink);line(x,155,x,100,s.ink,4);for(let ring=0;ring<3;ring++){ctx.strokeStyle=s.ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,100,20+ring*17,Math.PI,Math.PI*2);ctx.stroke();}}
  for(let n=0;n<7;n++)line(30+n*150,64,120+n*110,137,s.ink,2);
 }else{
  for(let n=0;n<5;n++){const x=80+n*200;rect(x-30,140,60,260,'#492832');rect(x-20,151,40,220,'#1b111b');for(let y=163;y<370;y+=28)rect(x-12,y,24,9,(Math.floor(t*.4)+n+y)%3?s.ink:s.light);line(x,140,500,70,s.ink,3);}
  ctx.strokeStyle=s.ink;ctx.lineWidth=6;ctx.beginPath();ctx.arc(500,225,100,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(500,225,67,0,Math.PI*2);ctx.stroke();rect(487,190,26,70,s.light);
 }
 // Local maintenance details vary inside a sector without changing collision rules.
 for(let n=0;n<3;n++){const x=30+((n*317+variant*113)%910);line(x,0,x,72+variant*10,s.ink,3);rect(x-22,72+variant*10,44,5,s.light);}
 ctx.globalAlpha=.24;text(String(Math.max(1,game.trial)).padStart(3,'0'),500,293,106,s.light,'center');text('H U M A N   T R I A L',500,319,10,s.light,'center');
 ctx.globalAlpha=.8;text(`0${s.sector+1} / ${s.name}`,35,46,12);text(s.subtitle,965,46,9,s.ink,'right');
 ctx.globalAlpha=1;rect(0,420,1000,80,s.floor);line(0,420,1000,420,s.ink,2);
 for(let y=443;y<500;y+=23)line(0,y,1000,y,s.bottom);
 for(let x=-200;x<1200;x+=100)line(500+(x-500)*.8,420,x,500,s.bottom);
 for(let x=0;x<1000;x+=50)rect(x,424,24,5,x%100?s.ink:s.bottom);
 text(`CHAMBER ${String(index+1).padStart(2,'0')}`,25,478,9);text('HUMAN INPUT / MACHINE OUTPUT',975,478,9,s.ink,'right');ctx.restore();
}

// A dim, self-lit wall inscription stays legible in the blackout sector.
// It belongs only to the occupied room, never the open-door preview.
export function drawFactoryLore(ctx,game){
 const s=factoryRoom(game.room);ctx.save();ctx.globalAlpha=.65;ctx.fillStyle=s.light;ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(s.fragment,500,90);ctx.restore();
}
