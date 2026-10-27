// Input-driven objective strategy. No HP, enemy-stat or victory-state edits.
const runtime=process.env.COUNTERMEASURE_RUNTIME??new URL('../../countermeasure/',import.meta.url).href;
const {ExpeditionArena}=await import(runtime+'expedition.mjs');
import {rng} from './countermeasure-pilot.mjs';
function markedBlast(g){const p=g.player;return g.robots.some(r=>r.airburstMark&&Math.hypot(r.airburstMark.x-p.x,r.airburstMark.y-(p.y-23))<100)||g.shots.some(s=>s.airburst&&s.burstTime<.7&&Math.hypot(s.targetX-p.x,s.targetY-(p.y-23))<100);}
function evadeLaser(g,motor){
 const beam=g.robots.find(r=>r.super&&r.hp>0&&['charge','blast'].includes(r.laser?.phase))?.laser;if(!beam)return null;
 if(motor.beam!==beam){motor.beam=beam;motor.up=g.player.y>200;motor.move=Math.abs(beam.dy)>.65?(g.player.x>500?-1:1):0;}
 return {up:motor.up,move:motor.move};
}
export function buttonApproach(g,reaction=.28){
 const p=g.player,dx=g.emergency.x-p.x,speed=320*(1+.1*g.skills.agility)*(p.mecha?1.15:1);
 // Choose the duration of a tap now; releasing it does not sample the world again.
 return {left:dx<-12,right:dx>12,up:p.y>g.emergency.y+30,moveFor:Math.min(reaction,Math.abs(dx)/speed)};
}
export function finish(g,motor={}){
 // Same public combat controls as the established pilot; choose mobile enemies instead of optional structures.
 const p=g.player,alive=g.robots.filter(r=>r.hp>0&&!r.structure),target=alive.sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)*.8-Math.abs(b.x-p.x)-Math.abs(b.y-p.y)*.8)[0];if(!target)return {};
 let weapon=target.wet<.5?3:2;if(g.resources.electricLock>0)weapon=3;g.setTier(weapon,weapon===2&&!g.ultra?Math.min(1,g.maxTier):g.maxTier);g.weapon=weapon;
 const dx=target.x-p.x;let move=Math.abs(dx)>225?Math.sign(dx):0;
 const warning=motor.careful&&markedBlast(g)||g.shots.some(s=>Math.hypot(s.x-p.x,s.y-p.y+25)<105)||alive.some(r=>r.windup>0&&Math.abs(r.x-p.x)<150);
 if(warning&&p.dashCd===0){move=p.x>500?-1:1;p.facing=move;g.dash();}
 let module=0;if(g.ultra&&target.super&&g.resources.ammo>0&&g.moduleCooldowns[5]===0&&Math.abs(target.y-p.y)<65&&Math.abs(target.x-p.x)<500)module=5;else if(target.flies&&g.moduleCooldowns[1]===0&&!(target.glueGround>0))module=1;else if(g.moduleCooldowns[0]>0)module=3;if(g.selectModule(module))g.useModule();
 const evasion=evadeLaser(g,motor);if(evasion?.move)move=evasion.move;const delay=motor.reaction??.28,unsafeFloor=weapon===2&&p.y+Math.max(0,p.vy)*delay+625*delay*delay>400&&g.pools.some(pool=>Math.abs(pool.x-p.x)<pool.radius+12);
 return {left:move<0,right:move>0,up:unsafeFloor|| (evasion?evasion.up:warning?p.y>250:(motor.careful?p.y+Math.max(0,p.vy)*(motor.reaction??.28)*.8>Math.max(105,Math.min(365,target.y-35)):p.y>Math.max(105,target.y-35))),attack:!unsafeFloor,aim:true};
}
export function fight(c,seed,strategy,{reaction=.28,style='fast'}={}){
 const g=new ExpeditionArena({random:rng(seed)});if(!g.resume(c))throw Error('resume');const motor={reaction,careful:style==='careful'};let stage=strategy==='direct'?'finish':'bait',t=0,think=0,moveFor=0,input={},lastStage='',evadeUp=false,lastBeam=null,events=[],enemyDamage={},enemyDestroyed=[],coreDamageOnBackup=0,laserHits=0,backupAt=null,pressAt=null,laserDestroyed=[],beams=new Map(),damageByCause={};
 const original=g.friendlyDamage.bind(g);g.friendlyDamage=(source,target,...args)=>{const hp=target.hp;original(source,target,...args);if(target.structure&&target.hp<hp){enemyDamage[target.type]=(enemyDamage[target.type]??0)+Math.min(hp,hp-target.hp);if(target.hp<=0)enemyDestroyed.push(target.type);const beam=g.robots.find(r=>r.id===source&&r.laser?.phase==='blast')?.laser;if(beam){laserHits++;const outcome=beams.get(beam)??{targets:[],resolved:false};outcome.targets.push(target.type);beams.set(beam,outcome);if(target.hp<=0)laserDestroyed.push(target.type);}}};
 const originalDamage=g.damageRobot.bind(g);g.damageRobot=(target,...args)=>{const hp=target.hp;originalDamage(target,...args);if(target.super&&g.emergency?.rerouted&&target.hp<hp)coreDamageOnBackup+=Math.min(hp,hp-target.hp);};
 const originalHurt=g.hurt.bind(g);g.hurt=(...args)=>{const before=g.player.hp+g.player.mechaShield;originalHurt(...args);const damage=before-g.player.hp-g.player.mechaShield;if(damage>0)damageByCause[args[3]??'combat trauma']=(damageByCause[args[3]??'combat trauma']??0)+damage;};
 const start={hp:g.player.hp,armor:g.player.mechaShield,ammo:g.resources.ammo,fuel:g.resources.fuel};
 while(t<180&&g.state==='playing'){
  const boss=g.robots.find(r=>r.super&&r.hp>0),a=g.robots.find(r=>r.type==='antenna'&&r.hp>0),b=g.robots.find(r=>r.type==='buttonGuard'&&r.hp>0);
  if(stage==='bait'&&!(strategy==='both'&&a)&&!b)stage='button';if(stage==='button'&&g.emergency.activated){stage='backup';pressAt=t;}if(stage==='backup'&&g.emergency.rerouted){stage='finish';backupAt=t;}
  if(stage!==lastStage){events.push({stage,time:+t.toFixed(2),hp:g.player.hp,armor:g.player.mechaShield,bossHP:boss?.hp});lastStage=stage;think=0;}
  if(think<=0){
   moveFor=reaction;
   if(stage==='finish')input=finish(g,motor);
   else if(stage==='button'){if(g.nearEmergency())g.pressEmergency();const approach=buttonApproach(g,reaction);moveFor=approach.moveFor;const {moveFor:_,...held}=approach;input=held;}
   else if(stage==='backup')input=finish(g,motor);
   else{
    const target=strategy==='both'&&a?a:b,p=g.player,evade=['charge','blast'].includes(boss?.laser?.phase),goalX=target.type==='antenna'?70:965,goalY=target.type==='antenna'?255:205;
    if(evade&&lastBeam!==boss.laser){lastBeam=boss.laser;evadeUp=p.y>210;}
    const shotDanger=motor.careful&&markedBlast(g)||g.shots.some(s=>Math.hypot(s.x-p.x,s.y-(p.y-25))<135),support=g.robots.filter(r=>r.hp>0&&r.supportReason).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    let dx=goalX-p.x,up=p.y>goalY,attack=false;
    if(evade){up=evadeUp;dx=goalX-p.x;}
    else if(shotDanger){up=p.y>215;dx=motor.careful?(p.x<180?1e3:p.x>820?-1e3:p.x>goalX?-1e3:1e3):p.x>goalX?-1e3:1e3;if(p.dashCd===0){p.facing=Math.sign(dx);g.dash();}}
    else if(support&&Math.abs(support.x-p.x)<(motor.careful?310:510)&&(support.type!=='metalDrone'&&g.maxTier>=2||!(Math.abs(boss.x-p.x)<Math.abs(support.x-p.x)&&Math.sign(boss.x-p.x)===Math.sign(support.x-p.x)&&Math.abs(boss.y-p.y)<110))){
     g.setTier(2,support.type==='metalDrone'?(g.ultra?3:Math.min(1,g.maxTier)):Math.min(2,g.maxTier));g.weapon=2;dx=Math.abs(support.x-p.x)>350?support.x-p.x:0;p.facing=Math.sign(support.x-p.x)||p.facing;up=p.y>Math.max(125,support.y-55);attack=true;
    }
    input={left:dx<-12,right:dx>12,up,attack,aim:false};
   }
   think=reaction;
  }
  if(moveFor<=0)input={...input,left:false,right:false};g.update(.02,input);moveFor-=.02;for(const [beam,result] of beams)if(!result.resolved&&beam.phase==='recharge'){result.resolved=true;result.clean=!beam.hits.has('human');}think-=.02;t+=.02;
 }
 return {difficulty:c.difficulty,style,wave:c.wave,seed,strategy,state:g.state,seconds:+t.toFixed(2),start,end:{hp:g.player.hp,armor:g.player.mechaShield,ammo:g.resources.ammo,fuel:g.resources.fuel},pressAt,backupAt,enemyDamage,enemyDestroyed,coreDamageOnBackup,buttonUses:g.emergency.uses,laserHits,laserDestroyed,cleanBaits:[...beams.values()].filter(b=>b.clean).length,damageByCause,events,attacks:g.stats.attacks,bossRemaining:g.robots.filter(r=>r.super).map(r=>r.hp),supportSpawned:g.bossSupport?.spent,modules:g.stats.modules,wetElectric:g.stats.combos.wetElectric};
}
