export function arenaView({width,height,playerX,active}) {
  const span=active?Math.min(1000,Math.max(1,width)/Math.max(1,height)*500):1000;
  return {width:span,left:Math.max(0,Math.min(1000-span,playerX-span/2))};
}

export function worldAt(ratio,view) { return view.left+ratio*view.width; }
export function screenAt(x,view) { return (x-view.left)/view.width; }

export class PlayMode {
  active=false;
  native=false;
  constructor({document,onChange=()=>{},onLeave=()=>{}}) {
    this.document=document;this.onChange=onChange;this.onLeave=onLeave;
    document.addEventListener('fullscreenchange',()=>{
      if(document.fullscreenElement===document.documentElement)this.native=true;
      else if(this.native){this.native=false;this.leave();}
    });
  }
  async enter({requestNative=true}={}) {
    if(this.active)return;
    this.active=true;this.onChange(true);
    if(!requestNative)return;
    // Call directly from the tap, before awaiting anything. CSS mode remains if denied.
    try {
      await this.document.documentElement.requestFullscreen?.({navigationUI:'hide'});
      this.native=this.document.fullscreenElement===this.document.documentElement;
      if(!this.active&&this.native)await this.document.exitFullscreen();
    } catch { /* Full-viewport layout is also usable without the native API. */ }
  }
  async leave() {
    if(!this.active)return;
    this.active=false;this.onLeave();this.onChange(false);
    if(this.document.fullscreenElement===this.document.documentElement){
      try { await this.document.exitFullscreen(); } catch {}
    }
    this.native=false;
  }
}

export class LoadoutMenu {
  constructor({game,controls,dialog,mount,panels,onChange=()=>{}}) {
    Object.assign(this,{game,controls,dialog,mount,panels,onChange});
    this.homes=panels.map(panel=>{const marker=panel.ownerDocument.createComment('loadout home');panel.before(marker);return marker;});
    dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
  }
  open() {
    if(this.dialog.open)return;
    this.wasActive=['playing','escaping'].includes(this.game.state);
    this.controls.clear();if(this.wasActive)this.game.pause();
    this.mount.append(...this.panels);this.dialog.showModal();this.onChange();
  }
  close({resume=this.wasActive}={}) {
    if(!this.dialog.open)return;
    this.dialog.close();this.panels.forEach((panel,i)=>this.homes[i].after(panel));
    this.controls.clear();if(resume&&this.game.state==='paused')this.game.pause();
    this.wasActive=false;this.onChange();
  }
}
