import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {InstallSupport,installedLaunch} from '../countermeasure/install.mjs';
import {PlayMode} from '../countermeasure/play-mode.mjs';

function environment(mode='browser',legacy=false,native=false){
  const window=new EventTarget();window.matchMedia=query=>({matches:query===`(display-mode: ${mode})`});
  return {window,navigator:{standalone:legacy},document:{fullscreenElement:native?{}:null}};
}
test('installed app launch detects Apple and manifest modes without mistaking an element fullscreen request',()=>{
  assert.equal(installedLaunch(environment('standalone')),true);
  assert.equal(installedLaunch(environment('fullscreen')),true);
  assert.equal(installedLaunch(environment('browser',true)),true);
  assert.equal(installedLaunch(environment('fullscreen',false,true)),false);
  assert.equal(installedLaunch(environment()),false);
});
test('installed launch enters the game layout without requesting gesture-gated native fullscreen',async()=>{
  let native=0,changes=0,launches=0;
  const env=environment('standalone');env.document.addEventListener=()=>{};env.document.documentElement={requestFullscreen:()=>native++};
  const mode=new PlayMode({document:env.document,onChange:()=>changes++});
  const installer=new InstallSupport({...env,onLaunch:()=>{launches++;mode.enter({requestNative:false});}});
  assert.equal(installer.installed,true);assert.equal(launches,1);assert.equal(mode.active,true);assert.equal(changes,1);assert.equal(native,0);
});
test('installation is prompted directly on a tap and accepted is distinct from actually installed',async()=>{
  const env=environment(),states=[];let prompts=0;
  const installer=new InstallSupport({...env,onChange:state=>states.push(state)});
  const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=()=>{prompts++;return Promise.resolve();};event.userChoice=Promise.resolve({outcome:'accepted'});
  env.window.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(states.at(-1).available,true);
  const installing=installer.install();assert.equal(prompts,1);assert.equal(await installing,'accepted');assert.equal(installer.installed,false);assert.equal(states.at(-1).accepted,true);
  env.window.dispatchEvent(new Event('appinstalled'));assert.equal(installer.installed,true);assert.equal(await installer.install(),'installed');assert.equal(prompts,1);
});
test('missing or failed native install prompts fall back to manual instructions',async()=>{
  const env=environment(),installer=new InstallSupport(env);assert.equal(await installer.install(),'manual');
  const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{throw Error('Not available');};env.window.dispatchEvent(event);
  assert.equal(await installer.install(),'manual');assert.equal(installer.busy,false);assert.equal(installer.installed,false);
});
test('dismissed prompts are not reused and concurrent taps cannot open multiple prompts',async()=>{
  const env=environment(),installer=new InstallSupport(env);let resolve,prompts=0;
  const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=()=>{prompts++;return Promise.resolve();};event.userChoice=new Promise(done=>resolve=done);env.window.dispatchEvent(event);
  const pending=installer.install();assert.equal(await installer.install(),'busy');resolve({outcome:'dismissed'});assert.equal(await pending,'dismissed');assert.equal(await installer.install(),'manual');assert.equal(prompts,1);
});
test('manifest identity, launch URL and real raster icon sizes stay inside the game directory',async()=>{
  const root='https://example.test/countermeasure/',manifest=JSON.parse(await readFile(new URL('../countermeasure/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(new URL(manifest.id,root).href,root);assert.equal(new URL(manifest.scope,root).href,root);assert.equal(new URL(manifest.start_url,root).pathname,'/countermeasure/');assert.equal(manifest.display,'fullscreen');
  for(const icon of manifest.icons){const url=new URL(icon.src,root);assert.equal(url.origin,'https://example.test');assert.ok(url.pathname.startsWith('/countermeasure/'));const png=await readFile(new URL('../countermeasure/'+icon.src,import.meta.url));assert.equal(png.subarray(1,4).toString(),'PNG');const [width,height]=icon.sizes.split('x').map(Number);assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);}
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
});
test('home-screen launch, install UI, manifest and icons all reload with no network after caching',async()=>{
  const root='https://example.test/countermeasure/',handlers={},stores=new Map();let pending,network=0;
  const caches={open:async key=>{if(!stores.has(key))stores.set(key,new Map());const entries=stores.get(key);return {addAll:async urls=>{for(const request of urls){const url=typeof request==='string'?request:request.url;const name=new URL(url).pathname.slice('/countermeasure/'.length)||'index.html';entries.set(url,await readFile(new URL('../countermeasure/'+name,import.meta.url)));}},match:async key=>entries.get(key)};},keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key)};
  const self={location:{href:root+'sw.js'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{}};
  vm.runInNewContext(await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8'),{self,caches,URL,Request,fetch:()=>{network++;throw Error('Offline');}});
  handlers.install({waitUntil:p=>pending=p});await pending;handlers.activate({waitUntil:p=>pending=p});await pending;
  for(const file of ['?launch=homescreen','install.mjs','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png']){
    handlers.fetch({request:{method:'GET',url:root+file,mode:file.startsWith('?')?'navigate':'cors'},respondWith:p=>pending=p});const result=await pending;assert.ok(result.length>0,file);if(file.startsWith('?'))assert.match(result.toString(),/Countermeasure/);
  }
  assert.equal(network,0);
});
