import {drawCharacterParts,DEFAULT_CHARACTER} from './character.mjs';
const C={sky:'#0c181e',wall:'#16303a',line:'#345561',human:'#d6c7a6',mint:'#b7e4c7',red:'#d58062',water:'#73c9e3',pale:'#dbe3cf'};
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function line(c,x,y,a,b,color,width=3){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();}
function label(c,text,x,y,size=14,color=C.line){c.fillStyle=color;c.font=`${size}px ui-monospace,monospace`;c.fillText(text,x,y);}
function person(c,x,y,{scale=1,walk=0,tool='',style=DEFAULT_CHARACTER,angle=0}={}){
 c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(angle);line(c,-6,-16,-8+walk,0,style.skin,6);line(c,6,-16,8-walk,0,style.skin,6);drawCharacterParts(c,{facing:1},style);line(c,12,-36,25,-28,style.skin,5);
 if(tool==='taser'){box(c,23,-33,21,9,C.water);box(c,28,-25,5,10,C.line);}
 if(tool==='sword')line(c,23,-29,52,-70,C.pale,5);
 if(tool==='lamp'){line(c,24,-30,52,-75,C.mint,5);line(c,40,-72,65,-82,C.mint,13);}
 if(tool==='sprayer'){box(c,-27,-31,15,24,C.water);line(c,-20,-32,-20,-45,C.water,4);}
 c.restore();
}
function bot(c,x,y,{scale=1,angle=0,shield=false,fallen=false,tools=false}={}){
 c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(fallen?Math.PI/2:angle);line(c,-13,-21,-16,0,C.line,12);line(c,13,-21,16,0,C.line,12);box(c,-23,-71,46,49,'#45636d');box(c,-18,-101,36,26,'#70888b');box(c,-14,-91,28,5,C.red);line(c,-24,-64,-38,-24,'#758783',9);line(c,24,-64,38,-24,'#758783',9);
 if(shield){box(c,-53,-70,27,68,'#40575c');line(c,-49,-66,-49,-8,C.red,3);}
 if(tools){line(c,-38,-27,-67,-76,C.pale,6);box(c,30,-37,22,30,C.water);line(c,40,-38,40,-49,C.water,5);line(c,40,-49,58,-49,C.water,5);}
 c.restore();
}
function facility(c,t,kind='hall'){
 box(c,0,0,1200,600,C.sky);box(c,0,100,1200,400,C.wall);
 for(let i=0;i<8;i++){const x=i*170;line(c,x,100,x,500,'#223e49',5);box(c,x+30,128,100,4,'#54716e');}
 box(c,0,500,1200,100,'#12262b');for(let i=0;i<9;i++)line(c,600,490,i*170-100,600,'#244149',2);
 line(c,0,498,1200,498,'#789089',4);line(c,0,550,1200,550,'#29444a',2);
 if(kind==='hall')for(let i=0;i<5;i++){const x=80+i*235;box(c,x,230,135,268,'#10242c');c.strokeStyle=C.line;c.lineWidth=3;c.strokeRect(x,230,135,268);label(c,String(3491+i),x+15,260,17);}
 for(let i=0;i<3;i++){const x=150+i*420;box(c,x,98,70,11,'#a7c6bd');c.save();c.globalAlpha=.055;c.fillStyle=C.pale;c.beginPath();c.moveTo(x,110);c.lineTo(x-120,500);c.lineTo(x+220,500);c.lineTo(x+70,110);c.fill();c.restore();}
 // A camera lens follows a bounded arc instead of presenting human-facing charts.
 c.save();c.translate(1060,170);c.rotate(Math.sin(t*.4)*.1);box(c,-20,-10,40,20,C.line);box(c,-25,-6,7,12,C.red);c.restore();
}
function world(c,t,servers=false){
 const sky=c.createLinearGradient(0,0,0,600);sky.addColorStop(0,'#122a35');sky.addColorStop(1,'#534c3d');c.fillStyle=sky;c.fillRect(0,0,1200,600);
 c.fillStyle='#c2ad7b';c.beginPath();c.arc(905,120,55,0,Math.PI*2);c.fill();
 c.fillStyle='#243a40';c.beginPath();c.moveTo(0,310);for(let i=0;i<13;i++)c.lineTo(i*100,220+(i*71)%100);c.lineTo(1200,600);c.lineTo(0,600);c.fill();
 for(let i=0;i<11;i++){const x=i*125-20;box(c,x,270+(i*53)%80,90,230,'#152b34');for(let k=0;k<4;k++)box(c,x+14,300+k*35,18,5,k%2?'#637872':'#6e644e');}
 box(c,0,490,1200,110,'#172a2d');box(c,0,510,1200,45,'#31403c');for(let i=0;i<12;i++)box(c,i*120,531,55,3,'#9b9871');
 for(let i=0;i<3;i++){const x=80+i*480;line(c,x,250,x,490,'#142930',7);line(c,x-60,270,x+60,270,'#142930',5);c.strokeStyle='#314b4c';c.beginPath();c.moveTo(x,280);c.quadraticCurveTo(x+240,350,x+480,280);c.stroke();}
 if(servers){box(c,280,215,660,285,'#18313a');box(c,275,210,670,20,'#677f7b');for(let i=0;i<9;i++){box(c,300+i*70,250,52,225,'#0c1e27');for(let j=0;j<9;j++){box(c,307+i*70,260+j*23,36,8,'#274954');box(c,337+i*70,262+j*23,4,4,(i+j)%3?'#87ada4':C.red);}}}
}
function pool(c,x,w,t){c.save();c.globalAlpha=.55;box(c,x,496,w,7,C.water);c.globalAlpha=.8;for(let i=0;i<8;i++)box(c,x+i*w/8,498+Math.sin(i+t)*2,w/12,2,C.water);c.restore();}
function bolt(c,x,y,a,b,t){c.save();c.shadowColor=C.water;c.shadowBlur=14;c.strokeStyle=C.water;c.lineWidth=4;c.beginPath();c.moveTo(x,y);for(let i=1;i<=12;i++)c.lineTo(x+(a-x)*i/12,y+(b-y)*i/12+(i%2?9:-9)*Math.sin(i+t*7));c.stroke();c.restore();}
function cell(c,t,style,task='desk',occupied=true){
 facility(c,t);box(c,330,185,540,315,'#14282f');c.strokeStyle=C.line;c.lineWidth=4;c.strokeRect(330,185,540,315);label(c,'HUMAN RETENTION / 3491',370,225,16,'#6f8d88');
 if(task==='desk'){box(c,510,380,200,13,'#6a7464');line(c,525,392,525,498,'#6a7464',8);line(c,695,392,695,498,'#6a7464',8);if(occupied){person(c,480,500,{scale:1.5,style});line(c,510,450,540+Math.sin(t*3)*5,371,C.human,6);}box(c,547,365,60,4,C.pale);}
 else {person(c,500,500,{scale:1.5,style});box(c,540,402,165,12,'#6a7464');for(let i=0;i<4;i++)box(c,560+i*15,380-i*8,75-i*5,15,['#6b8583','#8e9d86'][i%2]);line(c,520,449,590+Math.sin(t*2)*8,380,C.human,6);}
 box(c,750,320,80,180,'#304a4f');for(let i=0;i<3;i++)box(c,760,330+i*48,60,2,C.line);
 // Observation dots are machine sensors, not a live analytics dashboard.
 for(let i=0;i<4;i++)box(c,355+i*155,192,5,5,C.red);
}
export function drawIntroScene(c,id,t,{style=DEFAULT_CHARACTER,reduced=false}={}){
 t=reduced?1:Math.max(0,t);c.save();c.imageSmoothingEnabled=false;
 if(['war','infrastructure','learning'].includes(id)){
  world(c,t,id==='infrastructure');
  if(id==='war'){for(let i=0;i<6;i++)bot(c,620+i*100,500,{scale:.9+i*.035});for(let i=0;i<4;i++)person(c,60+i*68,500,{scale:1.2,tool:'taser',style});for(let i=0;i<4;i++){const x=320+(i*177+t*140)%580;line(c,x,400-i*18,x+25,400-i*18,C.red,3);}}
  if(id==='infrastructure'){for(let i=0;i<4;i++)bot(c,190+i*280,500,{shield:i%2===0});line(c,965,100,965,500,'#10252e',10);line(c,965,105,1090,175,C.line,10);line(c,1090,175,1090,295,C.line,5);box(c,1065,295,50,25,C.line);label(c,'COOLANT INTAKE',350,478,15,'#7ca6a4');}
  if(id==='learning'){person(c,200,500,{scale:1.5,tool:'sword',style});for(let i=0;i<3;i++)bot(c,350+i*95,486,{fallen:true,scale:.8});for(let i=0;i<9;i++)bot(c,650+i%5*110,500-Math.floor(i/5)*110,{scale:i>4?.68:1,shield:i%3===0});label(c,'',0,0);}
 }else if(id==='capture'){
  world(c,t);box(c,240,260,730,230,'#213e49');box(c,300,295,590,140,'#13252d');for(let i=0;i<5;i++){person(c,350+i*110,432,{scale:1.25,style});box(c,320+i*110,280,7,170,C.line);label(c,String(3491+i),330+i*110,315,15,'#91a8a0');}for(let i=0;i<4;i++){c.fillStyle='#0a1c24';c.beginPath();c.arc(335+i*170,490,40,0,Math.PI*2);c.fill();}bot(c,1050,505,{scale:1.7});
 }else if(id==='routine'){cell(c,t,style,Math.floor(t/4)%2?'fold':'desk');
 }else if(id==='trials'){
  facility(c,t,'trial');for(let i=0;i<3;i++){const x=240+i*350;box(c,x+110,315,35,180,'#52666a');box(c,x+90,290,75,35,'#80908a');person(c,x,500,{scale:1.5,tool:['sword','sprayer','taser'][i],style});}pool(c,545,190,t);bolt(c,975,455,1050,360,t);
 }else if(['leak','discharge','wires'].includes(id)){
  facility(c,t,'trial');const action=id==='discharge',cut=id==='wires';person(c,cut?725:270,500,{scale:2,tool:cut?'sword':'taser',style});bot(c,875,cut?468:500,{scale:2,tools:!cut,fallen:cut,angle:action?Math.sin(t*15)*.015:0});pool(c,430,550,t);
  if(id==='leak')for(let i=0;i<5;i++){const y=403+(i*31+t*55)%94;box(c,950,y,4,8,C.water);}if(action){bolt(c,355,439,440,495,t);bolt(c,440,495,885,490,t);bolt(c,850,480,880,330,t);box(c,856,300,39,9,'#a5e8e2');}
  if(cut){for(let i=0;i<6;i++)line(c,860+i*11,440,835+i*16,450+(i%2)*23,i%2?C.red:C.water,3);box(c,670,468,25,30,C.water);line(c,798,382,850,430,C.pale,7);}
 }else if(id==='lamp'){
  cell(c,t,style,'desk',false);person(c,710,500,{scale:1.8,tool:t>=2?'lamp':'',style});if(t<2){line(c,610,377,610,330,C.mint,6);box(c,589,320,49,15,C.mint);box(c,596,377,27,4,C.mint);}
 }else{
  facility(c,t);const walk=reduced?0:Math.sin(t*7)*5;person(c,440+Math.min(t*13,180),500,{scale:2,walk,tool:'lamp',style});box(c,1020,180,130,320,'#25483d');box(c,1040,200,90,298,'#0a181b');label(c,'SERVICE ACCESS',975,156,18,C.mint);bot(c,1115,330,{scale:.6});
 }
 // Static grain and letterbox framing keep fades gentle, without white flashes.
 c.globalAlpha=.055;for(let i=0;i<100;i++)box(c,(i*197)%1200,(i*101)%600,2,2,C.pale);c.globalAlpha=1;box(c,0,0,1200,26,'#091216');box(c,0,574,1200,26,'#091216');c.restore();
}
export function drawIntro(c,state,style,reduced=false){
 const scene=state.scene,fade=reduced?1:Math.min(1,state.elapsed/.7);drawIntroScene(c,scene.id,state.elapsed,{style,reduced});if(state.previous&&fade<1){c.save();c.globalAlpha=1-fade;drawIntroScene(c,state.previous.id,3,{style,reduced});c.restore();}
}
