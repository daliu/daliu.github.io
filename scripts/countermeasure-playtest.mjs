import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {play} from '../tests/helpers/countermeasure-pilot.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const seeds=option('--seeds','11,12,13,14,15').split(',').map(Number),reaction=Number(option('--reaction','.2')),maxDeaths=Number(option('--max-deaths','12'));
if(seeds.some(n=>!Number.isInteger(n))||!Number.isFinite(reaction)||reaction<.08||reaction>1)throw Error('Invalid seeds/reaction');
const runtime=process.env.COUNTERMEASURE_RUNTIME??fileURLToPath(new URL('../countermeasure/',import.meta.url)),hashes={};
for(const file of ['difficulty.mjs','engine.mjs','controls.mjs','campaign.mjs','campaign-plan.mjs','expedition.mjs','mirror-flight.mjs','boss-combos.mjs','boss-support.mjs','enemy-generations.mjs','expedition-plan.mjs','expedition-saves.mjs'])try{hashes[file]=createHash('sha256').update(readFileSync(runtime+file)).digest('hex');}catch{}
const runs=[];for(const mode of ['easy','normal','hard','terminator'])for(const seed of seeds){const r=play(mode,seed,{reaction,maxDeaths});delete r.game;runs.push(r);console.log(JSON.stringify({mode,seed,status:r.status,deaths:r.deaths,level:r.level,phase:r.phase,simulatedSeconds:r.seconds}));}
const report={method:'Seeded input-driven model, not a human playthrough or physical-device proof',reactionSeconds:reaction,seeds,maxDeaths,runtimeHashes:hashes,runs};
if(option('--report',null))writeFileSync(option('--report'),JSON.stringify(report,null,2)+'\n');
if(runs.some(r=>r.status!=='complete'))process.exitCode=1;
