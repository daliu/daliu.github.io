// A run keeps the same annex topology through retries and save imports. The
// layout never consumes combat RNG or changes the numbered main route.
const ANNEX_WAVES=[4,14,18,24,34,44];
const KINDS=['closet','service-bay','through'];
export function sideLayout(g){
 const slot=ANNEX_WAVES.indexOf(g.wave);if(slot<0)return null;
 const seed=(g.sideSeed??0)>>>0,slots=[0,1,2,0,1,2];let hash=seed;
 // Seed zero is the stable topology assigned to migrated checkpoints.
 if(seed)for(let i=slots.length-1;i>0;i--){hash=(Math.imul(hash,1664525)+1013904223)>>>0;const j=hash%(i+1);[slots[i],slots[j]]=[slots[j],slots[i]];}
 const kind=KINDS[slots[slot]];
 return {kind,forward:kind==='through',exitDirection:kind==='through'?1:-1,exitX:kind==='through'?1020:35};
}
export const sideIsDeadEnd=g=>g.encounter==='side'&&sideLayout(g)?.forward===false;
