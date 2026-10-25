import {TYPES} from './engine.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const enemyGeneration=wave=>clamp(1+Math.floor((wave-1)/10),1,5);
export function generationProfile(wave){const level=enemyGeneration(wave),n=level-1;return {level,n,speed:1+n*.075,health:1+n*.07,attack:1+n*.13,projectile:260+n*75,windup:Math.max(.62,1-n*.08),aftermath:2+n*1.25};}
export function equipGeneration(g,r){
 const u=generationProfile(g.wave);r.upgrade=u;r.generation=u.level;if(r.structure||['mirror','overseer'].includes(r.type))return;
 r.hp*=u.health;r.maxHp=r.hp;r.roleClock=0;r.specialCd=2.8;r.burst=0;
 if(r.type==='guard'&&u.n){r.fullArmor=true;r.shield=r.maxShield=100+u.n*35;}
}
const stopped=r=>r.hp<=0||r.emp>0||r.radio>0||r.root>0||r.confused>0||r.stun>0||r.paralyzed>0;
function shot(g,r,s){if(g.shots.length<96)g.shots.push({owner:r.id,ownerX:r.x,life:3,critical:g.random()<r.cognition.crit,...s});}
function laneBlocked(g,r,tx,y){return g.robots.some(o=>o!==r&&o.hp>0&&!o.structure&&(o.x-r.x)*(tx-r.x)>0&&Math.abs(o.x-r.x)<Math.abs(tx-r.x)&&Math.abs(o.y-26-y)<40);}
function push(g,r,damage,lift=0){const p=g.player;if(p.invulnerable>0)return false;g.botHurt(r,damage,r.x,0,r.type==='shocker'?'conductor slide':'armored shove');if(g.state!=='playing')return true;p.x=clamp(p.x+(Math.sign(p.x-r.x)||r.facing)*85,22,978);p.vy=Math.min(p.vy,lift);if(lift<0)p.grounded=false;return true;}
export function upgradedBombard(g,r){
 const n=r.upgrade.n,flight=1.12-n*.075,gravity=1050+n*650,start=r.y-50,spread=Math.max(18,44-n*6),target=r.target;
 // Keep the committed landing ring. A late-arriving ally makes the gunner hold fire.
 if(g.robots.some(o=>o!==r&&o.hp>0&&!o.structure&&Math.abs(o.x-target)<spread+60&&o.y>335)){r.cooldown=.4;r.heldFire=.4;return false;}
 for(const offset of [-spread,0,spread]){const x=clamp(target+offset,35,965);shot(g,r,{kind:'mortar',x:r.x,y:start,vx:(x-r.x)/flight,vy:(412-start-.5*gravity*flight*flight)/flight,gravity,targetX:x,flight});}
 return true;
}
function artillery(g,r,dt){
 const u=r.upgrade;g.senseRobot(r,dt);r.heldFire=Math.max(0,(r.heldFire??0)-dt);
 if(r.windup>0){r.windup-=dt;if(r.windup<=0){upgradedBombard(g,r);r.action='';}return true;}
 const dx=r.targetX-r.x;if(Math.abs(dx)<260)r.x=clamp(r.x-Math.sign(dx)*TYPES[r.type].speed*r.cognition.speed*dt,30,970);
 if(r.cooldown<=0){r.target=clamp(r.targetX+r.targetVX*(.10+u.n*.035),55,945);r.windup=Math.max(.42,.9*u.windup*r.cognition.windup);r.action='bombard';r.cooldown=3.1/(1+u.n*.22);}
 return true;
}
function ranged(g,r,dt){
 const u=r.upgrade;g.senseRobot(r,dt);const dx=r.targetX-r.x,dir=Math.sign(dx)||r.facing;r.facing=dir;
 if(r.windup>0){r.windup-=dt;if(r.windup<=0){r.burst=r.type==='flak'?1:Math.min(3,1+Math.floor(u.n/2));r.burstClock=0;r.action='burst';}return true;}
 if(r.burst>0){r.burstClock-=dt;if(r.burstClock<=0){
  const y=r.y-26;if(laneBlocked(g,r,r.targetX,y)){r.heldFire=.3;if(r.y>=414&&!r.crippled)r.vy=-480;r.burstClock=.16;return true;}
  if(r.type==='flak')for(const vy of [-180,-300,-420])shot(g,r,{kind:'flak',x:r.x,y:r.y-36,vx:dir*(240+u.n*45),vy:vy*(1+u.n*.12),gravity:600});
  else if(r.type==='flyer'){const dx=r.targetX-r.x,dy=r.targetY-25-y,d=Math.hypot(dx,dy)||1;shot(g,r,{x:r.x,y,vx:dx/d*u.projectile,vy:dy/d*u.projectile,gravity:.00001,damage:12});}else shot(g,r,{x:r.x,y,vx:dir*u.projectile,damage:12});
  r.burst--;r.burstClock=.17;if(!r.burst)r.action='';
 }return true;}
 const dist=Math.abs(dx),speed=TYPES[r.type].speed*r.cognition.speed*(1-r.glue*.23);if(dist<250)r.x=clamp(r.x-dir*speed*dt,30,970);else if(dist>420)r.x=clamp(r.x+dir*speed*dt,30,970);
 if(r.cooldown<=0){r.action='aimed-burst';r.windup=Math.max(.34,.65*u.windup*r.cognition.windup);r.cooldown=2.1/(1+u.n*.2);}
 return true;
}
function guard(g,r,dt){
 g.senseRobot(r,dt);const p=g.player,dx=r.targetX-r.x,slow=(r.crippled?.3:1)*(1-(r.glue??0)*.23);r.specialCd-=dt;
 if(r.shove){r.shove-=dt;r.x=clamp(r.x+r.lockDir*230*slow*dt,30,970);if(Math.abs(p.x-r.x)<65&&Math.abs(p.y-r.y)<65&&!(p.rollTime>0))push(g,r,12+r.upgrade.n,-180);if(r.shove<=0){r.shove=0;r.action='';r.cooldown=1;}return true;}
 if(r.windup>0){r.windup-=dt;if(r.windup<=0){r.shove=.35;r.action='shove';}return true;}
 if(Math.abs(dx)>48)r.x=clamp(r.x+Math.sign(dx)*TYPES.guard.speed*r.cognition.speed*slow*dt,30,970);
 if(Math.abs(dx)<125&&Math.abs(p.y-r.y)<75&&r.cooldown<=0){r.lockDir=r.facing;r.windup=Math.max(.45,.75*r.upgrade.windup);r.action='shove-windup';r.cooldown=2;}
 return true;
}
function shocker(g,r,dt){
 g.senseRobot(r,dt);const p=g.player,dx=r.targetX-r.x;r.specialCd-=dt;if(r.crippled){r.slide=0;r.crouching=false;}
 if(r.slide){r.slide-=dt;r.crouching=true;r.x=clamp(r.x+r.lockDir*(450+r.upgrade.n*45)*(1-r.glue*.23)*dt,25,975);
  if(!r.slideHit&&Math.abs(p.x-r.x)<57&&p.grounded&&!(p.rollTime>0)){r.slideHit=push(g,r,15+r.upgrade.n,-540);}
  if(r.slide<=0){r.slide=0;r.crouching=false;r.action='';r.cooldown=1;}return true;}
 if(r.windup>0){r.windup-=dt;if(r.windup<=0){if(r.action==='slide-windup'){r.slide=.52;r.slideHit=false;r.specialCd=6-r.upgrade.n*.4;r.action='dive-slide';}else if(r.action==='floor-shock'){for(const pool of g.pools)pool.charged=.6;for(const o of g.robots)if(o!==r&&o.hp>0&&!o.boots&&g.pools.some(pool=>g.poolAt(o,pool)))g.friendlyDamage(r.id,o,25);r.action='';}else{shot(g,r,{x:r.x,y:r.y-26,vx:r.facing*r.upgrade.projectile});r.action='';}}return true;}
 if(Math.abs(dx)>170)r.x=clamp(r.x+Math.sign(dx)*TYPES.shocker.speed*r.cognition.speed*(1-r.glue*.23)*dt,25,975);
 if(r.specialCd<=0&&Math.abs(dx)<390&&!r.crippled&&!(r.glueGround>0)){r.lockDir=Math.sign(dx)||r.facing;r.windup=.7;r.action='slide-windup';}
 else if(r.cooldown<=0){const unsafe=r.cognition.discipline&&g.robots.some(o=>o!==r&&o.hp>0&&!o.boots&&g.pools.some(pool=>g.poolAt(o,pool)));if(unsafe){r.cooldown=.4;return true;}r.action=g.pools.length?'floor-shock':'linear-shock';r.windup=g.pools.length?1.15:.6;r.cooldown=5/(1+r.upgrade.n*.1);}
 return true;
}
function drone(g,r,dt){
 g.senseRobot(r,dt);if(r.type==='chemDrone'){r.fuse=Math.max(0,r.fuse-dt);if(!r.fuse){g.damageRobot(r,r.hp);return true;}}
 r.specialCd-=dt;const d=r.dive;
 if(d){d.age+=dt;
  if(d.phase==='windup'){r.windup=Math.max(0,.72-d.age);r.action='dive-lock';if(d.age>=.72){const dx=d.x-r.x,dy=d.y-r.y,len=Math.hypot(dx,dy)||1,speed=300+r.upgrade.n*85;Object.assign(d,{phase:'dive',age:0,distanceTime:0,sx:r.x,sy:r.y,vx:dx/len*speed,vy:dy/len*speed});r.action='dive-bomb';}}
  else if(d.phase==='dive'){d.distanceTime+=dt*(1-r.glue*.23);r.x=clamp(d.sx+d.vx*d.distanceTime,25,975);r.y=clamp(d.sy+d.vy*d.distanceTime,95,420);r.hoverY=r.y;r.vy=0;if(Math.hypot(r.x-g.player.x,r.y-g.player.y)<70){g.damageRobot(r,r.hp);return true;}if(d.age>.85){r.dive=null;r.windup=0;r.action='';r.specialCd=1.7;r.hoverY=220;}}
  return true;
 }
 const dx=r.targetX-r.x;r.x=clamp(r.x+Math.sign(dx)*TYPES[r.type].speed*r.cognition.speed*(1-r.glue*.23)*dt,25,975);r.hoverY=clamp(r.targetY-100,150,310);
 if(r.specialCd<=0){r.dive={phase:'windup',age:0,x:clamp(r.targetX+r.targetVX*.12,35,965),y:clamp(r.targetY,100,420)};r.windup=.72;r.action='dive-lock';}
 return true;
}
export function updateGenerationRobot(g,r,dt){
 if(!r.upgrade?.n||r.structure||stopped(r))return false;
 r.cooldown-=dt*(r.upgrade.attack-1);if(r.type==='orchestrator')r.orderCd-=dt*r.upgrade.n*.18;
 if(r.type==='douser'){g.senseRobot(r,dt);if(r.windup>0){r.windup-=dt;if(r.windup<=0){for(let x=55;x<980;x+=80){const pool=g.addPool(x,0);pool.life=10+r.upgrade.n*2;}r.action='';}return true;}const dx=r.targetX-r.x;if(Math.abs(dx)<230)r.x=clamp(r.x-Math.sign(dx)*TYPES.douser.speed*r.cognition.speed*dt,30,970);if(r.cooldown<=0){r.action='flood';r.windup=Math.max(.7,1.2*r.upgrade.windup);r.cooldown=7/(1+r.upgrade.n*.17);}return true;}
 if(r.type==='guard')return guard(g,r,dt);
 if(r.type==='bombardier')return artillery(g,r,dt);
 if(['gunner','flak','flyer'].includes(r.type))return ranged(g,r,dt);
 if(r.type==='shocker')return shocker(g,r,dt);
 if(TYPES[r.type].behavior==='drone'&&!(r.glueGround>0))return drone(g,r,dt);
 return false;
}
export function blockGuardCrossing(g,oldX){
 const p=g.player;for(const r of g.robots)if(r.fullArmor&&!r.crippled&&!stopped(r)&&Math.abs(p.y-r.y)<66&&Math.abs(p.x-r.x)<54){const side=Math.sign(oldX-r.x)||-r.facing;p.x=clamp(r.x+side*54,22,978);p.vx=0;}
}
export function droneAftermath(g,r,before){
 const u=r.upgrade;if(!u?.n||Math.hypot(g.player.x-r.x,g.player.y-r.y)>150)return;
 const p=g.player;if(before.hp===p.hp&&before.armor===p.mechaShield)return;
 const kind=r.type==='chemDrone'?'chemical':r.type==='plasticDrone'?'shrapnel':'static';p.blastAftermath={kind,time:u.aftermath,tick:1};
 if(kind==='chemical'){p.corrosion=Math.max(p.corrosion,u.aftermath);p.corrosionTier=Math.max(1,p.corrosionTier);}
}
export function updateAftermath(g,dt){const a=g.player.blastAftermath;if(!a)return;a.time=Math.max(0,a.time-dt);a.tick-=dt;if(a.time===0){g.player.blastAftermath=null;return;}if(a.kind==='static'&&a.tick<=0){a.tick=1.25;g.hurt(1,g.player.x,0,'drone static residue',{hazard:true});}}
