import {validTrack} from './soundtrack.mjs';
import {defaultKeyboard,normalizeKeyboard} from './keybindings.mjs';
export const OPTIONS_KEY='countermeasure.options.v1';
export const DEFAULT_OPTIONS={audio:false,volume:.65,musicTrack:'auto',touchAim:true,overdrive:true,autoSkills:false,keyboard:defaultKeyboard()};
export function readOptions(storage){try{const value=JSON.parse(storage.getItem(OPTIONS_KEY));return {musicTrack:validTrack(value?.musicTrack)?value.musicTrack:'auto',audio:typeof value?.audio==='boolean'?value.audio:false,volume:Number.isFinite(value?.volume)?Math.max(0,Math.min(1,value.volume)):.65,touchAim:typeof value?.touchAim==='boolean'?value.touchAim:true,overdrive:typeof value?.overdrive==='boolean'?value.overdrive:true,autoSkills:false,autoSkills:value?.autoSkills===true,keyboard:normalizeKeyboard(value?.keyboard)};}catch{return {...DEFAULT_OPTIONS,keyboard:defaultKeyboard()};}}
export function saveOptions(storage,value){try{storage.setItem(OPTIONS_KEY,JSON.stringify(value));return true;}catch{return false;}}
export const RELEASE='49 · SIGNAL INTERCEPT';
