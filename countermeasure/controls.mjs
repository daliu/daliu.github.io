// Keep every finger and keyboard key independent, including overlapping holds.
export class HeldControls {
  state = {left:false,right:false,down:false,up:false,attack:false,dash:false,module:false,tool:false,charge:false,aim:false,hack:false};
  sources = new Map();
  listeners = new Set();
  hold(source,action) {
    if (!(action in this.state)) return;
    this.sources.set(source,action);
    this.refresh();
  }
  release(source) { this.sources.delete(source); this.refresh(); }
  clear() { this.sources.clear(); this.refresh(); }
  refresh() {
    const held = new Set(this.sources.values());
    for (const action in this.state) this.state[action] = held.has(action);
    for (const listener of this.listeners) listener();
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

export function bindPointerControl(element,{controls,action,canStart=()=>true,onPress=()=>{},onCancel=()=>{},aim=false}) {
  const pointers = new Set();
  const source = id => `pointer:${id}`;
  const paint = () => element.classList.toggle('held',[...pointers].some(id => controls.sources.has(source(id))));
  controls.subscribe(paint);
  element.addEventListener('pointerdown',event => {
    if ((event.button !== undefined && event.button !== 0) || !canStart()) return;
    event.preventDefault();
    pointers.add(event.pointerId);
    element.setPointerCapture(event.pointerId);
    controls.hold(source(event.pointerId),action);
    if(aim)controls.hold(source(event.pointerId)+':aim','aim');
    onPress(event); // A quick tap must act even if no animation frame occurs during it.
  });
  const release = event => {
    if(event.type!=='pointerup'&&pointers.has(event.pointerId)&&action==='attack'&&[...controls.sources.values()].filter(a=>a==='attack').length===1)onCancel();
    pointers.delete(event.pointerId);
    controls.release(source(event.pointerId));
    controls.release(source(event.pointerId)+':aim');
    paint();
  };
  for (const type of ['pointerup','pointercancel','lostpointercapture']) element.addEventListener(type,release);
  element.addEventListener('contextmenu',event => event.preventDefault());
}

// One right thumb can keep firing and add thrust; the left thumb stays free to steer.
export function bindAttackControl(element,{controls,canStart=()=>true,canFly=()=>false,onJump=()=>{},onPress=()=>{},onCancel=()=>{}}) {
  const starts=new Map(),source=id=>`pointer:${id}:lift`;
  bindPointerControl(element,{controls,action:'attack',aim:true,canStart,onCancel,onPress:event=>{starts.set(event.pointerId,{y:event.clientY,lifted:false});onPress(event);}});
  element.addEventListener('pointermove',event=>{
    const start=starts.get(event.pointerId);
    if(!start||!canStart()||!controls.sources.has(`pointer:${event.pointerId}`))return;
    event.preventDefault();const lifted=event.clientY<start.y-18;
    if(lifted&&canFly())controls.hold(source(event.pointerId),'up');else controls.release(source(event.pointerId));
    if(lifted&&!start.lifted&&!canFly())onJump();start.lifted=lifted;
  });
  const release=event=>{starts.delete(event.pointerId);controls.release(source(event.pointerId));};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,release);
}

export function bindWeaponSwitch(element,select) {
  const choose = event => {
    const button = event.target.closest('[data-weapon]');
    if (button && !button.disabled) select(Number(button.dataset.weapon));
  };
  element.addEventListener('pointerdown',event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    choose(event);
  });
  // Keyboard/assistive activation still works; a touch's follow-up click is ignored.
  element.addEventListener('click',event => { if (!event.detail) choose(event); });
}
