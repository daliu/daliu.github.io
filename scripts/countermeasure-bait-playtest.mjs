import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {play} from '../tests/helpers/countermeasure-pilot.mjs';
import {fight} from '../tests/helpers/countermeasure-bait-pilot.mjs';
const args=process.argv.slice(2),option=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const seeds=option('--seeds','12,72,84,98,211,401').split(',').map(Number),reaction=Number(option('--reaction','.28'));
if(seeds.some(n=>!Number.isInteger(n))||!Number.isFinite(reaction)||reaction<.08||reaction>1)throw Error('Invalid seeds');
const runtime=process.env.COUNTERMEASURE_RUNTIME??fileURLToPath(new URL('../countermeasure/',import.meta.url));
const {ExpeditionStore}=await import(pathToFileURL(runtime+'expedition-saves.mjs'));
let checkpoints=[];
if(option('--checkpoints',null))checkpoints=JSON.parse(readFileSync(option('--checkpoints')));
else for(const routeSeed of [11,71]){
 const seen=new Set(),r=play('terminator',routeSeed,{reaction:.28,maxDeaths:60,onEntry(g){
  if(g.encounter!=='super'||seen.has(g.wave))return;seen.add(g.wave);
  // entryCheckpoint retains carried health; snapshot after startWave would lose carry.
  const c=structuredClone(g.entryCheckpoint);checkpoints.push({routeSeed,checkpoint:c});
  if(option('--save-dir',null)){const s=new ExpeditionStore();if(!s.save(c))throw Error('Invalid reached checkpoint');mkdirSync(option('--save-dir'),{recursive:true});writeFileSync(option('--save-dir')+`/route${routeSeed}-${g.wave}-super.json`,s.export());}
 }});if(r.status!=='complete')throw Error(`Checkpoint route ${routeSeed}: ${r.status}`);
}
if(option('--write-checkpoints',null))writeFileSync(option('--write-checkpoints'),JSON.stringify(checkpoints));
const rows=[];for(const {routeSeed,checkpoint:c} of checkpoints)for(const seed of seeds)for(const strategy of ['direct','cover',...(c.wave>=40?['both']:[])]){const r=fight(c,seed,strategy,{reaction});rows.push({routeSeed,...r});}
const runtimeHashes={};for(const f of ['engine.mjs','expedition.mjs','boss-laser.mjs','boss-support.mjs','boss-combos.mjs','difficulty.mjs','objective-geometry.mjs'])runtimeHashes[f]=createHash('sha256').update(readFileSync(runtime+f)).digest('hex');
const pilotHash=createHash('sha256').update(readFileSync(new URL('../tests/helpers/countermeasure-bait-pilot.mjs',import.meta.url))).digest('hex');
const report={pilotHash,method:'State-aware model with delayed decisions and normally reached entry checkpoints; no HP/enemy/victory edits. Completion is not a human win rate.',reactionSeconds:reaction,seeds,runtimeHashes,rows};
if(option('--report',null))writeFileSync(option('--report'),JSON.stringify(report,null,2)+'\n');
for(const wave of [10,20,30,40,50])for(const strategy of ['direct','cover',...(wave>=40?['both']:[])]){const r=rows.filter(r=>r.wave===wave&&r.strategy===strategy),ok=r.filter(r=>['traveling','escaping'].includes(r.state));console.log(JSON.stringify({wave,strategy,clears:ok.length,attempts:r.length,seconds:ok.map(r=>r.seconds),endingHP:ok.map(r=>+r.end.hp.toFixed(1)),endingArmor:ok.map(r=>+r.end.armor.toFixed(1)),ammoUsed:ok.map(r=>r.start.ammo-r.end.ammo)}));}
