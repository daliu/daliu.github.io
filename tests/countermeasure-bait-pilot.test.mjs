import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExpeditionArena} from '../countermeasure/expedition.mjs';
import {finish,buttonApproach} from './helpers/countermeasure-bait-pilot.mjs';
function game(mode='hard',wave=40){const g=new ExpeditionArena({difficulty:mode,random:()=>.99});g.mechTier=mode==='terminator'?5:wave/10;g.plan=g.makePlan(wave,g.memory,'super');g.state='between';g.startWave();return g;}
test('the comparison pilot uses available Hard powers instead of attempting locked AP rounds',()=>{
 const g=game(),r=g.robots[0];g.player.x=r.x-150;g.player.y=r.y;finish(g);assert.equal(g.stats.modules[5],0);assert.equal(g.stats.modules[1],1);assert.equal(g.resources.ammo,g.profile.ammo);
});
test('wet targets get conducting arc-projector combos before ultra gear unlocks',()=>{
 const g=game(),r=g.robots[0];r.wet=5;finish(g);assert.equal(g.weapon,2);assert.equal(g.weaponTiers[2],1);assert.equal(g.activeWeapon.type,'electric');
});
test('the delayed pilot evades a visible long-range charged laser during finishing',()=>{
 const g=game(),r=g.robots[0];r.x=800;g.player.x=200;g.player.y=300;r.laser={phase:'charge',dx:-1,dy:0};const input=finish(g,{});assert.equal(input.up,true);assert.equal(g.player.hp,g.maxHealth);
});

test('the finisher anticipates falling into conductive pools instead of self-shocking',()=>{
 const g=game(),r=g.robots[0];r.wet=5;r.y=420;g.player.y=380;g.player.vy=200;g.addPool(g.player.x,2);assert.equal(finish(g,{reaction:.4,careful:true}).up,true);
});

test('the finisher releases electrical fire while lifting out of a conductive pool',()=>{
 const g=game(),r=g.robots[0];r.wet=5;r.y=420;g.player.y=420;g.addPool(g.player.x,2);const input=finish(g,{reaction:.4,careful:true});assert.equal(input.up,true);assert.equal(input.attack,false);
});

// A .4-second command must not oscillate from one side of the use radius to the other.
test('switch approach uses a timed movement tap chosen at the delayed decision',()=>{
 for(const x of [790,978]){const g=game(),wall=g.robots.find(r=>r.type==='buttonGuard');g.damageRobot(wall,wall.maxHp);g.player.x=x;g.player.y=200;const command=buttonApproach(g,.4);
  for(let t=0;t<.4;t+=.02)g.update(.02,t<command.moveFor?command:{...command,left:false,right:false});
  assert.ok(Math.abs(g.player.x-g.emergency.x)<20);assert.ok(command.moveFor<.4);
 }
});
test('a slow decision accounts for acceleration before falling into an electrified pool',()=>{
 const g=game(),r=g.robots[0];r.wet=5;r.y=420;g.player.y=320;g.player.vy=0;g.addPool(g.player.x,2);
 for(const careful of [false,true]){const input=finish(g,{reaction:.4,careful});assert.equal(input.up,true);assert.equal(input.attack,false);}
});
