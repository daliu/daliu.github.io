const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function feedbackRules(difficulty){return ({easy:{hits:7,misses:4,tell:.75,rest:6},normal:{hits:6,misses:3,tell:.65,rest:5},hard:{hits:5,misses:3,tell:.65,rest:4.5},terminator:{hits:4,misses:3,tell:.6,rest:4}})[difficulty]??feedbackRules('normal');}
export function createBossFeedback(){return {incoming:{key:null,count:0,at:-100,serial:null},moveCooldown:0,movePending:null,motion:null,moves:0,lastMove:null,attempts:[],recent:[],missStreak:0,attackCooldown:0,attackPending:null,switches:0,lastSwitch:null};}
function state(r){return r.feedback??=createBossFeedback();}
export function recordBossHit(g,r,key,serial){
 if(!r.super||r.hp<=0)return;const f=state(r),old=f.incoming;if(serial!==null&&serial!==undefined&&old.serial===serial)return;
 f.incoming={key,serial,count:old.key===key&&g.clock-old.at<8?old.count+1:1,at:g.clock};
 if(f.incoming.count>=feedbackRules(g.difficulty).hits&&f.moveCooldown===0&&!f.movePending&&!f.motion){f.movePending={key,expires:g.clock+4};f.incoming.count=0;}
}
// All pellets in a volley (or stages of a combo) share one outcome ticket.
export function trackBossAttack(g,r,kind,lifetime=3,existing=null){
 if(!r.super)return null;if(existing){existing.expires=Math.max(existing.expires,g.clock+lifetime);return existing;}
 const f=state(r),attempt={kind,landed:false,expires:g.clock+lifetime};f.attempts.push(attempt);if(f.attempts.length>8)f.attempts.shift();return attempt;
}
export function updateBossFeedback(g,r,dt){
 if(!r.super)return;const f=state(r),rules=feedbackRules(g.difficulty);f.moveCooldown=Math.max(0,f.moveCooldown-dt);f.attackCooldown=Math.max(0,f.attackCooldown-dt);
 if(g.clock-f.incoming.at>=8)f.incoming.count=0;
 while(f.attempts[0]?.expires<=g.clock){
  const a=f.attempts.shift();f.recent.push({kind:a.kind,landed:a.landed,at:g.clock});f.recent=f.recent.slice(-12);f.missStreak=a.landed?0:f.missStreak+1;
  if(f.missStreak>=rules.misses&&f.attackCooldown===0){const p=g.player;f.attackPending={failed:a.kind,air:p.y<330,close:Math.abs(p.x-r.x)<220,crouch:!!p.crouching,expires:g.clock+7};f.missStreak=0;f.attackCooldown=rules.rest+2;}
 }
 if(f.movePending?.expires<g.clock)f.movePending=null;if(f.motion?.expires<g.clock)f.motion=null;if(f.attackPending?.expires<g.clock)f.attackPending=null;
}
export function takeBossAttackSwitch(g,r){
 const f=r.feedback,pending=f?.attackPending;if(!pending||r.combo||r.windup>0||r.cooldown>.7||(r.comboCd??0)>0)return null;
 const choices=pending.air?['pursuit','airstrike','rebound']:pending.close||pending.crouch?['roll','riposte','rebound']:['pursuit','rebound','feint'];
 const available=choices.filter(id=>'combo-'+id!==pending.failed&&(r.cycle>=2||!['airstrike','feint'].includes(id)));
 const id=available[f.switches%available.length];f.switches++;f.lastSwitch={from:pending.failed,to:'combo-'+id,at:g.clock};f.attackPending=null;return id;
}
export function updateBossReposition(g,r,dt){
 const f=r.feedback;if(!f||r.hp<=0||r.combo||r.windup>0||r.laser||['emp','radio','root','paralyzed','stun','confused','glueGround'].some(k=>r[k]>0))return false;
 if(!f.motion&&f.movePending){
  const p=g.player,away=Math.sign(r.x-p.x)||r.facing||1,mode=f.moves%3,dir=r.x<115?1:r.x>885?-1:mode===1?-away:away;
  f.motion={mode,phase:'tell',age:0,x:clamp(mode===1?p.x-away*155:r.x+dir*(mode===0?200:110),55,945),y:clamp(mode===2?(r.y<250?340:155):p.y+(p.y<250?95:-95),145,370),direction:dir,expires:g.clock+3};
  // The wall-clamped cross-over target can lie opposite the initial escape direction.
  f.motion.direction=Math.sign(f.motion.x-r.x)||dir;
  f.movePending=null;f.moves++;f.lastMove=['break-range','cross-over','change-height'][mode];f.moveCooldown=feedbackRules(g.difficulty).rest;
 }
 const m=f.motion;if(!m)return false;m.age+=dt;r.action='feedback-'+f.lastMove;
 if(m.phase==='tell'){
  if(r.flies)r.vy=clamp(((r.targetY??r.y)-r.y)*3,-240,240);
  if(m.age>=feedbackRules(g.difficulty).tell){m.phase='move';m.age=0;if(!r.flies&&!r.crippled&&m.mode>0&&r.y>=414)r.vy=-480;}
  return true;
 }
 const speed=260*g.profile.speed*(r.crippled?.3:1)*(1-(r.glue??0)*.23)*(r.wet>0?.72:1),dx=m.x-r.x;
 r.x=clamp(r.x+Math.sign(dx)*Math.min(Math.abs(dx),speed*dt),35,965);if(r.flies&&!r.crippled)r.vy=clamp((m.y-r.y)*4,-240,240);
 if(m.age>=.75){f.motion=null;r.action='';r.cooldown=Math.max(r.cooldown,.8);r.comboCd=Math.max(r.comboCd??0,1);}
 return true;
}
export function drawBossFeedback(ctx,r){
 const m=r.feedback?.motion;if(!m)return;ctx.save();ctx.strokeStyle='#e9c77a';ctx.fillStyle='#e9c77a';ctx.lineWidth=2;
 const x=r.x+(m.direction||1)*60,y=r.y-30;ctx.beginPath();ctx.moveTo(x-(m.direction||1)*12,y-12);ctx.lineTo(x,y);ctx.lineTo(x-(m.direction||1)*12,y+12);ctx.stroke();
 ctx.font='10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(m.phase==='tell'?'REPOSITION':'PATTERN SHIFT',r.x,r.y-125);ctx.restore();
}
