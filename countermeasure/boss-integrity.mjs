const clamp=n=>Math.max(0,Math.min(1,n));
export const isLearningBoss=r=>!!r?.super||r?.type==='mirror';
// First ten percent is intact. Damaged internals then progressively expose the core.
export function bossWounds(r){return isLearningBoss(r)&&r.maxHp>0?clamp((.9-r.hp/r.maxHp)/.9):0;}
export const bossCriticalBonus=r=>.34*bossWounds(r);
export const bossMobility=r=>1+.4*bossWounds(r);
export function bossDamageScale(r){
 const wounds=bossWounds(r);if(!isLearningBoss(r))return 1;
 if(!r.super)return .65*(1+wounds);
 const weak=r.emp>0||r.radio>0||r.root>0||r.paralyzed>0||r.weakness>0||r.laser?.phase==='recharge';
 // Broken casing stops being an enduring damage sponge; objective openings still win.
 return weak?.85+.5*wounds:r.shieldReduced?.6+.55*wounds:.18+.7*Math.pow(wounds,.8);
}
export function woundPressure(robots){
 const wounds=Math.max(0,...robots.filter(r=>r.hp>0&&isLearningBoss(r)).map(r=>1-r.hp/r.maxHp));
 return wounds>=.85?3:wounds>=.65?2:wounds>=.35?1:0;
}
export function drawBossIntegrity(ctx,r,t){
 const wounds=bossWounds(r);if(!wounds)return;
 ctx.save();ctx.strokeStyle='#f2a26d';ctx.lineWidth=2;ctx.globalAlpha=.3+wounds*.6;
 for(let i=0;i<Math.ceil(wounds*5);i++){const x=r.x-16+i*8,y=r.y-65+i*9;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+5,y+8);ctx.lineTo(x-2,y+16);ctx.stroke();}
 if(wounds>.45){ctx.fillStyle='#f6d38b';for(let i=0;i<3;i++){const age=(t*3+i/3)%1;ctx.fillRect(r.x+Math.sin(i*3)*age*32,r.y-34+age*22,3,3);}}
 ctx.restore();
}
