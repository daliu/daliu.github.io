import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
import {HeldControls,bindPointerControl,bindWeaponSwitch} from '../countermeasure/controls.mjs';
import {Arena,makePlan,FINAL_WAVE} from '../countermeasure/engine.mjs';

class Button extends EventTarget {
  held=false;
  classList={toggle:(_,value)=>this.held=value};
  setPointerCapture(id){this.captured=id;}
  emit(type,id=1,extra={}) {
    const event=new Event(type,{cancelable:true});
    for(const [key,value] of Object.entries({pointerId:id,button:0,...extra}))Object.defineProperty(event,key,{value,configurable:true});
    this.dispatchEvent(event);
    return event;
  }
}
function setup(game=new Arena({random:()=>.99})) {
  if(game.state==='briefing')game.startWave();
  const controls=new HeldControls(),buttons={};
  for(const action of ['left','right','down','up','attack','dash']) {
    const button=buttons[action]=new Button();
    bindPointerControl(button,{controls,action,canStart:()=>['playing','escaping'].includes(game.state),onPress:()=>{
      if(action==='up')game.jump();
      if(action==='attack')game.attack();
      if(action==='dash')game.dash();
    }});
  }
  return {game,controls,buttons};
}
function advance(game,controls,seconds) {for(let t=0;t<seconds;t+=.02)game.update(.02,controls.state);}

test('movement, flight and repeated attacks can be held by independent fingers',()=>{
  const {game,controls,buttons:b}=setup();game.player.mecha=true;
  b.right.emit('pointerdown',1);b.up.emit('pointerdown',2);b.attack.emit('pointerdown',3);
  const start=game.player.x;advance(game,controls,.8);
  assert.ok(game.player.x>start+200);assert.ok(game.player.y<240);assert.equal(game.player.flying,true);
  assert.ok(game.stats.attacks[0]>=2);
  b.attack.emit('pointerup',3);assert.equal(controls.state.attack,false);assert.equal(controls.state.right,true);assert.equal(controls.state.up,true);
  b.up.emit('pointerup',2);advance(game,controls,.4);assert.equal(game.player.flying,false);assert.ok(game.player.vy>0);assert.equal(controls.state.right,true);
});

test('a short attack tap acts immediately without waiting for the next frame',()=>{
  const {game,controls,buttons:b}=setup();
  b.attack.emit('pointerdown',1);b.attack.emit('pointerup',1);
  assert.equal(game.stats.attacks[0],1);assert.equal(controls.state.attack,false);assert.equal(b.attack.held,false);
});

test('releasing one of two fingers on the same button keeps the other hold active',()=>{
  const {controls,buttons:b}=setup();b.right.emit('pointerdown',1);b.right.emit('pointerdown',2);
  b.right.emit('pointerup',1);assert.equal(controls.state.right,true);assert.equal(b.right.held,true);
  b.right.emit('pointerup',2);assert.equal(controls.state.right,false);assert.equal(b.right.held,false);
});

test('pointer cancellation and lost capture clear only the interrupted finger',()=>{
  const {controls,buttons:b}=setup();b.right.emit('pointerdown',1);b.up.emit('pointerdown',2);b.attack.emit('pointerdown',3);
  b.up.emit('pointercancel',2);assert.equal(controls.state.up,false);assert.equal(controls.state.right,true);assert.equal(controls.state.attack,true);
  b.right.emit('lostpointercapture',1);assert.equal(controls.state.right,false);assert.equal(b.right.held,false);assert.equal(controls.state.attack,true);
  b.attack.emit('pointerup',3);assert.ok(Object.values(controls.state).every(v=>!v));
});

test('keyboard aliases and pointer holds do not cancel each other',()=>{
  const {controls,buttons:b}=setup();controls.hold('key:KeyA','left');controls.hold('key:ArrowLeft','left');b.left.emit('pointerdown',1);
  controls.release('key:KeyA');controls.release('key:ArrowLeft');assert.equal(controls.state.left,true);
  controls.hold('key:KeyA','left');b.left.emit('pointerup',1);assert.equal(controls.state.left,true);
  controls.release('key:KeyA');assert.equal(controls.state.left,false);
});

test('pausing or losing focus clears all held sources and button feedback',()=>{
  const {game,controls,buttons:b}=setup();b.right.emit('pointerdown',1);b.up.emit('pointerdown',2);b.attack.emit('pointerdown',3);controls.hold('key:KeyA','left');
  game.pause();controls.clear();assert.ok(Object.values(controls.state).every(v=>!v));assert.ok(Object.values(b).every(button=>!button.held));
  b.right.emit('pointerdown',4);assert.equal(controls.state.right,false);b.right.emit('pointerup',1);game.pause();advance(game,controls,.1);assert.equal(game.player.vx,0);
});

test('quick weapon switching preserves moving, firing and flying; compatibility clicks do not double-switch',()=>{
  const {game,controls,buttons:b}=setup();game.player.mecha=true;
  b.right.emit('pointerdown',1);b.up.emit('pointerdown',2);b.attack.emit('pointerdown',3);
  const bar=new Button(),selected=[];bindWeaponSwitch(bar,n=>{game.weapon=n;selected.push(n);});
  for(let weapon=0;weapon<4;weapon++) {
    const target={closest:()=>({dataset:{weapon:String(weapon)}})};
    bar.emit('pointerdown',4,{target});bar.emit('click',4,{detail:1,target});
    assert.equal(game.weapon,weapon);assert.equal(controls.state.right,true);assert.equal(controls.state.attack,true);assert.equal(controls.state.up,true);
  }
  assert.deepEqual(selected,[0,1,2,3]);
  bar.emit('click',4,{detail:0,target:{closest:()=>({dataset:{weapon:'2'}})}});assert.equal(game.weapon,2);
});

test('touch jump, duck and dash use the same combat rules as the keyboard',()=>{
  const {game,controls,buttons:b}=setup();b.down.emit('pointerdown',1);advance(game,controls,.02);assert.equal(game.player.crouching,true);b.down.emit('pointerup',1);
  b.up.emit('pointerdown',2);b.up.emit('pointerup',2);advance(game,controls,.1);assert.ok(game.player.y<420);assert.equal(game.stats.jumps,1);
  b.dash.emit('pointerdown',3);assert.equal(game.stats.dashes,1);assert.ok(game.player.dashTime>0);b.dash.emit('pointerup',3);
});

test('touch flight reaches the emergency switch and Attack fires the EMP while still flying',()=>{
  const game=new Arena({random:()=>.99});game.plan=makePlan(FINAL_WAVE,game.memory);game.state='between';game.finaleCheckpoint={hp:100,mecha:true,mechaShield:60};game.startWave();
  const {controls,buttons:b}=setup(game);b.right.emit('pointerdown',1);b.up.emit('pointerdown',2);
  for(let t=0;t<150&&!game.nearEmergency();t++) {
    if(game.player.x>880)b.right.emit('pointerup',1);
    game.update(.02,controls.state);
  }
  assert.ok(game.nearEmergency());assert.equal(game.player.mecha,true);b.attack.emit('pointerdown',3);b.attack.emit('pointerup',3);
  assert.equal(game.emergency.activated,true);assert.equal(game.robots[0].disabled,true);assert.equal(controls.state.up,true);
  b.up.emit('pointercancel',2);assert.equal(controls.state.up,false);advance(game,controls,1);assert.equal(game.player.flying,false);
});

test('touch controls are available offline and the game cache leaves other site paths alone',async()=>{
  const root='https://example.test/countermeasure/',handlers={},stores=new Map();let pending,network=0;
  const caches={open:async key=>{if(!stores.has(key))stores.set(key,new Map());const entries=stores.get(key);return {addAll:async urls=>{for(const request of urls){const url=typeof request==='string'?request:request.url;const name=new URL(url).pathname.slice('/countermeasure/'.length)||'index.html';await access(new URL('../countermeasure/'+name,import.meta.url));entries.set(url,await readFile(new URL('../countermeasure/'+name,import.meta.url),'utf8'));}},match:async key=>entries.get(key)};},keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key)};
  const self={location:{href:root+'sw.js'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{}};
  vm.runInNewContext(await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8'),{self,caches,URL,Request,fetch:()=>{network++;throw Error('offline');}});
  handlers.install({waitUntil:p=>pending=p});await pending;stores.set('other-site-cache',new Map());handlers.activate({waitUntil:p=>pending=p});await pending;
  handlers.fetch({request:{method:'GET',url:root+'controls.mjs',mode:'cors'},respondWith:p=>pending=p});assert.match(await pending,/class HeldControls/);assert.equal(network,0);assert.ok(stores.has('other-site-cache'));
  let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://example.test/portfolio.html',mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
