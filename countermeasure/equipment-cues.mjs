import {POWERS,powerCue} from './expedition-plan.mjs';
import {toolAvailable} from './late-tools.mjs';

const POWER_NAMES=['RADIO','GLUE','FIRE','MAGNET','EMP','AP'];
const ICONS=['⌁','◌','♨','ϟ','◎','↗'];
export function equipmentCues(g,{hacking=false}={}){
 const playing=g.state==='playing',gear=g.gear,p=g.player,index=g.module,available=powerCue(g,index).available;
 const powerActive=playing&&(g.moduleActiveUntil?.[index]??0)>g.clock;
 const powerState=!available?'locked':!playing?'standby':powerActive?'active':index===3&&g.resources.electricLock>0?'locked':index===5&&g.resources.ammo<=0?'empty':g.moduleCooldowns[index]>0?'cooling':'ready';
 const powerLabel=powerState==='active'?'ACTIVE':powerState==='cooling'?Math.ceil(g.moduleCooldowns[index])+'s':powerState==='locked'?'LOCKED':powerState==='empty'?'EMPTY':powerState==='standby'?'STANDBY':'READY';
 const turretState=!toolAvailable(g,0)?'locked':gear.turretOn&&(!playing||hacking)?'standby':gear.turretOn&&p.turretFlash>0?'active':gear.turretAmmo<=0?'empty':gear.turretOn?'on':'off';
 const turretLabel={locked:'LOCKED',empty:'EMPTY',off:'OFF',standby:'PAUSED',active:'FIRING',on:'ON'}[turretState];
 const selected=gear.selected,stock=selected===0?gear.turretAmmo:selected===1?gear.lava:Math.ceil(gear.drillFuel);
 const firing=playing&&(selected===2?p.drilling>0:selected===1?g.gearShots.some(s=>s.kind==='lava'&&s.life>0):turretState==='active');
 const toolState=!toolAvailable(g,selected)?'locked':selected===0?turretState:firing?'active':stock<=0?'empty':playing?'ready':'standby';
 const toolLabel=selected===0?turretLabel:toolState==='active'?(selected===2?'DRILLING':'IN FLIGHT'):toolState==='ready'?'READY':toolState==='empty'?'EMPTY':toolState==='locked'?'LOCKED':'STANDBY';
 return {
  power:{name:POWER_NAMES[index],icon:ICONS[index],state:powerState,label:powerLabel,color:POWERS[index].color,available},
  tool:{name:['TURRET','LAVA','DRILL'][selected],icon:['◉','♨','⇣'][selected],state:toolState,label:toolLabel,stock},
  turret:{state:turretState,label:turretLabel,visible:toolAvailable(g,0)&&gear.turretOn}
 };
}

export function drawMechPowerCue(ctx,g,t){
 if(!g.player.mecha)return;const p=g.player,c=equipmentCues(g).power;
 ctx.save();ctx.translate(p.x-p.facing*24,p.y-45);ctx.fillStyle='#172a28';ctx.strokeStyle=c.color;ctx.lineWidth=2;
 ctx.fillRect(-5,-8,10,18);ctx.strokeRect(-5,-8,10,18);ctx.fillStyle=c.state==='active'?c.color:'#627871';ctx.fillRect(-2,-4,4,9);
 if(c.state==='active'){ctx.strokeStyle=c.color;ctx.globalAlpha=.7;for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(0,0,12+i*8+Math.sin(t*10)*2,-1.2,1.2);ctx.stroke();}}
 ctx.restore();
}
