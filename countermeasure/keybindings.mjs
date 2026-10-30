// Physical key codes keep saved controls stable across browser reloads.
export const KEY_COMMANDS=[
 ['left','Move left','Movement',['KeyA','ArrowLeft']],['right','Move right','Movement',['KeyD','ArrowRight']],['down','Crouch','Movement',['KeyS']],['up','Jump / fly / double-tap boost','Movement',['KeyW','Space','ArrowUp']],
 ['attack','Attack / interact / hold to charge','Combat',['Enter','NumpadEnter','KeyJ']],['dash','Dash / crouching roll','Combat',['ShiftLeft','ShiftRight','KeyK']],['flip','Rolling slash / air flip','Combat',['KeyR']],
 ['weapon0','Impact weapon','Weapons',['Digit1']],['weapon1','Cutting weapon','Weapons',['Digit2']],['weapon2','Electric weapon','Weapons',['Digit3']],['weapon3','Sprayer','Weapons',['Digit4']],['previousWeapon','Previous weapon','Weapons',['KeyQ','BracketLeft']],['nextWeapon','Next weapon','Weapons',['BracketRight']],
 ['power','Use / hold selected utility','Mech',['KeyF','KeyV']],['cyclePower','Cycle utility','Mech',['KeyH','KeyG']],['tool','Legacy use / hold mech tool','Mech',['KeyB']],['cycleTool','Cycle mech tool','Mech',['KeyC','KeyT']],['hack','Hold to hack nearby robot','Mech',['KeyE']],['charge','Legacy hold / release charge','Mech',[]],
 ...['Radio disruptor','Glue bomb','Flamethrower','Magnetic scramble','Localized EMP','AP rounds'].map((label,i)=>['power'+i,'Select '+label,'Mech',[i===5?'Digit0':'Digit'+(i+5)]]),
 ['squad.follow','Squad: follow','Companions',['KeyZ']],['squad.hold','Squad: hold position','Companions',['KeyX']],['squad.focus','Squad: focus target','Companions',['KeyU']],['squad.cover','Squad: cover','Companions',['KeyI']],['squad.retreat','Squad: retreat','Companions',['KeyO']],['voice','Hold optional offline microphone','Companions',['KeyL']],
 ['menu','Open / close menu','Menus',['KeyM']],['pause','Pause / resume','Menus',['KeyP','Escape']],['skills','Pause / skill tree','Menus',['Tab']]
].map(([id,label,group,keys])=>({id,label,group,keys}));
const SPECIAL_CODES=new Set(['Space','Enter','NumpadEnter','Tab','Escape','Backspace','Delete','Insert','Home','End','PageUp','PageDown','ShiftLeft','ShiftRight','Semicolon','Quote','Comma','Period','Slash','Backquote','Minus','Equal','BracketLeft','BracketRight','Backslash','NumpadAdd','NumpadSubtract','NumpadMultiply','NumpadDivide','NumpadDecimal']);
export const validKey=code=>typeof code==='string'&&(/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Left|Right|Up|Down))$/.test(code)||SPECIAL_CODES.has(code));
export const defaultKeyboard=()=>({version:3,flipCombo:true,bindings:Object.fromEntries(KEY_COMMANDS.map(c=>[c.id,[...c.keys]]))});
export function normalizeKeyboard(value){
 const fallback=defaultKeyboard();
 if(!value||![1,2,3].includes(value.version)||typeof value.flipCombo!=='boolean'||!value.bindings||typeof value.bindings!=='object')return fallback;
 const seen=new Set(),bindings={};
 for(const c of KEY_COMMANDS){const keys=value.bindings[c.id];if(!Array.isArray(keys)||keys.length>3||new Set(keys).size!==keys.length||keys.some(k=>!validKey(k)||seen.has(k)))return fallback;for(const k of keys)seen.add(k);bindings[c.id]=[...keys];}
 if(!bindings.menu.length)return fallback;
 if(value.version<3&&JSON.stringify(bindings.cyclePower)===JSON.stringify(['KeyG'])&&JSON.stringify(bindings.tool)===JSON.stringify(['KeyH','KeyB'])){bindings.cyclePower=['KeyH','KeyG'];bindings.tool=['KeyB'];}
 const result={version:3,flipCombo:value.version===1?true:value.flipCombo,bindings};if(!comboCompatible(result))result.flipCombo=false;return result;
}
export const keysFor=(settings,id)=>settings.bindings[id]??[];
export const actionFor=(settings,code)=>KEY_COMMANDS.find(c=>keysFor(settings,c.id).includes(code))?.id;
export function keyLabel(code){return ({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'Space',Enter:'Enter',NumpadEnter:'Num ↵',Tab:'Tab',Escape:'Esc',ShiftLeft:'L Shift',ShiftRight:'R Shift',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backquote:'`',Minus:'−',Equal:'=',Backslash:'\\',PageUp:'PgUp',PageDown:'PgDn',Backspace:'Backspace'})[code]??code?.replace(/^Key|^Digit/,'').replace(/^Numpad/,'Num ')??'Unbound';}
export const keyHint=(settings,id,all=false)=>{const keys=keysFor(settings,id);return keys.length?(all?keys:keys.slice(0,1)).map(keyLabel).join(' / '):'Unbound';};
// Count movement actions, so alternate/remapped keys cannot add extra directions.
export const movementComboCode=action=>({left:'KeyA',right:'KeyD',down:'KeyS',up:'KeyW'})[action];
export const comboCompatible=settings=>['left','right','down','up'].every(action=>keysFor(settings,action).length>0);
export function assignKey(settings,id,index,code){
 if(!KEY_COMMANDS.some(c=>c.id===id)||!Number.isInteger(index)||index<0||index>2||code!==null&&!validKey(code))return {ok:false,message:'Choose a letter, number, arrow or standard control key.'};
 const next=structuredClone(settings),keys=keysFor(next,id);if(index>keys.length)return {ok:false,message:'Add the next key first.'};
 const previous=code&&actionFor(next,code);
 if(previous&&previous!==id){if(previous==='menu'&&keysFor(next,'menu').length===1)return {ok:false,message:'Keep a menu key. Give Menu another key first.'};next.bindings[previous]=keysFor(next,previous).filter(k=>k!==code);}
 if(code===null)keys.splice(index,1);else{const existing=keys.indexOf(code);if(existing>=0&&existing!==index)keys.splice(existing,1);keys[Math.min(index,keys.length)]=code;}
 if(id==='menu'&&!keys.length)return {ok:false,message:'Keep at least one menu key.'};
 if(!comboCompatible(next))next.flipCombo=false;
 return {ok:true,settings:next,message:KEY_COMMANDS.find(c=>c.id===id).label+': '+keyHint(next,id,true)+(previous&&previous!==id?' · moved from '+KEY_COMMANDS.find(c=>c.id===previous).label:'')};
}
export function clearKeys(settings,id){
 if(!KEY_COMMANDS.some(c=>c.id===id))return {ok:false,message:'Unknown command.'};
 if(id==='menu'&&keysFor(settings,id).length<=1)return {ok:false,message:'Keep at least one menu key; replace it instead.'};
 const next=structuredClone(settings);next.bindings[id]=id==='menu'?keysFor(next,id).slice(0,1):[];
 if(!comboCompatible(next))next.flipCombo=false;
 return {ok:true,settings:next,message:id==='menu'?'Alternate menu keys cleared; primary key kept':KEY_COMMANDS.find(c=>c.id===id).label+' unbound'};
}

export function keyboardUI({window,document,options,save,onChange,onOpen,onClose}){
 const $=id=>document.getElementById(id),dialog=$('keyboard-dialog'),list=$('keyboard-list'),status=$('keyboard-status');let pending=null,origin=null;
 const label=id=>KEY_COMMANDS.find(c=>c.id===id).label;
 function capture(id,index,button){pending={id,index};origin=button;$('keyboard-capture').hidden=false;$('keyboard-capture-label').textContent='Press a key for '+label(id)+'.';status.textContent='Press one key. Escape can be assigned; use Cancel to stop.';}
 function stop(){pending=null;$('keyboard-capture').hidden=true;}
 function changed(settings,message){stop();options.keyboard=settings;onChange();const saved=save();render();status.textContent=message+(saved?' · Saved on this browser.':' · Session only: browser storage unavailable.');}
 function render(){
  const openGroups=new Set([...list.querySelectorAll('details[open]')].map(e=>e.dataset.group));list.replaceChildren();
  for(const group of [...new Set(KEY_COMMANDS.map(c=>c.group))]){const details=document.createElement('details');details.dataset.group=group;details.open=openGroups.has(group)||!openGroups.size&&group==='Movement';const summary=document.createElement('summary');summary.textContent=group;details.append(summary);
   for(const c of KEY_COMMANDS.filter(c=>c.group===group)){const row=document.createElement('div');row.className='binding-row';const name=document.createElement('span');name.textContent=c.label;row.append(name);const controls=document.createElement('div');controls.className='binding-keys';const keys=keysFor(options.keyboard,c.id);
    for(let i=0;i<Math.min(3,keys.length+1);i++){const b=document.createElement('button');b.type='button';b.textContent=keys[i]?keyLabel(keys[i]):'＋';b.dataset.command=c.id;b.dataset.slot=i;b.setAttribute('aria-label',c.label+', '+(keys[i]?'key '+(i+1)+': '+keyLabel(keys[i]):'add alternate key'));b.onclick=()=>capture(c.id,i,b);controls.append(b);}
    if(keys.length){const clear=document.createElement('button');clear.type='button';clear.textContent='×';clear.className='binding-clear';clear.setAttribute('aria-label','Clear keys for '+c.label);clear.onclick=()=>{const result=clearKeys(options.keyboard,c.id);if(!result.ok){status.textContent=result.message;return;}changed(result.settings,result.message);};controls.append(clear);}row.append(controls);details.append(row);
   }list.append(details);
  }
  $('option-flip-combo').checked=options.keyboard.flipCombo;$('option-flip-combo').disabled=!comboCompatible(options.keyboard);
 }
 window.addEventListener('keydown',e=>{if(!dialog.open||!pending)return;e.preventDefault();e.stopImmediatePropagation();if(e.repeat||e.isComposing)return;if(e.ctrlKey||e.metaKey||e.altKey){status.textContent='Use one key without Ctrl, Command or Alt.';return;}const result=assignKey(options.keyboard,pending.id,pending.index,e.code);if(!result.ok){status.textContent=result.message;return;}changed(result.settings,result.message);list.querySelector(`[data-command="${pending?.id??origin?.dataset.command}"][data-slot="${origin?.dataset.slot}"]`)?.focus();},true);
 $('keyboard-cancel').onclick=()=>{stop();status.textContent='Binding unchanged.';origin?.focus();};
 $('keyboard-reset').onclick=()=>changed(defaultKeyboard(),'Default controls restored');
 $('option-flip-combo').onchange=()=>{const next=structuredClone(options.keyboard);next.flipCombo=$('option-flip-combo').checked&&comboCompatible(next);changed(next,next.flipCombo?'Movement flip enabled: four directions within450ms; specials stay instant':'Movement flip disabled; use the Rolling slash key or touch Spin');};
 const close=()=>{stop();dialog.close();onClose();};$('keyboard-close').onclick=close;$('keyboard-done').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('keyboard-menu').onclick=()=>{stop();onOpen();render();status.textContent='Changes save automatically. A reused key moves from its previous command.';dialog.showModal();};
 return {render};
}
