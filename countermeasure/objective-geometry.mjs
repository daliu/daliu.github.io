// Match the visible mast and fortress plates, rather than a humanoid foot point.
export function structureBounds(r){
 if(r.type==='antenna')return {left:r.x-46,right:r.x+46,top:r.y-300,bottom:r.y+5};
 const extra=(r.maxHp>5000?4:r.maxHp>800?2:0);
 return {left:r.x-60-extra*8,right:r.x+60+extra*8,top:r.y-115-extra*6,bottom:r.y+45+extra*6};
}
export function structureDistance(r,x,y){const b=structureBounds(r);return Math.hypot(Math.max(b.left-x,0,x-b.right),Math.max(b.top-y,0,y-b.bottom));}
export function structureHitFraction(r,x,y,x2,y2){
 const b=structureBounds(r);let enter=0,exit=1;
 for(const [start,delta,low,high] of [[x,x2-x,b.left,b.right],[y,y2-y,b.top,b.bottom]]){
  if(Math.abs(delta)<1e-9){if(start<low||start>high)return null;continue;}
  const a=(low-start)/delta,c=(high-start)/delta;enter=Math.max(enter,Math.min(a,c));exit=Math.min(exit,Math.max(a,c));if(enter>exit)return null;
 }
 return enter;
}
