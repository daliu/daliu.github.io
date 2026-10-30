import {SIDE_ROOMS} from './side-rooms.mjs';
import {enemyGeneration} from './enemy-generations.mjs';
import {TYPES,UPGRADES} from './engine.mjs';
import {campaignPlan,MODULES} from './campaign-plan.mjs';
export const POWERS=[...MODULES.map(m=>m.id==='magnet'?{...m,hint:'One marked target. Conductive wiring briefly shuts down; insulation resists.'}:m.id==='glue'?{...m,name:'Industrial glue bomb',cooldown:10,hint:'2s grounded, then 3s slowed. 10s cooldown.'}:m),
 {id:'emp',name:'Localized EMP',key:'9',unlock:5,cooldown:14,color:'#c0f5ff',hint:'Disables one core. Locks electric weapons for 5s.',ultimate:true},
 {id:'rounds',name:'AP explosive rounds',key:'0',unlock:5,cooldown:.65,color:'#ffbd85',hint:'Armor-piercing blasts. 18 rounds for the entire fight.',ultimate:true}
];
const ultimate=[
 {name:'Highway Lamp',damage:120,cooldown:1.15,range:310,short:'Heavy shutdown sweep',detail:'Slow, enormous sweep. Knocks back; 35% chance to briefly disable robots.'},
 {name:'Diamond Chain-saw',damage:19,cooldown:.16,range:96,short:'Ultimate diamond cutting',detail:'Diamond teeth expose wiring and exploit thermite-opened armor.'},
 {name:'Tesla laser',type:'electric',damage:48,cooldown:.34,range:470,color:'#b7e77a',short:'Conductive core shutdown',detail:'Electric hits can disable the electric core (18% dry, 50% conductive wet). Temporarily locked by your localized EMP.'},
 {name:'Industrial acid',damage:33,cooldown:.22,range:400,corrosive:true,color:'#d6b5f5',short:'Corrode exposed hardware',detail:'Sustained corrosion without glue or grounding. Use the separate industrial glue bomb to interrupt flight.'}
];
for(let i=0;i<4;i++)UPGRADES[i][3]=ultimate[i];
Object.assign(TYPES,{
 buttonGuard:{name:'Button fortress',color:'#b7c1c8',hp:600,speed:0,resistance:{impact:.8,cutting:1,electric:.35,energy:.8,water:.25},flaw:'Destroy its plates to reach the button. Or fight the resistant core directly.',behavior:'structure'},
 antenna:{name:'Sync antenna',color:'#e9c77a',hp:700,speed:0,resistance:{impact:1,cutting:1,electric:.5,energy:.8,water:.35},flaw:'Destroy it: every robot reboots for eight seconds, then loses synchronization.',behavior:'structure'}
});
export const milestone=w=>w>=10&&w<=50&&w%10===0;
export const roomIndex=(w,encounter)=>w-1+Math.floor((w-1)/10)+(encounter==='super'?1:encounter==='hidden'?2:0);
export const bossRules=cycle=>({cycle,flies:cycle>=2,dodge:cycle>=3?(cycle-2)*.1:0,cover:[0,0,450,1400,8500,14000][cycle],antenna:cycle>=4?(cycle===4?850:5500):0,backup:cycle>=4,hp:900+cycle*420});
export function expeditionPlan(wave,memory,encounter=null,profile,{opening=true}={}){
 encounter??=milestone(wave)?'boss':'room';const base=campaignPlan(wave,memory,profile);
 if(opening&&encounter==='room'&&wave<=2)return {...base,encounter,units:wave===1?['guard','plated']:[],deployments:[],openingUnits:null,title:wave===1?'Stolen equipment':'Your cell',phase:wave===1?'Break the test perimeter':'Recover the desk lamp',reason:wave===1?'A sword, a sprayer and a taser. Find a way through.':'Your lamp is still on the desk.',dark:false};
 if(encounter==='room'&&wave===49){Object.assign(base,{units:['orchestrator','bulwark','flyer','chemDrone','gunner'],title:'The last corridor',phase:'Coordinated warfare'});}
 if(encounter==='side'){const s=SIDE_ROOMS[wave];return {...base,encounter,units:s.units,title:s.title,phase:'Optional prototype',dark:s.type==='spider'||wave>=24,boots:false,deployments:[],openingUnits:null,reason:s.line};}
 if(encounter==='boss')return {...base,encounter,units:['mirror'],title:`Mirror ${wave/10}`,phase:'Boss / copied build',boots:false,dark:false};
 if(encounter==='super'){const rules=bossRules(wave/10);return {...base,encounter,rules,units:['overseer',...(rules.cover?['buttonGuard']:[]),...(rules.antenna?['antenna']:[])],title:`Countermeasure ${wave/10}`,phase:'Superboss',boots:false,dark:false,flaw:rules.antenna?TYPES.antenna.flaw:rules.cover?TYPES.buttonGuard.flaw:'High resistance, not immunity. Flight reaches the red EMP button.'};}
 if(encounter==='hidden')return {...base,encounter,units:['overseer','overseer','overseer'],title:'Perfect human / imperfect machines',phase:'Hidden protocol',boots:false,dark:false,flaw:'Three sync cores. EMP / radio / electricity disable different cores. EMP also locks your electric weapons for five seconds.'};
 if(wave>=6){
  // Stagger existing squads so one opening shutdown cannot erase the entire challenge.
  const pattern=wave<11?'crossfire':['crossfire','pincer','airlift','relay'][wave%4],units=[...base.units],extra=profile?.name==='Easy'||wave<11?0:profile?.name==='Terminator'?2:1;
  const counter=memory.weapon.indexOf(Math.max(...memory.weapon)),screens=['guard','plated','insulated','sealed'];
  if(extra)units.push(wave>=21&&wave%3===0?'orchestrator':screens[counter]);
  if(extra>1)units.push(memory.jumpRate>.15?'flak':'lancer');
  const generation=enemyGeneration(wave),n=generation-1,palette=['guard','gunner','bombardier',...(wave>=11?['douser','shocker','flyer']:[]),...(wave>=21?['metalDrone','plasticDrone','chemDrone']:[]),...(wave>=41?['orchestrator','plated']:[])];
  if(!n){const reserve=units.splice(-Math.max(1,Math.ceil(units.length*.4)));return {...base,encounter,pattern,generation,units:[...units,...reserve],openingUnits:units,deployments:[{at:4,side:'right',units:reserve}]};}
  const size=Math.min(30,units.length+Math.round(n*2*(profile?.count??1)));
  while(units.length<size)units.push(palette[(wave+units.length)%palette.length]);
  const all=[...units],opening=units.splice(0,Math.min(Math.max(2,Math.round((3+n)*(profile?.count??1))),Math.ceil(units.length*.6))),deployments=[],chunk=Math.min(4,2+Math.floor(n/2));
  for(let i=0;units.length;i++){const side=wave<11?'right':['right','left','air'][(wave+i)%3];deployments.push({at:4+i*4.5,side,units:units.splice(0,chunk)});}
  const dark=base.dark||generation>=3&&wave%3===0||generation===5&&wave%2===1;
  return {...base,encounter,pattern,generation,units:all,openingUnits:opening,deployments,dark,visionRadius:Math.max(235,335-n*24),activeCap:Math.min(16,Math.round(8+n*1.4*(profile?.count??1)))};
 }
 return {...base,encounter};
}

// UI-only availability; acquisition and combat remain owned by the arena.
export function powerCue(g,index,touch=false){
 const m=POWERS[index],input=touch?'tap power · ↻ cycle':'F use · G cycle';
 const available=m.unlock<=g.mechTier&&(!m.ultimate||g.ultra);
 const unlock=m.ultimate&&!g.ultra?(g.difficulty==='terminator'?'Clear Mirror 10 · collect Ultra':'Deathless 50 · earned finale'):(g.difficulty==='terminator'?'Clear Mirror 10 · collect Ultra':`Clear Mirror ${m.unlock*10} · collect Mech ${m.unlock}`);
 const cd=g.moduleCooldowns?.[index]??0,locked=index===3&&g.resources.electricLock>0;
 const status=!available?unlock:cd>0?`Recharging ${Math.ceil(cd)}s`:index===5&&g.resources.ammo===0?'No AP rounds':locked?'Electric circuit reboot':'Ready';
 const hint=index===5?`${g.resources.ammo} rounds left · finite ammo`:m.hint;
 return {available,ready:available&&cd===0&&!locked&&!(index===5&&g.resources.ammo===0),status,hint,input};
}
