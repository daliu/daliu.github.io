import {POWERS,powerCue} from './expedition-plan.mjs';
import {toolAvailable} from './late-tools.mjs';
import {currentUtility} from './utility-controls.mjs';

const POWER_NAMES=['RADIO','GLUE','FIRE','MAGNET','EMP','AP'];
const ICONS=['⌁','◌','♨','ϟ','◎','↗'];
function powerEquipmentCue(g,index){
 const playing=g.state==='playing',cue=powerCue(g,index),available=cue.available;
 const powerActive=playing&&(g.moduleActiveUntil?.[index]??0)>g.clock;
 const powerState=!available?'locked':!playing?'standby':powerActive?'active':index===3&&g.resources.electricLock>0?'locked':cue.stock===0||index===5&&g.resources.ammo<=0?'empty':g.moduleCooldowns[index]>0?'cooling':'ready';
 const powerLabel=powerState==='active'?'ACTIVE':powerState==='cooling'?Math.ceil(g.moduleCooldowns[index])+'s':powerState==='locked'?'LOCKED':powerState==='empty'?'EMPTY':powerState==='standby'?'STANDBY':'READY';
 return {kind:'power',index,name:POWER_NAMES[index],icon:ICONS[index],state:powerState,label:powerLabel,color:POWERS[index].color,available,stock:cue.stock};
}
export function equipmentCues(g,{hacking=false}={}){
 const playing=g.state==='playing',gear=g.gear,p=g.player,power=powerEquipmentCue(g,g.module);
 const turretState=!toolAvailable(g,0)?'locked':gear.turretOn&&(!playing||hacking)?'standby':gear.turretOn&&p.turretFlash>0?'active':gear.turretAmmo<=0?'empty':gear.turretOn?'on':'off';
 const turretLabel={locked:'LOCKED',empty:'EMPTY',off:'OFF',standby:'PAUSED',active:'FIRING',on:'ON'}[turretState];
 const selected=gear.selected,stock=selected===0?gear.turretAmmo:selected===1?gear.lava:Math.ceil(gear.drillFuel);
 const firing=playing&&(selected===2?p.drilling>0:selected===1?g.gearShots.some(s=>s.kind==='lava'&&s.life>0):turretState==='active');
 const toolState=!toolAvailable(g,selected)?'locked':selected===0?turretState:firing?'active':stock<=0?'empty':playing?'ready':'standby';
 const toolLabel=selected===0?turretLabel:toolState==='active'?(selected===2?'DRILLING':'IN FLIGHT'):toolState==='ready'?'READY':toolState==='empty'?'EMPTY':toolState==='locked'?'LOCKED':'STANDBY';
 const tool={kind:'tool',index:selected,name:['TURRET','LAVA','DRILL'][selected],icon:['◉','♨','⇣'][selected],state:toolState,label:toolLabel,color:['#f4d194','#ff9b62','#c7edf2'][selected],stock};
 const utility=currentUtility(g);
 return {
  power,tool,selected:utility?(utility.kind==='tool'?tool:utility.index===power.index?power:powerEquipmentCue(g,utility.index)):null,
  turret:{state:turretState,label:turretLabel,visible:toolAvailable(g,0)&&gear.turretOn}
 };
}

export function drawMechPowerCue(ctx,g,t){
 if(!g.player.mecha)return;const p=g.player,c=equipmentCues(g).selected;if(!c)return;
 const active=c.state==='active',empty=c.state==='empty',id=c.kind==='tool'?c.index+6:c.index;
 ctx.save();ctx.translate(p.x-p.facing*26,p.y-47);ctx.fillStyle='#172a28';ctx.strokeStyle=c.color;ctx.lineWidth=2;
 ctx.fillRect(-10,-12,20,26);ctx.strokeRect(-10,-12,20,26);ctx.fillStyle=c.color;ctx.globalAlpha=empty?.35:1;
 // Each selected utility has its own silhouette; color is a second cue.
 if(id===0){line(ctx,-5,7,-5,-17);line(ctx,-9,-17,-1,-17);for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(-5,-10,7+i*5,-.9,.9);ctx.stroke();}}
 else if(id===1){ctx.fillRect(-6,-5,12,12);ctx.fillRect(-2,-10,4,5);ctx.beginPath();ctx.arc(0,1,3,0,Math.PI*2);ctx.stroke();}
 else if(id===2){ctx.fillRect(-6,-3,7,13);ctx.fillRect(1,-1,12,5);ctx.beginPath();ctx.moveTo(12,-3);ctx.lineTo(20,1);ctx.lineTo(12,5);ctx.fill();}
 else if(id===3){ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-2,6,0,Math.PI);ctx.stroke();line(ctx,-6,-2,-6,-8);line(ctx,6,-2,6,-8);ctx.fillRect(-8,-10,4,4);ctx.fillRect(4,-10,4,4);}
 else if(id===4){for(const radius of [3,8]){ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();}line(ctx,0,-12,0,-8);line(ctx,0,8,0,12);}
 else if(id===5){for(let i=0;i<3;i++){const x=-7+i*6;ctx.fillRect(x,-3,4,11);ctx.beginPath();ctx.moveTo(x,-3);ctx.lineTo(x+2,-8);ctx.lineTo(x+4,-3);ctx.fill();}}
 else if(id===6){ctx.fillRect(-7,0,14,7);ctx.fillRect(0,-4,15,5);ctx.beginPath();ctx.arc(0,-2,5,0,Math.PI*2);ctx.stroke();line(ctx,0,7,0,11);}
 else if(id===7){ctx.beginPath();ctx.moveTo(-4,-8);ctx.lineTo(-7,7);ctx.lineTo(7,7);ctx.lineTo(4,-8);ctx.closePath();ctx.stroke();ctx.fillRect(-5,-12,10,4);ctx.fillRect(-7,8,14,4);ctx.beginPath();ctx.arc(0,1,3,0,Math.PI*2);ctx.fill();}
 else {line(ctx,-8,-5,8,-5);ctx.fillRect(-5,-3,10,10);line(ctx,0,7,0,17);ctx.beginPath();ctx.moveTo(-3,15);ctx.lineTo(0,20);ctx.lineTo(3,15);ctx.stroke();}
 ctx.globalAlpha=1;
 if(empty){ctx.strokeStyle='#f0a49c';line(ctx,-9,-11,9,13);}
 else if(Number.isFinite(c.stock)&&c.kind==='power'){for(let i=0;i<Math.min(4,c.stock);i++)ctx.fillRect(-9+i*5,16,3,3);}
 if(active)drawActivation(ctx,id,t,c.color);
 ctx.restore();
}

function line(ctx,x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function drawActivation(ctx,id,t,color){
 ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=.75;ctx.lineWidth=2;
 if(id===0||id===4){for(let i=0;i<3;i++){const radius=18+((t*(id===0?22:40)+i*13)%40);ctx.beginPath();ctx.arc(0,0,radius,id===0?-1.35:0,id===0?1.35:Math.PI*2);ctx.stroke();}}
 else if(id===1){for(let i=0;i<5;i++){const phase=(t*2+i*.2)%1;ctx.beginPath();ctx.arc(Math.sin(i*3)*15,12+phase*24,2+phase,0,Math.PI*2);ctx.fill();}}
 else if(id===2){ctx.beginPath();ctx.moveTo(15,-5);ctx.lineTo(39+Math.sin(t*40)*6,1);ctx.lineTo(15,8);ctx.closePath();ctx.fill();}
 else if(id===3){for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*11,-8);ctx.lineTo(side*(20+Math.sin(t*30)*3),-16);ctx.lineTo(side*16,2);ctx.lineTo(side*25,8);ctx.stroke();}}
 else if(id===5||id===6){for(let i=0;i<3;i++)line(ctx,15,-4+i*4,26+i*3,-7+i*7);}
 else if(id===7){for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,-17-i*6,2,0,Math.PI*2);ctx.fill();}}
 else {for(let i=0;i<3;i++){const y=18+(t*90+i*9)%26;line(ctx,-5,y,-5,y+7);line(ctx,5,y,5,y+7);}}
}
