import {CRITICAL_MULTIPLIER} from './difficulty.mjs';
export const SPIDER_WAVE=18;
export const spiderRoom=g=>g.encounter==='side'&&g.wave===SPIDER_WAVE;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const spiderProfile=d=>({easy:{speed:170,tell:.85,interval:.62,hp:650,damage:8},normal:{speed:230,tell:.7,interval:.44,hp:900,damage:10},hard:{speed:290,tell:.58,interval:.32,hp:1100,damage:12},terminator:{speed:345,tell:.45,interval:.24,hp:1300,damage:14}}[d]??spiderProfile('normal'));
const LENGTH=2420;
export function wallPoint(s){s=(s%LENGTH+LENGTH)%LENGTH;if(s<890)return {x:55+s,y:420,surface:'floor'};if(s<1210)return {x:945,y:420-(s-890),surface:'right'};if(s<2100)return {x:945-(s-1210),y:100,surface:'ceiling'};return {x:55,y:100+s-2100,surface:'left'};}
function nearestTrack(x,y){const choices=[{distance:420-y,s:x-55},{distance:945-x,s:890+420-y},{distance:y-100,s:1210+945-x},{distance:x-55,s:2100+y-100}];return choices.sort((a,b)=>a.distance-b.distance)[0].s;}
export function equipSpider(g,r){const p=spiderProfile(g.difficulty);r.hp=r.maxHp=p.hp;r.x=750;r.y=100;r.vy=0;r.spider={track:1405,phase:'crawl',wait:2.2,x:r.x,y:r.y,surface:'ceiling',direction:1,age:0,flash:0,stabCd:0};}
export function updateSpider(g,r,dt){
 const s=r.spider,p=spiderProfile(g.difficulty),human=g.player;if(!s)return false;
 r.vy=0;r.x=s.x;r.y=s.y;s.flash=Math.max(0,s.flash-dt);
 if(['emp','radio','root','paralyzed','stun','confused'].some(k=>r[k]>0)||r.glueGround>0){s.phase='return';s.age=0;s.wait=1.2;s.y=Math.min(420,s.y+240*dt);s.track=nearestTrack(s.x,s.y);s.fromX=s.x;s.fromY=s.y;r.y=s.y;return true;}
 if(s.phase==='crawl'){
  s.track+=s.direction*p.speed*(r.wet>0?.72:1)*(r.glueSlow>0?.5:1)*(r.crippled?.35:1)*dt;Object.assign(s,wallPoint(s.track));s.wait-=dt;
  if(s.wait<=0){s.phase='tell';s.age=0;s.targetX=clamp(human.x+human.vx*.1,55,945);s.targetY=clamp(human.y,100,420);s.fromX=s.x;s.fromY=s.y;}
 }else if(s.phase==='tell'){
  s.age+=dt;if(s.age>=p.tell){s.phase='pounce';s.age=0;}
 }else if(s.phase==='pounce'){
  s.age+=dt;const f=Math.min(1,s.age/.35);s.x=s.fromX+(s.targetX-s.fromX)*f;s.y=clamp(s.fromY+(s.targetY-s.fromY)*f-Math.sin(f*Math.PI)*55,86,420);
  if(f===1){s.phase='stab';s.age=0;s.stabCd=0;}
 }else if(s.phase==='return'){
  s.age+=dt;const f=Math.min(1,s.age/.45),point=wallPoint(s.track);s.x=s.fromX+(point.x-s.fromX)*f;s.y=s.fromY+(point.y-s.fromY)*f;if(f===1){s.phase='crawl';s.wait=2.2;}
 }else{
  s.age+=dt;s.stabCd-=dt;
  if(s.stabCd<=1e-9){s.stabCd=p.interval;s.flash=.11;r.facing=Math.sign(human.x-s.x)||1;
   g.effects.push({kind:'arc',x:s.x,y:s.y-27,x2:s.x+r.facing*85,y2:s.y-55,life:.1,max:.1,color:'#efae9f'});
   if(Math.hypot(human.x-s.x,human.y-s.y)<88){g.hurt(p.damage*CRITICAL_MULTIPLIER.head,s.x,.15,'spider / head strike',{critical:true});g.effects.push({kind:'number',x:human.x,y:human.y-80,text:'HEAD',life:.3,max:.3,color:'#efbca8'});}
   for(const a of g.companions??[])if(a.hp>0&&Math.hypot(a.x-s.x,a.y-s.y)<88)g.hurtCompanion(a,p.damage*CRITICAL_MULTIPLIER.head);
  }
  if(s.age>=1.4){s.phase='return';s.age=0;s.fromX=s.x;s.fromY=s.y;s.track=nearestTrack(s.x,s.y);s.direction*=-1;}
 }
 r.x=clamp(s.x,55,945);r.y=clamp(s.y,86,420);r.vy=0;return true;
}
export function updateSpiderLight(g,dt){
 if(!spiderRoom(g))return;g.spiderLight=Math.max(0,(g.spiderLight??0)-dt);
 if(g.stats.attacks[2]>(g.lastCircuitShots??0))g.spiderLight=.28;g.lastCircuitShots=g.stats.attacks[2];
}
export function spiderVisibility(g,reduced=false){const lamp=g.weapon===0&&g.weaponAvailable(0);return {radius:lamp?78+42*g.weaponTiers[0]:55,reveal:(g.clock%7.2)<(reduced?.85:.12),electric:g.spiderLight>0};}
export function drawSpider(ctx,r,t){
 const s=r.spider;if(!s)return;ctx.save();ctx.translate(r.x,r.y-30);ctx.strokeStyle=r.flash>0?'#f0e2c0':'#8e9fa9';ctx.lineWidth=4;
 const rotate={floor:0,right:-Math.PI/2,ceiling:Math.PI,left:Math.PI/2};if(s.phase==='crawl'||s.phase==='tell')ctx.rotate(rotate[s.surface]??0);
 for(const side of [-1,1])for(let n=0;n<4;n++){const stride=Math.sin(t*15+n*1.8)*7,reach=s.flash>0?25:0;ctx.beginPath();ctx.moveTo(side*12,-5+n*6);ctx.lineTo(side*(36+n*4+reach),-30+n*18+stride);ctx.lineTo(side*(50+n*5+reach),-6+n*17);ctx.stroke();}
 ctx.fillStyle=r.flash>0?'#ede6ca':'#3f535f';ctx.beginPath();ctx.ellipse(0,1,25,20,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8a9ea1';ctx.fillRect(-14,-12,28,8);ctx.fillStyle=s.phase==='tell'?'#f3b68e':'#ba6d76';for(const x of [-10,-3,4])ctx.fillRect(x,-12,4,4);
 ctx.strokeStyle='#d9b5ad';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-7,14);ctx.lineTo(-3,24);ctx.lineTo(0,17);ctx.lineTo(4,24);ctx.lineTo(8,14);ctx.stroke();ctx.restore();
 if(['pounce','stab'].includes(s.phase)){ctx.save();ctx.strokeStyle='#71899866';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r.x,35);ctx.lineTo(r.x,r.y-48);ctx.stroke();ctx.restore();}
 if(s.phase==='tell'){ctx.save();ctx.strokeStyle='#eeb294';ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.targetX,s.targetY-30,33,0,Math.PI*2);ctx.moveTo(s.targetX-42,s.targetY-30);ctx.lineTo(s.targetX+42,s.targetY-30);ctx.stroke();ctx.restore();}
 ctx.fillStyle='#25343e';ctx.fillRect(r.x-30,r.y-84,60,4);ctx.fillStyle='#d6b8bb';ctx.fillRect(r.x-30,r.y-84,60*r.hp/r.maxHp,4);
}
// Render darkness into its own mask; destination-out must never erase the arena.
export function createSpiderLighting(document){
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=500;const mask=canvas.getContext('2d');
 return (ctx,g,reduced=false)=>{
  if(!spiderRoom(g))return;const v=spiderVisibility(g,reduced);mask.globalCompositeOperation='source-over';mask.clearRect(0,0,1000,500);mask.fillStyle=v.electric?(reduced?'#02040a88':'#02040a44'):v.reveal?(reduced?'#02040aaa':'#02040a22'):'#02040af5';mask.fillRect(0,0,1000,500);
  mask.globalCompositeOperation='destination-out';
  const light=(x,y,r,a)=>{const grad=mask.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(0,0,0,'+a+')');grad.addColorStop(1,'rgba(0,0,0,0)');mask.fillStyle=grad;mask.fillRect(x-r,y-r,r*2,r*2);};
  light(g.player.x,g.player.y-35,v.radius,1);for(const [i,x,y] of [[0,120,150],[1,480,100],[2,860,255]])light(x,y,58,reduced?.65:.4+.3*Math.sin(g.clock*5+i*2)**2);
  mask.globalCompositeOperation='source-over';ctx.drawImage(canvas,0,0);
 };
}
