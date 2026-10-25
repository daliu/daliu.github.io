const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Flight is a succession of passes, not an unlimited upward impulse. Sensing
// remains delayed; combo windups and disabling statuses retain their own rules.
export function limitMirrorAltitude(r){
 if(!r.build?.mechTier||r.glueGround>0)return;
 if(r.y<145){r.y=145;r.vy=Math.max(130,r.vy);}
}
export function updateMirrorFlight(r,player,dt){
 if(!r.build?.mechTier||r.glueGround>0)return;
 r.flightSense=(r.flightSense??0)-dt;
 if(r.flightSense<=0){r.flightTarget=player.y;r.flightSense=.24;}
 r.flightRest=Math.max(0,(r.flightRest??0)-dt);
 if(r.flightRest>0){r.vy=Math.max(150,r.vy);return;}
 if(r.flightTarget>=365){r.flightAge=0;return;}
 r.flightAge=(r.flightAge??0)+dt;
 if(r.flightAge>=3.2){r.flightAge=0;r.flightRest=1.1;r.vy=190;return;}
 // Approach above the target, cross its attack line, then break below it.
 const offset=r.flightAge<1?-25:r.flightAge<2?10:65;
 const goal=clamp(r.flightTarget+offset,165,390),error=goal-r.y;
 r.vy=Math.abs(error)<9?0:clamp(error*4,-260,300);
 limitMirrorAltitude(r);
}
