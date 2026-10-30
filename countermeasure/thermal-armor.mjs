// Material failure is separate from electrical stun and boss shutdown channels.
export const combustibleArmor=r=>!r.structure&&!r.super&&r.type!=='mirror'&&(!!r.shell||['insulated','sealed','plasticDrone'].includes(r.type)||['polymer','plastic','wood'].includes(r.armorMaterial));
export function igniteArmor(r){
 if(!combustibleArmor(r))return false;
 r.burning=5;r.burnTick??=0;r.burnPulse??=0;r.shell=false;r.exposed=Math.max(r.exposed??0,8);return true;
}
export function updateBurning(g,r,dt){
 r.burnMalfunction=Math.max(0,(r.burnMalfunction??0)-dt);if(!(r.burning>0)||r.hp<=0)return;
 r.burning=Math.max(0,r.burning-dt);r.burnTick=(r.burnTick??0)+dt;r.burnPulse=(r.burnPulse??0)+dt;
 if(r.burnPulse>=1){r.burnPulse-=1;r.burnMalfunction=.45;r.windup=0;r.action='';r.combo=null;}
 while(r.burnTick>=.25&&r.hp>0){r.burnTick-=.25;g.damageRobot(r,Math.min(30,9+r.maxHp*.035)*.25,{color:'#ffaf65',burnTick:true});}
}
export function drawBurning(ctx,g,t){
 for(const r of g.robots)if(r.hp>0&&r.burning>0){ctx.save();ctx.translate(r.x,r.y);ctx.globalAlpha=.8;for(let i=0;i<5;i++){const x=-18+i*9,y=-12-(i%3)*11,h=15+Math.sin(t*22+i*3)*7;ctx.fillStyle=i%2?'#ffe699':'#ff914d';ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+Math.sin(t*14+i)*4,y-h);ctx.lineTo(x+6,y);ctx.fill();}if(r.burnMalfunction>0){ctx.strokeStyle='#fff0ad';ctx.lineWidth=2;ctx.strokeRect(-23,-70,46,65);}ctx.restore();}
}
