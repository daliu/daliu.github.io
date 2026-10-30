// Free visual presets. No combat values or character entitlements belong here.
export const COSTUMES=[
 {id:'standard',name:'Custom survivor',detail:'Choose your own parts and colors.'},
 {id:'mom',name:'Asian Mom',detail:'The robots have not finished their homework.',style:{head:'bun',body:'apron',feet:'trainers',coat:'#b67485',trim:'#ded6bd',skin:'#d8b58f',shoe:'#617d87',costume:'mom'}},
 {id:'janitor',name:'Night Janitor',detail:'Someone has to clean up this model.',style:{head:'cap',body:'coveralls',feet:'boots',coat:'#568d89',trim:'#e7c576',skin:'#bb896b',shoe:'#273e45',costume:'janitor'}},
 {id:'office',name:'Middle Management',detail:'Your termination requires three signatures.',style:{head:'combover',body:'shirt',feet:'trainers',coat:'#e7e0c8',trim:'#9f584d',skin:'#cfa28e',shoe:'#464059',costume:'office'}}
];
const NAMES={mom:[['Ruler','Frying pan','Wok','Industrial wok'],['Belt','Studded belt','Reinforced belt','Conveyor belt']],janitor:[['Plunger','Mop','Floor buffer','Street sweeper'],['Paint scraper','Tile scraper','Rotary scrubber','Diamond scrubber']],office:[['Clipboard','Stapler','Printer','Photocopier'],['Letter opener','Paper cutter','Paper shredder','Diamond shredder']]};
export const costumePreset=id=>COSTUMES.find(c=>c.id===id)??COSTUMES[0];
export const costumeWeaponName=(style,index,tier,fallback)=>NAMES[style?.costume]?.[index]?.[Math.max(0,Math.min(3,tier))]??fallback;
export function drawCostumeWeapon(ctx,style,index,tier,x=0,y=0,dir=1,t=0){
 const theme=style?.costume;if(!NAMES[theme]?.[index])return false;
 ctx.save();ctx.translate(x,y);ctx.scale(dir,1);ctx.lineCap='round';
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 const line=(x,y,x2,y2,c,w=3)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();};
 const oval=(x,y,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
 if(theme==='mom'){
  if(index===1){ctx.strokeStyle=tier>1?'#d8ae7d':'#a26e50';ctx.lineWidth=5+tier;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(18,-18-Math.sin(t*8)*3,38,-8);ctx.stroke();box(1,-4,8,8,'#d8c080');box(3,-2,4,4,'#5b463a');if(tier>0)for(let i=0;i<4;i++)box(14+i*6,-10-i%2*2,2,2,'#e3d2ad');}
  else if(tier===0){box(0,-7,37,10,'#e9c479');for(let i=4;i<36;i+=5)line(i,-6,i,-2,'#725533',1);}
  else{const size=tier===3?19:tier===2?16:12;line(0,0,20,-5,'#bd9267',6);oval(28,-9,size,tier>1?size*.65:size,'#b3c1ba');oval(28,-9,size-3,tier>1?(size-3)*.65:size-3,'#33474c');if(tier>=2){line(28-size,-12,28-size-5,-18,'#b3c1ba',3);line(28+size,-12,28+size+5,-18,'#b3c1ba',3);}line(23,-14,30,-17,'#70877d',2);}
 }else if(theme==='janitor'){
  line(0,3,29,-22,'#c5a476',4);
  if(index===1){box(22,-27,17,13,tier>1?'#c0dfd5':'#b1bbb6');for(let n=0;n<5;n++)line(24+n*3,-15,25+n*3,-11,tier>1?'#dcf6de':'#7a9091',1);}
  else if(tier===0){oval(29,-21,12,8,'#c17c67');box(16,-18,26,4,'#d69b80');}
  else if(tier===1){for(let n=0;n<7;n++)line(21+n*3,-27,23+n*3,-12,'#c9ddd2',2);box(21,-27,20,4,'#74989c');}
  else{oval(29,-17,19,12,'#abc9b1');box(14,-29,29,14,'#71998f');box(21,-31,16,5,'#dbc17c');for(let n=0;n<4;n++)line(18+n*6,-7,20+n*6,-2,'#d6e1c7',2);}
 }else{
  if(index===1&&tier<2){line(1,1,30,-22,'#dbd8be',tier===0?3:7);line(6,-8,17,4,'#a88965',3);}
  else if(index===0&&tier===0){box(3,-23,28,35,'#a18565');box(6,-20,22,28,'#ede5ce');box(11,-26,12,6,'#8caba3');for(let n=0;n<4;n++)line(9,-12+n*5,24,-12+n*5,'#9dada0',1);}
  else if(index===0&&tier===1){box(2,-9,35,7,'#49696b');line(2,-12,34,-19,'#bc8e74',7);box(28,-17,8,5,'#91b4af');}
  else{box(2,-24,37,32,'#b0bdb0');box(6,-18,29,16,'#516b69');box(10,-33,22,12,'#f2e9cf');box(11,1,21,12,'#eee3c7');box(28,-19,4,4,'#add891');if(index===1)for(let n=0;n<4;n++)line(13+n*5,-3,14+n*5,7,'#c5e4d9',2);}
 }
 ctx.restore();return true;
}
