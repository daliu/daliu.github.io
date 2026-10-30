import {convertRobot} from './companions.mjs';
// Unsaved, in-memory practice. No campaign unlocks, telemetry or profile writes.
export function startSquadDrill(g){
 g.reset();g.mechTier=1;g.plan=g.makePlan(11,g.memory,'room');g.state='between';g.startWave();g.deployments=[];g.deploymentWarning=null;g.skills.voltage=1;g.hackSkill=true;g.player.x=220;g.companions=[];g.robots=[];
 for(const [i,type] of ['gunner','douser'].entries()){const r=g.spawn(type,80+i);r.x=200;r.exposed=10;r.emp=10;g.robots=[r];const a=convertRobot(g,r);a.x=110+i*50;}
 g.robots=['probe','guard','gunner'].map((type,i)=>{const r=g.spawn(type,i);r.x=600+i*130;r.cooldown=3+i;return r;});g.entrySquad={sequence:g.squadSequence,recruited:g.recruited,allies:g.companions.map(a=>({...a}))};g.entryCheckpoint=g.snapshot();g.pausedFrom='playing';g.state='paused';g.event('SQUAD DRILL / UNSAVED','#9ce5e3');
}

export function startHackDrill(g){startSquadDrill(g);g.state='playing';g.pausedFrom=null;g.orders.issue(g,'retreat');const r=g.spawn('probe',90);r.x=g.player.x+48;r.y=420;r.exposed=10;r.radio=8;const far=g.spawn('gunner',91);far.x=930;far.cooldown=6;g.robots=[r,far];g.event('EXPOSED + DISABLED / HOLD HACK','#9ce5e3');}

// Explicit cleared-room practice; shares the existing memory-only drill storage.
export function startRescueDrill(g,{survivor=false,group=false,collar=false,difficulty='normal'}={}){g.reset();g.difficulty=difficulty;g.mechTier=difficulty==='terminator'?5:survivor||collar?2:group&&difficulty==='hard'?3:1;g.plan=g.makePlan(collar?27:survivor?25:group?(difficulty==='hard'?33:19):12,g.memory,'room');g.state='between';g.startWave();g.deployments=[];g.deploymentWarning=null;g.robots=[];g.finishWave();g.weapon=2;g.player.x=survivor?440:g.rescueDoor.x-40;g.event((collar?'COLLAR RESCUE':survivor?'IRIS RESCUE':group?'GROUP RESCUE':'CLEARED-ROOM RESCUE')+' DRILL / UNSAVED','#9ce5e3');}

// Optional prototype practice uses the real encounter and the existing unsaved storage.
export function startSpiderDrill(g){g.reset();g.difficulty='normal';g.mechTier=1;g.plan=g.makePlan(18,g.memory,'side');g.state='between';g.startWave();g.player.x=300;g.event('SPIDER ANNEX / UNSAVED','#c3b0c5');}
