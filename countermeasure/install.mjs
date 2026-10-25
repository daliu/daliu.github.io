export function installedLaunch({window,navigator,document}) {
  return navigator.standalone===true || window.matchMedia('(display-mode: standalone)').matches ||
    (window.matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement);
}

export class InstallSupport {
  deferred=null;
  busy=false;
  accepted=false;
  constructor({window,navigator,document,onChange=()=>{},onLaunch=()=>{}}) {
    this.installed=installedLaunch({window,navigator,document});this.onChange=onChange;
    window.addEventListener('beforeinstallprompt',event=>{
      event.preventDefault();if(this.installed)return;
      this.deferred=event;this.accepted=false;this.render();
    });
    window.addEventListener('appinstalled',()=>{
      this.installed=true;this.accepted=false;this.deferred=null;this.render();
    });
    this.render();if(this.installed)onLaunch();
  }
  render() { this.onChange({installed:this.installed,available:!!this.deferred,busy:this.busy,accepted:this.accepted}); }
  async install() {
    if(this.installed)return 'installed';
    if(this.busy)return 'busy';
    if(!this.deferred)return 'manual';
    const event=this.deferred;this.deferred=null;this.busy=true;this.render();
    try {
      await event.prompt(); // Must stay in the initiating tap's user-activation window.
      const {outcome}=await event.userChoice;this.accepted=outcome==='accepted';return outcome;
    } catch { return 'manual'; }
    finally {this.busy=false;this.render();}
  }
}
