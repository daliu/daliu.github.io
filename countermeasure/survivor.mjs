// A specific adult survivor, separate from the ordinary wounded-prisoner rules.
export const SURVIVOR_ROOM=26; // Campaign level 25, after the second Mirror/Super pair.
export const SURVIVOR_ARMOR=180;
export const SURVIVOR_DODGE=.7;
export const SURVIVOR_DAMAGE=.55;
export const SURVIVOR_HAIR=['#e9ba70','#402f39','#a74849','#eff0df','#6bc5b6','#967cce','#d88fa9','#4287b2'];
export const isSurvivor=a=>a?.kind==='human'&&a.survivor==='iris';
export const survivorDodge=g=>g.difficulty==='terminator'?Math.min(.92,.82+.02*Math.floor((g.wave-1)/10)):SURVIVOR_DODGE;
export const survivorMorale=g=>(g.companions??[]).some(a=>isSurvivor(a)&&a.hp>0)?1.12:1;
export function survivorHair(subject=''){
 let hash=2166136261;for(const c of String(subject)){hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;}
 return SURVIVOR_HAIR[hash%SURVIVOR_HAIR.length];
}
export function survivorFields(a){
 if(a.survivor===undefined)return a.hair===undefined&&a.armor===undefined?{}:null;
 if(a.survivor!=='iris'||a.rescueRoom!==SURVIVOR_ROOM||(a.rescueSlot??0)!==0||!SURVIVOR_HAIR.includes(a.hair)||!Number.isFinite(a.armor)||a.armor<0||a.armor>SURVIVOR_ARMOR)return null;
 return {survivor:'iris',hair:a.hair,armor:a.armor};
}
export function drawSurvivor(ctx,a,t=0){
 ctx.save();
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 if(a.dodgeFlash>0){ctx.save();ctx.globalAlpha=.25;box(-25*a.facing,-62,22,59,'#b9f9ee');ctx.restore();ctx.translate(8*a.facing*Math.sin(t*32),0);}
 // Long swept hair, fitted utility coat, reinforced shoulders and boots; fully clothed.
 box(-13,-65,26,29,a.hair);box(-11,-42,22,29,'#f1dfc8');box(-11,-42,22,5,'#6fa6a3');
 box(-3,-37,6,24,'#42636e');box(-12,-17,24,4,'#c7a876');box(-8,-62,17,18,'#e7ba9f');
 box(-12,-65,23,7,a.hair);box(a.facing>0?-12:7,-59,6,29,a.hair);
 box(a.facing>0?2:-7,-56,5,2,'#20353e');box(a.facing>0?4:-6,-49,3,1,'#ad6872');
 for(const x of [-9,3]){box(x,-14,6,14,'#334658');box(x-2,-6,10,6,'#adc3c1');}
 if(a.armor>0){box(-15,-41,9,15,'#a4c9c4');box(6,-41,9,15,'#a4c9c4');box(-8,-36,16,15,'#587f89');box(-7,-35,14,3,'#d7ba81');}
 box(a.facing>0?8:-29,-32,21,5,'#b4f6e5');
 ctx.restore();
}
