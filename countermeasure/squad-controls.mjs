import {keyLabel} from './keybindings.mjs';
import {SQUAD_COMMANDS} from './squad-orders.mjs';
// Only command sources are handled here; combat key/finger ownership stays independent.
export function squadControls({window,document,container,issue,canOrder=()=>true,getKeys=c=>[c.code]}){
 const buttons=new Map();
 for(const c of SQUAD_COMMANDS){const b=document.createElement('button');b.type='button';b.dataset.order=c.id;b.setAttribute('aria-label',c.label+' squad · '+getKeys(c).map(keyLabel).join(' / '));b.title=c.detail;b.innerHTML='<span aria-hidden="true">'+c.icon+'</span> '+c.label+' <kbd>'+getKeys(c).map(keyLabel).join(' / ')+'</kbd>';b.setAttribute('aria-pressed','false');b.onclick=()=>{if(canOrder())issue(c.id,'touch');};container.append(b);buttons.set(c.id,b);}
 const key=e=>{if(e.defaultPrevented||e.isComposing||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||document.querySelector('dialog[open]')||!canOrder())return;const c=SQUAD_COMMANDS.find(c=>getKeys(c).includes(e.code));if(c){e.preventDefault();issue(c.id,'keyboard');}};
 window.addEventListener('keydown',key);
 return {refreshBindings(){for(const c of SQUAD_COMMANDS){const b=buttons.get(c.id),hint=getKeys(c).map(keyLabel).join(' / ')||'Unbound';b.setAttribute('aria-label',c.label+' squad · '+hint);b.innerHTML='<span aria-hidden="true">'+c.icon+'</span> '+c.label+' <kbd>'+hint+'</kbd>';}},render(command,enabled=true){for(const [id,b] of buttons){b.setAttribute('aria-pressed',String(id===command));b.disabled=!enabled;}},destroy(){window.removeEventListener('keydown',key);container.replaceChildren();}};
}
