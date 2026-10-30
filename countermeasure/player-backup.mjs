import {ProgressStore} from './saves.mjs';
import {ExpeditionStore,EXPEDITION_SAVE_KEY,campaignSaveFrom,expeditionCheckpoint} from './expedition-saves.mjs';
import {SubjectRegister} from './subjects.mjs';
import {EscapeArchive,ESCAPE_KEY} from './escape-archive.mjs';
import {CHARACTER_KEY,normalizeCharacter} from './character.mjs';
import {OPTIONS_KEY,readOptions} from './options.mjs';
import {validDifficulty} from './difficulty.mjs';
import {EndingArchive,ENDINGS_KEY} from './narrative.mjs';
export const PROFILE_PENDING='countermeasure.profile.pending.v1';
const DEMO='countermeasure.progress.v1',SUBJECTS='countermeasure.subjects.v1',FINALE='countermeasure.finale.v1',MODE='countermeasure.mode.v1',DIFFICULTY='countermeasure.difficulty.v1';
const KEYS=[DEMO,EXPEDITION_SAVE_KEY,SUBJECTS,ESCAPE_KEY,ENDINGS_KEY,CHARACTER_KEY,OPTIONS_KEY,FINALE,MODE,DIFFICULTY];
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const parse=(s,k)=>{try{return JSON.parse(s.getItem(k));}catch{return null;}};
// A write-ahead undo record protects the previous profile if a browser closes or
// runs out of space halfway through a multi-key restore. Failed recovery uses
// the old snapshot in memory and reports session-only storage instead of mixing runs.
export function playerStorage(base){
 let fallback=null,sessionOnly=false;
 const write=(key,value)=>value===null?base.removeItem(key):base.setItem(key,value);
 const api={get sessionOnly(){return sessionOnly;},getItem(key){if(fallback?.has(key))return fallback.get(key);try{return base.getItem(key);}catch{return null;}},setItem(key,value){if(sessionOnly){fallback.set(key,String(value));throw Error('Session only');}base.setItem(key,value);},removeItem(key){if(sessionOnly){fallback.set(key,null);throw Error('Session only');}base.removeItem(key);},recover(){
  let pending;try{pending=JSON.parse(base.getItem(PROFILE_PENDING));}catch{sessionOnly=true;fallback=new Map();return false;}
  if(!pending)return true;
  const legacyKey=['countermeasure.campaign.v8','countermeasure.campaign.v7','countermeasure.campaign.v6','countermeasure.campaign.v5'].find(k=>pending.old&&Object.hasOwn(pending.old,k));
  const campaignKeys=legacyKey&&!Object.hasOwn(pending.old,EXPEDITION_SAVE_KEY)?KEYS.map(k=>k===EXPEDITION_SAVE_KEY?legacyKey:k):KEYS;
  // Older write-ahead records never touched ending history; undo only their keys.
  const recoverKeys=campaignKeys.filter(k=>k!==ENDINGS_KEY||pending.old&&Object.hasOwn(pending.old,ENDINGS_KEY));
  if(pending.version!==1||!['prepared','complete'].includes(pending.phase)||pending.phase==='prepared'&&(!pending.old||!recoverKeys.every(k=>pending.old[k]===null||typeof pending.old[k]==='string'))){try{base.removeItem(PROFILE_PENDING);}catch{}return true;}
  if(pending.phase==='complete'){try{base.removeItem(PROFILE_PENDING);}catch{}return true;}
  try{for(const k of recoverKeys)write(k,pending.old[k]);base.removeItem(PROFILE_PENDING);return true;}
  catch{sessionOnly=true;fallback=new Map(recoverKeys.map(k=>[k,pending.old[k]]));return false;}
 }};api.recover();return api;
}
export function scopedPlayerStorage(base,{payment=false,analyticsTest=false}={}){
 const prefix=payment?'countermeasure.payment-qa.':analyticsTest?'countermeasure.qa.':'';
 return playerStorage({getItem:k=>base.getItem(prefix+k),setItem:(k,v)=>base.setItem(prefix+k,v),removeItem:k=>base.removeItem(prefix+k)});
}
function normalized(value){
 if(!value||value.format!=='countermeasure-player'||value.version!==1||!value.profile||typeof value.profile!=='object')throw Error('Use a player backup file');
 const p=value.profile,demo=new ProgressStore(),campaign=new ExpeditionStore();
 if(p.demo!==null)demo.import(JSON.stringify(p.demo));if(p.campaign!==null)campaign.import(JSON.stringify(p.campaign));
 if(!p.subjects||!Number.isInteger(p.subjects.seed)||p.subjects.seed<0||p.subjects.seed>0xffffffff||!Number.isSafeInteger(p.subjects.sequence)||p.subjects.sequence<0||p.subjects.sequence>1000000000||!Array.isArray(p.subjects.records)||p.subjects.records.length>24)throw Error('Invalid subject records');
 if(!p.archive||!Array.isArray(p.archive.winners)||p.archive.winners.length>48||!Array.isArray(p.archive.lost)||p.archive.lost.length>128)throw Error('Invalid escape archive');
 const store=memory();store.setItem(ESCAPE_KEY,JSON.stringify(p.archive));if(p.endings!==undefined)store.setItem(ENDINGS_KEY,JSON.stringify(p.endings));const archive=new EscapeArchive(store,p.subjects.records),endings=new EndingArchive(store),subjects=new SubjectRegister(p.subjects),opts=memory();opts.setItem(OPTIONS_KEY,JSON.stringify(p.options));
 return {format:'countermeasure-player',version:1,profile:{demo:demo.entries.size?demo.snapshot():null,campaign:campaign.entries.size?JSON.parse(campaign.export()):null,subjects:subjects.snapshot(),archive:{winners:archive.winners,lost:archive.lost,unlocked:archive.unlocked},endings:{version:1,entries:endings.list()},character:normalizeCharacter(p.character,false,archive.unlocked),options:readOptions(opts),mode:p.mode==='campaign'?'campaign':'demo',difficulty:validDifficulty(p.difficulty)?p.difficulty:'normal'}};
}
export function readPlayerBackup(text){if(typeof text!=='string'||text.length>1000000)throw Error('Backup too large');return normalized(JSON.parse(text));}
export function capturePlayerBackup(storage){
 const d=new ProgressStore(storage.getItem(DEMO)),c=new ExpeditionStore(campaignSaveFrom(storage)),legacyFinale=parse(storage,FINALE);
 if(legacyFinale&&expeditionCheckpoint(legacyFinale))c.unlockFinale(legacyFinale);
 const register=new SubjectRegister(parse(storage,SUBJECTS)),temp=memory();temp.setItem(ESCAPE_KEY,JSON.stringify(parse(storage,ESCAPE_KEY)));const archive=new EscapeArchive(temp,register.records);
 return normalized({format:'countermeasure-player',version:1,profile:{demo:d.entries.size?d.snapshot():null,campaign:c.entries.size?JSON.parse(c.export()):null,subjects:register.snapshot(),archive:{winners:archive.winners,lost:archive.lost,unlocked:archive.unlocked},endings:{version:1,entries:new EndingArchive(storage).list()},character:parse(storage,CHARACTER_KEY),options:readOptions(storage),mode:storage.getItem(MODE),difficulty:storage.getItem(DIFFICULTY)}});
}
export function restorePlayerBackup(storage,value){
 if(storage.sessionOnly)throw Error('Storage unavailable. Keep your backup and retry in a browser with local storage.');
 const p=normalized(value).profile,current=capturePlayerBackup(storage).profile;
 // Entry progress is replaced, but already-earned permanent rewards are retained.
 const winners=new Map([...current.archive.winners,...p.archive.winners].map(r=>[r.id,r]));p.archive.winners=[...winners.values()].slice(-48);p.archive.lost=[...new Set([...current.archive.lost,...p.archive.lost])].slice(-128);p.archive.unlocked ||=current.archive.unlocked;
 const endings=new Map(current.endings.entries.map(e=>[e.id,e]));for(const e of p.endings.entries){const earned=endings.get(e.id);if(!earned)endings.set(e.id,e);else if(e.difficulty==='terminator'&&earned.difficulty!=='terminator')endings.set(e.id,{...earned,difficulty:'terminator'});}p.endings={version:1,entries:[...endings.values()]};
 p.character=normalizeCharacter(value.profile.character,false,p.archive.unlocked);
 const campaign=new ExpeditionStore();if(p.campaign)campaign.import(JSON.stringify(p.campaign));if(current.campaign?.finale)campaign.unlockFinale(current.campaign.finale);p.campaign=campaign.entries.size?JSON.parse(campaign.export()):null;
 const values={[DEMO]:p.demo,[EXPEDITION_SAVE_KEY]:p.campaign,[SUBJECTS]:p.subjects,[ESCAPE_KEY]:p.archive,[ENDINGS_KEY]:p.endings,[CHARACTER_KEY]:p.character,[OPTIONS_KEY]:p.options,[FINALE]:campaign.finale,[MODE]:p.mode,[DIFFICULTY]:p.difficulty};
 const old=Object.fromEntries(KEYS.map(k=>[k,storage.getItem(k)??null]));storage.setItem(PROFILE_PENDING,JSON.stringify({version:1,phase:'prepared',old}));
 try{for(const k of KEYS){const v=values[k];if(v===null)storage.removeItem(k);else storage.setItem(k,k===MODE||k===DIFFICULTY?v:JSON.stringify(v));}storage.setItem(PROFILE_PENDING,JSON.stringify({version:1,phase:'complete'}));}
 catch(error){storage.recover();throw error;}
 try{storage.removeItem(PROFILE_PENDING);}catch{}return p;
}
export function playerBackupUI({storage,document,window,beforeExport,onOpen,onClose}){
 const $=id=>document.getElementById(id);let staged=null;
 $('export-profile').onclick=()=>{try{beforeExport();const url=window.URL.createObjectURL(new Blob([JSON.stringify(capturePlayerBackup(storage))],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='countermeasure-player-backup.json';a.click();setTimeout(()=>window.URL.revokeObjectURL(url),1000);}catch{$('save-status').textContent='Could not prepare backup. Your current data was not replaced.';}};
 $('import-profile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1000000)throw Error();staged=readPlayerBackup(await file.text());const p=staged.profile;$('backup-summary').textContent=`Demo: ${p.demo?.levels.length??0} saved levels · Campaign: ${p.campaign?.levels.length??0} · Escapee portraits: ${p.archive.winners.length}.`;$('backup-error').textContent='';$('restore-profile').disabled=storage.sessionOnly;onOpen();$('backup-dialog').showModal();}catch{staged=null;$('save-status').textContent='Use a valid player backup. Nothing changed. Single-mode saves use Import checkpoint below.';}e.target.value='';};
 function close(){staged=null;$('backup-dialog').close();onClose();}
 $('cancel-backup').onclick=close;$('backup-dialog').addEventListener('cancel',e=>{e.preventDefault();close();});
 $('restore-profile').onclick=()=>{if(!staged)return;try{const restored=restorePlayerBackup(storage,staged),url=new URL(window.location.href);url.searchParams.set('mode',restored.mode);window.location.replace(url.href);}catch{$('backup-error').textContent=storage.sessionOnly?'Browser storage is unavailable. Previous records are loaded for this session; keep your backup file.':'Restore failed; previous records were recovered. Free space or enable browser storage and retry.';}};
}
