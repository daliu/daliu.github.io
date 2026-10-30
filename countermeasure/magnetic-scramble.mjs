import {TYPES} from './engine.mjs';
export function scrambleTarget(g){
 const p=g.player;return g.robots.filter(r=>r.hp>0&&!r.structure&&Math.hypot(r.x-p.x,r.y-p.y)<350&&(g.aimAssist||(r.x-p.x)*p.facing>=-30&&Math.abs(r.y-p.y)<140)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]??null;
}
export function scrambleSusceptibility(r){let n=TYPES[r.type].resistance.electric??1;if(r.shell)n=Math.min(.25,n);if(r.exposed>0)n=Math.max(1.3,n);return n;}
export function applyScramble(g,r){
 if(g.aimAssist)g.player.facing=Math.sign(r.x-g.player.x)||g.player.facing;
 if(g.anticipate(r,'magnet'))return;
 const n=scrambleSusceptibility(r);r.corruption=Math.max(r.corruption,4*n);
 const disabled=n>=.75&&!(r.controlRecovery>0)&&g.disable(r,'electric',Math.min(1.6,1.2*n));
 g.damageRobot(r,50*n,{color:'#b7e77a',number:true,feedbackKey:'magnet',feedbackSerial:'magnet:'+g.stats.modules[3]});
 g.effects.push({kind:'arc',x:g.player.x,y:g.player.y-30,x2:r.x,y2:r.y-25,life:.35,max:.35,color:'#b7e77a'});
 if(r.hp>0&&!disabled)g.effects.push({kind:'number',x:r.x,y:r.y-90,text:n<.75?'INSULATED':'CORRUPTING',life:.7,max:.7,color:'#d9d6b6'});
}
export function drawScrambleTarget(ctx,g){
 if(g.module!==3||!g.player.mecha||g.state!=='playing'||g.moduleCooldowns[3]>0)return;
 const r=scrambleTarget(g);if(!r)return;
 ctx.save();ctx.strokeStyle=scrambleSusceptibility(r)<.75?'#d9b677':'#b7e77a';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.strokeRect(r.x-29,r.y-77,58,78);ctx.restore();
}
