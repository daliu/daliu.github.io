import {TYPES,WEAPONS,emptyMemory,summarize} from './engine.mjs';
export const CAMPAIGN_MIRROR=49,CAMPAIGN_FINAL=50;
export const MODULES=[
 {id:'radio',name:'Radio disruptor',key:'5',unlock:1,cooldown:12,color:'#9ee6ee',hint:'Stops the arena. Flyers fall.'},
 {id:'glue',name:'Glue polymer',key:'6',unlock:2,cooldown:3,color:'#d8b6f4',hint:'Stack three close bursts to bind.'},
 {id:'flame',name:'Flamethrower',key:'7',unlock:3,cooldown:2.4,color:'#ffad66',hint:'Melts sealed and plastic coatings.'},
 {id:'magnet',name:'Magnetic scramble',key:'8',unlock:4,cooldown:8,color:'#b7e77a',hint:'Corrupts conductive hardware.'}
];
export const CHASSIS=['HUMAN','I / SIGNAL','II / POLYMER','III / FURNACE','IV / MAGNETAR','V / OVERDRIVE'];
Object.assign(TYPES,{
 douser:{name:'Douser',color:'#69c7ed',hp:130,speed:48,resistance:{water:.35,electric:1.35,cutting:1.2},flaw:'Flood pump: interrupt it or rise above the floor.',behavior:'douser'},
 shocker:{name:'Floor conductor',color:'#eff08a',hp:130,speed:62,resistance:{electric:.55,cutting:1.2},flaw:'Boots block floor shocks. Direct wet-body hits still conduct.',behavior:'shocker'},
 flyer:{name:'Sky slinger',color:'#b3c8f2',hp:95,speed:112,resistance:{impact:1.2},flaw:'Tracks your last observed position. Fly into range; radio grounds it.',behavior:'flyer',flying:true},
 metalDrone:{name:'Metal bomb drone',color:'#f2a16e',hp:75,speed:125,resistance:{electric:1.8,energy:.8},flaw:'Electricity safely detonates it at range. Blast harms its allies.',behavior:'drone',flying:true},
 plasticDrone:{name:'Shunt-shell drone',color:'#dec3ef',hp:105,speed:118,resistance:{electric:.18,water:.3,cutting:1.65,energy:.6},flaw:'Conductive casing shunts current. Cut open or melt the shell first.',behavior:'drone',flying:true},
 chemDrone:{name:'Chemical fuse drone',color:'#c6ed79',hp:85,speed:88,resistance:{electric:.5,water:.8},flaw:'Plain water dilutes the fuse. Acid does not. Watch the countdown.',behavior:'drone',flying:true},
 orchestrator:{name:'Orchestrator',color:'#f1c778',hp:350,speed:44,resistance:{cutting:.65,energy:.6,electric:1.2},flaw:'Commands crossfire. Destroy it to confuse its team.',behavior:'command'}
});
// Each room has an authored encounter and one bounded slot learned from combat.
// This is a local opponent model, not an LLM or an online service.
const ROOMS=[
 ['First resistance','probe','guard'],['Front plate','guard','probe','probe'],['Insulation','insulated','plated'],
 ['Landing trap','interceptor','guard','probe'],['Retreat bait','feinter','plated','guard'],['Heavy screen','bulwark','gunner','interceptor'],
 ['Locked arcs','bombardier','guard','gunner'],['Air denial','flak','lancer','guard'],['Crossfire','gunner','bulwark','feinter','flak'],['Signal forge','bulwark','bombardier','guard','lancer'],
 ['Flood pumps','douser','guard','gunner'],['Live floor','douser','shocker','guard'],['Insulated patrol','shocker','insulated','douser','gunner'],
 ['Double pump','douser','douser','shocker','lancer'],['High ground','flyer','shocker','guard'],['Wet crossfire','douser','flak','shocker','gunner'],
 ['Bait the pulse','shocker','feinter','interceptor','douser'],['Charged convoy','bulwark','shocker','douser','flyer'],['Flood lock','douser','shocker','gunner','flyer','guard'],['Polymer forge','douser','shocker','bulwark','flyer','lancer'],
 ['Metal swarm','metalDrone','metalDrone','guard','gunner'],['Shunted core','plasticDrone','guard','metalDrone','gunner'],['Chemical clock','chemDrone','chemDrone','bulwark','gunner'],
 ['Mixed payload','plasticDrone','metalDrone','chemDrone','guard'],['Sky chase','flyer','flyer','metalDrone','shocker'],['Dilution test','chemDrone','chemDrone','douser','flak','guard'],
 ['Shell game','plasticDrone','plasticDrone','metalDrone','lancer'],['Hostile salvage','metalDrone','chemDrone','flyer','bulwark','shocker'],['Fuse corridor','chemDrone','plasticDrone','flak','gunner','guard'],['Furnace forge','plasticDrone','chemDrone','flyer','bulwark','lancer'],
 ['Lights out','flyer','gunner','guard','interceptor'],['Night patrol','plasticDrone','flyer','shocker','guard'],['Blind arcs','bombardier','flak','flyer','bulwark'],
 ['Chemical eclipse','chemDrone','chemDrone','flyer','douser','guard'],['Airborne wall','flyer','flyer','bulwark','metalDrone','gunner'],['Black flood','douser','shocker','flyer','plasticDrone','guard'],
 ['Afterimage','interceptor','feinter','flyer','flak','plasticDrone'],['Burning runway','chemDrone','metalDrone','flyer','lancer','gunner'],['Moving cover','bulwark','guard','flyer','flyer','shocker'],['Magnetar forge','plasticDrone','metalDrone','chemDrone','flyer','bulwark'],
 ['Central command','orchestrator','guard','gunner','flyer'],['Synchronized fire','orchestrator','bulwark','flak','flyer','gunner'],['Shield relay','orchestrator','guard','bulwark','plasticDrone','flyer'],
 ['Flood protocol','orchestrator','douser','shocker','flyer','guard'],['False retreat','orchestrator','feinter','interceptor','chemDrone','gunner'],['Night network','orchestrator','flyer','plasticDrone','flak','bulwark'],
 ['Last formation','orchestrator','guard','shocker','douser','chemDrone','flyer'],['Factory council','orchestrator','orchestrator','bulwark','flyer','plasticDrone','bombardier'],
 ['Mirror protocol','mirror'],['Emergency protocol','overseer']
];
export const campaignPhase=w=>w===50?'Emergency protocol':w===49?'Mirror protocol':w<=3?'Defensive learning':w<=6?'Movement learning':w<=10?'Offensive learning':w<=20?'Conductive warfare':w<=30?'Drone warfare':w<=40?'Low visibility':'Coordinated warfare';
export function campaignCognition(w){const g=(Math.exp(.055*(Math.max(1,Math.min(48,w))-1))-1)/(Math.exp(.055*47)-1);return {growth:g,speed:1+1.05*g,reaction:.9-.73*g,turn:1.08-.91*g,windup:1-.32*g,dodge:.03+.72*g,crit:.015+.14*g,discipline:g>.48};}
export function campaignMemory(){return {...emptyMemory(),attempts:0,failures:0,outcomes:[],effective:[.25,.25,.25,.25]};}
export function learnCampaign(memory,stats,{wave,won,learning=1}){
 const s=summarize(stats),totalDamage=stats.damage.reduce((a,b)=>a+b,0),weight=Math.min(.92,Math.min(.65,Math.max(.12,s.total/18))*learning),mix=(a,b)=>a*(1-weight)+b*weight;
 const m=structuredClone(memory);m.waves+=won?1:0;m.attempts++;m.failures+=won?0:1;
 if(s.total){m.weapon=m.weapon.map((v,i)=>mix(v,s.weapon[i]));m.effective=m.effective.map((v,i)=>mix(v,totalDamage?stats.damage[i]/totalDamage:s.weapon[i]));for(const k of ['energyShare','groundShockShare','stationaryRatio','duckRatio','attackRate','jumpRate','dashRate','farRatio'])m[k]=mix(m[k],s[k]);}
 m.groundShockHits+=s.groundShockHits;m.history=[...m.history,{total:s.total}].slice(-12);
 m.outcomes=[...m.outcomes,{wave,won,damageTaken:Math.round(stats.damageTaken),attacks:s.total,seconds:Math.round(stats.time)}].slice(-12);return m;
}
export function campaignPlan(wave,memory,profile={adaptation:1,slots:1,count:1}){
 const [title,...authored]=ROOMS[wave-1],units=[...authored],phase=campaignPhase(wave);
 const confidence=Math.min(1,memory.history.reduce((n,h)=>n+h.total,0)*profile.adaptation/30);
 const scores=memory.weapon.map((v,i)=>v*.35+memory.effective[i]*.65),dominant=scores.indexOf(Math.max(...scores));
 let counter=['guard','plated',memory.energyShare>.5?'bulwark':'insulated','sealed'][dominant];
 if(wave>=4&&memory.jumpRate>.13)counter=wave>=7?'flak':'interceptor';
 else if(wave>=7&&memory.stationaryRatio>.55)counter='bombardier';
 else if(wave>=4&&memory.dashRate>.12)counter='feinter';
 // Difficulty bounds replacement slots; the authored lead role stays intact.
 if(wave<49&&wave>1&&confidence>.2)for(let slot=0;slot<Math.min(profile.slots,units.length-1);slot++)units[units.length-1-slot]=counter;
 if(wave<49){const size=Math.max(1,Math.min(9,Math.round(units.length*profile.count)));while(units.length>size)units.pop();while(units.length<size)units.push(confidence>.2?counter:units.length%2?'probe':'gunner');}
 const boots=wave>=12||memory.groundShockHits>=2&&memory.groundShockShare>.25;
 const dark=wave>=31&&wave<=40||[46,48].includes(wave);
 return {wave,phase,title,units,boots,dark,tactic:title,reason:confidence>.2?`Effective ${WEAPONS[dominant].name.toLowerCase()} attacks prompted ${TYPES[counter].name.toLowerCase()}.`:'Factory trial in progress.',adaptation:confidence>.2?TYPES[counter].name:'Gathering evidence',flaw:[...new Set(units)].map(t=>TYPES[t].flaw).join(' '),observations:[`${memory.attempts} attempts analyzed, including ${memory.failures} failures.`,confidence>.2?`${profile.slots} counter slot${profile.slots===1?'':'s'} available; the lead role retains its job.`:'Not enough evidence to select a counter.'],sampleAttacks:memory.history.reduce((n,h)=>n+h.total,0),confidence};
}
