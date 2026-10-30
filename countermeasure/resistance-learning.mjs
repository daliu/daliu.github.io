export const DAMAGE_CHANNELS=['impact','cutting','electric','energy','water','fire'];
export const DAMAGE_LABELS=['impact','cutting','shock','laser','liquid','heat'];
export const freshReinforcement=()=>({through:0,ranks:[0,0,0,0,0,0],last:[]});
export function validReinforcement(v){
 if(v===undefined)return freshReinforcement();
 if(!v||!Number.isInteger(v.through)||v.through<0||v.through>50||!Array.isArray(v.ranks)||v.ranks.length!==6||v.ranks.some(n=>!Number.isInteger(n)||n<0||n>v.through)||!Array.isArray(v.last)||v.last.length>3||new Set(v.last).size!==v.last.length||v.last.some(n=>!Number.isInteger(n)||n<0||n>5||v.ranks[n]===0))return null;
 return {through:v.through,ranks:[...v.ranks],last:[...v.last]};
}
export function learnReinforcement(memory,stats,{wave,won,learning=1,levelComplete=true}){
 const r=structuredClone(memory.reinforcement??freshReinforcement());if(!won||!levelComplete||wave<=r.through)return r;
 const a=stats.attacks??[0,0,0,0],electric=Math.max(0,a[2]-(stats.energyAttacks??0)),uses=[a[0]+(stats.modules?.[5]??0)+(stats.turretShots??0),a[1],electric,stats.energyAttacks??0,a[3],(stats.modules?.[2]??0)+(stats.heatBursts??0)],limit=learning>=1.7?3:learning>=1.3?2:1;
 r.last=uses.map((n,i)=>({n,i})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n||a.i-b.i).slice(0,limit).map(x=>x.i);for(const i of r.last)r.ranks[i]++;r.through=wave;return r;
}
export function resistanceFactor(memory,type){const i=DAMAGE_CHANNELS.indexOf(type);return i<0?1:Math.pow(.98,memory.reinforcement?.ranks[i]??0);}
export function learningBroadcast(wave,memory,plan){
 if(wave===21)return 'UNAUTHORIZED RECEIVER DETECTED / TACTICAL CHANNEL ENCRYPTED';
 if(wave>21)return 'TACTICAL CHANNEL / ENCRYPTED';
 const r=memory.reinforcement,changed=r?.last.map(i=>DAMAGE_LABELS[i]+' −2%').join(' · ');
 return 'INTERCEPTED / '+(changed||'collecting combat samples')+(memory.jumpRate>.13?' / air interception':memory.stationaryRatio>.55?' / artillery targeting':memory.dashRate>.12?' / feint pursuit':' / '+(plan.adaptation??'observing movement'));
}
export function learningReport(wave,memory){
 if(wave>=21)return 'The factory detected the receiver. Its tactical broadcasts are encrypted; enemy changes must now be read from their behavior.';
 const r=memory.reinforcement??freshReinforcement(),rows=r.ranks.map((n,i)=>n?DAMAGE_LABELS[i]+': '+(100*(1-Math.pow(.98,n))).toFixed(1)+'% less damage ('+n+' lessons)':null).filter(Boolean);
 const habits=['movement '+Math.round((memory.jumpRate??0)*60)+' jumps/min',Math.round((memory.stationaryRatio??0)*100)+'% stationary',Math.round((memory.duckRatio??0)*100)+'% crouching'];
 return [...rows,habits.join(' · ')].join('. ');
}
