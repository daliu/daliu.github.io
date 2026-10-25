// Deterministic test player. Uses normal movement, attacks, skills and powers; never edits HP, enemy damage or victory state.
const runtime=process.env.COUNTERMEASURE_RUNTIME??new URL('../../countermeasure/',import.meta.url).href;
const {ExpeditionArena}=await import(runtime+'expedition.mjs');
const {weaponAt,TYPES}=await import(runtime+'engine.mjs');
export function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const skills=['agility','agility','plating','plating','voltage','voltage','voltage','force','force','breaker','agility','cascade'];
export function equip(g){for(const id of skills)if(g.spent<g.points&&g.skills[id]<skills.slice(0,Math.min(g.points,skills.length)).filter(n=>n===id).length)g.allocate(id,1);}
export function decide(g,t,{reckless=false}={}){
 const p=g.player,alive=g.robots.filter(r=>r.hp>0&&!r.structure);if(!alive.length)return {};
 const target=alive.slice().sort((a,b)=>{const score=r=>Math.abs(r.x-p.x)+Math.abs(r.y-p.y)*.8-(r.type==='orchestrator'?250:r.type==='chemDrone'?180:0);return score(a)-score(b);})[0];
 let weapon=2,tier=Math.min(g.maxTier,g.ultra?3:1);
 if(target.type==='chemDrone'&&!target.disarmed){weapon=3;tier=0;}
 else if(target.shell){weapon=1;tier=g.maxTier;}
 else if(target.wet<.5){weapon=3;tier=g.maxTier;}
 const floorShock=!p.mecha&&g.pools.some(pool=>g.poolAt(p,pool))&&weapon===2;if(floorShock&&p.grounded)g.jump();
 if(g.resources.electricLock>0&&weapon===2){weapon=3;tier=g.maxTier;}
 g.setTier(weapon,tier);g.weapon=weapon;
 const w=weaponAt(weapon,tier),dx=target.x-p.x,dist=Math.abs(dx),goal=Math.min(w.range*.72,weapon<2?105:235);
 let move=dist>goal?Math.sign(dx):0;
 if(dist<75&&target.windup>0&&p.dashCd===0&&!reckless){move=-Math.sign(dx);p.crouching=p.grounded;g.dash();}
 const warning=g.shots.some(s=>Math.hypot(s.x-p.x,s.y-(p.y-25))<105)||alive.some(r=>r.windup>0&&Math.abs(r.x-p.x)<150);
 if(!p.mecha&&p.grounded&&(warning||floorShock))g.jump();
 // Hover near head height, adjusting only on this controller's delayed decision tick.
 const pod=g.mechaDrop&&!g.mechaDrop.collected?g.mechaDrop:null;
 if(pod&&pod.landed){move=Math.abs(pod.x-p.x)>30?Math.sign(pod.x-p.x):0;if(p.dashCd===0&&Math.abs(pod.x-p.x)>180){p.facing=move;g.dash();}}
 const up=p.mecha&&p.y>Math.max(105,target.y-35)&&!pod;
 if(p.mecha&&warning&&g.clock%1.6<.24&&p.dashCd===0){g.dash();move=p.x>500?-1:1;}
 if(p.mecha){let module=0;if(target.shell&&g.mechTier>=3)module=2;else if(g.ultimate&&target.channel==='emp'&&g.resources.electricLock===0&&g.moduleCooldowns[4]===0)module=4;else if(g.ultimate&&target.channel==='electric')module=3;else if(g.mechTier>=4&&g.moduleCooldowns[0]>0)module=3;if(g.selectModule(module))g.useModule();}
 if(g.nearEmergency())g.pressEmergency();
 return {right:move>0,left:move<0,up,attack:true,aim:true};
}
export function play(difficulty,seed=1,{maxDeaths=20,reaction=.14,reckless=false,onEntry=null,stopAt=51,checkpoint=null}={}){
 const g=new ExpeditionArena({difficulty,random:rng(seed)});if(checkpoint){if(!g.resume(checkpoint,0))throw Error('Invalid playtest checkpoint');}else{equip(g);g.startWave();}let ticks=0,elapsed=0,think=0,input={},key='',combat=0,rows=[],status='timeout',deaths=0,attempt=0,entry=null;
 const finish=result=>{if(entry){rows.push({...entry,seconds:+combat.toFixed(2),endHP:+g.player.hp.toFixed(2),endArmor:+g.player.mechaShield.toFixed(2),damageTaken:+g.stats.damageTaken.toFixed(2),fuelEnd:g.resources.fuel,ammoEnd:g.resources.ammo,result});entry=null;}};
 while(ticks++<400000){
  const k=g.wave+':'+g.encounter+':'+attempt;
  if(g.state==='playing'&&k!==key){key=k;combat=0;entry={wave:g.wave,phase:g.encounter,attempt,hp:+g.player.hp.toFixed(2),armor:+g.player.mechaShield.toFixed(2),fuel:g.resources.fuel,ammo:g.resources.ammo,count:g.robots.length};equip(g);onEntry?.(g);think=0;}
  if(g.wave>=stopAt){status='checkpoint';break;}
  if(g.state==='dead'){finish('death');if(++deaths>maxDeaths){status='death-limit';break;}attempt++;g.retry();input={};continue;}
  if(g.state==='traveling'){g.update(.04,{right:true});elapsed+=.04;continue;}
  if(g.state==='escaping'){g.update(.04,{left:true});elapsed+=.04;continue;}
  if(g.state==='complete'){status='complete';break;}
  if(combat>180){status='stalled';finish(status);break;}
  if(think<=0){input=decide(g,elapsed,{reckless});think=reaction;}
  g.update(.04,input);think-=.04;elapsed+=.04;combat+=.04;if(g.state==='traveling'||g.state==='escaping')finish('clear');
 }
 return {difficulty,seed,status,deaths,level:g.wave,phase:g.encounter,seconds:+elapsed.toFixed(1),hp:g.player.hp,armor:g.player.mechaShield,rows,game:g};
}
