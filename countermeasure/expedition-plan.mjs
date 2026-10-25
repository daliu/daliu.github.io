import {TYPES,UPGRADES} from './engine.mjs';
import {campaignPlan,MODULES} from './campaign-plan.mjs';
export const POWERS=[...MODULES.map(m=>m.id==='glue'?{...m,name:'Industrial glue bomb',cooldown:10,hint:'2s grounded, then 3s slowed. 10s cooldown.'}:m),
 {id:'emp',name:'Localized EMP',key:'9',unlock:5,cooldown:14,color:'#c0f5ff',hint:'Disables one core. Locks electric weapons for 5s.',ultimate:true},
 {id:'rounds',name:'AP explosive rounds',key:'0',unlock:5,cooldown:.65,color:'#ffbd85',hint:'Armor-piercing blasts. 18 rounds for the entire fight.',ultimate:true}
];
const ultimate=[
 {name:'Highway Lamp',damage:120,cooldown:1.15,range:310,short:'Heavy shutdown sweep',detail:'Slow, enormous sweep. Knocks back and temporarily disables robots.'},
 {name:'Diamond Chain-saw',damage:62,cooldown:.22,range:185,short:'Ultimate diamond cutting',detail:'Diamond teeth expose wiring and exploit thermite-opened armor.'},
 {name:'Tesla laser',type:'electric',damage:48,cooldown:.34,range:470,color:'#b7e77a',short:'Conductive core shutdown',detail:'Electric/laser attacks disable the electric core. Temporarily locked by your localized EMP.'},
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
export function expeditionPlan(wave,memory,encounter=null,profile){
 encounter??=milestone(wave)?'boss':'room';const base=campaignPlan(wave,memory,profile);
 if(encounter==='room'&&wave===49){Object.assign(base,{units:['orchestrator','bulwark','flyer','chemDrone','gunner'],title:'The last corridor',phase:'Coordinated warfare'});}
 if(encounter==='boss')return {...base,encounter,units:['mirror'],title:`Mirror ${wave/10}`,phase:'Boss / copied build',boots:false,dark:false};
 if(encounter==='super'){const rules=bossRules(wave/10);return {...base,encounter,rules,units:['overseer',...(rules.cover?['buttonGuard']:[]),...(rules.antenna?['antenna']:[])],title:`Countermeasure ${wave/10}`,phase:'Superboss',boots:false,dark:false,flaw:rules.antenna?TYPES.antenna.flaw:rules.cover?TYPES.buttonGuard.flaw:'High resistance, not immunity. Flight reaches the red EMP button.'};}
 if(encounter==='hidden')return {...base,encounter,units:['overseer','overseer','overseer'],title:'Perfect human / imperfect machines',phase:'Hidden protocol',boots:false,dark:false,flaw:'Three sync cores. EMP / radio / electricity disable different cores. EMP also locks your electric weapons for five seconds.'};
 if(wave>=6){
  // Stagger existing squads so one opening shutdown cannot erase the entire challenge.
  const pattern=wave<11?'crossfire':['crossfire','pincer','airlift','relay'][wave%4],units=[...base.units],extra=profile?.name==='Easy'||wave<11?0:profile?.name==='Terminator'?2:1;
  const counter=memory.weapon.indexOf(Math.max(...memory.weapon)),screens=['guard','plated','insulated','sealed'];
  if(extra)units.push(wave>=21&&wave%3===0?'orchestrator':screens[counter]);
  if(extra>1)units.push(memory.jumpRate>.15?'flak':'lancer');
  const reserve=units.splice(-Math.max(1,Math.ceil(units.length*.4))),deployments=[];
  if(pattern==='relay'&&reserve.length>1){deployments.push({at:4,side:'right',units:reserve.slice(0,1)},{at:9,side:'left',units:reserve.slice(1)});}
  else deployments.push({at:4,side:pattern==='pincer'?'left':pattern==='airlift'?'air':'right',units:reserve});
  return {...base,encounter,pattern,units:[...units,...reserve],openingUnits:units,deployments};
 }
 return {...base,encounter};
}
