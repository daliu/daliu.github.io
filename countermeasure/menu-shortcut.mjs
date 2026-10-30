// Keep menu access separate from combat keys and ordinary text entry.
export function bindMenuShortcut({window,document,menu,open,close,matches=event=>event.code==='KeyM'}){
 const keydown=event=>{
  if(!matches(event)||event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
  if([...document.querySelectorAll('dialog[open]')].some(dialog=>dialog!==menu))return;
  event.preventDefault();
  menu.open?close():open();
 };
 window.addEventListener('keydown',keydown);
 return ()=>window.removeEventListener('keydown',keydown);
}
