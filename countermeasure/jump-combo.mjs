// Jump taps change height only. The separate rolling-slash command owns flips.
export function jumpPlayer(g){
 const p=g.player;if(!['playing','traveling'].includes(g.state)||p.rollTime>0||p.paralyzed>0||!p.grounded&&(p.airJumps??0)>=2)return false;
 p.airJumps=p.grounded?1:2;p.vy=p.mecha?-620:-510;p.grounded=false;g.stats.jumps++;return true;
}
export function updateJumpState(p){if(p.grounded)p.airJumps=0;}
export const freshJump=()=>({airJumps:0});
