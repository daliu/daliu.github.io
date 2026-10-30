// Balanced allocation, using the same dependency/point checks as manual spending.
export function autoAllocate(g){
 const order=['agility','voltage',...(g.wave>=11&&'hackSkill' in g?['hack']:[]),'force','plating','breaker','cascade'];let added=0;
 for(let pass=0;pass<4&&g.spent<g.points;pass++)for(const id of order)if(g.spent<g.points&&g.allocate(id,1))added++;
 return added;
}
