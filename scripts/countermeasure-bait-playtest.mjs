import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {play} from '../tests/helpers/countermeasure-pilot.mjs';
import {fight} from '../tests/helpers/countermeasure-bait-pilot.mjs';
const args=process.argv.slice(2),option=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const seeds=option('--seeds','12,72,84,98,211,401').split(',').map(Number),reaction=Number(option('--reaction','.28'));
if(seeds.some(n=>!Number.isInteger(n))||!Number.isFinite(reaction)||reaction<.08||reaction>1)throw Error('Invalid seeds');
const style=option('--style','fast');if(!['fast','careful'].includes(style))throw Error('Invalid style');
const modes=option('--modes','terminator').split(','),routeSeeds=option('--route-seeds','11,71').split(',').map(Number),waves=option('--waves','10,20,30,40,50').split(',').map(Number);if(modes.some(m=>!['hard','terminator'].includes(m))||routeSeeds.some(s=>!Number.isInteger(s))||waves.some(w=>![10,20,30,40,50].includes(w)))throw Error('Invalid modes/routes/waves');
const runtime=process.env.COUNTERMEASURE_RUNTIME??fileURLToPath(new URL('../countermeasure/',import.meta.url));
const {ExpeditionStore}=await import(pathToFileURL(runtime+'expedition-saves.mjs'));
let checkpoints=[];
if(option('--checkpoints',null))checkpoints=JSON.parse(readFileSync(option('--checkpoints')));
else for(const difficulty of modes)for(const routeSeed of routeSeeds){
 const seen=new Set(),r=play(difficulty,routeSeed,{reaction:.28,maxDeaths:60,onEntry(g){
  if(g.encounter!=='super'||seen.has(g.wave))return;seen.add(g.wave);
  // entryCheckpoint retains carried health; snapshot after startWave would lose carry.
  const c=structuredClone(g.entryCheckpoint);checkpoints.push({routeSeed,checkpoint:c});
  if(option('--save-dir',null)){const s=new ExpeditionStore();if(!s.save(c))throw Error('Invalid reached checkpoint');mkdirSync(option('--save-dir'),{recursive:true});writeFileSync(option('--save-dir')+`/${difficulty}-route${routeSeed}-${g.wave}-super.json`,s.export());}
 }});if(r.status!=='complete')throw Error(`Checkpoint route ${routeSeed}: ${r.status}`);
}
if(option('--write-checkpoints',null))writeFileSync(option('--write-checkpoints'),JSON.stringify(checkpoints));
const rows=[];for(const {routeSeed,checkpoint:c} of checkpoints.filter(o=>modes.includes(o.checkpoint.difficulty)&&waves.includes(o.checkpoint.wave)))for(const seed of seeds)for(const strategy of ['direct','cover',...(c.wave>=40?['both']:[])]){const r=fight(c,seed,strategy,{reaction,style});rows.push({routeSeed,...r});}
const runtimeHashes={};for(const f of ['engine.mjs','expedition.mjs','boss-laser.mjs','boss-support.mjs','boss-combos.mjs','boss-feedback.mjs','expedition-plan.mjs','difficulty.mjs','objective-geometry.mjs'])runtimeHashes[f]=createHash('sha256').update(readFileSync(runtime+f)).digest('hex');
const pilotHash=createHash('sha256').update(readFileSync(new URL('../tests/helpers/countermeasure-bait-pilot.mjs',import.meta.url))).digest('hex');
const report={pilotHash,method:'State-aware model with delayed decisions and normally reached entry checkpoints; no HP/enemy/victory edits. Completion is not a human win rate.',reactionSeconds:reaction,style,seeds,checkpointHash:createHash('sha256').update(JSON.stringify(checkpoints)).digest('hex'),runtimeHashes,rows};
if(option('--report',null))writeFileSync(option('--report'),JSON.stringify(report,null,2)+'\n');
for(const difficulty of modes)for(const wave of waves)for(const strategy of ['direct','cover',...(wave>=40?['both']:[])]){const r=rows.filter(r=>r.difficulty===difficulty&&r.wave===wave&&r.strategy===strategy),ok=r.filter(r=>['traveling','escaping'].includes(r.state)&&r.end.hp>0);console.log(JSON.stringify({difficulty,wave,strategy,clears:ok.length,completeBaits:ok.filter(r=>strategy!=='direct'&&r.buttonUses===1&&r.coreDamageOnBackup>0&&['buttonGuard',...(strategy==='both'?['antenna']:[])].every(type=>r.laserDestroyed.includes(type))).length,attempts:r.length,seconds:ok.map(r=>r.seconds),endingHP:ok.map(r=>+r.end.hp.toFixed(1)),endingArmor:ok.map(r=>+r.end.armor.toFixed(1)),ammoUsed:ok.map(r=>r.start.ammo-r.end.ammo)}));}
