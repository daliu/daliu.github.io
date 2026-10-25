import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
import {Chiptune,LEAD} from '../countermeasure/music.mjs';

test('service worker serves its entire application offline under a GitHub Pages subdirectory',async()=>{
 const handlers={},stores=new Map(),root='https://example.test/countermeasure/',removed=[];let network=0;
 const caches={open:async key=>{if(!stores.has(key))stores.set(key,new Map());const entries=stores.get(key);return {addAll:async urls=>{for(const url of urls){const name=new URL(url).pathname.slice('/countermeasure/'.length)||'index.html';await access(new URL('../countermeasure/'+name,import.meta.url));entries.set(url,await readFile(new URL('../countermeasure/'+name,import.meta.url),'utf8'));}},match:async key=>entries.get(typeof key==='string'?key:key.url)};},keys:async()=>[...stores.keys()],delete:async key=>{removed.push(key);stores.delete(key);}};
 const self={location:{href:root+'sw.js'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{}};
 vm.runInNewContext(await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8'),{self,caches,URL,fetch:()=>{network++;throw Error('offline');}});
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;stores.set('unrelated-site-cache',new Map());stores.set('countermeasure:/countermeasure/:old',new Map());handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(removed,['countermeasure:/countermeasure/:old']);assert.ok(stores.has('unrelated-site-cache'));
 for(const file of ['','index.html','style.css','game.mjs','engine.mjs','subjects.mjs','saves.mjs','music.mjs','offline.mjs']){handlers.fetch({request:{method:'GET',url:root+file,mode:file?'cors':'navigate'},respondWith:p=>pending=p});assert.equal(typeof await pending,'string',file);}
 assert.equal(network,0);
});
test('the application has no external font, music, model or API dependency',async()=>{
 const css=await readFile(new URL('../countermeasure/style.css',import.meta.url),'utf8');assert.ok(!css.includes('@import'));const files=['index.html','game.mjs','engine.mjs','subjects.mjs','music.mjs','saves.mjs'];for(const file of files){const text=await readFile(new URL('../countermeasure/'+file,import.meta.url),'utf8');assert.ok(!/https?:\/\//.test(text.replaceAll('http://www.w3.org/2000/svg','')),file);assert.ok(!/\bfetch\(/.test(text),file);}
});
test('original chiptune scheduling starts only on opt-in, changes phase and mutes while paused',async()=>{
 const gains=[];class Context{constructor(){this.currentTime=0;this.sampleRate=100;this.destination={};}createGain(){return {connect(){},gain:{value:0,setTargetAtTime:v=>gains.push(v)}};}createBuffer(ch,len){return {getChannelData:()=>new Float32Array(len)};}async resume(){}}
 const music=new Chiptune(Context),notes=[];music.tone=(note,time)=>notes.push([note,time]);music.drum=()=>{};music.update('playing',1);assert.equal(notes.length,0);assert.ok(await music.setEnabled(true));music.update('playing',1);assert.ok(notes.length>0);assert.ok(LEAD.filter(n=>n>0).length>20);music.ctx.currentTime=1;music.update('escaping',11);assert.equal(music.mode,'escape');const count=notes.length;music.update('paused',11);assert.equal(notes.length,count);assert.equal(gains.at(-1),0);await music.setEnabled(false);music.update('playing',1);assert.equal(notes.length,count);assert.ok(notes.every(([n,t])=>Number.isFinite(n)&&Number.isFinite(t)));
});
