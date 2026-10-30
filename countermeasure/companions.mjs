import {borrowedLoadout,ensurePlayerWeapon} from './weapon-lending.mjs';
import {TYPES} from './engine.mjs';
import {SquadOrders} from './squad-orders.mjs';
import {isSurvivor,survivorDodge,SURVIVOR_DAMAGE} from './survivor.mjs';
export const HACK_SKILL={id:'hack',name:'Physical hack',branch:'CIRCUIT',tier:1,parent:'voltage',max:1,desc:'Level 11 · expose wiring, disable, then hold Hack nearby for 2s. Up to 3 allies.'};
export const ordinaryRobot=r=>!!r&&!r.sideBoss&&!r.humanPilot&&r.type!=='trialPilot'&&!r.structure&&!r.super&&!['mirror','overseer','spider','microSpider','antenna','buttonGuard'].includes(r.type)&&!!TYPES[r.type];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function eligibleHack(g,r){return g.wave>=11&&g.hackSkill&&ordinaryRobot(r)&&r.hp>0&&r.faction!=='ally'&&r.exposed>0&&['emp','radio','paralyzed','stun','root'].some(k=>r[k]>0)&&Math.hypot(r.x-g.player.x,r.y-g.player.y)<=70;}
export function hackTarget(g){return g.robots.filter(r=>eligibleHack(g,r)).sort((a,b)=>Math.hypot(a.x-g.player.x,a.y-g.player.y)-Math.hypot(b.x-g.player.x,b.y-g.player.y))[0]??null;}
export function hackOpportunity(g){return g.state==='playing'&&g.player.hp>0&&g.player.grounded&&!(g.player.paralyzed>0)&&!(g.player.dashTime>0)&&!(g.player.spinTime>0)&&g.companions.filter(a=>a.hp>0).length<3?hackTarget(g):null;}
export function initCompanions(g){g.companions=[];g.hackSkill=false;g.squadSequence=0;g.recruited=0;g.hackAttempt=null;g.companionAction=0;g.orders=new SquadOrders();}
export function cancelHack(g){g.hackAttempt=null;}
export function convertRobot(g,r){
 if(!eligibleHack(g,r)||g.companions.filter(a=>a.hp>0).length>=3)return null;
 return adoptRobot(g,r);
}
function adoptRobot(g,r){
 const a={id:'ally-'+(++g.squadSequence),type:r.type,name:'UNIT '+String(g.squadSequence).padStart(3,'0'),role:['douser','chemDrone'].includes(r.type)?'douser':TYPES[r.type].behavior==='ranged'?'gunner':'fighter',faction:'ally',x:r.x,y:420,hp:Math.min(r.hp,r.maxHp*.25),maxHp:r.maxHp,rank:0,kills:0,boots:!!r.boots,flying:!!r.flying,generation:r.generation??1,joinFlash:1.2,facing:g.player.facing,cooldown:.7};
 g.companions=g.companions.filter(a=>a.hp>0);g.companions.push(a);g.recruited++;g.robots=g.robots.filter(o=>o!==r);g.shots=g.shots.filter(s=>s.owner!==r.id);g.event('ALLY ONLINE / '+a.name,'#9ce5e3');return a;
}
export function freeRobot(g,type='gunner'){if(g.encounter!=='side'||g.state!=='traveling'||g.wave<11||!g.sideCleared.includes(g.wave)||g.companions.filter(a=>a.hp>0).length>=3)return null;const r=g.spawn(type,90);r.x=g.player.x+35;r.hp=r.maxHp*.25;r.exposed=8;r.emp=5;return adoptRobot(g,r);}
export function updateHack(g,dt,input){
 if(g.state!=='playing'||!input.hack||!g.player.grounded||input.up||input.left||input.right||input.attack||input.module||input.tool||input.charge||g.player.dashTime>0||g.player.spinTime>0||g.player.paralyzed>0){cancelHack(g);return;}
 if(!g.hackSkill||g.wave<11)return;
 const cap=g.companions.filter(a=>a.hp>0).length>=3;
 let h=g.hackAttempt;
 if(h){const r=g.robots.find(r=>r.id===h.target);if(cap||!eligibleHack(g,r)||Math.abs(g.player.x-h.x)>10||g.player.hp+g.player.mechaShield<h.durability||h.action!==g.companionAction){cancelHack(g);return;}}
 else{const r=hackTarget(g);if(!r||cap){if(g.clock>=(g.hackNoticeAt??0)){g.hackNoticeAt=g.clock+1;g.event(cap?'SQUAD FULL / DISMISS IN SKILLS':'EXPOSE + DISABLE AN ORDINARY ROBOT','#9ce5e3');}return;}h=g.hackAttempt={target:r.id,time:0,x:g.player.x,durability:g.player.hp+g.player.mechaShield,action:g.companionAction};}
 h.time+=dt;if(h.time+1e-9>=2){const r=g.robots.find(r=>r.id===h.target);convertRobot(g,r);cancelHack(g);}
}
export function hurtCompanion(g,a,damage,{continuous=false,dodgeable=true}={}){
 if(a.hp<=0||!Number.isFinite(damage)||damage<=0||!continuous&&a.hurtCd>0)return false;
 if(isSurvivor(a)&&!continuous&&dodgeable&&g.random()<survivorDodge(g)){a.hurtCd=.2;a.dodgeFlash=.3;return false;}
 damage*=1-.04*a.rank;
 if(isSurvivor(a)){if(g.difficulty==='terminator')damage/=1+.16*Math.floor((g.wave-1)/10);const absorbed=Math.min(a.armor,damage);a.armor-=absorbed;damage-=absorbed;}
 a.hp=Math.max(isSurvivor(a)&&g.difficulty==='terminator'?1:0,a.hp-damage);if(!continuous)a.hurtCd=.2;if(a.hp===0)g.event(a.name+' / SIGNAL LOST','#9ce5e3');return true;
}
export function awardCompanionKill(g,a){a.kills++;if(a.rank<5&&g.random()<.25){a.rank++;g.event(a.name+' / ADAPTED '+a.rank,'#9ce5e3');}}
export function companionAttack(g,a,r){
 if(r.hp<=0||r.structure||r.faction==='ally'||g.hackAttempt?.target===r.id)return;
 const loan=borrowedLoadout(g,a),water=loan?loan.weapon===3:a.role==='douser',electric=loan?loan.w.type==='electric':['shocker','plated'].includes(a.type),type=loan?loan.w.type:water?'water':electric?'electric':a.role==='fighter'?'cutting':'impact';
 const resistance=TYPES[r.type].resistance[type]??1;let damage=(loan?loan.w.damage*.5:water?7:a.role==='fighter'?12:10)*(1+.1*a.rank)*(1+.12*(a.generation-1))*resistance*(isSurvivor(a)?SURVIVOR_DAMAGE:1);
 if(electric&&r.wet>0)damage*=3;if(electric&&r.dented>0)damage*=1.08;if(water){r.wet=Math.max(r.wet,3);if(loan?.w.corrosive){r.corrosion=4;r.corrosionTier=loan.w.tier;r.corrosionOwner=a.id;}}if(loan?.weapon===1)r.exposed=6;if(loan?.weapon===0)r.dented=5;
 if((loan?.role??a.role)==='fighter')g.effects.push({kind:'attack',x:a.x,y:a.y-22,dir:Math.sign(r.x-a.x)||a.facing,range:loan?.range??90,weapon:loan?.weapon??1,life:.15,max:.15,color:'#9ce5e3'});else g.effects.push({kind:'arc',x:a.x,y:a.y-30,x2:r.x,y2:r.y-27,life:.13,max:.13,color:loan?.w.color??(water?'#7cc9e8':'#9ce5e3')});
 g.damageRobot(r,damage,{number:true,color:'#9ce5e3',companionId:a.id,...(r.microSpider?{damageType:type,tier:loan?.w.tier??0}:{})});
}
export function updateCompanions(g,dt){
 if(!['playing','traveling'].includes(g.state))return;ensurePlayerWeapon(g);
 for(const a of g.companions){if(a.hp<=0)continue;a.joinFlash=Math.max(0,(a.joinFlash??0)-dt);a.dodgeFlash=Math.max(0,(a.dodgeFlash??0)-dt);a.hurtCd=Math.max(0,(a.hurtCd??0)-dt);if(!a.flying){a.vy=(a.vy??0)+1250*dt;a.y=Math.min(420,a.y+a.vy*dt);if(a.y===420)a.vy=0;}
  if(g.state==='playing'){
   const pools=g.pools.filter(p=>p.life>0&&g.poolAt(a,p));if(pools.some(p=>p.fluid>0))hurtCompanion(g,a,pools.some(p=>p.fluid===2)?5:3,{dodgeable:false});if(!a.boots&&pools.some(p=>p.charged>0))hurtCompanion(g,a,18,{dodgeable:false});
   // Ordinary enemies can strike companions without changing boss focus on the human.
   const attacker=g.robots.find(r=>r.hp>0&&!r.structure&&!['mirror','overseer'].includes(r.type)&&r.windup<=dt&&r.windup>0&&['strike','shove-windup','dive-slide'].includes(r.action)&&Math.hypot(r.x-a.x,r.y-a.y)<80);if(attacker)hurtCompanion(g,a,12+g.wave);
  }else a.x+=clamp(g.player.x-65-a.x,-180*dt,180*dt);
 }
 if(g.state==='playing')g.orders.update(g,dt,{attack:(a,r)=>companionAttack(g,a,r),speed:250,getLoadout:a=>borrowedLoadout(g,a)});
}
export function drawHack(ctx,g){const h=g.hackAttempt,r=h&&g.robots.find(r=>r.id===h.target);if(!r)return;ctx.save();ctx.strokeStyle='#9ce5e3';ctx.lineWidth=5;ctx.beginPath();ctx.arc(r.x,r.y-35,44,-Math.PI/2,-Math.PI/2+Math.PI*2*h.time/2);ctx.stroke();ctx.fillStyle='#d5ffff';ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('LINKING',r.x,r.y-100);ctx.fillStyle='#102b2b';ctx.fillRect(r.x-42,r.y-94,84,8);ctx.fillStyle='#a6fff0';ctx.fillRect(r.x-41,r.y-93,82*Math.min(1,h.time/2),6);ctx.restore();}
