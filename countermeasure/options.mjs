export const OPTIONS_KEY='countermeasure.options.v1';
export const DEFAULT_OPTIONS={audio:false,volume:.65,touchAim:true};
export function readOptions(storage){try{const value=JSON.parse(storage.getItem(OPTIONS_KEY));return {audio:typeof value?.audio==='boolean'?value.audio:false,volume:Number.isFinite(value?.volume)?Math.max(0,Math.min(1,value.volume)):.65,touchAim:typeof value?.touchAim==='boolean'?value.touchAim:true};}catch{return {...DEFAULT_OPTIONS};}}
export function saveOptions(storage,value){try{storage.setItem(OPTIONS_KEY,JSON.stringify(value));return true;}catch{return false;}}
export const RELEASE='17 · LEARNED COMBOS';
