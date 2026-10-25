import {trackBossAttack} from './boss-feedback.mjs';
import {structureHitFraction} from './objective-geometry.mjs';
export const laserRules=difficulty=>({hard:{charge:1.35,blast:.32,recharge:2.5,cooldown:9,damage:28},terminator:{charge:1.05,blast:.3,recharge:1.65,cooldown:6.5,damage:32}})[difficulty]??null;
export function laserContact(beam,entity){
 if(entity.structure)return structureHitFraction(entity,beam.x,beam.y,beam.x+beam.dx*1200,beam.y+beam.dy*1200)!==null;
 const y=entity.y-(entity.crouching?9:26),dx=entity.x-beam.x,dy=y-beam.y,along=dx*beam.dx+dy*beam.dy;
 return along>=-12&&along<=1200&&Math.abs(dx*beam.dy-dy*beam.dx)<(entity.crouching?16:25);
}
// Direction and muzzle lock at the start of the visible charge. No tracking beam.
export function updateSuperLaser(g,r,dt){
 const rules=laserRules(g.difficulty);if(!rules||!r.super)return false;
 const interrupted=r.hp<=0||['emp','radio','root','paralyzed','stun','confused','glueGround'].some(k=>r[k]>0);
 if(r.hp<=0||interrupted&&r.laser?.phase!=='recharge'){if(r.laser){r.laser=null;r.laserCd=rules.cooldown;r.windup=0;r.action='';}return false;}
 r.laserCd=Math.max(0,(r.laserCd??(5+r.cycle*.3))-dt);
 if(!r.laser){
  if(r.feedback?.motion||r.feedback?.attackPending||r.laserCd>0||r.combo||r.windup>0||r.moduleWindup>0)return false;
  const x=r.x,y=r.y-26,dx=g.player.x-x,dy=g.player.y-(g.player.crouching?9:26)-y,d=Math.hypot(dx,dy)||1;
  r.laser={phase:'charge',time:rules.charge,total:rules.charge,x,y,dx:d===1&&dx===0&&dy===0?r.facing:dx/d,dy:dy/d,hits:new Set()};r.combo=null;r.predictBlock=0;r.rollTime=0;r.crouching=false;
 }
 const beam=r.laser;beam.time=Math.max(0,beam.time-dt);
 if(beam.phase!=='recharge'){r.x=beam.x;r.y=beam.y+26;r.vy=0;r.facing=Math.sign(beam.dx)||r.facing;}
 if(beam.phase==='charge'){
  r.action='laser-charge';r.windup=beam.time;
  if(beam.time===0){beam.phase='blast';beam.time=rules.blast;beam.total=rules.blast;r.windup=0;r.laserShots=(r.laserShots??0)+1;beam.feedbackAttack=trackBossAttack(g,r,'laser',rules.blast+.05);}
 }
 if(beam.phase==='blast'){
  r.action='laser-blast';
  if(!beam.hits.has('human')&&laserContact(beam,g.player)){beam.hits.add('human');g.botHurt(r,rules.damage,beam.x,0,'charged core laser',false,beam.feedbackAttack);}
  for(const o of g.robots)if(o!==r&&o.hp>0&&!beam.hits.has(o.id)&&laserContact(beam,o)){beam.hits.add(o.id);g.friendlyDamage(r.id,o,o.structure?Math.max(180,o.maxHp*.25):40);}
  if(beam.time===0){beam.phase='recharge';beam.time=rules.recharge;beam.total=rules.recharge;r.disabled=true;r.action='laser-recharge';r.vy=160;r.cooldown=rules.recharge+.9;}
 }else if(beam.phase==='recharge'){
  r.action='laser-recharge';r.disabled=true;r.windup=0;r.vy=Math.max(130,r.vy);
  if(beam.time===0){r.laser=null;r.disabled=false;r.action='';r.cooldown=.9;r.comboCd=Math.max(1.1,r.comboCd??0);r.laserCd=rules.cooldown;}
 }
 return true;
}
export function drawSuperLaser(ctx,r){
 const b=r.laser;if(!b)return;ctx.save();const endX=b.x+b.dx*1200,endY=b.y+b.dy*1200;
 if(b.phase!=='recharge'){
  ctx.strokeStyle=b.phase==='charge'?'#ffbc75':'#fff3da';ctx.lineWidth=b.phase==='charge'?3:12;ctx.setLineDash(b.phase==='charge'?[12,9]:[]);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(endX,endY);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=b.phase==='charge'?'#ffbc75':'#ff6e5e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(b.x,b.y,15+(b.phase==='charge'?1-b.time/b.total:1)*18,0,Math.PI*2);ctx.stroke();
 }else{ctx.strokeStyle='#9ee6ee';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y-30,48,-Math.PI/2,-Math.PI/2+Math.PI*2*b.time/b.total);ctx.stroke();}
 ctx.fillStyle=b.phase==='recharge'?'#9ee6ee':'#ffbc75';ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(b.phase==='recharge'?'VENTING '+b.time.toFixed(1)+'s':'LASER '+(b.phase==='charge'?b.time.toFixed(1)+'s':''),r.x,r.y-116);ctx.restore();
}
