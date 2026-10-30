import {TYPES,weaponAt} from './engine.mjs';
import {bodyZone,CRITICAL_MULTIPLIER} from './difficulty.mjs';
TYPES.trialPilot={name:'The other survivor',color:'#dfc5a1',hp:100,speed:640,resistance:{},flaw:'Human. Fragile, fast; persistent slows reduce the tempo.',behavior:'pilot'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function revealPilot(g){
 const wreck=g.robots.find(r=>r.super);g.finalPilot={phase:'choice',age:0,x:clamp(wreck?.x??700,150,850),y:340,vy:-180};
 g.state='pilot-choice';g.bossSupport=null;g.synchronized=false;g.command=null;g.emergency=null;g.shots=[];g.pools=[];g.ordnance=[];g.glueBombs=[];g.gearShots=[];g.boostTime=0;g.player.drilling=0;g.cancelCharge();
 const gain=Math.min(g.armorCapacity-g.player.mechaShield,Math.round(g.armorCapacity*.25));g.player.mechaShield+=gain;
 g.effects.push({kind:'mech-break',x:g.finalPilot.x,y:390,life:1,max:1,color:'#ffbc75',range:150});
 g.event('PILOT EJECTED / +'+gain+' SALVAGED ARMOR','#dfc5a1');
}
export function slowPilot(r,amount,duration){
 if(!r?.humanPilot||r.hp<=0)return false;r.pilotSlows??=[];
 // A repeated source extends its own effect instead of allocating unbounded stacks.
 const existing=r.pilotSlows.find(s=>s.amount===amount);if(existing)existing.left=Math.max(existing.left,duration);else if(r.pilotSlows.length<8)r.pilotSlows.push({amount,left:duration});
 r.pilotSlow=Math.min(.5,r.pilotSlows.reduce((n,s)=>n+s.amount,0));return true;
}
export function choosePilot(g,mercy){
 if(g.state!=='pilot-choice'||!g.finalPilot||g.finalPilot.age<1||typeof mercy!=='boolean')return false;
 const betray=mercy&&(g.difficulty==='terminator'||g.random()<.05),npc=g.finalPilot;
 g.state='playing';npc.mercy=mercy;
 if(mercy&&!betray){npc.phase='spared';g.pilotOutcome='spared';g.event('THEN WE LEAVE TOGETHER.','#9ce5e3');g.finishWave();return true;}
 const r=g.spawn('trialPilot',0);Object.assign(r,{humanPilot:true,x:npc.x,y:420,vy:0,hp:g.difficulty==='terminator'?110:85,maxHp:g.difficulty==='terminator'?110:85,pilotSlows:[],pilotSlow:0,pilotCd:.6,pilotTell:0,pilotEvade:g.difficulty==='terminator'?.75:.3});
 g.robots=[r];npc.phase='hostile';g.player.invulnerable=Math.max(g.player.invulnerable,1);g.event(betray?'MERCY IS A PREDICTABLE INPUT.':'THEN FINISH THE TRIAL.','#ef9b8d');return true;
}
export function pilotEvasion(g,r){
 if(g.random()>=r.pilotEvade)return false;
 g.effects.push({kind:'evasion',attackKind:'human',x:r.x,y:r.y-28,dir:r.facing,life:.2,max:.2,color:'#dfc5a1'});return true;
}
export function hitPilot(g,r,index,scale){
 const w=weaponAt(index,g.weaponTiers[index]),zone=bodyZone(g.player,r),critical=g.random()<.1+(g.player.dashCrit>0?.24:0),before=r.hp;
 const damage=w.damage*scale*(1+(index<2?.16*g.skills.force:.2*g.skills.voltage))*(g.player.mecha?1.65:1)*(critical?CRITICAL_MULTIPLIER[zone]:1);
 const previousZone=r.lastCritical;if(critical)r.lastCritical=zone;
 g.damageRobot(r,damage,{color:w.color,number:true,critical});
 if(r.hp>=before){r.lastCritical=previousZone;return;}if(critical)r.criticalFlash=.4;
 if(r.hp<before){g.stats.hits[index]++;g.stats.damage[index]+=before-Math.max(0,r.hp);if(critical)g.stats.criticals[zone]++;slowPilot(r,index===3?.18:index===2?.1:.05,index===3?3:1.5);}
}
export function updatePilotCombat(g,r,dt){
 for(const s of r.pilotSlows)s.left-=dt;r.pilotSlows=r.pilotSlows.filter(s=>s.left>0);r.pilotSlow=Math.min(.5,r.pilotSlows.reduce((n,s)=>n+s.amount,0));
 for(const k of ['emp','radio','root','paralyzed','stun','confused','glueGround'])r[k]=0;r.crippled=false;
 const p=g.player,pace=1-r.pilotSlow,dir=Math.sign(p.x-r.x)||r.facing,dist=Math.abs(p.x-r.x),term=g.difficulty==='terminator';r.facing=dir;
 const speed=320*(1+.1*g.skills.agility)*(p.mecha?1.15:1)*(term?2:1.4)*pace;
 if(dist>95)r.x=clamp(r.x+dir*speed*dt,28,972);else if(dist<45)r.x=clamp(r.x-dir*speed*.6*dt,28,972);
 if(p.y<335&&r.y>=414){r.vy=-720;r.grounded=false;}
 // Keep the tell inside the cycle and retain overshoot, rather than adding a second cooldown.
 const interval=g.activeWeapon.cooldown/(term?2:1.4);r.pilotCd-=dt*pace;
 r.pilotTell=r.pilotCd>0&&r.pilotCd<=Math.min(.25,interval*.7)?r.pilotCd:0;r.action=r.pilotTell>0?'pilot-aim':'pilot-recover';
 if(r.pilotCd<=0){
  const dx=p.x-r.x,dy=p.y-23-(r.y-26),len=Math.hypot(dx,dy)||1;
  g.shots.push({kind:'pilot-shot',x:r.x,y:r.y-26,vx:dx/len*540,vy:dy/len*540,gravity:.00001,life:2,owner:r.id,ownerX:r.x,damage:term?18:12,critical:g.random()<.25});
  g.effects.push({kind:'attack',x:r.x,y:r.y-22,dir:r.facing,range:105,weapon:1,life:.12,max:.12,color:'#dfc5a1'});
  if(Math.hypot(dx,dy)<105)g.hurt(term?18:12,r.x,0,'survivor counterattack');
  r.pilotCd+=interval;
 }
 return true;
}
export function updatePilotScene(g,dt){
 const npc=g.finalPilot;if(!npc)return;
 if(g.state==='pilot-choice'){g.clock+=dt;npc.age+=dt;npc.vy+=800*dt;npc.y=Math.min(420,npc.y+npc.vy*dt);for(const e of g.effects)e.life-=dt;g.effects=g.effects.filter(e=>e.life>0);}
 else if(npc.phase==='spared'&&['traveling','playing','escaping','complete'].includes(g.state)){npc.x+=clamp(g.player.x-g.player.facing*65-npc.x,-290*dt,290*dt);npc.y=420;}
}
export function drawFinalPilot(ctx,g,t){
 const npc=g.finalPilot;if(!npc)return;const hostile=g.robots.find(r=>r.humanPilot&&r.hp>0);
 if(npc.phase==='defeated'||npc.phase==='hostile'&&!hostile)return;
 const a=hostile??npc;ctx.save();ctx.translate(a.x,a.y);ctx.fillStyle='#dfc5a1';ctx.beginPath();ctx.arc(0,-54,8,0,Math.PI*2);ctx.fill();ctx.fillStyle=hostile?'#b86f66':'#829c9b';ctx.fillRect(-10,-43,20,27);ctx.strokeStyle='#dfc5a1';ctx.lineWidth=5;const stride=hostile?Math.sin(t*30)*8:0;ctx.beginPath();ctx.moveTo(-5,-16);ctx.lineTo(-8+stride,0);ctx.moveTo(5,-16);ctx.lineTo(8-stride,0);ctx.stroke();
 if(hostile){ctx.fillStyle='#f4d194';ctx.fillRect(a.facing>0?8:-28,-34,20,5);if(a.pilotTell>0){ctx.strokeStyle='#ffb594';ctx.strokeRect(-25,-75,50,79);}if(a.pilotSlow>0){ctx.fillStyle='#dab9f2';ctx.fillRect(-20,8,40*a.pilotSlow/.5,4);}}
 ctx.restore();
}
