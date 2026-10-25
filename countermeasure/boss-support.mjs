// A short local observation window, not instant reactions to individual inputs.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const SUPPORT_ICONS={crouch:'↓',air:'↑',camp:'⌖',mixed:'+'};
export function supportRules(difficulty,cycle=1){
 const [observe,interval,batch,cap,extra]=({easy:[6.5,13,1,2,-1],normal:[5,11,1,3,0],hard:[4.5,10,2,4,2],terminator:[4,9,2,5,4]})[difficulty]??[5,11,1,3,0];
 return {observe,interval,batch,cap:Math.min(6,cap+(cycle>=4?1:0)),budget:Math.min(16,2+cycle*2+extra),warning:1.8};
}
export function createBossSupport(g){return {rules:supportRules(g.difficulty,Math.ceil(g.wave/10)),samples:[],sampleClock:0,elapsed:0,cooldown:0,spent:0,warning:null,history:[]};}
export function observedHabit(samples){
 const duration=samples.length*.25;if(!samples.length)return null;
 const crouch=samples.filter(s=>s.crouch).length/samples.length,air=samples.filter(s=>s.air).length/samples.length;
 // A dense patch catches hovering and small circles, not just zero horizontal velocity.
 let density=0;for(const p of samples)density=Math.max(density,samples.filter(s=>Math.hypot(s.x-p.x,(s.y-p.y)*1.1)<72).length/samples.length);
 if(crouch>=.6)return {reason:'crouch',strength:crouch,duration};
 if(density>=.72)return {reason:'camp',strength:density,duration};
 if(air>=.65)return {reason:'air',strength:air,duration};
 return null;
}
function bosses(g){return g.robots.filter(r=>r.hp>0&&(r.type==='mirror'||r.super));}
function budgetLeft(g,d){return Math.min(d.rules.budget-d.spent,d.rules.cap-g.robots.filter(r=>r.hp>0&&r.supportReason).length,10-g.robots.filter(r=>r.hp>0&&!r.structure).length);}
export function updateBossSupport(g,dt,input={}){
 const d=g.bossSupport;if(!d||g.state!=='playing')return;const alive=bosses(g);
 if(!alive.length){d.warning=null;return;}
 // Objective EMPs and radio shutdowns remain real windows of relief.
 if(alive.every(r=>r.objectiveReboot>0||r.emp>0||r.radio>0))return;
 d.elapsed+=dt;d.cooldown=Math.max(0,d.cooldown-dt);d.sampleClock+=dt;
 if(d.sampleClock>=.25){d.sampleClock-=.25;const p=g.player;d.samples.push({x:p.x,y:p.y,crouch:p.grounded&&!!input.down&&!(p.rollTime>0),air:!p.grounded&&p.y<365});if(d.samples.length>32)d.samples.shift();d.observed=observedHabit(d.samples);}
 const w=d.warning;if(w){w.remaining-=dt;if(w.remaining>0)return;const available=budgetLeft(g,d);if(available<=0){d.warning=null;d.cooldown=2;return;}
  for(const [i,type] of w.units.slice(0,available).entries()){
   const r=g.spawn(type,g.spawnSequence++);r.supportReason=w.reason;r.x=w.xs[i];r.y=w.side==='air'?110:420;r.hoverY=r.y;r.vy=0;r.cooldown=1.5+i*.3;r.specialCd=2;r.facing=Math.sign(g.player.x-r.x)||-1;
   // Support has the current generation's tools but is lighter than the main squad.
   r.hp*=.65;r.maxHp=r.hp;g.robots.push(r);d.spent++;
  }
  d.history.push({reason:w.reason,at:d.elapsed,units:w.units.slice(0,available)});d.history=d.history.slice(-16);d.warning=null;d.cooldown=d.rules.interval;return;
 }
 if(d.elapsed<d.rules.observe||d.samples.length*.25<d.rules.observe||d.cooldown>0||budgetLeft(g,d)<=0)return;
 const habit=d.observed,lateBackup=g.wave>=40&&g.encounter!=='boss';if(!habit&&!lateBackup)return;
 const reason=habit?.reason??'mixed',number=Math.min(d.rules.batch,budgetLeft(g,d)),units=[];
 for(let i=0;i<number;i++)units.push(reason==='air'?(i?'flyer':'metalDrone'):reason==='camp'?'bombardier':reason==='crouch'?(g.wave>=20&&(d.spent+i)%2?'shocker':'lancer'):'gunner');
 const side=reason==='air'?'air':g.player.x<500?'right':'left',gate=g.player.x<500?860:140,xs=units.map((_,i)=>clamp(gate+(side==='left'?i*55:-i*55),60,940));
 d.warning={reason,units,side,xs,remaining:d.rules.warning,total:d.rules.warning};
}
// Adaptive artillery can burst at a committed airborne target as well as the floor.
export function updateSupportArtillery(g,r,dt){
 if(r.supportReason!=='camp'||r.type!=='bombardier')return false;
 const refresh=r.sense<=dt;g.senseRobot(r,dt);if(refresh||r.targetAimY===undefined)r.targetAimY=g.player.y-(g.player.crouching?9:23);
 if(r.windup>0){r.windup-=dt;if(r.windup<=0){
  const target=r.airburstMark,unsafe=r.cognition.discipline&&g.robots.some(o=>o!==r&&o.hp>0&&Math.hypot(o.x-target.x,o.y-23-target.y)<85);
  if(!unsafe&&g.shots.length<96){const flight=Math.max(.72,1.15-(r.generation-1)*.07),gravity=1000+(r.generation-1)*450,start=r.y-50;g.shots.push({kind:'mortar',airburst:true,burstTime:flight,targetX:target.x,targetY:target.y,x:r.x,y:start,vx:(target.x-r.x)/flight,vy:(target.y-start-.5*gravity*flight*flight)/flight,gravity,life:3,owner:r.id,ownerX:r.x,critical:g.random()<r.cognition.crit});}
  r.airburstMark=null;r.action='';r.cooldown=unsafe?.4:3.2/(1+(r.generation-1)*.15);
 }return true;}
 const dx=r.targetX-r.x;if(Math.abs(dx)<240)r.x=clamp(r.x-Math.sign(dx)*45*r.cognition.speed*dt,30,970);
 if(r.cooldown<=0){r.airburstMark={x:clamp(r.targetX,35,965),y:clamp(r.targetAimY,65,411)};r.windup=Math.max(.6,.95*r.cognition.windup);r.action='airburst';}
 return true;
}
