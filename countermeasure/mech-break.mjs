export const MECH_BLAST_RADIUS=210;
export function breakMech(g){
 const p=g.player;g.robotReassessment=1;
 g.effects.push({kind:'mech-break',x:p.x,y:p.y-30,life:1,max:1,color:'#ffbc75',range:MECH_BLAST_RADIUS});
 g.event(p.hp>0?'FAILSAFE FIRED / HUMAN STILL ACTIVE':'FAILSAFE COMPLETE / HUMAN TERMINATED','#ffbc75');
 for(const r of [...g.robots])if(r.hp>0&&!r.structure){
  const distance=Math.hypot(r.x-p.x,r.y-p.y);
  if(distance<MECH_BLAST_RADIUS)g.damageRobot(r,90*(1-.5*distance/MECH_BLAST_RADIUS),{color:'#ffbc75',number:true});
 }
}
export function updateReassessment(g,dt){
 if(!(g.robotReassessment>0))return;
 g.robotReassessment=Math.max(0,g.robotReassessment-dt);
 if(g.robotReassessment<1e-9){g.robotReassessment=0;if(g.player.hp>0)g.event('EXPERIMENT RESUMED / BOOSTERS ONLINE','#9ee6ee');}
}
