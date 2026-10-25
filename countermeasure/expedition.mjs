import {createBossFeedback,recordBossHit,trackBossAttack,updateBossFeedback,updateBossReposition,takeBossAttackSwitch} from './boss-feedback.mjs';
import {updateSuperLaser} from './boss-laser.mjs';
import {createBossSupport,updateBossSupport,updateSupportArtillery} from './boss-support.mjs';
import {generationProfile,equipGeneration,updateGenerationRobot,blockGuardCrossing,droneAftermath,updateAftermath} from './enemy-generations.mjs';
import {limitMirrorAltitude} from './mirror-flight.mjs';
import {comboPolicy,updateBossCombo,beginCombo,chooseCombo} from './boss-combos.mjs';
import {profileFor,fullResources,tunedCognition,validDifficulty} from './difficulty.mjs';
import {Arena,TYPES,weaponAt,emptyStats} from './engine.mjs';
import {CampaignArena} from './campaign.mjs';
import {campaignMemory,learnCampaign} from './campaign-plan.mjs';
import {expeditionPlan,roomIndex,POWERS,milestone,bossRules} from './expedition-plan.mjs';
import {expeditionCheckpoint} from './expedition-saves.mjs';
export {POWERS};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class ExpeditionArena extends CampaignArena{
 reset(){this.difficulty=validDifficulty(this.difficulty)?this.difficulty:'normal';super.reset();this.encounter='room';this.journey={cleared:0,flawless:true,secretQualified:false};this.carry=null;this.resources=fullResources(this.difficulty);this.moduleCooldowns=POWERS.map(()=>0);this.next=null;this.room=0;this.door=0;this.synchronized=false;this.syncClock=0;this.ordnance=[];this.glueBombs=[];this.spawnSequence=100;this.bossSupport=null;this.deployments=[];this.deploymentWarning=null;this.deploymentClock=0;this.lastJumpTap=-10;this.boostTime=0;this.plan=this.makePlan(1,this.memory);this.player.hp=this.maxHealth;}
 get bossWave(){return this.encounter==='boss'?this.plan.wave:-1;}
 get finalWave(){return this.encounter==='super'?this.plan.wave:-1;}
 get ultimate(){return this.encounter==='hidden';}
 get ultra(){return this.ultimate||this.difficulty==='terminator'&&this.mechTier===5;}
 get profile(){return profileFor(this.difficulty);}
 get maxHealth(){return this.profile.health;}
 cognition(w){const c=tunedCognition(super.cognition(w),this.difficulty),u=generationProfile(w);return {...c,speed:c.speed*u.speed,reaction:Math.max(.08,c.reaction/u.speed),windup:c.windup*u.windup};}
 get maxTier(){return this.ultra?3:super.maxTier;}
 get armorCapacity(){return Math.round((this.ultra?400:super.armorCapacity)*this.profile.armor);}
 get powers(){return POWERS;}
 get roomOffset(){return this.room*1000;}
 makePlan(w,m,encounter=null){return expeditionPlan(w,m?.effective?m:campaignMemory(),encounter??(w===this.wave?this.encounter:null),this.profile);}
 validateCheckpoint(c){return expeditionCheckpoint(c);}
 snapshot(wave=this.wave){return {...super.snapshot(wave),version:3,difficulty:this.difficulty,encounter:this.encounter??(milestone(wave)?'boss':'room'),journey:structuredClone(this.journey??{cleared:0,flawless:false,secretQualified:false}),carry:this.carry?{...this.carry}:null,cooldowns:this.state==='dead'?POWERS.map(()=>0):POWERS.map((_,i)=>this.moduleCooldowns[i]??0),resources:{...(this.state==='dead'&&this.ultra?fullResources(this.difficulty):this.resources??fullResources(this.difficulty))},finaleCheckpoint:null};}
 resume(data,deaths=null){const c=expeditionCheckpoint(data);if(!c)return false;this.difficulty=c.difficulty;this.encounter=c.encounter;this.wave=c.wave;this.journey=c.journey;this.mechTier=c.mechTier;this.module=c.module;this.resources=c.resources;this.carry=c.carry;this.moduleCooldowns=c.cooldowns;if(deaths>0)this.journey.flawless=false;return Arena.prototype.resume.call(this,c,deaths);}
 startWave(){
  if(!['briefing','between'].includes(this.state))return false;
  this.encounter=this.plan.encounter??(milestone(this.plan.wave)?'boss':'room');this.room=roomIndex(this.plan.wave,this.encounter);this.next=null;this.door=0;this.command=null;this.confusion=0;this.deathLearned=false;this.ordnance=[];this.glueBombs=[];this.synchronized=this.encounter==='hidden'||this.encounter==='super'&&this.plan.wave>=40;this.syncClock=2.5;this.emergency=null;this.finaleCheckpoint=null;this.events=[];
  this.player.blastAftermath=null;this.autoUpgrade();
  if(this.encounter==='boss'&&!this.mirrorBlueprint)this.mirrorBlueprint={skills:{...this.skills},tiers:[...this.weaponTiers],weapon:this.weapon,style:structuredClone(this.memory),subject:{...this.subject},mechTier:this.mechTier,module:this.difficulty==='terminator'?this.module:Math.min(3,this.module)};
  const carry=this.carry,allUnits=this.plan.units;this.deployments=structuredClone(this.plan.deployments??[]);this.deploymentWarning=null;this.deploymentClock=0;if(this.plan.openingUnits)this.plan.units=this.plan.openingUnits;const ok=Arena.prototype.startWave.call(this);this.plan.units=allUnits;if(!ok)return false;if(this.encounter!=='boss')this.mechaDrop=null;
  this.player.hp=this.maxHealth;this.player.x=80;if(this.mechTier){this.player.mecha=true;this.player.mechaShield=carry?.shield??this.armorCapacity;}if(carry)this.player.hp=carry.hp;
  for(const r of this.robots)if(r.type==='shocker')r.boots=true;
  if(this.ultimate){this.player.mecha=true;this.player.mechaShield=carry?.shield??this.armorCapacity;this.mechTier=5;this.module=Math.min(this.module,5);}
  this.player.mechaShield=Math.min(this.armorCapacity,this.player.mechaShield);
  if(['boss','super'].includes(this.encounter))this.events=[{text:(this.encounter==='boss'?'MIRROR DUEL ':'SUPERBOSS ')+this.wave/10,color:this.encounter==='boss'?'#e9a8d1':'#ef9b8d',time:2.5}];
  if(this.wave>10&&this.wave%10===1)this.event('ENEMY GENERATION '+Math.ceil(this.wave/10),'#e9bc85');
  this.bossSupport=['boss','super','hidden'].includes(this.encounter)?createBossSupport(this):null;
  this.initialHP=this.robots.filter(r=>!r.structure).reduce((n,r)=>n+r.hp,0);this.autoUpgrade();this.checkMechaDrop();this.entryCheckpoint=this.snapshot();this.carry=null;return true;
 }
 spawn(type,i){const r=super.spawn(type,i);if(type==='mirror'){r.hp=r.maxHp=this.wave===10&&this.mechTier===0?450:650+this.wave*27;r.moduleCd=5;}
  if(type==='overseer'){
   const cycle=this.ultimate?5:this.wave/10,rules=bossRules(cycle);Object.assign(r,{super:true,cycle,flies:this.ultimate||rules.flies,hp:this.ultimate?2400:rules.hp,maxHp:this.ultimate?2400:rules.hp,evadeRate:this.ultimate?.3:rules.dodge,evadeCredit:0,emp:0,weakness:0,evasion:null,boostExposed:0,sense:0,targetX:this.player.x,targetY:420,disabled:false});r.cooldown=2.3;if(this.ultimate){r.channel=['emp','radio','electric'][i];r.x=480+i*180;r.y=230+i*65;}
  }
  if(['buttonGuard','antenna'].includes(type)){
   const rules=bossRules(this.wave/10);Object.assign(r,{structure:true,x:type==='antenna'?160:900,y:type==='antenna'?420:170,anchorY:type==='antenna'?420:170,hp:type==='antenna'?rules.antenna:rules.cover,maxHp:type==='antenna'?rules.antenna:rules.cover});
  }if(r.super){r.feedback=createBossFeedback();r.hp*=(this.ultimate?1.8:1.35+r.cycle*.35)*this.profile.bossHealth;r.controlSpent=0;r.controlRecovery=0;r.objectiveReboot=0;}
  if(['mirror','overseer'].includes(type)){r.comboPolicy=comboPolicy(type==='mirror'?r.build.style:this.memory,Math.max(1,Math.ceil(this.wave/10)));r.lessonBuild={skills:{...this.skills},tiers:[...this.weaponTiers],mechTier:this.mechTier};r.comboCd=type==='mirror'&&this.wave>=20?1.2:3;r.controlSpent=0;r.controlRecovery=0;}
  if(!r.structure&&!['mirror','overseer'].includes(type)){const front=['guard','bulwark','plated','insulated','sealed','lancer','interceptor','feinter'].includes(type);r.x=Math.min(955,(front?380:650)+(i%3)*100+Math.floor(i/3)*32);}
  if(!r.structure){r.hp*=this.difficulty==='easy'?.8:this.difficulty==='hard'?1.15:this.difficulty==='terminator'?(['mirror','overseer'].includes(type)?1.3:1.15):1;r.maxHp=r.hp;}equipGeneration(this,r);return r;
 }
 upgradeMech(tier){super.upgradeMech(tier);this.moduleCooldowns=POWERS.map((_,i)=>this.moduleCooldowns[i]??0);}
 get rewardTier(){return this.difficulty==='terminator'?5:this.wave/10;}
 checkMechaDrop(){if(this.encounter!=='boss'||this.mechaDrop)return;this.mechaDrop={x:500,y:260,vy:250,landed:false,collected:false,tier:this.rewardTier,locked:true,reward:true};}
 collectMechReward(){const d=this.mechaDrop;if(!d?.reward||d.collected||d.locked||this.state!=='traveling')return false;this.upgradeMech(d.tier);this.player.mecha=true;this.player.mechaShield=this.armorCapacity;this.moduleCooldowns=POWERS.map(()=>0);this.resources=fullResources(this.difficulty);d.collected=true;if(this.carry)this.carry.shield=this.armorCapacity;this.autoUpgrade();this.event('NEW SUIT / FULL ARMOR','#9ee6ee');return true;}
 updateMecha(dt){const d=this.mechaDrop;if(!d?.reward||d.collected)return;if(d.locked)return;d.y=Math.min(420,d.y+d.vy*dt);d.landed=d.y===420;if(d.landed&&Math.abs(this.player.x-d.x)<70&&this.player.y>320)this.collectMechReward();}
 updateGlueBombs(dt){for(const b of this.glueBombs){b.x=clamp(b.x+b.vx*dt,20,980);b.vy+=650*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.y>=405){b.life=0;this.effects.push({kind:'glue-burst',x:b.x,y:Math.min(b.y,405),life:.6,max:.6,color:'#d8b6f4'});for(const r of this.robots)if(r.hp>0&&!r.structure&&Math.hypot(r.x-b.x,r.y-25-b.y)<185){r.glueGround=2;r.glueSlow=5;r.glue=2;r.glueTimer=5;r.vy=Math.max(180,r.vy);r.windup=0;r.action='';r.combo=null;r.dive=null;r.burst=0;r.slide=0;r.shove=0;r.predictBlock=0;r.crouching=false;}}}this.glueBombs=this.glueBombs.filter(b=>b.life>0);}
 signalDeployment(){if(this.deploymentWarning||!this.deployments.length)return;this.deploymentWarning={...this.deployments.shift(),remaining:1.6};}
 updateDeployments(dt){
  this.deploymentClock+=dt;if(!this.deploymentWarning&&this.deployments[0]?.at<=this.deploymentClock)this.signalDeployment();const warning=this.deploymentWarning;if(!warning)return;
  warning.remaining-=dt;if(warning.remaining>0||this.robots.filter(r=>r.hp>0&&!r.structure).length+warning.units.length>(this.plan.activeCap??30))return;this.deploymentWarning=null;
  for(const [i,type] of warning.units.entries()){const r=this.spawn(type,this.spawnSequence++);r.x=warning.side==='left'?85+i*55:warning.side==='air'?420+i*100:915-i*55;if(warning.side==='air'){r.y=115;r.vy=60;}r.cooldown=1.5+i*.35;r.facing=Math.sign(this.player.x-r.x)||-1;r.boots=!!this.plan.boots&&i%2===0||type==='shocker';this.robots.push(r);}
 }

 selectModule(index){if(!Number.isInteger(index)||index<0||index>=POWERS.length||POWERS[index].unlock>this.mechTier||POWERS[index].ultimate&&!this.ultra)return false;this.module=index;return true;}
 pause(){this.lastJumpTap=-10;if(this.state==='traveling'){this.pausedFrom='traveling';this.state='paused';}else super.pause();}
 dash(){if(this.state==='traveling'&&this.player.dashCd<=0){this.player.rollTime=this.player.grounded&&this.player.crouching?.34:0;this.player.dashTime=this.player.rollTime||.16;this.player.dashCd=1;return;}super.dash();}
 jump(){
  if(this.player.rollTime>0)return;
  if(this.state==='traveling'&&this.player.grounded){this.player.vy=-510;this.player.grounded=false;return;}
  if(this.ultra&&this.state==='playing'&&this.clock-this.lastJumpTap<=.28&&this.resources.fuel>=20){this.resources.fuel-=20;this.boostTime=.65;this.player.vy=-670;this.player.grounded=false;this.player.invulnerable=Math.max(.3,this.player.invulnerable);this.lastJumpTap=-10;this.effects.push({kind:'boost',x:this.player.x,y:this.player.y,life:.65,max:.65,color:'#ffac65'});return;}
  this.lastJumpTap=this.clock;super.jump();
 }
 disable(r,channel,duration){if(r.structure||r.hp<=0||r.super&&r.controlRecovery>0&&channel!=='button'||this.ultimate&&r.channel&&r.channel!==channel)return false;r.emp=Math.max(r.emp??0,duration);r.weakness=Math.max(r.weakness??0,duration+1);r.windup=0;r.moduleWindup=0;r.action='';r.disabled=true;r.vy=Math.max(150,r.vy);r.disabledBy=channel;return true;}
 anticipate(r,kind){
  if(!r.super||r.disabled||r.emp>0||r.radio>0||r.root>0||r.paralyzed>0||r.evadeRate===0)return false;
  r.evadeCredit+=r.evadeRate;if(r.evadeCredit<1-1e-9)return false;r.evadeCredit-=1;r.evasion={kind,age:0,x:r.x,y:r.y};r.flash=.1;
  this.effects.push({kind:'evasion',attackKind:kind,x:r.x,y:r.y-28,dir:r.facing,life:.42,max:.42,color:'#e6c4fa'});return true;
 }
 attack(){if(this.weapon===2&&this.resources.electricLock>0&&this.state==='playing'){if(this.player.attackCd<=0){this.player.attackCd=.4;this.event('CIRCUIT REBOOT', '#9ee6ee');}return;}super.attack();}
 hit(r,index,scale=1){
  if(r.structure&&r.hp<=0)return;const w=weaponAt(index,this.weaponTiers[index]);if(index===2&&this.resources.electricLock>0)return;
  const kind=index===0?'impact':index===1?'cutting':w.type==='water'?'liquid':w.type==='energy'?'laser':'electric';if(this.anticipate(r,kind))return;
  if(r.fullArmor){const factor=[.82,.7,1.05,.82][index];scale*=r.corrosion>0?factor+(1-factor)*.6:factor;}
  if(r.predictBlock>0&&!r.disabled&&!(r.stun>0||r.paralyzed>0||r.radio>0||r.emp>0)&&r.predictedWeapon===index&&(this.player.x-r.x)*r.facing>0){scale*=.3;r.predictBlock=0;if(r.combo)r.combo.blockUsed=true;this.effects.push({kind:'number',x:r.x,y:r.y-90,text:'PREDICTED BLOCK',life:.55,max:.55,color:'#e9a8d1'});}
  const hpBefore=r.hp,oldStun=r.stun;const boost=r.boostExposed>0&&index<2?1.8:1;const online=r.type==='overseer'&&!r.disabled;if(online)r.disabled=true;super.hit(r,index,scale*boost);if(online&&r.hp>0)r.disabled=false;
  if(index===3)r.stun=oldStun;
  if((r.super||r.type==='mirror')&&r.controlRecovery>0)for(const k of ['emp','radio','root','paralyzed','stun'])r[k]=0;
  if(index===2&&this.ultimate&&r.channel!=='electric')r.paralyzed=0;
  if(index===2&&r.super&&this.ultimate)this.disable(r,'electric',2.4);
  if(this.ultra&&index===0&&r.hp>0){this.disable(r,'impact',.75);r.x=clamp(r.x+this.player.facing*55,35,965);if(!(r.controlRecovery>0))r.stun=Math.max(r.stun,.8);}
  if(this.ultra&&index===3&&r.hp>0){r.corrosion=6;r.corrosionTier=2;r.corrosionOwner=null;}
  const serial=this.player.dashTime>0?this.stats.dashes:this.stats.attacks.reduce((a,b)=>a+b,0);if(r.hp<hpBefore&&serial>0)recordBossHit(this,r,(this.player.dashTime>0?'dash:':'weapon:')+index,(this.player.dashTime>0?'dash:':'attack:')+serial);
 }
 damageRobot(r,damage,options={}){
  const alive=r.hp>0,hpBefore=r.hp;if(!alive)return;
  // The old emergency robot was immune. Expedition cores always take damage.
  if(r.super){const weak=r.emp>0||r.radio>0||r.root>0||r.paralyzed>0||r.weakness>0||r.laser?.phase==='recharge';damage*=weak?.85:r.shieldReduced?.6:.18;}
  const online=r.type==='overseer'&&!r.disabled;if(online)r.disabled=true;super.damageRobot(r,damage,options);if(online&&r.hp>0)r.disabled=false;if(options.feedbackKey&&r.hp<hpBefore)recordBossHit(this,r,options.feedbackKey,options.feedbackSerial);
  if(alive&&r.hp<=0&&r.type==='antenna'){
   this.synchronized=false;this.command=null;if(this.bossSupport)this.bossSupport.warning=null;for(const [i,o] of this.robots.entries())if(!o.structure&&o.hp>0){o.emp=Math.max(o.emp??0,8);o.objectiveReboot=8;o.controlRecovery=0;o.controlSpent=0;o.radio=8;o.weakness=9;o.desynchronized=true;o.windup=0;o.action='';o.cooldown=1+i*.7;}this.event('SYNC LOST / REBOOT 8s', '#9ee6ee');
  }
  if(r.super&&r.hp<=0&&!this.robots.some(o=>o.super&&o.hp>0))for(const o of this.robots)if(o.structure)o.hp=0;
 }
 useModule(){
  if(this.state!=='playing'||!this.player.mecha||this.moduleCooldowns[this.module]>0||!this.selectModule(this.module))return false;
  if(this.aimAssist)this.aimAtNearest(this.module===3?350:265,false);const p=this.player,m=POWERS[this.module];if(this.module===3&&this.resources.electricLock>0||this.module===5&&this.resources.ammo===0)return false;
  this.stats.modules[this.module]++;this.moduleCooldowns[this.module]=m.cooldown*(this.module===1?1:this.mechTier===5?.65:1);this.effects.push({kind:'module',module:this.module,x:p.x,y:p.y-30,dir:p.facing,range:this.module===0?1000:350,life:.55,max:.55,color:m.color});
  if(this.module===1){this.glueBombs.push({x:p.x+p.facing*20,y:p.y-35,vx:p.facing*270,vy:-160,life:.65});return true;}
  if(this.module===5){this.resources.ammo--;this.ordnance.push({feedbackSerial:'ap:'+this.stats.modules[5],x:p.x+p.facing*28,y:p.y-27,vx:p.facing*640,life:1.5});return true;}
  if(this.module===4){this.resources.electricLock=5;const targets=this.robots.filter(r=>r.hp>0&&!r.structure&&(!r.channel||r.channel==='emp')&&Math.hypot(r.x-p.x,r.y-p.y)<480).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));if(targets[0])this.disable(targets[0],'emp',6);return true;}
  for(const r of this.robots.filter(r=>r.hp>0&&!r.structure)){
   const cone=(r.x-p.x)*p.facing>=-30&&Math.abs(r.x-p.x)<265&&Math.abs(r.y-p.y)<140;
   if(this.module!==0&&!cone&&!(this.module===3&&Math.hypot(r.x-p.x,r.y-p.y)<350))continue;
   if(this.anticipate(r,m.id))continue;
   if(this.module===0){if(r.super)this.disable(r,'radio',this.ultimate?4:2.6);else{r.radio=2.6;r.windup=0;r.action='';r.vy=Math.max(r.vy,100);}}
   if(this.module===2){const plastic=r.shell;r.shell=false;if(plastic){r.exposed=8;r.corrosion=6;r.corrosionOwner=null;}this.damageRobot(r,plastic?125:32,{color:m.color,number:true,feedbackKey:'flame',feedbackSerial:'flame:'+this.stats.modules[2]});}
   if(this.module===3){let susceptibility=TYPES[r.type].resistance.electric??1;if(r.shell)susceptibility=Math.min(.25,susceptibility);if(r.exposed>0)susceptibility=Math.max(1.3,susceptibility);r.corruption=Math.max(r.corruption,4*susceptibility);this.damageRobot(r,50*susceptibility,{color:m.color,number:true,feedbackKey:'magnet',feedbackSerial:'magnet:'+this.stats.modules[3]});}
  }return true;
 }
 nearEmergency(){return this.encounter==='super'&&!this.emergency?.activated&&!this.robots.some(r=>r.type==='buttonGuard'&&r.hp>0)&&super.nearEmergency();}
 pressEmergency(){
  if(this.state!=='playing'||this.encounter!=='super'||!this.nearEmergency()||this.emergency.activated)return false;
  const e=this.emergency;e.activated=true;e.pulse=1.2;e.backup=8;e.uses++;for(const r of this.robots)if(!r.structure&&r.hp>0){this.disable(r,'button',8);r.objectiveReboot=8;r.controlSpent=0;r.controlRecovery=0;}
  this.shots=[];this.pools=[];if(this.bossSupport)this.bossSupport.warning=null;this.player.invulnerable=1.2;this.effects.push({kind:'emp',x:e.x,y:e.y,life:1.2,max:1.2,color:'#b3e9ec'});return true;
 }
 addPool(x,chemical=0,owner=null){return super.addPool(x,Math.min(2,Number(chemical)||0),owner);}
 updateEnemyGeneration(r,dt){return updateSupportArtillery(this,r,dt)||updateGenerationRobot(this,r,dt);}
 explodeDrone(r){const before={hp:this.player.hp,armor:this.player.mechaShield};super.explodeDrone(r);droneAftermath(this,r,before);if(r.type==='chemDrone'&&r.upgrade?.n)for(const pool of this.pools)if(Math.abs(pool.x-r.x)<160&&pool.fluid===2)pool.life=Math.max(pool.life,10+r.upgrade.n*3);}
 robotShotHitsAlly(shot,target){if(target?.structure)return true;shot.friendlyFire??=this.profile.friendlyFire===1||this.profile.friendlyFire>0&&this.random()<this.profile.friendlyFire;return shot.friendlyFire;}
 friendlyDamage(source,target,damage,critical=false,confirmed=false){if(target.structure){super.friendlyDamage(source,target,damage,critical);return;}const chance=this.profile.friendlyFire;if(!chance||!confirmed&&chance<1&&this.random()>=chance)return;super.friendlyDamage(source,target,damage,critical);}
 botHurt(r,damage,...args){super.botHurt(r,damage*(['mirror','overseer'].includes(r.type)?1:1+(r.upgrade?.n??0)*.045),...args);}
 updateSpecialRobot(r,dt){
  if(r.structure){r.y=r.anchorY;r.vy=0;return true;}
  r.emp=Math.max(0,(r.emp??0)-dt);r.weakness=Math.max(0,(r.weakness??0)-dt);r.boostExposed=Math.max(0,(r.boostExposed??0)-dt);if(r.evasion){r.evasion.age+=dt;if(r.evasion.age>.42)r.evasion=null;}
  if(r.type==='mirror'&&this.wave>=20){
   r.controlRecovery=Math.max(0,r.controlRecovery-dt);const controlled=['emp','radio','root','paralyzed','stun'].some(k=>r[k]>0);
   if(controlled)r.comboCd=Math.max(0,r.comboCd-dt);
   if(!r.controlRecovery){r.controlSpent=controlled?r.controlSpent+dt:Math.max(0,r.controlSpent-dt*.25);if(r.controlSpent>=1.3){r.controlRecovery=1.9;r.controlSpent=0;r.moduleWindup=0;r.cooldown=.6;r.windup=0;if(r.comboPolicy.weights.length)beginCombo(this,r,chooseCombo(r.comboPolicy,()=>this.random()));}}
   if(r.controlRecovery>0){for(const k of ['emp','radio','root','paralyzed','stun'])r[k]=0;r.disabled=false;}
  }
  if(r.emp>0||r.radio>0||r.root>0||r.confused>0){r.windup=0;r.action='';r.dive=null;r.burst=0;r.slide=0;r.shove=0;r.predictBlock=0;r.crouching=false;r.combo=null;}
  const hadGlue=r.glueSlow>0;r.glueGround=Math.max(0,(r.glueGround??0)-dt);r.glueSlow=Math.max(0,(r.glueSlow??0)-dt);if(hadGlue&&r.glueSlow===0){r.glue=0;r.glueTimer=0;}
  const flying=r.flying;if(r.glueGround>0){r.flying=false;r.vy=Math.max(180,r.vy);}const handled=super.updateSpecialRobot(r,dt);r.flying=flying;
  if(r.super){
   r.objectiveReboot=Math.max(0,(r.objectiveReboot??0)-dt);r.controlRecovery=Math.max(0,(r.controlRecovery??0)-dt);
   const controlled=['emp','radio','root','paralyzed','stun'].some(k=>r[k]>0);
   if(r.objectiveReboot>0)r.controlSpent=0;else if(r.controlRecovery===0){r.controlSpent=controlled?r.controlSpent+dt:Math.max(0,r.controlSpent-dt*.2);if(r.controlSpent>4/Math.sqrt(this.profile.attack)){r.controlRecovery=2.2*Math.sqrt(this.profile.attack);r.controlSpent=0;r.action='';r.windup=0;r.cooldown=Math.max(.6,r.cooldown);}}
   if(r.controlRecovery>0)for(const k of ['emp','radio','root','paralyzed','stun'])r[k]=0;
   updateBossFeedback(this,r,dt);const laserActive=updateSuperLaser(this,r,dt);r.disabled=r.emp>0||r.radio>0||r.root>0||r.paralyzed>0||r.confused>0||r.laser?.phase==='recharge';if(laserActive)return true;if(r.disabled||r.stun>0||r.hp<=0){r.windup=0;r.action='';return true;}if(updateBossReposition(this,r,dt))return true;this.updateSuperboss(r,dt);return true;}
  if(r.emp>0)return true;return handled;
 }
 updateMirror(r,dt){if(updateBossCombo(this,r,dt)){limitMirrorAltitude(r);return;}const grounded=r.glueGround>0,tier=r.build.mechTier;if(grounded)r.build.mechTier=0;super.updateMirror(r,dt);r.build.mechTier=tier;limitMirrorAltitude(r);if(grounded)r.vy=Math.max(180,r.vy);}
 updateSuperboss(r,dt){
  const revised=takeBossAttackSwitch(this,r);if(revised)beginCombo(this,r,revised);
  if(updateBossCombo(this,r,dt))return;
  r.sense-=dt;if(r.sense<=0){r.targetX=this.player.x;r.targetY=this.player.y;r.targetAimY=this.player.y-(this.player.crouching?9:22);r.sense=Math.max(.09,(.45-r.cycle*.045)*this.profile.reaction);r.facing=Math.sign(r.targetX-r.x)||r.facing;}
  const dx=r.targetX-r.x;
  if(r.flies&&!(r.glueGround>0)){const altitude=r.targetY+(this.ultimate?(r.channel==='emp'?-65:r.channel==='electric'?65:0):0);r.vy=clamp((altitude-r.y)*3,-240,240);r.y=clamp(r.y,95,420);}else if(r.targetY<350&&r.y>=420&&r.jumpCd<=0&&!r.crippled&&!(r.glueGround>0)){r.vy=-610;r.jumpCd=1.3;}r.jumpCd-=dt;
  if(r.windup>0){r.windup-=dt;if(r.windup<=0){
   const aimX=r.lockX-r.x,aimY=r.lockY-(r.y-26),d=Math.hypot(aimX,aimY)||1;
   let feedbackAttack=null;for(const angle of r.cycle>=3?[-.15,0,.15]:[0]){const vx=aimX/d*340,vy=aimY/d*340;const shot={kind:'core-shot',x:r.x,y:r.y-26,vx:vx*Math.cos(angle)-vy*Math.sin(angle),vy:vx*Math.sin(angle)+vy*Math.cos(angle),gravity:.00001,life:3,owner:r.id,ownerX:r.x,critical:this.random()<.1};const unsafe=this.synchronized&&this.robots.some(o=>{if(o===r||o.structure||o.hp<=0)return false;const dx=o.x-shot.x,dy=o.y-26-shot.y,projection=(dx*shot.vx+dy*shot.vy)/(340*340);return projection>0&&projection<1.5&&Math.abs(dx*shot.vy-dy*shot.vx)/340<28;});if(!unsafe){feedbackAttack??=trackBossAttack(this,r,'core-volley',3.05);shot.feedbackAttack=feedbackAttack;this.shots.push(shot);}}r.cooldown=r.desynchronized?1.7+(Number(r.id.split('-').at(-1))%3)*.3:1.6;
  }return;}
  const speed=(180+r.cycle*24)*this.profile.speed*(r.crippled?.3:1)*(1-r.glue*.23);if(Math.abs(dx)>(this.ultimate?(r.channel==='emp'?180:r.channel==='radio'?260:340):180))r.x=clamp(r.x+Math.sign(dx)*speed*dt,35,965);
  if(r.cooldown<=0){r.action='core-volley';r.windup=(.95-r.cycle*.065)/Math.sqrt(this.profile.attack);r.lockX=r.targetX+(this.ultimate?(r.channel==='emp'?-55:r.channel==='electric'?55:0):0);r.lockY=r.targetAimY??r.targetY-22;}
 }

 hurt(...args){if(this.encounter==='boss'&&this.wave===10&&this.mechTier===0)args[0]*=.55;if(this.ultra&&this.player.mechaShield>0)args[0]*=this.profile.ultraMitigation;super.hurt(...args);if(this.state==='dead'){this.journey.flawless=false;this.entryCheckpoint=this.snapshot();}}
 finishWave(){
  if(this.deploymentWarning||this.deployments.length){this.signalDeployment();return;}
  this.memory=learnCampaign(this.memory,this.stats,{wave:this.wave,won:true,learning:this.profile.learning});
  if(this.encounter==='boss'){
   this.checkMechaDrop();this.mechaDrop.locked=false;this.event('SUIT UNLOCKED / COLLECT AFTER CLEAR','#9ee6ee');this.player.hp=Math.min(this.maxHealth,this.player.hp+(this.profile.repair?30:0));this.next={wave:this.wave,encounter:'super'};
  }else if(this.encounter==='hidden'){this.beginEscape();return;}
  else{
   if(this.journey.cleared===this.wave-1)this.journey.cleared=this.wave;
   this.points=Math.min(12,5+Math.floor(this.wave/4));
   if(this.wave===50){
    if(this.journey.cleared===50&&this.journey.flawless&&this.runDeaths===0){this.journey.secretQualified=true;this.next={wave:50,encounter:'hidden'};this.resources=fullResources(this.difficulty);this.event('PERFECT HUMAN / VAULT OPEN', '#e6c4fa');}
    else{this.beginEscape();return;}
   }else this.next={wave:this.wave+1,encounter:milestone(this.wave+1)?'boss':'room'};
  }
  this.carry={hp:Math.max(this.profile.healthFloor,Math.min(this.maxHealth,this.player.hp+this.profile.repair)),shield:Math.min(this.armorCapacity,this.player.mechaShield)};if(this.next.encounter==='hidden')this.carry={hp:this.profile.repair?this.maxHealth:this.player.hp,shield:Math.round(400*this.profile.armor)};
  this.pools=[];this.shots=[];this.ordnance=[];this.glueBombs=[];this.door=0;this.state='traveling';
 }
 nextCheckpoint(){if(!this.next)return null;const c=this.snapshot(this.next.wave);c.encounter=this.next.encounter;c.mirrorBlueprint=null;if(c.encounter==='hidden')c.tiers=[3,3,3,3];const d=this.mechaDrop;if(d?.reward&&!d.locked&&!d.collected){c.mechTier=d.tier;if(this.difficulty==='terminator')c.tiers=[3,3,3,3];c.resources=fullResources(this.difficulty);c.cooldowns=POWERS.map(()=>0);c.carry.shield=Math.round((this.difficulty==='terminator'?400:40+d.tier*28)*this.profile.armor);}return c;}

 retry(){if(this.state==='dead')this.moduleCooldowns=POWERS.map(()=>0);if(this.state==='dead'&&this.ultra){this.resources=fullResources(this.difficulty);this.carry={hp:this.maxHealth,shield:this.armorCapacity};}super.retry();}
 updateTravel(dt,input){
  this.updateMecha(dt);for(const e of this.effects)e.life-=dt;this.effects=this.effects.filter(e=>e.life>0);for(const e of this.events)e.time-=dt;this.events=this.events.filter(e=>e.time>0);
  this.clock+=dt;this.moduleCooldowns=this.moduleCooldowns.map(c=>Math.max(0,c-dt));this.resources.electricLock=Math.max(0,this.resources.electricLock-dt);this.door=Math.min(1,this.door+dt*1.5);const p=this.player;p.rollTime=Math.max(0,(p.rollTime??0)-dt);p.crouching=p.rollTime>0||!!input.down&&p.grounded;p.dashTime=Math.max(0,p.dashTime-dt);p.dashCd=Math.max(0,p.dashCd-dt);const move=(input.right?1:0)-(input.left?1:0);if(move)p.facing=move;p.vx=p.dashTime>0?p.facing*900:move*320*(1+.1*this.skills.agility)*(p.mecha?1.15:1);p.x=clamp(p.x+p.vx*dt,22,this.door<1?935:1040);
  p.flying=p.mecha&&!!input.up;p.vy=p.flying?-255:p.vy+1250*dt;p.y=clamp(p.y+p.vy*dt,86,420);p.grounded=p.y===420;
  if(p.x>=1020&&this.next){this.collectMechReward();const next=this.next,entryY=p.y,entryVY=p.vy;this.encounter=next.encounter;this.plan=this.makePlan(next.wave,this.memory,next.encounter);this.mirrorBlueprint=null;this.state='between';this.startWave();this.player.x=22;this.player.y=entryY;this.player.vy=entryVY;this.player.grounded=entryY===420;}
 }
 updateOrdnance(dt){for(const s of this.ordnance){const old=s.x;s.x+=s.vx*dt;s.life-=dt;const target=this.robots.filter(r=>r.hp>0&&Math.abs(r.y-26-s.y)<65&&(r.x-old)*(r.x-s.x)<=0).sort((a,b)=>Math.abs(a.x-old)-Math.abs(b.x-old))[0];if(target){s.life=0;if(!this.anticipate(target,'explosive')){this.effects.push({kind:'blast',x:target.x,y:target.y-25,life:.5,max:.5,color:'#ffbd85'});for(const r of this.robots)if(r.hp>0&&Math.hypot(r.x-target.x,r.y-target.y)<110){const critical=this.random()<.1;this.damageRobot(r,240*(r.super?3:1)*(critical?1.65:1),{critical,number:true,color:'#ffbd85',feedbackKey:'ap',feedbackSerial:s.feedbackSerial});};}}}this.ordnance=this.ordnance.filter(s=>s.life>0&&s.x>0&&s.x<1000);}
 update(dt,input={}){
  dt=clamp(dt,0,.04);const oldX=this.player.x;if(this.state==='playing')updateAftermath(this,dt);if(this.state==='traveling'){this.updateTravel(dt,input);return;}if(this.state==='playing'){
   this.resources.electricLock=Math.max(0,this.resources.electricLock-dt);this.boostTime=Math.max(0,this.boostTime-dt);
   if(this.boostTime>0){this.player.vy=-670;input={...input,up:false};for(const r of this.robots)if(r.hp>0&&!r.structure&&Math.abs(r.x-this.player.x)<100&&r.y>=this.player.y-10&&r.y<this.player.y+180){r.boostExposed=4;this.damageRobot(r,80*dt,{color:'#ffac65'});}}
   updateBossSupport(this,dt,input);this.updateDeployments(dt);this.updateGlueBombs(dt);this.updateOrdnance(dt);if(this.emergency?.activated&&!this.emergency.rerouted){this.emergency.backup=Math.max(0,this.emergency.backup-dt);if(this.emergency.backup===0){this.emergency.rerouted=true;for(const r of this.robots)if(r.super&&r.hp>0)r.shieldReduced=true;this.event('BACKUP POWER / SHIELDS REDUCED','#f1c778');}}
   if(this.synchronized){this.syncClock-=dt;if(this.syncClock<=0){this.syncClock=5/this.profile.coordination;this.command={x:this.ultimate?500:160,y:this.ultimate?200:300,time:1.2};for(const r of this.robots)if(r.hp>0&&!r.structure&&!r.disabled)r.cooldown=0;}}
  }
  if(this.state==='playing')for(const r of this.robots)if(r.hp>0&&!r.structure){r.cooldown-=dt*(this.profile.attack-1);if(r.windup>0)r.windup=Math.max(dt*.1,r.windup-dt*(this.profile.attack-1));}
  super.update(dt,input);
  if(this.state==='playing'){if(this.player.blastAftermath?.kind==='shrapnel'){this.player.x=oldX+(this.player.x-oldX)*.72;this.player.vx*=.72;}blockGuardCrossing(this,oldX);}
  if(this.state==='playing'){const wall=this.robots.find(r=>r.type==='buttonGuard'&&r.hp>0);if(wall&&this.player.x>wall.x-105&&this.player.y<245)this.player.x=wall.x-105;}
 }
}
