import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function installer({fail=false}={}){
 const root='https://example.test/countermeasure/',handlers={},stores=new Map(),requests=[],old='countermeasure:/countermeasure/:previous';
 stores.set(old,new Map([[root+'options.mjs','RELEASE 26']]));let claimed=false;
 const caches={open:async key=>{
  if(!stores.has(key))stores.set(key,new Map());const entries=stores.get(key);
  return {addAll:async inputs=>{
   // A fresh HTTP-cache entry wins unless the request explicitly reloads it.
   const downloaded=await Promise.all(inputs.map(async input=>{
    const request=input instanceof Request?input:new Request(input);requests.push(request);
    if(fail)throw Error('network unavailable');
    const path=new URL(request.url).pathname.slice('/countermeasure/'.length)||'index.html';
    return [request.url,request.cache==='reload'?await readFile(new URL('../countermeasure/'+path,import.meta.url),'utf8'):'RELEASE 26'];
   }));for(const [url,data] of downloaded)entries.set(url,data);
  },match:async key=>entries.get(key)};
 },keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key)};
 const self={location:{href:root+'sw.js'},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,handler)=>handlers[name]=handler};
 vm.runInNewContext(await readFile(new URL('../countermeasure/sw.js',import.meta.url),'utf8'),{self,caches,URL,Request,fetch:()=>{throw Error('network unavailable');}});
 let pending;handlers.install({waitUntil:promise=>pending=promise});
 return {root,handlers,stores,requests,old,pending,claimed:()=>claimed};
}

test('an update replaces fresh-but-stale HTTP-cache assets before offline use',async()=>{
 const e=await installer();await e.pending;assert.ok(e.requests.length>30);assert.ok(e.requests.every(r=>r.cache==='reload'&&r.url.startsWith(e.root)));
 let response;e.handlers.fetch({request:{method:'GET',url:e.root+'options.mjs',mode:'cors'},respondWith:p=>response=p});assert.equal(await response,await readFile(new URL('../countermeasure/options.mjs',import.meta.url),'utf8'));
 e.handlers.fetch({request:{method:'GET',url:e.root+'boss-feedback.mjs',mode:'cors'},respondWith:p=>response=p});assert.equal(await response,await readFile(new URL('../countermeasure/boss-feedback.mjs',import.meta.url),'utf8'));
 assert.equal(e.claimed(),false);assert.equal(e.stores.get(e.old).get(e.root+'options.mjs'),'RELEASE 26');
});

test('a failed fresh download rejects installation and leaves the prior offline release intact',async()=>{
 const e=await installer({fail:true});await assert.rejects(e.pending,/network unavailable/);assert.equal(e.claimed(),false);assert.equal(e.stores.get(e.old).get(e.root+'options.mjs'),'RELEASE 26');
});
