// Dry only the heated ground interval. Preserve untouched fluid and its owner/lifetime.
export function dryFloor(g,left,right){
 const a=Math.max(0,Math.min(left,right)),b=Math.min(1000,Math.max(left,right));if(b<=a)return 0;
 let dried=0;const kept=[];
 for(const pool of g.pools){const lo=pool.x-pool.radius,hi=pool.x+pool.radius;if(hi<=a||lo>=b){kept.push(pool);continue;}dried++;
  for(const [x,y] of [[lo,Math.min(a,hi)],[Math.max(b,lo),hi]])if(y-x>=6)kept.push({...pool,x:(x+y)/2,radius:(y-x)/2});
 }
 g.pools=kept;return dried;
}
