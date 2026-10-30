
const status=document.getElementById('status'),retry=document.getElementById('retry');
let mode=new URLSearchParams(location.search).get('mode');try{mode??=localStorage.getItem('countermeasure.mode.v1');}catch{}mode=mode==='demo'?'demo':'campaign';const destination='./?mode='+mode;document.getElementById('return').href=destination;
function waitFor(test,subscribe){return new Promise((resolve,reject)=>{let timer;const check=()=>{const result=test();if(result){clearTimeout(timer);cleanup();result instanceof Error?reject(result):resolve();}};const cleanup=subscribe(check);timer=setTimeout(()=>{cleanup();reject(Error('timeout'));},30000);check();});}
async function update(){retry.hidden=true;status.textContent='Downloading the latest game…';try{
 if(!('serviceWorker' in navigator))throw Error('unsupported');
 const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});await reg.update();
 if(reg.installing){const worker=reg.installing;await waitFor(()=>worker.state==='installed'||worker.state==='activated'||worker.state==='redundant'&&Error('install failed'),check=>{worker.addEventListener('statechange',check);return ()=>worker.removeEventListener('statechange',check);});}
 const worker=reg.waiting??reg.installing??reg.active;if(!worker)throw Error('missing worker');if(worker.state!=='activated'){const activated=waitFor(()=>worker.state==='activated'||worker.state==='redundant'&&Error('activation failed'),check=>{worker.addEventListener('statechange',check);return ()=>worker.removeEventListener('statechange',check);});if(reg.waiting)reg.waiting.postMessage('ACTIVATE_UPDATE');await activated;}
 status.textContent='Updated. Reopening the game…';location.replace(destination);
 }catch{status.textContent='Could not download the update. Connect to the internet and try again, or return to your cached game.';retry.hidden=false;}}
retry.onclick=update;update();
