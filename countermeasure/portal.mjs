// This portfolio shell contains no game runtime. The Demo runs on Aygen.
// Only the existing isolated-QA flag may pass through from the outer page.
export function portfolioDemoURL(search=''){
  const url=new URL('https://aygen.us/countermeasure/update.html?mode=demo&embed=portfolio');
  if(new URLSearchParams(search).get('analytics_test')==='1')url.searchParams.set('analytics_test','1');
  return url.href;
}
// Upgrade the old game worker at its existing URL so it can retire its own cache.
export async function retireLegacyWorker(serviceWorker,baseUrl,{force=false}={}){
  if(!serviceWorker)return false;
  try{
    const root=new URL('./',baseUrl),existing=await serviceWorker.getRegistration(root.href);
    // A broader portfolio worker is not the old game's registration. Fresh
    // visitors need neither a cleanup worker nor a reload of their new Demo.
    if(!force&&existing?.scope!==root.href)return false;
    const registration=await serviceWorker.register(new URL('sw.js',root),{scope:root.pathname,updateViaCache:'none'});
    await registration.update();return true;
  }catch{return false;}
}
// Only these historic single-mode checkpoint keys may be read. No profile,
// analytics, purchase or other portfolio data enters these local downloads.
const LEGACY_KEYS={demo:['countermeasure.progress.v1'],campaign:[10,9,8,7,6,5,4,3,1].map(version=>'countermeasure.campaign.v'+version)};
export function legacyCheckpoint(storage,mode){
  if(!Object.hasOwn(LEGACY_KEYS,mode))return {ok:false,message:'Choose a Demo or Campaign checkpoint.'};
  try{
    for(const key of LEGACY_KEYS[mode]){
      const text=storage.getItem(key);if(text===null)continue;
      if(typeof text!=='string')return {ok:false,message:'This saved checkpoint is unavailable. Nothing was changed.'};
      if(text.length>(mode==='demo'?150000:600000))return {ok:false,message:'This saved checkpoint is too large to download here. Nothing was changed.'};
      if(!text.trim())return {ok:false,message:'This saved checkpoint is empty. Nothing was changed.'};
      return {ok:true,text,filename:'countermeasure-'+mode+'-checkpoint.json'};
    }
    return {ok:false,message:'No previous '+(mode==='demo'?'Demo':'Campaign')+' checkpoint was found in this browser.'};
  }catch{return {ok:false,message:'Browser storage is unavailable. Your saved data was not changed.'};}
}
export function downloadLegacyCheckpoint({storage,mode,document,urlApi,BlobType=Blob,schedule=setTimeout}){
  const saved=legacyCheckpoint(storage,mode);if(!saved.ok)return saved;
  let url,link;
  try{
    url=urlApi.createObjectURL(new BlobType([saved.text],{type:'application/json'}));link=document.createElement('a');link.href=url;link.download=saved.filename;link.hidden=true;document.body.append(link);link.click();
    return {ok:true,message:(mode==='demo'?'Demo':'Campaign')+' checkpoint downloaded. Import it on Aygen in the matching game mode.'};
  }catch{return {ok:false,message:'The download could not start. Your saved data was not changed.'};}
  finally{link?.remove();if(url)schedule(()=>urlApi.revokeObjectURL(url),1000);}
}
export function legacyDownloadsUI({document,storageAccess=()=>globalThis.localStorage,urlApi=globalThis.URL,BlobType=globalThis.Blob,schedule=globalThis.setTimeout}){
  const status=document.getElementById('legacy-status');
  for(const mode of ['demo','campaign']){
    const button=document.getElementById('legacy-'+mode);if(!button)continue;
    button.onclick=()=>{try{status.textContent=downloadLegacyCheckpoint({storage:storageAccess(),mode,document,urlApi,BlobType,schedule}).message;}catch{status.textContent='Browser storage is unavailable. Your saved data was not changed.';}};
  }
}
if(typeof document!=='undefined'&&document.getElementById('demo-frame')){
  document.getElementById('demo-frame').src=portfolioDemoURL(globalThis.location?.search??'');
  retireLegacyWorker(globalThis.navigator?.serviceWorker,import.meta.url);
  legacyDownloadsUI({document});
}
