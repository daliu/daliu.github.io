import {weaponAt} from './engine.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const COMBO_NAMES={rebound:'Rebound circuit',pursuit:'Cut and pursue',feint:'Aerial feint',riposte:'Duck and counter'};
// These weights come from the player's retained outcomes; the motor skills are authored.
export function comboPolicy(memory,cycle=1){
 const samples=(memory.history??[]).reduce((n,h)=>n+h.total,0),wins=(memory.outcomes??[]).filter(o=>o.won&&o.seconds>0),seconds=wins.length?wins.reduce((n,o)=>n+o.seconds,0)/wins.length:20;
 const confidence=clamp(samples/60,0,1),pace=clamp(10/Math.max(2,seconds),.2,1),mix=memory.effective??memory.weapon??[.25,.25,.25,.25],air=clamp((memory.jumpRate??0)*4+(memory.farRatio??.5)*.3,0,1);
 const weights=confidence<.25?[]:[{id:'rebound',weight:.25+mix[2]*2+air*.5},{id:'pursuit',weight:.3+mix[1]+air+(memory.dashRate??0)*3},{id:'riposte',weight:.2+mix[2]+mix[3]+pace*.4},...(cycle>=2?[{id:'feint',weight:.25+pace+(memory.attackRate??1)*.15}]:[])];
 return {confidence,pace,air,weights,cycle,seconds};
}
export function chooseCombo(policy,random){let value=random()*policy.weights.reduce((n,w)=>n+w.weight,0);for(const w of policy.weights){value-=w.weight;if(value<=0)return w.id;}return policy.weights.at(-1)?.id??null;}
function buildFor(r){return r.build??r.lessonBuild;}
function canFly(r){return (r.type==='mirror'?buildFor(r)?.mechTier>0:r.flies)&&!(r.glueGround>0);}
function strike(g,r,index){
 const build=buildFor(r),w=weaponAt(index,build.tiers[index]),p=g.player,dir=Math.sign(p.x-r.x)||r.facing;r.facing=dir;
 g.effects.push({kind:'attack',x:r.x,y:r.y-22,dir,range:w.range,weapon:index,energy:w.type==='energy',life:.22,max:.22,color:'#e9a8d1'});if(r.attacks)r.attacks[index]++;
 if(Math.abs(p.x-r.x)<w.range&&Math.abs(p.y-r.y)<72){const critical=g.random()<.06+r.comboPolicy.pace*.1;g.botHurt(r,clamp(w.damage*.45*(1+(index<2?.16*build.skills.force:.2*build.skills.voltage)),8,24),r.x,index<2?.25*build.skills.breaker:0,'learned combo',critical);if(index===1)p.exposed=4;}
}
function circuit(g,r,spread=false){
 const tier=buildFor(r).tiers[2],w=weaponAt(2,tier);
 for(const dir of [-1,1])for(const vy of spread?[-75,75]:[0])g.shots.push({kind:'mirror-circuit',x:r.x+dir*30,y:r.y-26,vx:dir*370,vy,gravity:.00001,life:1.7,owner:r.id,ownerX:r.x,damage:clamp(w.damage*.4,10,18),critical:g.random()<.08,color:'#d8b6f4'});
 if(r.attacks)r.attacks[2]++;g.effects.push({kind:'arc',x:r.x-48,y:r.y-26,x2:r.x+48,y2:r.y-26,life:.2,max:.2,color:'#e9a8d1'});
}
export function beginCombo(g,r,id){
 if(!COMBO_NAMES[id])return false;const p=g.player;r.combo={id,age:0,fired:0,target:{x:p.x,y:p.y},direction:Math.sign(r.x-p.x)||1};r.windup=.6;r.action='combo-'+id;r.comboCounts??={};r.comboCounts[id]=(r.comboCounts[id]??0)+1;return true;
}
export function updateBossCombo(g,r,dt){
 if(!r.comboPolicy?.weights.length)return false;r.comboCd=Math.max(0,(r.comboCd??3)-dt);
 if(!r.combo){
  if(r.comboCd>0||r.windup>0||r.moduleWindup>0||r.cooldown>.7||g.random()>.5+r.comboPolicy.confidence*.4)return false;
  const id=chooseCombo(r.comboPolicy,()=>g.random());if(!id)return false;beginCombo(g,r,id);
 }
 const c=r.combo,p=g.player,slow=1-(r.glue??0)*.23;c.age+=dt;
 const windup=.6,active=c.age-windup;r.windup=Math.max(0,windup-c.age);r.action='combo-'+c.id;
 if(active<0){r.crouching=c.id==='riposte'&&r.y>=414;if(canFly(r)&&r.y<380)r.vy=0;return true;}
 if(c.id==='rebound'){
  if(c.fired===0){if(canFly(r))r.vy=-260;else if(r.y>=414&&!r.crippled&&!(r.glueGround>0)){r.vy=-500;r.jumps=(r.jumps??0)+1;}}
  if(canFly(r))r.vy=clamp((Math.max(130,c.target.y-55)-r.y)*3,-200,200);
  if(active>=c.fired*.3&&c.fired<3){circuit(g,r,r.comboPolicy.cycle>=3);c.fired++;}
 }else if(c.id==='feint'){
  if(active<.35){r.x=clamp(r.x+c.direction*530*slow*dt,35,965);if(canFly(r))r.vy=c.target.y>270?-250:220;else if(r.y>=414&&!r.crippled&&!(r.glueGround>0))r.vy=-480;g.effects.push({kind:'dash',x:r.x,y:r.y,life:.12,max:.12,color:'#e9a8d1'});}
  else if(c.fired===0){circuit(g,r);c.fired++;}
 }else if(c.id==='riposte'){
  r.crouching=active<.4&&r.y>=414;
  if(active>=.4&&c.fired===0){r.crouching=false;strike(g,r,1);c.fired++;}
  if(active>=.7&&c.fired===1){circuit(g,r);c.fired++;}
 }else if(c.id==='pursuit'){
  const dx=c.target.x-r.x;r.x=clamp(r.x+Math.sign(dx)*Math.min(Math.abs(dx),360*slow*dt),35,965);
  if(canFly(r))r.vy=clamp((c.target.y-r.y)*4,-260,260);else if(c.fired===0&&c.target.y<350&&r.y>=414&&!r.crippled&&!(r.glueGround>0))r.vy=-530;
  if(active>=.2&&c.fired===0){strike(g,r,1);c.fired++;}
  if(active>=.55&&c.fired===1){c.target={x:p.x,y:p.y};c.fired++;}
  if(active>=.85&&c.fired===2){strike(g,r,2);circuit(g,r);c.fired++;}
 }
 if(r.glueGround>0)r.vy=Math.max(180,r.vy);
 if(active>1.1){r.combo=null;r.windup=0;r.action='';r.crouching=false;r.cooldown=.9;r.comboCd=Math.max(2.6,5.5-r.comboPolicy.cycle*.45)/Math.sqrt(g.profile.attack);}
 return true;
}
