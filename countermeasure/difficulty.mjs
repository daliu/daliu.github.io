// All settings are local. Profiles change the opponent model as well as resources.
export const DIFFICULTIES={
 easy:{name:'Easy',health:140,armor:1.35,fuel:160,ammo:30,learning:.45,adaptation:.55,slots:1,count:.72,reaction:1.35,speed:.85,attack:.75,coordination:.45,repair:35,healthFloor:95},
 normal:{name:'Normal',health:100,armor:1,fuel:100,ammo:18,learning:1,adaptation:1,slots:1,count:1,reaction:1,speed:1,attack:1,coordination:1,repair:20,healthFloor:70},
 hard:{name:'Hard',health:85,armor:.8,fuel:80,ammo:12,learning:1.3,adaptation:1.5,slots:2,count:1.25,reaction:.8,speed:1.13,attack:1.25,coordination:1.35,repair:10,healthFloor:55},
 terminator:{name:'Terminator',health:70,armor:.42,fuel:65,ammo:9,learning:1.7,adaptation:2,slots:3,count:1.5,reaction:.6,speed:1.24,attack:1.55,coordination:1.8,repair:0,healthFloor:0}
};
export const validDifficulty=value=>Object.hasOwn(DIFFICULTIES,value);
export const profileFor=value=>DIFFICULTIES[value]??DIFFICULTIES.normal;
export const fullResources=difficulty=>({fuel:profileFor(difficulty).fuel,ammo:profileFor(difficulty).ammo,electricLock:0});
export function tunedCognition(base,difficulty){const p=profileFor(difficulty);return {...base,speed:base.speed*p.speed,reaction:Math.max(.08,base.reaction*p.reaction),turn:Math.max(.1,base.turn*p.reaction),windup:base.windup/Math.sqrt(p.attack),dodge:Math.min(.9,base.dodge*Math.sqrt(p.adaptation)),crit:Math.min(.24,base.crit*Math.sqrt(p.attack)),discipline:base.growth*p.coordination>.48};}
export const bodyZone=(player,robot)=>{const y=player.y-(player.crouching||player.rollTime>0?9:26),height=robot.crippled?.48:1;return y<robot.y-47*height?'head':y>robot.y-17*height?'legs':'body';};
export const CRITICAL_MULTIPLIER={body:1.65,legs:1.85,head:2.65};
