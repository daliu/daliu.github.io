import {Arena,TYPES,weaponAt} from './engine.mjs';
import {campaignPlan,campaignPhase,campaignCognition,campaignMemory,learnCampaign,MODULES,CAMPAIGN_MIRROR,CAMPAIGN_FINAL} from './campaign-plan.mjs';
import {campaignCheckpoint} from './campaign-saves.mjs';
export {campaignPhase,campaignCognition,MODULES};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class CampaignArena extends Arena{
 get bossWave(){return CAMPAIGN_MIRROR;}
 get finalWave(){return CAMPAIGN_FINAL;}
 get calibrationOnly(){return false;}
 makePlan(w,m){return campaignPlan(w,m?.effective?m:campaignMemory());}
 cognition(w){return campaignCognition(w);}
 validateCheckpoint(c){return campaignCheckpoint(c);}
 reset(){super.reset();this.memory=campaignMemory();this.plan=this.makePlan(1,this.memory);this.mechTier=0;this.module=0;this.moduleCooldowns=[0,0,0,0];this.command=null;this.confusion=0;this.deathLearned=false;}
 get maxTier(){const w=this.state==='between'?this.plan.wave:this.wave;return w>=16?2:w>=6?1:0;}
 get armorCapacity(){return this.mechTier?40+this.mechTier*28:0;}
 snapshot(wave=this.wave){return {...super.snapshot(wave),version:2,mode:'campaign',mechTier:this.mechTier??0,module:this.module??0};}
 resume(data,deaths=null){const c=campaignCheckpoint(data);if(!c)return false;this.mechTier=c.mechTier;this.module=c.module;this.moduleCooldowns=[0,0,0,0];return super.resume(c,deaths);}
 startWave(){if(!['between','briefing'].includes(this.state))return false;this.command=null;this.confusion=0;this.deathLearned=false;this.moduleCooldowns=[0,0,0,0];this.emergency=null;if(this.plan.wave===49&&!this.mirrorBlueprint)this.mirrorBlueprint={skills:{...this.skills},tiers:[...this.weaponTiers],weapon:this.weapon,style:structuredClone(this.memory),subject:{...this.subject},mechTier:this.mechTier,module:this.module};const ok=super.startWave();if(!ok)return false;
  if(this.mechTier){this.player.mecha=true;this.player.mechaShield=this.wave===50&&this.finaleCheckpoint?this.finaleCheckpoint.mechaShield:this.armorCapacity;}
  for(const r of this.robots)if(r.type==='shocker')r.boots=true;
  this.initialHP=this.robots.reduce((n,r)=>n+r.hp,0);this.entryCheckpoint=this.snapshot();return true;
 }
 spawn(type,i){const r=super.spawn(type,i);const boss=['mirror','overseer'].includes(type);r.hp=r.maxHp=boss?(type==='mirror'?1900:1500):TYPES[type].hp*(1+this.wave*.055);r.x=clamp(530+(i%4)*105,40,965);if(i>=4)r.x=80+(i-4)*100;
  r.cooldown=1.3+i*.35;r.flying=!!TYPES[type].flying;r.hoverY=220+(i%3)*65;r.y=r.flying?r.hoverY:420;r.glue=0;r.glueTimer=0;r.root=0;r.radio=0;r.confused=0;r.fuse=type==='chemDrone'?11:0;r.dilution=0;r.shell=type==='plasticDrone'||type==='sealed'||type==='insulated';r.corruption=0;r.corruptionTick=0;r.pump=0;r.orderCd=3;r.warning=0;r.intact=true;
  if(type==='shocker')r.boots=true;if(type==='mirror'){r.build.mechTier??=this.mechTier;r.build.module??=this.module;r.moduleCd=4;r.flightSense=0;}return r;
 }
 upgradeMech(tier){if(tier<=this.mechTier)return;this.mechTier=tier;this.player.mecha=true;this.player.mechaShield=this.armorCapacity;this.moduleCooldowns=[0,0,0,0];this.event(`MECH ${tier} ONLINE`, '#9ee6ee');}
 checkMechaDrop(){
  const milestone=this.wave%10===0&&this.wave<=50?this.wave/10:0;
  if(!milestone||this.mechTier>=milestone||this.mechaDrop)return;
  const remaining=this.robots.reduce((n,r)=>n+Math.max(0,r.hp),0);
  if(remaining<=this.initialHP*.4)this.mechaDrop={x:500,y:-70,vy:340,landed:false,collected:false,tier:milestone};
 }
 updateMecha(dt){this.checkMechaDrop();const d=this.mechaDrop;if(!d||d.collected)return;if(!d.landed){d.y=Math.min(420,d.y+d.vy*dt);d.landed=d.y===420;}
  if(d.landed&&Math.abs(this.player.x-d.x)<48&&this.player.y>370){d.collected=true;this.upgradeMech(d.tier??Math.max(1,this.mechTier));this.player.invulnerable=Math.max(.8,this.player.invulnerable);}
 }
 selectModule(index){if(!Number.isInteger(index)||index<0||index>3||MODULES[index].unlock>this.mechTier)return false;this.module=index;return true;}
 useModule(){
  if(this.state!=='playing'||!this.player.mecha||this.moduleCooldowns[this.module]>0||MODULES[this.module].unlock>this.mechTier)return false;
  const p=this.player,m=MODULES[this.module];this.moduleCooldowns[this.module]=m.cooldown*(this.mechTier===5?.65:1);
  this.effects.push({kind:'module',module:this.module,x:p.x,y:p.y-30,dir:p.facing,range:this.module===0?1000:this.module===3?350:265,life:.55,max:.55,color:m.color});
  for(const r of this.robots.filter(r=>r.hp>0)){
   if(r.type==='overseer'&&!r.disabled){this.countered(r);continue;}
   const inCone=(r.x-p.x)*p.facing>=-30&&Math.abs(r.x-p.x)<265&&Math.abs(r.y-p.y)<140;
   if(this.module===0){r.radio=Math.max(r.radio,2.6);r.windup=0;r.moduleWindup=0;r.action='';r.cooldown=Math.max(r.cooldown,1);r.vy=Math.max(r.vy,100);}
   if(this.module===1&&inCone){r.glue=Math.min(3,r.glue+1);r.glueTimer=10;if(r.glue===3){r.root=3.4;r.windup=0;r.action='';}this.damageRobot(r,7,{color:m.color,number:true});}
   if(this.module===2&&inCone){const plastic=r.shell;r.shell=false;if(plastic){r.exposed=8;r.corrosion=6;}this.damageRobot(r,plastic?125:32,{color:m.color,number:true});}
   if(this.module===3&&Math.abs(r.x-p.x)<350&&Math.abs(r.y-p.y)<220){let susceptibility=TYPES[r.type].resistance.electric??1;if(r.shell)susceptibility=Math.min(susceptibility,.25);if(r.exposed>0)susceptibility=Math.max(1.3,susceptibility);r.corruption=Math.max(r.corruption,4*susceptibility);this.damageRobot(r,50*susceptibility,{color:m.color,number:true});}
  }return true;
 }
 dash(){const was=this.stats.dashes;super.dash();if(this.stats.dashes>was){this.player.dashStrike=.24;this.dashContacts=new Set();}}
 hit(r,weapon,scale=1){if(r.hp<=0)return;const w=weaponAt(weapon,this.weaponTiers[weapon]);
  if(r.type==='chemDrone'&&weapon===3&&w.tier===0){r.dilution++;if(r.dilution>=3){r.disarmed=true;this.damageRobot(r,r.hp,{color:'#7cc9e8',number:true});return;}}
  if(r.type==='plasticDrone'&&weapon===1){r.shell=false;r.exposed=8;}
  const boots=r.boots;if(w.type==='electric')r.boots=false; // Boots isolate feet, not direct body contact.
  if(!r.shell&&(r.type==='plasticDrone'||r.type==='sealed'||r.type==='insulated')&&(weapon===3||w.type==='electric'))scale*=3.5;
  super.hit(r,weapon,scale*.72);r.boots=boots;
  if(r.type==='metalDrone'&&w.type==='electric'&&r.hp>0)this.damageRobot(r,r.hp,{color:'#b7e77a',number:true});
 }
 damageRobot(r,damage,options={}){const alive=r.hp>0;super.damageRobot(r,damage,options);if(!alive||r.hp>0||r.deathHandled)return;r.deathHandled=true;
  if(r.type==='orchestrator'){
   this.confusion=3.2;this.command=null;this.shots=this.shots.filter(s=>s.owner===r.id);for(const o of this.robots)if(o.hp>0){o.confused=3.2;o.windup=0;o.action='';o.cooldown=Math.max(.8,o.cooldown);o.dodgeTime=0;}this.event('SIGNAL LOST', '#9ee6ee');
  }
  if(['metalDrone','plasticDrone','chemDrone'].includes(r.type)&&!r.disarmed)this.explodeDrone(r);
 }
 explodeDrone(r){if(r.exploded)return;r.exploded=true;this.effects.push({kind:'blast',x:r.x,y:r.y-20,life:.6,max:.6,color:TYPES[r.type].color});
  if(r.type==='chemDrone'){for(let x=r.x-100;x<=r.x+100;x+=70)this.addPool(x,2);}
  if(Math.hypot(this.player.x-r.x,this.player.y-r.y)<105)this.hurt(r.type==='chemDrone'?22:30,r.x,0,'drone detonation');
  for(const o of this.robots)if(o!==r&&o.hp>0&&Math.hypot(o.x-r.x,o.y-r.y)<125)this.friendlyDamage(r.id,o,70);
 }
 updateMirror(r,dt){
  if(r.moduleWindup>0){r.moduleWindup-=dt;if(r.moduleWindup<=0){const module=r.build.module??0;r.moduleCd=(this.powers??MODULES)[module].cooldown;this.effects.push({kind:'module',module,x:r.x,y:r.y-30,dir:r.facing,range:280,life:.55,max:.55,color:'#e9a8d1'});if(Math.abs(r.x-this.player.x)<280&&Math.abs(r.y-this.player.y)<150){if(module===0)this.player.vy=Math.max(140,this.player.vy);else this.botHurt(r,module===1?12:module===2?24:30,r.x,0,'mirrored mech power');}}return;}
  super.updateMirror(r,dt);if(r.stun>0||r.paralyzed>0)return;
  r.flightSense-=dt;if(r.flightSense<=0){r.flightTarget=this.player.y;r.flightSense=.24;}
  if(r.build.mechTier&&r.flightTarget<350){r.vy=-235;r.y=Math.max(95,r.y);}
  r.moduleCd-=dt;if(r.moduleCd<=0&&r.windup<=0&&Math.abs(r.x-this.player.x)<280&&Math.abs(r.y-this.player.y)<150)r.moduleWindup=.7;
 }
 botHurt(r,damage,...args){super.botHurt(r,Math.min(38,damage),...args);}
 senseRobot(r,dt){super.senseRobot(r,dt);if(this.confusion>0||r.confused>0){r.cognition={...r.cognition,discipline:false};return;}r.cognition=this.cognition(this.wave);
  const busy=this.robots.filter(o=>o!==r&&o.hp>0&&o.windup>0).length;if(busy>=3)r.cooldown=Math.max(r.cooldown,.25);
 }
 updateSpecialRobot(r,dt){
  for(const k of ['radio','root','glueTimer','confused'])r[k]=Math.max(0,(r[k]??0)-dt);if(r.glueTimer===0)r.glue=Math.max(0,r.glue-dt*.6);
  if(r.corruption>0){r.corruption-=dt;r.corruptionTick-=dt;if(r.corruptionTick<=0){r.corruptionTick=.35;this.damageRobot(r,7,{color:'#b7e77a'});}}
  if(r.hp<=0)return true;
  const stopped=r.radio>0||r.root>0||r.confused>0||r.stun>0||r.paralyzed>0;
  if(r.flying&&!stopped){r.y=Math.max(110,r.y+(r.hoverY+Math.sin(this.clock*2+r.x*.01)*18-r.y)*Math.min(1,dt*8));r.vy=0;}
  if(stopped){if(r.radio>0||r.root>0){r.windup=0;r.action='';}return true;}
  // Glue also slows ordinary units without overwriting their delayed senses.
  if(r.glue>0&&!TYPES[r.type].flying){r.slowSkip=(r.slowSkip??0)+dt*(1-r.glue*.23);if(r.slowSkip<dt)return true;r.slowSkip-=dt;}
  const t=TYPES[r.type],special=['douser','shocker','flyer','drone','command'].includes(t.behavior);if(!special){
   if(this.command&&['guard','bulwark','plated','insulated','sealed'].includes(r.type)&&r.windup<=0){
    this.senseRobot(r,dt);const leader=this.robots.find(o=>o.type==='orchestrator'&&o.hp>0),ranged=this.robots.find(o=>o.hp>0&&['gunner','flyer','flak'].includes(o.type));
    const protectedBot=ranged??leader;if((!this.command.coverId||this.command.coverId===r.id)&&protectedBot&&r.targetX!==undefined&&Math.abs(r.targetX-r.x)>100){const desired=clamp(protectedBot.x+Math.sign(r.targetX-protectedBot.x)*100,35,965);if(this.command.coverId===r.id&&this.command.air&&!r.crippled&&r.y>=420&&r.cooldown<=0){r.vy=-520;r.cooldown=2;}r.x+=Math.sign(desired-r.x)*Math.min(Math.abs(desired-r.x),t.speed*r.cognition.speed*(r.crippled?.3:1)*dt);return true;}
   }return false;
  }
  this.senseRobot(r,dt);const p=this.player,dx=r.targetX-r.x,dy=r.targetY-r.y,dist=Math.abs(dx),speed=t.speed*r.cognition.speed*(r.crippled?.3:1)*(1-r.glue*.23);
  if(t.behavior==='drone'){
   r.x=clamp(r.x+Math.sign(dx)*speed*dt,25,975);r.hoverY=clamp(r.targetY,150,400);
   if(r.type==='chemDrone'){r.fuse=Math.max(0,r.fuse-dt);if(r.fuse===0){this.damageRobot(r,r.hp);return true;}}
   if(Math.hypot(dx,dy)<105){if(!r.warning)r.warning=.9;r.warning-=dt;if(r.warning<=0)this.damageRobot(r,r.hp);}else r.warning=0;return true;
  }
  if(r.windup>0){r.windup-=dt;if(r.windup<=0){
   if(r.action==='flood'){for(let x=55;x<980;x+=80)this.addPool(x,0);}
   if(r.action==='floor-shock'){
    for(const pool of this.pools)pool.charged=.6;
    for(const o of this.robots)if(o.hp>0&&!o.boots&&this.pools.some(pool=>this.poolAt(o,pool)))this.friendlyDamage(r.id,o,25);
   }
   if(r.action==='sky-shot'){const tx=r.lockX-r.x,ty=r.lockY-r.y,d=Math.hypot(tx,ty)||1;this.shots.push({x:r.x,y:r.y-24,vx:tx/d*330,vy:ty/d*330,gravity:.00001,life:3,owner:r.id,ownerX:r.x,critical:this.random()<r.cognition.crit});}
  }return true;}
  if(t.behavior==='command'){
   if(r.sense===r.cognition.reaction){const attack=this.effects.find(e=>e.kind==='attack'&&e.color!=='#e9a8d1'&&e.weapon!==undefined);if(attack){const type=attack.energy?'energy':weaponAt(attack.weapon,0).type,covers=this.robots.filter(o=>o!==r&&o.hp>0&&!o.flying);covers.sort((a,b)=>(TYPES[a.type].resistance[type]??1)-(TYPES[b.type].resistance[type]??1));r.coverId=covers[0]?.id;r.coverAir=attack.y<340;}}
   r.orderCd-=dt;if(r.orderCd<=0){r.orderCd=4.6/(this.profile?.coordination??1);this.command={time:1.3,x:r.x,y:r.y,coverId:r.coverId,air:r.coverAir};for(const o of this.robots)if(o!==r&&o.hp>0&&o.radio<=0&&o.confused<=0)o.cooldown=Math.min(o.cooldown,0);this.effects.push({kind:'module',module:0,x:r.x,y:r.y-30,range:900,life:.6,max:.6,color:'#f1c778'});}
   if(dist<210)r.x-=Math.sign(dx)*speed*dt;else if(dist>400)r.x+=Math.sign(dx)*speed*dt;
  }else if(t.behavior==='douser'){
   if(dist<240)r.x-=Math.sign(dx)*speed*dt;if(r.cooldown<=0){r.action='flood';r.windup=1.2;r.cooldown=7;}
  }else if(t.behavior==='shocker'){
   if(dist>200)r.x+=Math.sign(dx)*speed*dt;if(r.cooldown<=0&&this.pools.length){r.action='floor-shock';r.windup=1.4;r.cooldown=5.5;}
   else if(!this.pools.length&&dist<100&&r.cooldown<=0){r.action='sky-shot';r.lockX=r.targetX;r.lockY=r.targetY-20;r.windup=.8;r.cooldown=2;}
  }else if(t.behavior==='flyer'){
   if(dist<200)r.x-=Math.sign(dx)*speed*dt;else if(dist>350)r.x+=Math.sign(dx)*speed*dt;
   if(r.cooldown<=0&&this.robots.filter(o=>o.windup>0&&o.hp>0).length<3){r.lockX=r.targetX;r.lockY=r.targetY-20;r.action='sky-shot';r.windup=.8;r.cooldown=2.4;}
  }r.x=clamp(r.x,25,975);return true;
 }
 hurt(...args){const before=this.state;super.hurt(...args);if(before==='playing'&&this.state==='dead'&&!this.deathLearned){this.memory=learnCampaign(this.memory,this.stats,{wave:this.wave,won:false,learning:this.profile?.learning??1});this.deathLearned=true;this.plan=this.makePlan(this.wave,this.memory);this.entryCheckpoint=this.snapshot();}}
 finishWave(){
  if(this.wave===50){this.upgradeMech(5);this.beginEscape();return;}
  if(this.wave%10===0)this.upgradeMech(this.wave/10); // Salvage a missed pod before mandatory flight.
  this.memory=learnCampaign(this.memory,this.stats,{wave:this.wave,won:true});this.points=Math.min(12,5+Math.floor(this.wave/4));
  if(this.wave===49)this.finaleCheckpoint={hp:this.player.hp,mecha:this.player.mecha,mechaShield:this.player.mechaShield};
  this.plan=this.makePlan(this.wave+1,this.memory);this.state='between';
 }
 update(dt,input={}){
  dt=clamp(dt,0,.04);if(this.state==='playing'){
   this.moduleCooldowns=this.moduleCooldowns.map(c=>Math.max(0,c-dt));this.confusion=Math.max(0,this.confusion-dt);if(this.command){this.command.time-=dt;if(this.command.time<=0)this.command=null;}
   if(input.module)this.useModule();this.player.dashStrike=Math.max(0,(this.player.dashStrike??0)-dt);
   if(this.player.dashStrike>0&&this.weapon<2)for(const r of this.robots)if(r.hp>0&&!this.dashContacts?.has(r.id)&&Math.abs(r.x-this.player.x)<85&&Math.abs(r.y-this.player.y)<85){this.dashContacts?.add(r.id);this.hit(r,this.weapon,1.35);}
  }super.update(dt,input);
 }
}
