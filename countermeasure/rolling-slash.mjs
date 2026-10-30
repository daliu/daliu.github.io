import {structureDistance} from './objective-geometry.mjs';
// Four distinct presses, in any order. Held keys and auto-repeat do not count.
export class RollingSlashGesture {
  constructor(windowMs=450){this.windowMs=windowMs;this.presses=new Map();}
  clear(){this.presses.clear();}
  press(code,time,{repeat=false}={}){
    if(repeat||!['KeyW','KeyA','KeyS','KeyD'].includes(code))return false;
    for(const [key,at] of this.presses)if(time-at>this.windowMs)this.presses.delete(key);
    this.presses.set(code,time);
    if(this.presses.size!==4)return false;
    this.clear();return true;
  }
}

export function startRollingSlash(g){
  const p=g.player;
  if(g.weaponAvailable&&!g.weaponAvailable(1))return false;
  if(g.state!=='playing'||p.spinTime>0||p.paralyzed>0||p.spinQueue>0)return false;
  if(p.attackCd>0){p.spinQueue=1.5;return true;}
  p.spinTime=.42;p.spinTurns=p.airJumps>=2?2:1;p.spinHits=new Set();p.attackCd=.85;
  g.stats.attacks[1]++;g.stats.rollingSlashes=(g.stats.rollingSlashes??0)+1;
  g.effects.push({kind:'spin-slash',x:p.x,y:p.y-24,life:.42,max:.42,color:'#d7eff5'});
  return true;
}

export function updateRollingSlash(g,dt){
  const p=g.player;if(p.spinQueue>0){p.spinQueue=Math.max(0,p.spinQueue-dt);if(p.attackCd<=0){p.spinQueue=0;startRollingSlash(g);}}if(!(p.spinTime>0))return;
  p.spinTime=Math.max(0,p.spinTime-dt);
  const dash=p.dashTime>0,range=dash?150:125;
  for(const r of g.robots)if(r.hp>0&&!p.spinHits.has(r.id)&&(r.structure?structureDistance(r,p.x,p.y-24)<range:Math.hypot(r.x-p.x,r.y-p.y)<range)){
    p.spinHits.add(r.id);g.hit(r,1,dash?1.35:1.05);
  }
}
