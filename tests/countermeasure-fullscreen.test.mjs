import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayMode,LoadoutMenu,arenaView,screenAt,worldAt} from '../countermeasure/play-mode.mjs';
import {Arena} from '../countermeasure/engine.mjs';
import {HeldControls} from '../countermeasure/controls.mjs';

class Screen extends EventTarget {
  documentElement={};fullscreenElement=null;exits=0;
  async exitFullscreen(){this.exits++;this.fullscreenElement=null;this.dispatchEvent(new Event('fullscreenchange'));}
}
test('unsupported or rejected native fullscreen retains usable screen-filling mode',async()=>{
  for(const rejected of [false,true]){
    const document=new Screen(),changes=[];let leaves=0;
    if(rejected)document.documentElement.requestFullscreen=async()=>{throw Error('Denied');};
    const mode=new PlayMode({document,onChange:value=>changes.push(value),onLeave:()=>leaves++});
    await mode.enter();assert.equal(mode.active,true);assert.equal(mode.native,false);assert.deepEqual(changes,[true]);
    await mode.leave();assert.equal(mode.active,false);assert.equal(leaves,1);assert.deepEqual(changes,[true,false]);
  }
});
test('native request happens in the tap and browser fullscreen exit pauses exactly once',async()=>{
  const document=new Screen();let requested=false,leaves=0;
  document.documentElement.requestFullscreen=async options=>{requested=true;assert.equal(options.navigationUI,'hide');document.fullscreenElement=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));};
  const mode=new PlayMode({document,onLeave:()=>leaves++});const entering=mode.enter();assert.equal(requested,true);await entering;assert.equal(mode.native,true);
  await document.exitFullscreen();assert.equal(mode.active,false);assert.equal(leaves,1);await mode.leave();assert.equal(leaves,1);
});
test('leaving before a native request resolves cannot strand the game in fullscreen',async()=>{
  const document=new Screen();let resolve;
  document.documentElement.requestFullscreen=()=>new Promise(done=>resolve=()=>{document.fullscreenElement=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));done();});
  const mode=new PlayMode({document});const entering=mode.enter();await mode.leave();resolve();await entering;
  assert.equal(mode.active,false);assert.equal(document.fullscreenElement,null);assert.equal(document.exits,1);
});

class Node extends EventTarget {
  children=[];parent=null;
  constructor(document){super();this.ownerDocument=document;}
  insert(node,index){if(node.parent){const at=node.parent.children.indexOf(node);node.parent.children.splice(at,1);}this.children.splice(index,0,node);node.parent=this;}
  append(...nodes){for(const node of nodes)this.insert(node,this.children.length);}
  before(node){this.parent.insert(node,this.parent.children.indexOf(this));}
  after(node){this.parent.insert(node,this.parent.children.indexOf(this)+1);}
}
function loadout(state='playing'){
  const document={createComment:()=>new Node(document)},home=new Node(document),panel=new Node(document),weapons=new Node(document),mount=new Node(document),dialog=new Node(document);
  dialog.open=false;dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;home.append(panel,weapons);
  const game=new Arena({random:()=>.99}),controls=new HeldControls();game.startWave();if(state==='escaping')game.beginEscape();if(state==='paused')game.pause();if(state==='briefing')game.reset();
  const menu=new LoadoutMenu({game,controls,dialog,mount,panels:[panel,weapons]});return {menu,game,controls,dialog,home,mount,panel,weapons};
}
test('skill menu freezes combat and held inputs, preserves live build and restores the same DOM nodes',()=>{
  const {menu,game,controls,dialog,home,mount,panel,weapons}=loadout();controls.hold('finger','right');
  const before=structuredClone(game.player);let clicks=0;panel.addEventListener('click',()=>clicks++);
  menu.open();assert.equal(game.state,'paused');assert.equal(controls.state.right,false);assert.equal(dialog.open,true);assert.deepEqual(mount.children,[panel,weapons]);
  for(let i=0;i<100;i++)game.update(.02,{right:true,attack:true});assert.deepEqual(game.player,before);
  assert.equal(game.allocate('force',1),true);panel.dispatchEvent(new Event('click'));menu.close();
  assert.equal(game.state,'playing');assert.equal(game.skills.force,1);assert.equal(game.player.hp,before.hp);assert.equal(dialog.open,false);assert.equal(panel.parent,home);assert.equal(weapons.parent,home);assert.equal(clicks,1);
  menu.open();menu.close();assert.equal(home.children.filter(node=>node===panel).length,1);
});
test('closing an already-paused menu or pre-game loadout does not start combat',()=>{
  for(const state of ['paused','briefing']){const {menu,game}=loadout(state);menu.open();menu.close();assert.equal(game.state,state);}
});
test('cancel resumes the original escape phase; explicit no-resume is safe for fullscreen exit',()=>{
  const {menu,game,dialog}=loadout('escaping');menu.open();assert.equal(game.state,'paused');
  const cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);assert.equal(game.state,'escaping');
  menu.open();menu.close({resume:false});assert.equal(game.state,'paused');assert.equal(game.pausedFrom,'escaping');
});
test('portrait camera fills the view proportionally and clamps to both edges of the same arena',()=>{
  for(const [width,height] of [[304,330],[374,610],[400,200],[500,250]]){
    const left=arenaView({width,height,playerX:22,active:true}),right=arenaView({width,height,playerX:978,active:true});
    assert.equal(left.left,0);assert.ok(Math.abs(right.left+right.width-1000)<1e-9);assert.ok(Math.abs(width/left.width-height/500)<1e-9);
    for(const playerX of [22,200,500,900,978]){const view=arenaView({width,height,playerX,active:true});assert.ok(screenAt(playerX,view)>=0&&screenAt(playerX,view)<=1);}
  }
});
test('aiming and the red button share camera projection; normal page view stays unchanged',()=>{
  const view=arenaView({width:374,height:610,playerX:880,active:true});
  assert.ok(screenAt(900,view)>0&&screenAt(900,view)<1);assert.equal(worldAt(screenAt(900,view),view),900);
  assert.ok(worldAt(.1,view)<880);assert.ok(worldAt(.9,view)>880);
  assert.deepEqual(arenaView({width:374,height:610,playerX:800,active:false}),{width:1000,left:0});
});
