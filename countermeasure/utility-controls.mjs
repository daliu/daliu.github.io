import {POWERS,powerCue} from './expedition-plan.mjs';
import {LATE_TOOLS,toolAvailable} from './late-tools.mjs';
export function availableUtilities(g){return [...POWERS.flatMap((p,i)=>powerCue(g,i).available?[{kind:'power',index:i,name:p.name}]:[]),...LATE_TOOLS.flatMap((p,i)=>toolAvailable(g,i)?[{kind:'tool',index:i,name:p.name}]:[])];}
export function currentUtility(g){const all=availableUtilities(g);return all.find(p=>p.kind===(g.utilityKind??'power')&&p.index===(g.utilityKind==='tool'?g.gear.selected:g.module))??all[0]??null;}
export function selectUtility(g,kind,index){if(!availableUtilities(g).some(p=>p.kind===kind&&p.index===index))return false;g.utilityKind=kind;if(kind==='power')g.selectModule(index);else g.gear.selected=index;g.player.drilling=0;g.cancelCharge?.();return true;}
export function cycleUtility(g){const all=availableUtilities(g),cur=currentUtility(g);if(!all.length)return false;const next=all[(all.findIndex(p=>p.kind===cur?.kind&&p.index===cur?.index)+1)%all.length];return selectUtility(g,next.kind,next.index);}
export function activateUtility(g){const u=currentUtility(g);if(!u)return false;if(u.kind==='power')g.module=u.index;else g.gear.selected=u.index;return u.kind==='power'?g.useModule():g.useLateTool();}
export function utilityInput(g,input){if(currentUtility(g)?.kind!=='tool')return input;return {...input,module:false,tool:input.tool||input.module};}
