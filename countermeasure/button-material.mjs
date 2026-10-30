// The final ceramic jacket occupies the first quarter of the existing armor HP.
// It adds a material gate without increasing the four-clean-laser bait budget.
export function equipButtonMaterial(r,cycle){
 if(r.type!=='buttonGuard')return;
 r.layeredCase=cycle===4;r.corrosionRate=cycle===4?.2:cycle>=5?.05:0;
 r.coatingMax=cycle>=5?r.maxHp*.25:0;r.coating=r.coatingMax;
}
export function buttonCorrosionDamage(r,tickDamage){
 if(r.type!=='buttonGuard'||!r.corrosionRate)return tickDamage;
 if(r.coating>0)return 0;
 const interval=r.corrosionTier>=2?.25:.65,tier=r.corrosionTier>=2?1:.5;
 return Math.max(tickDamage,(r.maxHp-r.coatingMax)*r.corrosionRate*tier*interval);
}
// Unknown damage sources (including enemy lasers) retain the original HP budget.
export function buttonMaterialDamage(r,damage,{corrosive=false,damageType,tier=0}={}){
 if(!r.layeredCase||r.type!=='buttonGuard')return damage;
 const shell=r.hp>r.maxHp*.5,acid=corrosive||damageType==='water'&&tier>0;
 if(acid){if(!shell)return damage*.025;return Math.min(damage*(corrosive?1:4),r.hp-r.maxHp*.5);}
 if(damageType==='impact')return shell?damage*.4:damage*12;
 return damageType?damage*.45:damage;
}
export function drawButtonMaterial(ctx,r,t){
 if(r.layeredCase){
  const shell=r.hp>r.maxHp*.5;ctx.strokeStyle=shell?'#b4dc78':'#e9b66e';ctx.lineWidth=shell?5:9;ctx.strokeRect(-86,-132,172,194);
  ctx.fillStyle=ctx.strokeStyle;ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(shell?'ACID SHELL':'IMPACT FRAME',0,-106);
  for(let i=0;i<5;i++){if(shell){ctx.beginPath();ctx.arc(-64+i*32,-75+Math.sin(t+i)*4,4,0,Math.PI*2);ctx.fill();}else{ctx.beginPath();ctx.moveTo(-70+i*32,-75);ctx.lineTo(-61+i*32,-20);ctx.lineTo(-70+i*32,35);ctx.stroke();}}
  ctx.fillStyle='#30444a';ctx.fillRect(-66,46,132,6);ctx.fillStyle=shell?'#b4dc78':'#e9b66e';ctx.fillRect(-66,46,132*(shell?(r.hp/r.maxHp-.5)*2:r.hp/r.maxHp*2),6);return;
 }
 if(r.coating>0){
  ctx.fillStyle='#c9c2ac';ctx.fillRect(-92,-139,184,184);ctx.strokeStyle='#eee3bd';ctx.lineWidth=3;ctx.strokeRect(-92,-139,184,208);
  ctx.strokeStyle='#807b70';ctx.lineWidth=6;
  for(let x=-74;x<90;x+=36){ctx.beginPath();ctx.moveTo(x,-132);ctx.lineTo(x-16,40);ctx.stroke();}
  ctx.fillStyle='#142a32';ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('CERAMIC JACKET',0,-102);ctx.fillText('BREAK TO EXPOSE',0,-83);
  ctx.fillStyle='#374951';ctx.fillRect(-65,13,130,5);ctx.fillStyle='#eee3bd';ctx.fillRect(-65,13,130*r.coating/r.coatingMax,5);
 }else if(r.corrosionRate){
  ctx.strokeStyle=r.corrosion>0?'#d1ee83':'#87a67e';ctx.lineWidth=3;ctx.strokeRect(-86,-132,172,194);
  if(r.corrosion>0){ctx.fillStyle='#b4dc78';for(let i=0;i<12;i++){const x=-78+(i*37)%156,y=-124+(i*53+t*18)%172;ctx.fillRect(x,y,5,5);}}
 }
}
