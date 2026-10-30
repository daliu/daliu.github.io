import {autoAllocate} from './auto-skills.mjs';
import {freshJump,jumpPlayer,updateJumpState} from './jump-combo.mjs';
import {breakMech,updateReassessment} from './mech-break.mjs';
import {startRollingSlash,updateRollingSlash} from './rolling-slash.mjs';
import {structureBounds,structureDistance,structureHitFraction} from './objective-geometry.mjs';
import {bodyZone,CRITICAL_MULTIPLIER,validDifficulty} from './difficulty.mjs';
import {checkpoint} from './saves.mjs';
import {SubjectRegister} from './subjects.mjs';
export const TRAINING_WAVES=9;
export const BOSS_WAVE=10;
export const FINAL_WAVE=11;
export const HIT_STUN_CHANCE={impact:.25,ultraImpact:.35,electric:.18,wetElectric:.5,lava:.5};
// Exponential curriculum: tiny early gains, pronounced late acceleration.
export function cognitionAt(wave){const growth=(Math.exp(.32*(Math.max(1,Math.min(TRAINING_WAVES,wave))-1))-1)/(Math.exp(.32*8)-1);return {growth,speed:1+.85*growth,reaction:.95-.82*growth,turn:1.05-.91*growth,windup:1-.42*growth,dodge:.03+.75*growth,crit:.01+.15*growth,discipline:growth>=.42};}
export const phaseFor=wave=>wave>=FINAL_WAVE?'Emergency protocol':wave>=BOSS_WAVE?'Mirror protocol':wave>=7?'Offensive learning':wave>=4?'Movement learning':'Defensive learning';
export const WEAPONS = [
  {id:'lamp', name:'Desk lamp', type:'impact', damage:29, cooldown:.38, range:100, color:'#f2b966', short:'Stagger & shove', detail:'Blunt damage. Heavy knockback opens a formation.'},
  {id:'sword', name:'Sword', type:'cutting', damage:34, cooldown:.64, range:130, color:'#edf0d0', short:'Cut through guards', detail:'Long melee arc. Cuts guards and insulated shells.'},
  {id:'taser', name:'Taser', type:'electric', damage:23, cooldown:.32, range:280, color:'#b7e77a', short:'Stun & short circuit', detail:'18% paralysis chance; 50% on conductive wet targets. Chains between wet robots.'},
  {id:'water', name:'Water sprayer', type:'water', damage:12, cooldown:.20, range:360, color:'#7cc9e8', short:'Soak, slow, then shock', detail:'Soaks for 5 seconds. Wet robots take 3× electrical damage; exposed wiring amplifies fluid damage.'}
];
export const UPGRADES = [
  [{}, {name:'Floor lamp',damage:37,range:145,cooldown:.46,short:'Wide blunt sweep',detail:'More reach and impact than the desk lamp, with a slower swing.'}, {name:'Street lamp',damage:49,range:195,cooldown:.58,short:'Heavy crowd control',detail:'An enormous blunt sweep. Long reach and heavy damage, but slow recovery.'}],
  [{}, {name:'Chainsaw',damage:9,range:68,cooldown:.16,short:'Fast armor shredding',detail:'Small, rapid cutting hits at close quarters. Excellent against polymer and guards.'}, {name:'Diamond chainsaw',damage:13,range:82,cooldown:.16,short:'Diamond-edged cutting',detail:'Short diamond-edged teeth deal small rapid hits. Get close to exposed wiring.'}],
  [{}, {name:'Arc projector',damage:29,range:320,cooldown:.35,short:'Longer electrical reach'}, {name:'Laser',type:'energy',damage:40,range:510,cooldown:.42,color:'#f29c87',short:'Piercing thermal beam',detail:'A piercing energy beam. Does not electrify water or gain the wet-target bonus. Heavy plating resists it.'}],
  [{}, {name:'Chemical sprayer',damage:14,range:365,corrosive:true,color:'#a9d992',short:'Mild corrosive mixture',detail:'Soaks and corrodes robots. Its conductive pools damage anyone standing in them.'}, {name:'Acid sprayer',damage:19,range:380,corrosive:true,color:'#caed70',short:'Corrode armor & floor',detail:'Stronger corrosive spray. Softens armor and leaves conductive acid pools that burn everyone faster.'}]
];
export function weaponAt(index,tier=0){return {...WEAPONS[index],...UPGRADES[index][tier],tier};}
export const SKILLS = [
  {id:'force', name:'Heavy hands', branch:'FORCE', tier:0, max:3, desc:'+16% lamp and sword damage per point.'},
  {id:'breaker', name:'Guard breaker', branch:'FORCE', tier:1, parent:'force', max:2, desc:'Ignore 25% of melee resistance per point.'},
  {id:'voltage', name:'Live wire', branch:'CIRCUIT', tier:0, max:3, desc:'+20% circuit and sprayer damage per point.'},
  {id:'cascade', name:'Chain reaction', branch:'CIRCUIT', tier:1, parent:'voltage', max:2, desc:'Taser chains to 1 extra wet robot per point.'},
  {id:'agility', name:'Quick feet', branch:'MOTION', tier:0, max:3, desc:'+10% movement speed; −12% dash cooldown per point.'},
  {id:'plating', name:'Salvaged armor', branch:'MOTION', tier:1, parent:'agility', max:2, desc:'Reduce incoming damage by 15% per point.'}
];
export const TYPES = {
  spider:{name:'Maintenance spider',color:'#9aa9b3',hp:550,speed:230,resistance:{cutting:.8,electric:1.25,energy:.85,impact:1.15},flaw:'Circuit flashes reveal it. A lamp keeps a local light. Roll out of the marked pounce, then punish the stabbing recovery.',behavior:'spider'},
  probe:{name:'Scrap bot', color:'#a4a7a0', hp:65, speed:78, resistance:{}, flaw:'Unarmored. Every tool works.', behavior:'rush'},
  guard:{name:'Guard bot', color:'#e6ad60', hp:92, speed:75, resistance:{impact:.65,cutting:1.3}, flaw:'The front guard is weak to cutting; circle behind it.', behavior:'guard'},
  plated:{name:'Plated bot', color:'#d58b68', hp:115, speed:59, resistance:{impact:.55,cutting:.5,electric:1.55,energy:.45,water:.75}, flaw:'Plating resists cutting and lasers, but conducts electricity. Slow turn speed.', behavior:'rush'},
  insulated:{name:'Polymer bot', color:'#bdc6a7', hp:88, speed:103, resistance:{electric:.25,water:.55,cutting:1.55}, flaw:'Insulation resists electricity but cuts easily.', behavior:'rush'},
  sealed:{name:'Sealed bot', color:'#82b7bb', hp:98, speed:70, resistance:{water:.3,electric:.65,impact:1.5}, flaw:'A brittle sealed casing is weak to blunt impact.', behavior:'rush'},
  interceptor:{name:'Interceptor', color:'#ba9ad5', hp:80, speed:112, resistance:{}, flaw:'Commits to a marked landing point. Dodge, then punish.', behavior:'intercept'},
  gunner:{name:'Slinger', color:'#dcce83', hp:72, speed:65, resistance:{impact:1.4}, flaw:'Fragile at close range. Sidestep the orange projectiles.', behavior:'ranged'},
  feinter:{name:'Feint bot', color:'#d69da2', hp:85, speed:97, resistance:{}, flaw:'Baits an attack, retreats, then rushes. Wait out the feint.', behavior:'feint'},
  bulwark:{name:'Bulwark',color:'#d1b296',hp:150,speed:57,resistance:{energy:.4,cutting:.55,impact:.85,electric:1.25},flaw:'Heavy plating stops piercing beams. Slow turning; use electricity or corrode the armor.',behavior:'bulwark'},
  bombardier:{name:'Bombardier',color:'#d8a365',hp:100,speed:58,resistance:{impact:1.3},flaw:'The landing rings lock before launch. Move out or jump over the blast.',behavior:'bombard'},
  flak:{name:'Flak unit',color:'#c99aa6',hp:95,speed:68,resistance:{impact:1.25},flaw:'Angled shots cover the air. Stay low, then close the gap.',behavior:'flak'},
  lancer:{name:'Lancer',color:'#e18e76',hp:110,speed:105,resistance:{cutting:1.15},flaw:'The charge commits to one direction. Dodge past it during the windup.',behavior:'lancer'},
  overseer:{name:'Overseer',color:'#ef796b',hp:900,speed:410,resistance:{},flaw:'Every weapon is countered. It can jump, but cannot fly. Reach the elevated red EMP button, then destroy the disabled core before backup reroutes.',behavior:'overseer'},
  mirror:{name:'Mirror',color:'#e9a8d1',hp:600,speed:320,resistance:{},flaw:'It learned your habits. Break them. The build freezes when the duel starts.',behavior:'mirror'}
};
export const emptyStats=()=>({attacks:[0,0,0,0],hits:[0,0,0,0],damage:[0,0,0,0],criticals:{head:0,body:0,legs:0},combos:{wetElectric:0,exposedLiquid:0,dentedElectric:0},modules:[0,0,0,0,0,0],energyAttacks:0,electricalHits:0,groundShockHits:0,stationaryTime:0,duckTime:0,jumps:0,dashes:0,rolls:0,airDashes:0,close:0,far:0,samples:0,time:0,damageTaken:0});
export const emptyMemory=()=>({waves:0,weapon:[.25,.25,.25,.25],energyShare:0,groundShockShare:0,groundShockHits:0,stationaryRatio:0,duckRatio:0,attackRate:1,jumpRate:0,dashRate:0,farRatio:.5,history:[]});
export function summarize(s){
  const total=s.attacks.reduce((a,b)=>a+b,0);
  return {groundShockShare:s.electricalHits?s.groundShockHits/s.electricalHits:0,groundShockHits:s.groundShockHits??0,stationaryRatio:s.samples?(s.stationaryTime??0)/s.samples:0,duckRatio:s.samples?(s.duckTime??0)/s.samples:0,weapon:s.attacks.map(n=>total?n/total:.25),energyShare:s.attacks[2]?s.energyAttacks/s.attacks[2]:0,attackRate:total/Math.max(1,s.time),jumpRate:s.jumps/Math.max(1,s.time),dashRate:s.dashes/Math.max(1,s.time),farRatio:s.samples?s.far/s.samples:.5,rollRate:(s.rolls??0)/Math.max(1,s.time),airDashRate:(s.airDashes??0)/Math.max(1,s.time),total};
}
export function learn(memory,stats){
  const s=summarize(stats), a=memory.waves===0?1:.65;
  return {waves:memory.waves+1,groundShockShare:(memory.groundShockShare??0)*(1-a)+s.groundShockShare*a,groundShockHits:(memory.groundShockHits??0)+s.groundShockHits,stationaryRatio:(memory.stationaryRatio??0)*(1-a)+s.stationaryRatio*a,duckRatio:(memory.duckRatio??0)*(1-a)+s.duckRatio*a,weapon:memory.weapon.map((v,i)=>v*(1-a)+s.weapon[i]*a),energyShare:(memory.energyShare??0)*(1-a)+s.energyShare*a,attackRate:(memory.attackRate??1)*(1-a)+s.attackRate*a,jumpRate:memory.jumpRate*(1-a)+s.jumpRate*a,dashRate:memory.dashRate*(1-a)+s.dashRate*a,farRatio:memory.farRatio*(1-a)+s.farRatio*a,history:[...memory.history,{...s,damageTaken:stats.damageTaken}].slice(-TRAINING_WAVES)};
}
export function makePlan(wave,memory){
  const phase=phaseFor(wave),sampleAttacks=memory.history.reduce((n,s)=>n+s.total,0);
  if(wave===1)return {wave,phase,units:['probe'],tactic:'Calibration',reason:'No combat data yet. The first machine is learning what a human does.',flaw:TYPES.probe.flaw,adaptation:'No adaptation yet',observations:[],sampleAttacks:0,boots:false};
  if(wave===FINAL_WAVE)return {wave,phase,units:['overseer'],tactic:'Total countermeasure',reason:'The factory kept one machine in reserve. It counters every weapon in the training set.',adaptation:'All counters online. Flight was never in its model.',flaw:TYPES.overseer.flaw,observations:['Carry your mecha into the emergency chamber. Hold W to fly; press Enter or click near the high red button. EMP disables the machine for 12 seconds. Destroy its core before backup reroutes.'],sampleAttacks,boots:false};
  if(wave===BOSS_WAVE)return {wave,phase,units:['mirror'],tactic:'Mirror protocol',reason:'Nine waves were a training set. The next machine copies the build you bring into the duel.',adaptation:'Your weapons. Your skills. Your habits.',flaw:TYPES.mirror.flaw,observations:[`Learned ${memory.farRatio>.62?'ranged':'close-range'} spacing, ${memory.jumpRate.toFixed(1)} jumps/s, ${memory.dashRate.toFixed(1)} dashes/s and ${memory.attackRate.toFixed(1)} attacks/s.`],sampleAttacks,boots:false};
  const dominant=memory.weapon.indexOf(Math.max(...memory.weapon));
  const map=['guard','plated',memory.energyShare>.5?'plated':'insulated','sealed'];
  let type=map[dominant],tactic='Resist & survive',specialist=null,movement=null;
  let reason=`${WEAPONS[dominant].name} made up ${Math.round(memory.weapon[dominant]*100)}% of your recent attacks.`;
  if(dominant===2)reason=`${memory.energyShare>.5?'Laser':'Taser / arc projector'} attacks dominated your circuit weapon use (${Math.round(memory.weapon[2]*100)}% of all attacks).`;
  const observations=[reason];
  const boots=(memory.groundShockHits??0)>=2&&(memory.groundShockShare??0)>.3;
  if(boots)observations.push(`${Math.round(memory.groundShockShare*100)}% of electrical hits caught a robot standing in fluid. Rubber boots isolate selected units from ground conduction.`);
  if(wave>=4){
    if(memory.jumpRate>.15){specialist=memory.weapon[2]+memory.weapon[3]>.35?'bulwark':'interceptor';tactic='Intercept aerial habits';observations.push(`You jump ${memory.jumpRate.toFixed(1)} times per second. ${specialist==='bulwark'?'Heavy units will jump to intercept shots.':'Interceptors will contest your landings.'}`);}
    else if(memory.dashRate>.12){specialist='feinter';tactic='Bait & punish';observations.push('You dodge frequently. Feints test your recovery timing.');}
    else{specialist='interceptor';tactic='Pin & surround';observations.push('Grounded movement is predictable. Interceptors pressure your escape routes.');}
  }
  movement=specialist;
  if(wave>=7){
    if(memory.jumpRate>.15){specialist='flak';tactic='Anti-air crossfire';observations.push('Frequent jumping prompted an angled anti-air volley.');}
    else if((memory.stationaryRatio??0)>.6){specialist='bombardier';tactic='Arcing bombardment';observations.push(`You stayed in place for ${Math.round(memory.stationaryRatio*100)}% of combat. Bombardiers aim at that position, then lock their landing zones.`);}
    else if(memory.dashRate>.12||memory.weapon[0]+memory.weapon[1]>.5){specialist='lancer';tactic='Telegraphed rush';observations.push('Your mobile close-range attacks prompted committed charge attacks.');}
    else{specialist='gunner';tactic='Screen & fire';observations.push('Your distant attacks prompted ranged pressure behind a defensive screen.');}
  }
  const count=Math.min(5,1+Math.floor(wave*.7)),units=[type];
  if(wave>=7&&movement)units.push(movement);
  if(specialist)units.push(specialist);
  while(units.length<count)units.push(units.length%2===0?type:'probe');
  if(wave>=7&&count>=4)units[units.length-1]=specialist;
  const adaptation=`Deploy ${TYPES[type].name.toLowerCase()}${specialist?' + '+TYPES[specialist].name.toLowerCase():''}${boots?' / rubber boots':''}`;
  return {wave,phase,units,tactic,reason,adaptation,flaw:[TYPES[type].flaw,wave>=7&&movement?TYPES[movement].flaw:'',specialist?TYPES[specialist].flaw:'',boots?'Boots stop grounded conduction, not direct hits or airborne wet shocks.':''].filter(Boolean).join(' '),observations,sampleAttacks,boots};
}
export class Arena{
  constructor({register,random=Math.random,difficulty='normal'}={}){this.difficulty=validDifficulty(difficulty)?difficulty:'normal';this.random=random;this.register=register??new SubjectRegister();this.reset();}
  reset(){this.robotReassessment=0;this.register.close('reassigned',this.wave??0,'protocol reset');this.subject=this.register.issue();this.wave=0;this.runDeaths=0;this.escape=null;this.entryCheckpoint=null;this.pausedFrom=null;this.state='briefing';this.memory=emptyMemory();this.plan=this.makePlan(1,this.memory);this.skills=Object.fromEntries(SKILLS.map(s=>[s.id,0]));this.points=5;this.weapon=0;this.weaponTiers=[0,0,0,0];this.unlockedTier=0;this.mirrorBlueprint=null;this.finaleCheckpoint=null;this.emergency=null;this.mechaDrop=null;this.pools=[];this.robots=[];this.shots=[];this.effects=[];this.events=[];this.stats=emptyStats();this.kills=0;this.clock=0;this.player={x:200,y:420,vx:0,vy:0,hp:100,facing:1,...freshJump(),grounded:true,crouching:false,rollTime:0,spinTime:0,spinQueue:0,spinHits:null,flying:false,wet:0,corrosion:0,corrosionTier:0,corrosionTick:0,hazardCd:0,exposed:0,dented:0,paralyzed:0,dashCrit:0,mecha:false,mechaShield:0,attackCd:0,dashCd:0,dashTime:0,invulnerable:0};}
  get bossWave(){return BOSS_WAVE;}
  get finalWave(){return FINAL_WAVE;}
  makePlan(wave,memory){return makePlan(wave,memory);}
  validateCheckpoint(data){return checkpoint(data);}
  cognition(wave){return cognitionAt(wave);}
  updateSpecialRobot(){return false;}
  get calibrationOnly(){return this.wave===1;}
  get trial(){return this.runDeaths+1;}
  snapshot(wave=this.wave){return {version:1,wave:Math.max(1,wave),points:this.points,skills:{...this.skills},tiers:[...this.weaponTiers],weapon:this.weapon,memory:structuredClone(this.memory),mirrorBlueprint:structuredClone(this.mirrorBlueprint),finaleCheckpoint:structuredClone(this.finaleCheckpoint),runDeaths:this.runDeaths,kills:this.kills};}
  resume(data,deaths=null){const c=this.validateCheckpoint(data);if(!c)return false;if(this.subject.status!=='active')this.subject=this.register.issue();this.memory=c.memory;this.skills=c.skills;this.points=c.points;this.weaponTiers=c.tiers;this.unlockedTier=Math.max(...c.tiers);this.weapon=c.weapon;this.mirrorBlueprint=c.mirrorBlueprint;this.finaleCheckpoint=c.finaleCheckpoint;this.runDeaths=Number.isInteger(deaths)&&deaths>=0?deaths:c.runDeaths;this.kills=c.kills;this.plan=this.makePlan(c.wave,this.memory);this.state='between';return this.startWave();}
  pause(){if(['playing','escaping'].includes(this.state)){this.pausedFrom=this.state;this.state='paused';}else if(this.state==='paused'){this.state=this.pausedFrom??'playing';this.pausedFrom=null;}}
  beginEscape(){this.state='escaping';this.escape={time:0,door:0,burst:0,blasts:[]};this.pools=[];this.shots=[];this.effects=[];this.events=[];this.player.invulnerable=10;}
  updateEscape(dt,input){const p=this.player,e=this.escape;this.clock+=dt;e.time+=dt;e.door=Math.min(1,Math.max(0,(e.time-.6)/1.6));e.burst-=dt;if(e.burst<=0){e.burst=.28;e.blasts.push({x:140+(e.blasts.length*137+Math.floor(e.time*10)*41)%800,y:100+(Math.floor(e.time*7)*53)%300,age:0});}for(const b of e.blasts)b.age+=dt;e.blasts=e.blasts.filter(b=>b.age<1.2);
    const move=(input.right?1:0)-(input.left?1:0);if(move)p.facing=move;p.vx=move*320*(1+.1*this.skills.agility)*(p.mecha?1.15:1);p.x=Math.max(e.door<1?75:-45,Math.min(978,p.x+p.vx*dt));p.flying=p.mecha&&!!input.up;if(p.flying){p.vy=-255;p.grounded=false;}else p.vy+=1250*dt;p.y=Math.max(86,p.y+p.vy*dt);if(p.y>=420){p.y=420;p.vy=0;p.grounded=true;}updateJumpState(p,dt);
    if(e.door===1&&p.x<-20&&p.y>350){this.register.close('survived',this.wave,'factory escape / EMP');this.subject=this.register.current;this.state='complete';}
  }
  get maxTier(){const wave=this.state==='between'?this.plan.wave:this.wave;return wave>=5?2:wave>=3?1:0;}
  autoUpgrade(){const tier=this.maxTier;if(tier<=(this.unlockedTier??0))return false;this.unlockedTier=tier;this.weaponTiers=this.weaponTiers.map(()=>tier);this.event('WEAPONS UPGRADED', '#9ee6ee');return true;}
  get activeWeapon(){return weaponAt(this.weapon,this.weaponTiers[this.weapon]);}
  setTier(index,tier){if(!Number.isInteger(index)||index<0||index>3||!Number.isInteger(tier)||tier<0||tier>this.maxTier)return false;this.weaponTiers[index]=tier;return true;}
  get spent(){return Object.values(this.skills).reduce((a,b)=>a+b,0);}
  allocate(id,delta){const s=SKILLS.find(s=>s.id===id);if(!s||![-1,1].includes(delta))return false;const value=this.skills[id]+delta;if(value<0||value>s.max||delta>0&&(this.spent>=this.points||s.parent&&!this.skills[s.parent]))return false;if(value===0&&SKILLS.some(s=>s.parent===id&&this.skills[s.id]>0))return false;this.skills[id]=value;return true;}
  respec(){for(const id in this.skills)this.skills[id]=0;}
  startWave(){if(this.state!=='briefing'&&this.state!=='between')return false;if(this.autoSkills)autoAllocate(this);this.premiumBoosts={armor:this.premiumNext?.armor===true,thrusters:this.premiumNext?.thrusters===true};this.wave=this.plan.wave;this.robotReassessment=0;this.escape=null;const carry=this.wave===this.finalWave?this.finaleCheckpoint:null;this.state='playing';this.stats=emptyStats();this.pools=[];this.shots=[];this.effects=[];this.mechaDrop=null;Object.assign(this.player,{x:200,y:420,vx:0,vy:0,hp:100,attackCd:0,dashCd:0,dashTime:0,invulnerable:1.2,...freshJump(),grounded:true,crouching:false,rollTime:0,spinTime:0,spinQueue:0,spinHits:null,flying:false,wet:0,corrosion:0,corrosionTier:0,corrosionTick:0,hazardCd:0,exposed:0,dented:0,paralyzed:0,dashCrit:0,mecha:false,mechaShield:0});if(this.wave===this.finalWave){Object.assign(this.player,carry??{hp:100,mecha:false,mechaShield:0});this.emergency={x:900,y:108,activated:false,pulse:0,backup:0,uses:0};if(!this.player.mecha)this.mechaDrop={x:200,y:420,vy:0,landed:true,collected:false};this.events=[];this.event('HOLD W TO FLY — reach the red emergency button.','#ef796b');}if(this.wave===this.bossWave&&!this.mirrorBlueprint)this.mirrorBlueprint={skills:{...this.skills},tiers:[...this.weaponTiers],weapon:this.weapon,style:structuredClone(this.memory),subject:{...this.subject}};this.robots=this.plan.units.map((type,i)=>{const r=this.spawn(type,i);r.boots=!!this.plan.boots&&i%2===0;return r;});this.entryCheckpoint=this.snapshot();return true;}
  spawn(type,i){const t=TYPES[type], hp=['mirror','overseer'].includes(type)?t.hp:t.hp*(1+Math.min(5,this.wave-1)*.09);const r={id:`${this.wave}-${i}`,type,x:700+i*58,y:420,vy:0,hp,maxHp:hp,facing:-1,cooldown:1+i*.35,wet:0,corrosion:0,stun:0,flash:0,windup:0,action:'',target:0,phase:0,turn:0,cognition:this.cognition(this.wave),sense:0,targetX:this.player.x,targetY:this.player.y,targetVX:0,dodgeTime:0,dodgeCd:0,dodgeDir:0,paralyzed:0,exposed:0,dented:0,hazardCd:0,corrosionTier:0,shield:type==='guard'?90:0,maxShield:type==='guard'?90:0,disabled:false,jumps:0,jumpCd:0};if(type==='mirror'){r.build=structuredClone(this.mirrorBlueprint??{skills:this.skills,tiers:this.weaponTiers,weapon:this.weapon,style:this.memory});Object.assign(r,{weapon:r.build.weapon,reaction:0,targetX:this.player.x,jumpCd:1.5,dashCd:1.8,dashTime:0,decisions:0,attacks:[0,0,0,0],jumps:0,dashes:0});}return r;}
  event(text,color='#b7e77a'){this.events.push({text,color,time:3});if(this.events.length>4)this.events.shift();}
  jump(){return jumpPlayer(this);}
  dash(){const p=this.player;if(this.state!=='playing'||p.dashCd>0)return;const rolling=p.grounded&&p.crouching;p.rollTime=rolling?.34:0;p.dashTime=rolling?.34:.16;p.dashCrit=.4;p.dashCd=1.25*(1-.12*this.skills.agility);p.invulnerable=.23;this.stats.dashes++;if(rolling)this.stats.rolls++;else if(!p.grounded)this.stats.airDashes++;this.effects.push({kind:'dash',x:p.x,y:p.y,life:.22,max:.22,color:'#b7e77a'});}
  rollingSlash(){return startRollingSlash(this);}
  addPool(x,chemical=0,owner=null){const fluid=chemical===true?1:Number(chemical)||0;x=Math.max(25,Math.min(975,x));const near=this.pools.find(p=>p.fluid===fluid&&(p.owner??null)===owner&&Math.abs(p.x-x)<55);if(near){near.life=10;return near;}const pool={x,radius:48,life:10,charged:0,fluid,owner,corrosive:fluid>0};this.pools.push(pool);if(this.pools.length>18)this.pools.shift();return pool;}
  poolAt(entity,pool){return entity.y>=414&&Math.abs(entity.x-pool.x)<pool.radius+12;}
  conducts(entity,pool){return this.poolAt(entity,pool)&&!entity.boots;}
  conductiveNetwork(entities){const connected=new Set(this.pools.filter(pool=>entities.some(e=>this.conducts(e,pool))));let grew=true;while(grew){grew=false;for(const pool of this.pools)if(!connected.has(pool)&&[...connected].some(p=>Math.abs(p.x-pool.x)<=p.radius+pool.radius)){connected.add(pool);grew=true;}}return [...connected];}
  electrify(targets){const connected=new Set(this.pools.filter(pool=>this.poolAt(this.player,pool)||targets.some(r=>this.conducts(r,pool))));let grew=true;while(grew){grew=false;for(const pool of this.pools)if(!connected.has(pool)&&[...connected].some(p=>Math.abs(p.x-pool.x)<=p.radius+pool.radius)){connected.add(pool);grew=true;}}
    for(const pool of connected)pool.charged=.55;
    if([...connected].some(pool=>this.poolAt(this.player,pool))){this.event('SELF-SHOCK! Jump clear of conductive pools.','#f07f66');this.hurt(18,this.player.x,0,'conductive-floor discharge');}
    for(const r of this.robots)if(r.hp>0&&!targets.includes(r)&&[...connected].some(pool=>this.conducts(r,pool)))this.hit(r,2,.6);
  }
  checkMechaDrop(){const boss=this.robots.find(r=>r.type==='mirror'&&r.hp>0);if(!boss||this.mechaDrop||boss.hp>boss.maxHp*.35)return;this.mechaDrop={x:500,y:-70,vy:420,landed:false,collected:false};this.event('MECHA INBOUND — collect the marked pod at arena center.','#b7e77a');}
  updateMecha(dt){this.checkMechaDrop();const d=this.mechaDrop;if(!d||d.collected)return;if(!d.landed){d.y=Math.min(420,d.y+d.vy*dt);if(d.y===420)d.landed=true;}if(d.landed&&Math.abs(this.player.x-d.x)<48&&this.player.y>370){d.collected=true;this.player.mecha=true;this.player.mechaShield=60;this.player.invulnerable=Math.max(this.player.invulnerable,.8);this.effects.push({kind:'burst',x:d.x,y:d.y-40,life:.8,max:.8,color:'#b7e77a'});this.event('MECHA ONLINE — +65% damage / +15% speed / armor 60.');}}
  nearEmergency(){const e=this.emergency,p=this.player;return !!e&&Math.abs(p.x-e.x)<68&&Math.abs(p.y-30-e.y)<55;}
  pressEmergency(){if(this.state!=='playing'||this.wave!==this.finalWave||!this.nearEmergency()||this.emergency.activated)return false;const e=this.emergency,r=this.robots.find(r=>r.type==='overseer'&&r.hp>0);if(!r)return false;e.activated=true;e.uses++;e.pulse=1.2;e.backup=12;r.disabled=true;r.hp=Math.min(r.hp,240);r.windup=0;r.action='';r.vy=0;r.wet=r.corrosion=r.stun=r.paralyzed=0;this.shots=[];this.pools=[];Object.assign(this.player,{wet:0,corrosion:0,exposed:0,dented:0,invulnerable:1.2,attackCd:.2});this.effects.push({kind:'emp',x:e.x,y:e.y,life:1.2,max:1.2,color:'#b3e9ec'});this.event('EMP FIRED — destroy the core before backup reroutes!','#b3e9ec');return true;}
  countered(r,weapon=null){if(weapon!==null)r.counterWeapon=weapon;r.cooldown=Math.min(r.cooldown,.25);if(!r.counterFlash||r.counterFlash<=0){r.counterFlash=.3;this.effects.push({kind:'number',x:r.x,y:r.y-90,text:'COUNTERED',life:.5,max:.5,color:'#ef796b'});}}
  updateOverseer(r,dt){const p=this.player,e=this.emergency;r.counterFlash=Math.max(0,(r.counterFlash??0)-dt);r.jumpCd=Math.max(0,r.jumpCd-dt);
    if(r.disabled){if(!e)return;e.backup=Math.max(0,e.backup-dt);if(e.backup===0){r.disabled=false;e.activated=false;r.cooldown=.8;this.event('BACKUP ROUTED — counters online. Hit the red button again.','#ef796b');}return;}
    const dx=p.x-r.x;r.facing=Math.sign(dx)||r.facing;
    if(r.windup>0){r.windup-=dt;if(r.windup<=0){this.effects.push({kind:'attack',x:r.x,y:r.y-30,dir:r.facing,range:650,weapon:r.counterWeapon??2,energy:true,life:.2,max:.2,color:'#ef796b'});if(Math.abs(p.x-r.x)<650&&Math.abs(p.y-r.y)<70)this.botHurt(r,25,r.x,0,'total countermeasure');r.cooldown=.65;}return;}
    if(Math.abs(dx)>46)r.x=Math.max(30,Math.min(970,r.x+Math.sign(dx)*410*(r.crippled?.3:1)*dt));
    // A single ground-launched ballistic jump. No thrust, hover, or midair jump resets.
    if(!r.crippled&&p.y<360&&r.y>=420&&r.jumpCd===0){r.vy=-610;r.jumpCd=.9;r.jumps++;}
    if(r.cooldown<=0&&Math.abs(dx)<650){r.windup=.3;r.action='counter-strike';}
  }
  mirrorWeapon(r){return weaponAt(r.weapon,r.build.tiers[r.weapon]);}
  mirrorAttack(r){const p=this.player,w=this.mirrorWeapon(r),skills=r.build.skills;this.effects.push({kind:'attack',x:r.x,y:r.y-22,dir:r.facing,range:w.range,weapon:r.weapon,energy:w.type==='energy',life:.22,max:.22,color:'#e9a8d1'});r.attacks[r.weapon]++;
    const within=Math.abs(p.x-r.x)<w.range&&(p.x-r.x)*r.facing>-18&&Math.abs((p.y-(p.crouching?9:23))-(r.y-23))<(p.crouching&&r.weapon>=2?11:70);
    if(r.weapon===3)for(let distance=65;distance<=w.range;distance+=75)this.addPool(r.x+r.facing*distance,w.corrosive?w.tier:0);
    if(within){let damage=w.damage*(1+(r.weapon<2?.16*skills.force:.2*skills.voltage))*.65;if(r.weapon===3&&p.exposed>0)damage*=1.75;if(w.type==='electric'){if(p.wet>0)damage*=3;if(p.dented>0)damage*=1.08;}this.botHurt(r,damage,r.x,r.weapon<2?.25*skills.breaker:0);if(r.weapon===1)p.exposed=6;if(r.weapon===0)p.dented=5;if(r.weapon===3){p.wet=5;if(w.corrosive){p.corrosion=4;p.corrosionTier=w.tier;}}}
    if(w.type==='electric'){const network=this.conductiveNetwork(within?[r,p]:[r]);for(const pool of network)pool.charged=.55;if(network.some(pool=>this.poolAt(p,pool)))this.hurt(18,r.x);if(network.some(pool=>this.poolAt(r,pool))){this.damageRobot(r,18*(1-.15*skills.plating));}}
    r.cooldown=Math.max(w.cooldown,.65,1/Math.max(.3,r.build.style.attackRate??1));r.decisions++;let weight=(r.decisions*.61803398875)%1;for(let i=0;i<4;i++){weight-=r.build.style.weapon[i];if(weight<=0){r.weapon=i;break;}}
  }
  updateMirror(r,dt){const p=this.player,style=r.build.style,skills=r.build.skills;r.reaction-=dt;r.jumpCd-=dt;r.dashCd-=dt;r.dashTime=Math.max(0,r.dashTime-dt);
    if(r.reaction<=0){r.targetX=p.x;r.reaction=.2;}
    const dx=r.targetX-r.x,dist=Math.abs(dx),w=this.mirrorWeapon(r);r.facing=Math.sign(dx)||r.facing;r.crouching=r.y>=420&&(this.clock%3)<3*(style.duckRatio??0);
    if(r.windup>0){r.windup-=dt;if(r.windup<=0)this.mirrorAttack(r);return;}
    const spacing=style.farRatio>.62?w.range*.72:Math.min(90,w.range*.6);let move=dist>spacing+14?Math.sign(dx):dist<spacing-35?-Math.sign(dx):0;
    if(style.jumpRate>.05&&!r.crippled&&r.jumpCd<=0&&r.y>=420){r.vy=-510;r.jumpCd=Math.max(1,1/style.jumpRate);r.jumps++;}
    if(style.dashRate>.05&&!r.crippled&&r.dashCd<=0&&dist>100){r.dashTime=.16;r.dashCd=Math.max(1.25*(1-.12*skills.agility),1/style.dashRate);r.dashes++;}
    r.x=Math.max(30,Math.min(970,r.x+(r.dashTime>0?r.facing*900:move*320*(1+.1*skills.agility))*(r.crippled?.3:1)*(r.wet>0?.72:1)*(r.crouching?.45:1)*dt));
    if(r.cooldown<=0&&Math.abs(p.x-r.x)<w.range+5){r.windup=w.type==='energy'?.65:.48;r.action='mirror-strike';}
  }
  bombard(r){const flight=1.15,gravity=760,start=r.y-50;for(const offset of [-48,0,48]){const target=Math.max(35,Math.min(965,r.target+offset));this.shots.push({kind:'mortar',x:r.x,y:start,vx:(target-r.x)/flight,vy:(412-start-.5*gravity*flight*flight)/flight,gravity,life:3,targetX:target,ownerX:r.x,owner:r.id,critical:this.random()<r.cognition.crit});}}
  flak(r){for(const vy of [-180,-300,-420])this.shots.push({kind:'flak',x:r.x,y:r.y-36,vx:r.facing*240,vy,gravity:600,life:3,ownerX:r.x,owner:r.id,critical:this.random()<r.cognition.crit});}
  aimAtNearest(range,structures=true){const p=this.player,target=this.robots.filter(r=>r.hp>0&&(structures||!r.structure)&&(r.structure?p.y-23>=structureBounds(r).top&&p.y-23<=structureBounds(r).bottom:Math.abs(r.y-p.y)<(p.mecha?105:75))&&Math.abs(r.x-p.x)<range).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];if(target)p.facing=Math.sign(target.x-p.x)||p.facing;return target;}
  attack(){if(!['playing','traveling'].includes(this.state))return;if(this.pressEmergency())return;if(this.aimAssist)this.aimAtNearest(this.activeWeapon.range*(this.player.mecha?1.15:1));const p=this.player,w=this.activeWeapon;if(p.attackCd>0)return;p.attackCd=w.cooldown;this.stats.attacks[this.weapon]++;if(w.type==='energy')this.stats.energyAttacks++;this.effects.push({kind:'attack',source:'player',x:p.x,y:p.y-22,dir:p.facing,range:w.range*(p.mecha?1.15:1),weapon:this.weapon,energy:w.type==='energy',life:.16,max:.16,color:w.color});
    const targets=this.robots.filter(r=>r.hp>0&&(r.structure?structureHitFraction(r,p.x,p.y-23,p.x+p.facing*w.range*(p.mecha?1.15:1),p.y-23)!==null:Math.abs((r.y-(r.crouching?9:23))-(p.y-23))<(r.crouching&&this.weapon>=2?11:p.mecha?100:75)&&(r.x-p.x)*p.facing>-18&&(r.x-p.x)*p.facing<w.range*(p.mecha?1.15:1))).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
    let chosen=this.weapon<2||w.type==='energy'?targets:targets.slice(0,1);
    if(w.type==='energy'){const stop=chosen.findIndex(r=>r.type==='bulwark');if(stop>=0){chosen=chosen.slice(0,stop+1);this.effects[this.effects.length-1].range=Math.abs(chosen.at(-1).x-p.x);}}
    if(this.weapon===3){const end=chosen.length?Math.max(80,Math.abs(chosen[0].x-p.x)):w.range;for(let distance=65;distance<=end+20;distance+=75)this.addPool(p.x+p.facing*distance,w.corrosive?w.tier:0);}
    for(const r of chosen){this.hit(r,this.weapon);if(w.type==='electric'&&this.skills.cascade&&r.wet>0){const chain=this.robots.filter(o=>o!==r&&o.hp>0&&o.wet>0&&Math.abs(o.x-r.x)<175).slice(0,this.skills.cascade);for(const o of chain){this.hit(o,2,.7);this.effects.push({kind:'arc',x:r.x,y:r.y-24,x2:o.x,y2:o.y-24,life:.22,max:.22,color:w.color});}}}
    if(w.type==='electric')this.electrify(chosen);
  }
  damageRobot(r,damage,{color='#caed70',critical=false,number=false}={}){if(r.hp<=0)return;if(r.type==='overseer'&&!r.disabled){if(number)this.countered(r);return;}r.hp-=damage;r.flash=.10;if(number)this.effects.push({kind:'number',x:r.x,y:r.y-65,text:`${critical?'CRIT '+(r.lastCritical??'body').toUpperCase()+' ':''}${Math.round(damage)}`,life:.65,max:.65,color:critical?'#fff0a3':color});if(r.type==='mirror')this.checkMechaDrop();if(r.hp<=0){this.kills++;this.effects.push({kind:'burst',x:r.x,y:r.y-25,life:.5,max:.5,color:TYPES[r.type].color});}}
  bossCriticalBonus(){return 0;}
  tryHitStun(r,chance,duration,paralysis=0){if(r.hp<=0||r.structure||r.controlRecovery>0||this.random()>=chance)return false;r.stun=Math.max(r.stun??0,duration);if(paralysis)r.paralyzed=Math.max(r.paralyzed??0,paralysis);return true;}
  hit(r,weapon,scale=1){if(r.type==='overseer'&&!r.disabled&&r.hp>0){this.countered(r,weapon);return;}if(r.hp<=0||r.type==='mirror'&&r.dashTime>0&&!(this.robotReassessment>0))return;r.lastHitStunned=false;const w=weaponAt(weapon,this.weaponTiers[weapon]),t=TYPES[r.type],p=this.player,front=r.type==='guard'&&r.shield>0&&(p.x-r.x)*r.facing>0;let resistance=r.type==='mirror'?1-.15*r.build.skills.plating:t.resistance[w.type]??1;
    if(r.type==='guard'&&w.type==='impact')resistance=front?.4:1.2;
    if(r.corrosion>0&&resistance<1)resistance+=(1-resistance)*.3;
    if(weapon<2&&resistance<1)resistance+=(1-resistance)*(.25*this.skills.breaker);
    const zone=bodyZone(p,r),critical=this.random()<.06+(p.dashCrit>0?.24:0)+(r.paralyzed>0?.22:0)+this.bossCriticalBonus(r);
    let damage=w.damage*resistance*scale*(1+(weapon<2?.16*this.skills.force:.2*this.skills.voltage))*(p.mecha?1.65:1)*(critical?CRITICAL_MULTIPLIER[zone]:1);
    if(critical){r.lastCritical=zone;r.criticalFlash=.55;if(zone==='legs'&&!r.structure&&!TYPES[r.type].flying){r.legTrauma=(r.legTrauma??0)+1;if(r.legTrauma>=(r.super?3:2)||!r.super&&this.random()<.4){r.crippled=true;r.stun=Math.max(r.stun,1.2);r.vy=Math.max(0,r.vy);r.dodgeTime=0;r.dashTime=0;r.windup=0;r.action='';}}}
    if(w.type==='electric'){this.stats.electricalHits++;if(this.pools.some(pool=>this.poolAt(r,pool)))this.stats.groundShockHits++;const conductive=r.wet>0&&!(r.boots&&r.y>=414);if(conductive)damage*=3;if(r.dented>0)damage*=1.08;r.lastHitStunned=this.tryHitStun(r,conductive?HIT_STUN_CHANCE.wetElectric:HIT_STUN_CHANCE.electric,r.type==='insulated'?.08:.2,r.type==='mirror'?.45:.95);}
    if(weapon===3){if(r.exposed>0)damage*=1.75;r.wet=5;if(w.corrosive){r.corrosion=4;r.corrosionTier=w.tier;r.corrosionOwner=null;}}
    if(weapon===1)r.exposed=6;
    if(weapon===0){r.dented=5;if(!r.structure)r.x=Math.max(30,Math.min(970,r.x+p.facing*24));r.lastHitStunned=this.tryHitStun(r,this.ultra?HIT_STUN_CHANCE.ultraImpact:HIT_STUN_CHANCE.impact,.18);}
    if(front){r.shield=Math.max(0,r.shield-w.damage*scale*(weapon===0?1.4:weapon===1?.85:.2));if(r.shield===0){this.event('SHIELD BROKEN — guard exposed.','#f2b966');this.effects.push({kind:'shield-drop',x:r.x+r.facing*26,y:r.y-30,life:.8,max:.8,color:'#d8ad68'});}}
    if(critical)this.stats.criticals[zone]++;
    if(w.type==='electric'&&r.wet>0&&!(r.boots&&r.y>=414))this.stats.combos.wetElectric++;
    if(w.type==='electric'&&r.dented>0)this.stats.combos.dentedElectric++;
    if(weapon===3&&r.exposed>0)this.stats.combos.exposedLiquid++;
    this.stats.hits[weapon]++;this.stats.damage[weapon]+=damage;if(r.type==='mirror')r.stun=Math.min(r.stun,.18);this.damageRobot(r,damage,{color:w.color,critical,number:true,weapon,damageType:w.type,tier:w.tier});
  }
  botHurt(r,damage,fromX=r.x,penetration=0,cause='combat trauma',critical=null,feedbackAttack=null){critical??=this.random()<r.cognition.crit;this.hurt(damage*(critical?1.65:1),fromX,penetration,cause,{critical,feedbackAttack});}
  robotShotHitsAlly(){return true;}
  friendlyDamage(source,target,damage,critical=false){if(target.hp<=0||source===target.id)return;this.damageRobot(target,damage*(critical?1.65:1),{color:'#e9a165',critical,number:true});}
  friendlyRisk(r,range=600){return this.robots.some(o=>o!==r&&o.hp>0&&!o.structure&&(o.x-r.x)*r.facing>0&&Math.abs(o.x-r.x)<range&&Math.abs(o.y-r.y)<55);}
  senseRobot(r,dt){const p=this.player,c=r.cognition;r.sense-=dt;r.dodgeCd=Math.max(0,r.dodgeCd-dt);if(r.sense>0)return;r.sense=c.reaction;r.targetX=p.x;r.targetY=p.y;r.targetVX=p.vx;
    if(r.turn<=0&&r.windup<=0){r.facing=Math.sign(p.x-r.x)||r.facing;r.turn=(r.type==='guard'||r.type==='plated'||r.type==='bulwark'?c.turn:c.reaction*.6);}
    const threat=this.effects.some(e=>e.kind==='attack'&&e.weapon!==undefined&&e.color!=='#e9a8d1'&&e.life>0&&(r.x-e.x)*e.dir>0&&Math.abs(r.x-e.x)<e.range+55&&Math.abs(r.y-(e.y+22))<90);
    if(threat&&!r.crippled&&r.windup<=0&&r.dodgeCd===0&&this.random()<c.dodge){r.dodgeTime=.28;r.dodgeCd=.75;r.dodgeDir=Math.sign(r.x-p.x)||r.facing;if(c.growth>.4&&p.y>=400&&r.y>=420&&this.activeWeapon.range>200){r.vy=-430;}else if(c.growth>.6&&p.y<380){r.dodgeDir=-r.dodgeDir;}this.effects.push({kind:'dash',x:r.x,y:r.y,life:.2,max:.2,color:'#e9a165'});}
  }
  statusDamage(entity,dt,isPlayer=false){entity.wet=Math.max(0,entity.wet-dt);entity.corrosion=Math.max(0,entity.corrosion-dt);entity.exposed=Math.max(0,entity.exposed-dt);entity.dented=Math.max(0,entity.dented-dt);entity.paralyzed=Math.max(0,entity.paralyzed-dt);entity.hazardCd=Math.max(0,entity.hazardCd-dt);
    const touching=this.pools.filter(pool=>pool.life>0&&this.poolAt(entity,pool));for(const pool of touching){if(!entity.boots)entity.wet=Math.max(entity.wet,.5);}
    const corrosive=touching.filter(p=>p.fluid>0).sort((a,b)=>b.fluid-a.fluid||Number(!!a.owner)-Number(!!b.owner))[0],chemical=corrosive?.fluid??0;if(chemical){entity.corrosionOwner=corrosive.owner??null;entity.corrosion=Math.max(entity.corrosion,.6);entity.corrosionTier=Math.max(entity.corrosionTier||0,chemical);}
    if(entity.hazardCd===0&&(chemical||entity.corrosion>0)){const tier=Math.max(chemical,entity.corrosionTier||1),damage=chemical?(tier===2?5:4):(tier===2?2:1);entity.hazardCd=tier===2?.25:.65;if(isPlayer)this.hurt(damage,entity.x,0,'corrosive exposure',{hazard:true});else if(entity.corrosionOwner)this.friendlyDamage(entity.corrosionOwner,entity,damage);else{this.stats.damage[3]+=damage;this.damageRobot(entity,damage,{corrosive:true});}}
    if(entity.corrosion===0)entity.corrosionTier=0;
  }
  hurt(damage,fromX,penetration=0,cause='combat trauma',{hazard=false,critical=false,feedbackAttack=null}={}){const p=this.player;if(p.hp<=0||!hazard&&p.invulnerable>0)return;const armorBefore=p.mechaShield,incoming=damage*(this.premiumBoosts?.armor&&p.mechaShield>0?.9:1)*(1-.15*this.skills.plating*(1-penetration))*(p.mecha&&p.mechaShield>0?.7:1),absorbed=Math.min(p.mechaShield,incoming);p.mechaShield-=absorbed;const armorBroke=armorBefore>0&&p.mechaShield===0;const healthDamage=incoming-absorbed;p.hp=Math.max(0,p.hp-healthDamage);if(feedbackAttack&&(absorbed>0||healthDamage>0))feedbackAttack.landed=true;if(!hazard){p.invulnerable=.65;p.x=Math.max(22,Math.min(978,p.x+Math.sign(p.x-fromX)*18));}this.stats.damageTaken+=healthDamage;this.effects.push({kind:'number',x:p.x,y:p.y-65,text:absorbed?`ARMOR −${Math.round(absorbed)}`:(critical?'CRIT −':'−')+Math.round(healthDamage),life:.65,max:.65,color:absorbed?'#b7e77a':'#f07f66'});if(p.hp===0){this.runDeaths++;this.register.close('terminated',this.wave,cause);this.subject=this.register.current;this.state='dead';this.event('Human down. Retry the same wave.','#f07f66');}if(armorBroke)breakMech(this);}
  retry(){if(this.state!=='dead')return;this.subject=this.register.issue();this.state='between';this.startWave();}
  update(dt,input={}){
    dt=Math.max(0,Math.min(dt,.04));if(this.state==='escaping'){this.updateEscape(dt,input);return;}if(this.state!=='playing')return;const reassessing=this.robotReassessment>0;this.clock+=dt;this.aimAssist=!!input.aim&&this.touchAimEnabled!==false;const p=this.player;
    for(const k of ['attackCd','dashCd','dashTime','dashCrit','invulnerable','rollTime'])p[k]=Math.max(0,(p[k]??0)-dt);
    p.crouching=p.rollTime>0||!!input.down&&p.grounded&&p.dashTime<=0;const move=(input.right?1:0)-(input.left?1:0);if(move)p.facing=move;
    p.vx=(p.dashTime>0?p.facing*(p.rollTime>0?760:900):move*320*(1+.1*this.skills.agility)*(p.crouching?.45:1))*(p.mecha?1.15:1);p.x=Math.max(22,Math.min(978,p.x+p.vx*dt));p.flying=p.mecha&&!!input.up;if(p.flying){p.vy=-255;p.grounded=false;}else p.vy+=1250*dt;p.y+=p.vy*dt;if(p.y<86){p.y=86;p.vy=0;}if(p.y>=420){p.y=420;p.vy=0;p.grounded=true;}updateJumpState(p,dt);if(this.emergency)this.emergency.pulse=Math.max(0,this.emergency.pulse-dt);
    for(const pool of this.pools){pool.life-=dt;pool.charged=Math.max(0,pool.charged-dt);}this.pools=this.pools.filter(pool=>pool.life>0);
    this.statusDamage(p,dt,true);if(this.state!=='playing')return;this.updateMecha(dt);
    if(this.pools.some(pool=>pool.charged>0&&this.poolAt(p,pool)))this.hurt(18,p.x,0,'conductive-floor discharge');
    if(this.state!=='playing')return;updateRollingSlash(this,dt);if(input.attack)this.attack();
    const alive=this.robots.filter(r=>r.hp>0),nearest=alive.reduce((n,r)=>Math.min(n,Math.abs(r.x-p.x)),1000);
    if(nearest<420||move||input.attack||!p.grounded||p.dashTime>0)this.stats.time+=dt;
    if(this.stats.attacks.some(n=>n>0)||this.stats.damageTaken>0){this.stats.samples+=dt;if(Math.abs(p.vx)<20)this.stats.stationaryTime+=dt;if(p.crouching)this.stats.duckTime+=dt;if(nearest>190)this.stats.far+=dt;else this.stats.close+=dt;}
    for(const r of alive){
      if(r.hp<=0)continue;this.statusDamage(r,dt);if(r.hp<=0||this.robotReassessment>0&&!r.structure&&!r.humanPilot)continue;
      const c=r.cognition,t=TYPES[r.type];r.criticalFlash=Math.max(0,(r.criticalFlash??0)-dt);r.cooldown-=dt*(1+.35*c.growth);r.stun=Math.max(0,r.stun-dt);r.flash=Math.max(0,r.flash-dt);r.turn-=dt;r.vy+=1250*dt;r.y+=r.vy*dt;if(r.y>=420){r.y=420;r.vy=0;}
      if(this.updateSpecialRobot(r,dt))continue;if(r.type==='overseer'){this.updateOverseer(r,dt);continue;}if(r.stun>0||r.paralyzed>0||this.calibrationOnly)continue;
      if(r.type==='mirror'){this.updateMirror(r,dt);continue;}
      this.senseRobot(r,dt);const dx=r.targetX-r.x,dist=Math.abs(dx),speed=t.speed*c.speed*(r.crippled?.3:1)*(r.wet>0?.72:1);
      if(r.windup>0){
        r.windup-=dt;if(r.windup<=0){
          const ranged=['shoot','bombard','flak'].includes(r.action),blocked=c.discipline&&(ranged||['strike','charge-windup','leap'].includes(r.action))&&(r.action==='bombard'?alive.some(o=>o!==r&&o.hp>0&&!o.structure&&Math.abs(o.x-r.target)<110&&o.y>350):this.friendlyRisk(r,ranged?600:75));
          if(blocked){r.action='';r.cooldown=.3;if(ranged&&r.y>=420)r.vy=-350;continue;}
          if(r.action==='shoot')this.shots.push({x:r.x,y:r.y-26,vx:r.facing*260,life:4,owner:r.id,ownerX:r.x,critical:this.random()<c.crit});
          else if(r.action==='bombard')this.bombard(r);
          else if(r.action==='flak')this.flak(r);
          else if(r.action==='block-jump')r.vy=-520;
          else if(r.action==='charge-windup'){r.action='charge';r.chargeTime=.3;r.contactHits=[];r.contactCritical=this.random()<c.crit;}
          else if(r.action==='leap'){r.vy=-360;r.action='airborne';r.contactHits=[];r.contactCritical=this.random()<c.crit;}
          else if(r.action==='feint'){r.action='punish';r.cooldown=.4;}
          else if(r.action==='strike'){
            if(Math.abs(p.x-r.x)<75&&(p.x-r.x)*r.facing>-18&&Math.abs(p.y-r.y)<67)this.botHurt(r,12+this.wave);
            const critical=this.random()<c.crit;for(const o of alive)if(o!==r&&(o.structure?structureHitFraction(o,r.x,r.y-30,r.x+r.facing*75,r.y-30)!==null:Math.abs(o.x-r.x)<75&&(o.x-r.x)*r.facing>-18&&Math.abs(o.y-r.y)<67))this.friendlyDamage(r.id,o,12+this.wave,critical);
          }
        }continue;
      }
      if(r.action==='airborne'||r.action==='charge'){
        const charging=r.action==='charge';if(charging)r.chargeTime-=dt;r.x=Math.max(25,Math.min(975,r.x+(charging?r.lockDir*650:Math.sign(r.target-r.x)*speed*1.7)*dt));
        if(Math.abs(r.x-p.x)<45&&Math.abs(r.y-p.y)<55)this.botHurt(r,charging?20:14,r.x,0,charging?'committed charge':'landing interception',r.contactCritical);
        for(const o of alive)if(o!==r&&o.hp>0&&!r.contactHits.includes(o.id)&&(o.structure?structureDistance(o,r.x,r.y-25)<45:Math.abs(r.x-o.x)<45&&Math.abs(r.y-o.y)<55)){r.contactHits.push(o.id);this.friendlyDamage(r.id,o,charging?20:14,r.contactCritical);}
        if(charging?r.chargeTime<=0:r.y===420){r.action='';r.cooldown=1.6;}continue;
      }
      if(r.dodgeTime>0){r.dodgeTime=Math.max(0,r.dodgeTime-dt);r.x=Math.max(25,Math.min(975,r.x+r.dodgeDir*speed*2.3*dt));continue;}
      if(['ranged','bombard','flak'].includes(t.behavior)){
        const hasCover=this.wave>=4&&alive.some(o=>o!==r&&o.hp>0&&Math.sign(o.x-r.x)===Math.sign(dx)&&Math.abs(o.x-r.x)<dist);
        if(dist<230)r.x-=Math.sign(dx)*speed*dt;else if(dist>360&&!hasCover)r.x+=Math.sign(dx)*speed*dt;
        if(r.cooldown<=0){r.action=t.behavior==='bombard'?'bombard':t.behavior==='flak'?'flak':'shoot';r.target=r.targetX;r.windup=(t.behavior==='bombard'?.9:.65)*c.windup;r.cooldown=t.behavior==='bombard'?3.2:2.1;}
      }
      else if(t.behavior==='bulwark'&&!r.crippled&&r.targetY<385&&r.y>=420&&r.cooldown<=0&&dist<600){r.action='block-jump';r.windup=.25*c.windup;r.cooldown=1.8;}
      else if(t.behavior==='lancer'&&!r.crippled&&dist<270&&r.cooldown<=0){r.action='charge-windup';r.lockDir=Math.sign(dx)||1;r.windup=.65*c.windup;r.cooldown=2;}
      else if(t.behavior==='intercept'&&!r.crippled&&r.cooldown<=0&&dist<410){r.target=Math.max(25,Math.min(975,r.targetX+r.targetVX*.18*c.growth));r.action='leap';r.windup=.65*c.windup;r.cooldown=2;}
      else if(t.behavior==='feint'&&!r.crippled&&r.action!=='punish'&&dist<140&&r.cooldown<=0){r.x-=Math.sign(dx)*32;r.action='feint';r.windup=.35*c.windup;r.cooldown=.7;}
      else{if(dist>42)r.x+=Math.sign(dx)*speed*(r.action==='punish'?1.7:1)*dt;if(dist<62&&r.cooldown<=0){r.action='strike';r.windup=(r.type==='probe'?.72:.45)*c.windup;r.cooldown=1.25;}}
      r.x=Math.max(25,Math.min(975,r.x));
    }
    for(const s of this.shots){
      const oldX=s.x,oldY=s.y;s.x+=s.vx*dt;s.life-=dt;if(s.gravity){s.vy+=s.gravity*dt;s.y+=s.vy*dt;}
      if(s.kind==='mortar'){
        if(s.airburst){s.burstTime-=dt;if(s.burstTime<=0){for(const a of this.companions??[])if(a.hp>0&&Math.hypot(a.x-s.targetX,a.y-23-s.targetY)<62)this.hurtCompanion(a,18);s.x=s.targetX;s.y=s.targetY;s.life=0;this.effects.push({kind:'blast',x:s.x,y:s.y,life:.45,max:.45,color:'#e7a56e'});if(Math.hypot(s.x-p.x,s.y-(p.y-(p.crouching?9:23)))<62)this.hurt(18*(s.critical?1.65:1),s.ownerX,0,'arcing bombardment',{critical:s.critical});for(const r of this.robots)if(r.hp>0&&(r.structure?structureDistance(r,s.x,s.y)<62:Math.hypot(s.x-r.x,s.y-(r.y-23))<62))this.friendlyDamage(s.owner,r,18,s.critical);}}
        else if(s.y>=412){for(const a of this.companions??[])if(a.hp>0&&Math.abs(a.x-s.targetX)<52)this.hurtCompanion(a,20);s.x=s.targetX;s.life=0;this.effects.push({kind:'blast',x:s.x,y:415,life:.45,max:.45,color:'#e7a56e'});if(Math.abs(s.x-p.x)<52&&p.y>350)this.hurt(20*(s.critical?1.65:1),s.ownerX,0,'arcing bombardment',{critical:s.critical});for(const r of this.robots)if(r.hp>0&&(r.structure?structureDistance(r,s.x,415)<52:Math.abs(s.x-r.x)<52&&r.y>350))this.friendlyDamage(s.owner,r,20,s.critical);}
      }else{
        // Sweep the travelled segment so faster projectiles cannot tunnel through bodies.
        const candidates=[{entity:p,player:true},...(this.companions??[]).filter(a=>a.hp>0).map(entity=>({entity,companion:true})),...this.robots.filter(r=>r.hp>0&&r.id!==s.owner&&this.robotShotHitsAlly(s,r)).map(entity=>({entity,player:false}))];const vx=s.x-oldX,vy=s.y-oldY,length=vx*vx+vy*vy;
        const contacts=candidates.map(c=>{const e=c.entity;if(e.structure){const fraction=structureHitFraction(e,oldX,oldY,s.x,s.y);return {...c,fraction,hit:fraction!==null};}const y=e.y-(e.crouching?9:23),fraction=length?Math.max(0,Math.min(1,((e.x-oldX)*vx+(y-oldY)*vy)/length)):0;return {...c,fraction,hit:Math.abs(oldX+vx*fraction-e.x)<23&&Math.abs(oldY+vy*fraction-y)<(e.crouching?11:27)};}).filter(c=>c.hit).sort((a,b)=>a.fraction-b.fraction);
        if(contacts.length){const target=contacts[0];if(target.player){const before=p.hp+p.mechaShield;this.hurt((s.damage??12)*(s.critical?1.65:1),s.x-Math.sign(s.vx)*20,0,s.kind==='mirror-circuit'?'mirrored circuit combo':s.kind==='flak'?'anti-air volley':s.kind==='robot-glue'?'robot glue spray':'projectile impact',{critical:s.critical,feedbackAttack:s.feedbackAttack});if(s.kind==='robot-glue'&&p.hp+p.mechaShield<before)p.glueSlow=Math.max(p.glueSlow??0,3);}else if(target.companion)this.hurtCompanion(target.entity,(s.damage??12)*(s.critical?1.65:1));else this.friendlyDamage(s.owner,target.entity,s.damage??12,s.critical,true);s.life=0;}
      }
    }
    this.shots=this.shots.filter(s=>s.life>0&&s.x>-20&&s.x<1020&&s.y<470);
    if(reassessing)updateReassessment(this,dt);
    for(const e of this.effects)e.life-=dt;this.effects=this.effects.filter(e=>e.life>0);for(const e of this.events)e.time-=dt;this.events=this.events.filter(e=>e.time>0);
    if(this.state==='playing'&&!this.robots.some(r=>r.hp>0))this.finishWave();
  }
  finishWave(){const p=this.player;if(this.wave===this.finalWave){this.beginEscape();}else if(this.wave===this.bossWave){this.finaleCheckpoint={hp:p.hp,mecha:p.mecha,mechaShield:p.mechaShield};this.plan=this.makePlan(this.finalWave,this.memory);this.state='between';this.event('MIRROR OFFLINE — an unregistered machine is waking up.','#ef796b');}else{this.memory=learn(this.memory,this.stats);this.points=Math.min(12,5+this.wave);this.plan=this.makePlan(this.wave+1,this.memory);this.state='between';this.event('Combat data uploaded. Factory adapting.');}}
}
