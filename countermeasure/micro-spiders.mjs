// Tiny harvesters trade armor and reach for numbers. Their committed tells leave
// room to jump, roll or step away; electrical and corrosive weapons clear them.
export const MICRO_SPIDER_WAVES=Object.freeze([46,48,49]);
export const MICRO_SPIDER_CAP=10;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const profiles={
 easy:{count:6,hp:18,speed:80,tell:.72,rest:1.5,damage:2},
 normal:{count:6,hp:20,speed:95,tell:.62,rest:1.35,damage:2.5},
 hard:{count:8,hp:22,speed:115,tell:.54,rest:1.2,damage:3},
 terminator:{count:10,hp:24,speed:130,tell:.48,rest:1.1,damage:3.5}
};
const profile=g=>profiles[g.difficulty]??profiles.normal;
export function swarmPlan(wave,difficulty='normal'){
 return {count:MICRO_SPIDER_WAVES.includes(wave)?(profiles[difficulty]??profiles.normal).count:0,activeCap:MICRO_SPIDER_CAP};
}
export function microSpiderVulnerable(options={}){
 return options.corrosive===true||options.damageType==='electric'||options.damageType==='energy'||options.damageType==='water'&&options.tier>=1;
}
export function microSpiderDamage(r,damage,options={}){
 if(!r.microSpider||!Number.isFinite(damage)||damage<=0)return 0;
 if(!microSpiderVulnerable(options)){r.microSpider.deflectFlash=.22;return 0;}
 // Repeated taser contact deals damage, but cannot keep a living unit frozen.
 if(r.microSpider.shockRecovery>0){r.paralyzed=0;r.stun=0;}
 return damage;
}
export function equipMicroSpider(g,r,index=0){
 const p=profile(g),slot=Math.abs(Math.trunc(index))%MICRO_SPIDER_CAP;
 r.hp=r.maxHp=p.hp;r.flying=false;r.vy=0;r.shield=r.maxShield=0;
 const wall=slot%4===3;
 const x=wall?(slot%2?945:55):clamp(530+slot*39,70,930),y=wall?210+(slot%3)*55:420;
 r.x=x;r.y=y;
 r.microSpider={x,y,surface:wall?'wall':'floor',phase:'crawl',wait:1.2+slot*.12,age:0,attack:slot%2?'spin':'stab',cycle:slot,deflectFlash:0,controlSpent:0,shockRecovery:0,hits:[]};
 return r;
}
function beginTell(g,r){
 const s=r.microSpider,p=g.player;
 s.phase='tell';s.age=0;s.attack=s.cycle++%2?'spin':'stab';s.fromX=s.x;s.fromY=s.y;
 s.targetX=clamp(p.x+(p.vx??0)*.08,s.x-240,s.x+240);s.targetX=clamp(s.targetX,40,960);
 s.targetY=clamp(p.y,115,420);s.direction=Math.sign(s.targetX-s.x)||r.facing||-1;s.hits=[];
 r.facing=s.direction;
}
function recover(r){const s=r.microSpider;s.phase='recover';s.age=0;r.action='';r.windup=0;}
function contact(g,r,reach){
 const s=r.microSpider,p=profile(g);
 const within=a=>Math.abs(a.x-s.x)<=reach&&Math.abs(a.y-s.y)<(s.attack==='spin'?48:35)&&(s.attack==='spin'||(a.x-s.x)*s.direction>=-12);
 if(!s.hits.includes('player')&&within(g.player)&&!(g.player.rollTime>0)){
  s.hits.push('player');g.hurt(p.damage,r.x,0,s.attack==='spin'?'harvester spin':'harvester leg strike');
 }
 for(const a of g.companions??[])if(a.hp>0&&!s.hits.includes(a.id)&&within(a)){
  s.hits.push(a.id);g.hurtCompanion?.(a,p.damage);
 }
 // Route through the arena's policy so Terminator still has no robot friendly fire.
 for(const other of g.robots??[])if(other!==r&&other.hp>0&&!other.structure&&!s.hits.includes(other.id)&&within(other)){
  s.hits.push(other.id);g.friendlyDamage?.(r.id,other,p.damage);
 }
}
export function updateMicroSpider(g,r,dt){
 const s=r.microSpider;if(!s)return false;
 if(g.state!=='playing'||r.hp<=0||!Number.isFinite(dt)||dt<=0)return true;
 dt=Math.min(dt,.1);const p=profile(g),human=g.player;
 s.deflectFlash=Math.max(0,s.deflectFlash-dt);s.shockRecovery=Math.max(0,s.shockRecovery-dt);
 if(s.shockRecovery>0){r.stun=0;r.paralyzed=0;}
 const shock=r.stun>0||r.paralyzed>0;
 if(shock){s.controlSpent+=dt;if(s.controlSpent>=.45){s.shockRecovery=1.1;s.controlSpent=0;r.stun=0;r.paralyzed=0;}}
 else s.controlSpent=Math.max(0,s.controlSpent-dt*.35);
 const stopped=r.emp>0||r.radio>0||r.root>0||r.confused>0||r.glueGround>0||r.stun>0||r.paralyzed>0;
 if(stopped){
  s.y=Math.min(420,s.y+220*dt);s.surface=s.y===420?'floor':s.surface;recover(r);
 }else if(s.phase==='crawl'){
  s.wait-=dt;const dx=human.x-s.x,speed=p.speed*(r.glueSlow>0?.45:1)*(r.wet>0?.75:1)*(r.crippled?.4:1);
  if(s.surface==='wall')s.y=clamp(s.y+Math.sign(human.y-s.y)*speed*.65*dt,115,420);
  else if(Math.abs(dx)>46)s.x=clamp(s.x+Math.sign(dx)*speed*dt,40,960);
  r.facing=Math.sign(dx)||r.facing;
  if(s.wait<=0&&(Math.abs(dx)<86&&Math.abs(human.y-s.y)<70||s.surface==='wall'&&Math.abs(dx)<255))beginTell(g,r);
 }else if(s.phase==='tell'){
  s.age+=dt;r.action='harvester-tell';r.windup=Math.max(0,p.tell-s.age);
  if(s.age>=p.tell){s.phase=s.attack;s.age=0;r.windup=0;r.action='harvester-'+s.attack;}
 }else if(s.phase==='spin'){
  s.age+=dt;const f=Math.min(1,s.age/.52);
  s.x=clamp(s.fromX+(s.targetX-s.fromX)*f,40,960);s.y=clamp(s.fromY+(s.targetY-s.fromY)*f-Math.sin(f*Math.PI)*72,95,420);
  contact(g,r,31);if(f===1)recover(r);
 }else if(s.phase==='stab'){
  s.age+=dt;if(s.age>=.06&&s.age<=.22)contact(g,r,57);if(s.age>=.28)recover(r);
 }else{
  s.age+=dt;s.y=Math.min(420,s.y+210*dt);
  if(s.age>=.7){s.phase='crawl';s.surface=s.y===420?'floor':'wall';s.wait=p.rest;s.age=0;}
 }
 r.x=s.x;r.y=s.y;r.vy=0;return true;
}
export function drawMicroSpider(ctx,r,t){
 const s=r.microSpider;if(!s)return;ctx.save();ctx.translate(r.x,r.y-12);
 if(s.phase==='spin')ctx.rotate(s.age*Math.PI*16);else if(s.surface==='wall'&&s.phase!=='recover')ctx.rotate(r.x>500?-Math.PI/2:Math.PI/2);
 ctx.strokeStyle=r.flash>0?'#f4f1d9':s.phase==='tell'?'#f3c489':'#a2b9ae';ctx.lineWidth=2;
 for(const side of [-1,1])for(let leg=0;leg<4;leg++){
  const stride=s.phase==='crawl'?Math.sin(t*18+leg*1.5)*3:0,extension=s.phase==='stab'&&side===s.direction&&leg===s.cycle%4?17*Math.sin(Math.min(1,s.age/.28)*Math.PI):0;
  ctx.beginPath();ctx.moveTo(side*5,-6+leg*4);ctx.lineTo(side*(13+extension),-11+leg*7+stride);ctx.lineTo(side*(20+extension),-5+leg*6);ctx.stroke();
 }
 ctx.fillStyle=r.flash>0?'#e5fff2':'#344e4c';ctx.beginPath();ctx.ellipse(0,0,8,10,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=s.phase==='tell'?'#ffd080':'#aeeac5';ctx.fillRect(-4,-8,3,3);ctx.fillRect(2,-8,3,3);ctx.restore();
 if(s.phase==='tell'){
  ctx.save();ctx.strokeStyle='#ffd080bb';ctx.lineWidth=2;ctx.beginPath();
  if(s.attack==='spin'){ctx.ellipse(s.targetX,s.targetY-8,31,10,0,0,Math.PI*2);ctx.moveTo(s.fromX,s.fromY-12);ctx.lineTo(s.targetX,s.targetY-12);}
  else{ctx.moveTo(r.x,r.y-12);ctx.lineTo(r.x+s.direction*62,r.y-12);ctx.moveTo(r.x+s.direction*52,r.y-20);ctx.lineTo(r.x+s.direction*62,r.y-12);ctx.lineTo(r.x+s.direction*52,r.y-4);}
  ctx.stroke();ctx.restore();
 }
 if(s.deflectFlash>0){ctx.save();ctx.font='9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle='#c3d7d0';ctx.fillText('DEFLECTED',r.x,r.y-36);ctx.restore();}
}
