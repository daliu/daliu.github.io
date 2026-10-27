export const PREMIUM_KEY='countermeasure.premium.stripe-test.v1',IDENTITY_KEY=PREMIUM_KEY+'.identity',PREFERENCES_KEY=PREMIUM_KEY+'.preferences';
export const PALETTES={standard:{coat:'#d89965',trim:'#eab784',armor:'#b7e77a',plate:'#65804f'},ember:{coat:'#d97766',trim:'#ffc28a',armor:'#ffab73',plate:'#8f4a3e'},glacier:{coat:'#7baec7',trim:'#d3f4fa',armor:'#a3e9f4',plate:'#416e86'},amethyst:{coat:'#ab85c7',trim:'#ecd0ff',armor:'#d2aaf2',plate:'#6a4f86'}};
export function loadoutFor(active,preferences={}){return {color:active&&Object.hasOwn(PALETTES,preferences.color)?preferences.color:'standard',armor:active&&preferences.armor===true,thrusters:active&&preferences.thrusters===true};}
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export async function identityHash(secret,cryptoImpl=crypto){return [...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(secret)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyLicense(license,config,installation,cryptoImpl=crypto,now=Date.now()){
 try{
  if(!config.enabled||config.environment!=='stripe-test'||!config.publicJwk||!license||license.body.length>4096||license.signature.length>160)return false;
  const p=JSON.parse(new TextDecoder().decode(decode(license.body)));
  if(p.v!==1||p.app!=='countermeasure'||p.environment!=='stripe-test'||p.entitlement!=='premium-kit'||p.kid!==config.kid||p.installation!==installation||!/^[-a-f0-9]{36}$/.test(p.grant??'')||!Number.isFinite(p.issuedAt)||p.issuedAt>now+60000)return false;
  const key=await cryptoImpl.subtle.importKey('jwk',config.publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return await cryptoImpl.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(license.signature),new TextEncoder().encode(license.body));
 }catch{return false;}
}
export class PremiumAccess{
 constructor({config,storage=localStorage,cryptoImpl=crypto,fetchImpl=fetch,onChange=()=>{}}){Object.assign(this,{config,storage,crypto:cryptoImpl,fetch:fetchImpl,onChange});this.active=false;this.preferences={};this.record=null;this.status='';this.persisted=true;}
 read(key){try{return JSON.parse(this.storage.getItem(key));}catch{return null;}}
 write(key,value){try{this.storage.setItem(key,JSON.stringify(value));return true;}catch{this.persisted=false;return false;}}
 async init(){
  if(!this.config.enabled)return;
  this.secret=this.read(IDENTITY_KEY);if(!/^[a-f0-9]{64}$/.test(this.secret??'')){this.secret=[...this.crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');this.write(IDENTITY_KEY,this.secret);}
  this.installation=await identityHash(this.secret,this.crypto);this.preferences=this.read(PREFERENCES_KEY)??{};const record=this.read(PREMIUM_KEY);
  if(await verifyLicense(record?.license,this.config,this.installation,this.crypto)){this.record=record;this.active=true;this.status='Test pack activated · works offline';}else this.status='Demo and Campaign are free.';
  this.onChange();
 }
 get loadout(){return loadoutFor(this.active,this.preferences);}
 choose(preferences){this.preferences=loadoutFor(this.active,preferences);this.write(PREFERENCES_KEY,this.preferences);this.onChange();}
 async request(route,data={}){
  const fetchRequest=this.fetch;
  const response=await fetchRequest(this.config.apiBase+'/'+route,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.secret},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
  const value=await response.json();if(!response.ok){const error=Error(value.error??'Test payment service unavailable');error.code=value.code;error.status=response.status;throw error;}return value;
 }
 async accept(value){
  if(value.state==='active'){
   if(!await verifyLicense(value.license,this.config,this.installation,this.crypto))throw Error('Invalid test unlock signature');
   this.write(PREMIUM_KEY+'.request',null);this.write(PREMIUM_KEY+'.pending',null);this.record={license:value.license,recoveryCode:value.recoveryCode};this.active=true;this.write(PREMIUM_KEY,this.record);this.status=this.persisted?'Test pack activated · works offline':'Active in this tab only. Browser storage unavailable; keep your recovery code.';
  }else if(value.state==='revoked'){
   this.active=false;this.record=null;this.write(PREMIUM_KEY+'.request',null);this.write(PREMIUM_KEY+'.pending',null);this.write(PREMIUM_KEY,null);this.status='Test purchase refunded or revoked. Free play remains available.';
  }else if(value.state==='pending')this.status='Payment is pending. Nothing unlocked yet; retry activation after confirmation.';
  this.onChange();return value.state;
 }
 async activate(sessionId){
  if(typeof sessionId!=='string'||!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)){if(this.read(PREMIUM_KEY+'.pending')===sessionId)this.write(PREMIUM_KEY+'.pending',null);throw Error('A valid test checkout session is required');}
  this.write(PREMIUM_KEY+'.pending',sessionId);
  try{return await this.accept(await this.request('activate',{sessionId}));}catch(error){if([400,404,410].includes(error.status))this.write(PREMIUM_KEY+'.pending',null);throw error;}
 }
 async restore(code){return this.accept(await this.request('restore',{code:code.trim()}));}
 async refresh(){try{return await this.accept(await this.request('status'));}catch{this.status=this.active?'Offline · cached test pack remains active':'Connect to activate or restore. Free play works offline.';this.onChange();return 'offline';}}
 async checkout(mode){if(this.active)throw Error('Test pack already activated');let requestId=this.read(PREMIUM_KEY+'.request');if(!requestId){requestId=this.crypto.randomUUID();this.write(PREMIUM_KEY+'.request',requestId);}try{const value=await this.request('checkout',{requestId,mode});if(['active','pending','revoked'].includes(value.state)){if(value.state==='pending'&&/^cs_test_[A-Za-z0-9_]+$/.test(value.sessionId??''))this.write(PREMIUM_KEY+'.pending',value.sessionId);await this.accept(value);return null;}return value.url;}catch(error){if(error.code==='checkout_expired'){this.write(PREMIUM_KEY+'.request',null);this.write(PREMIUM_KEY+'.pending',null);}throw error;}}
 cancel(){this.write(PREMIUM_KEY+'.request',null);this.write(PREMIUM_KEY+'.pending',null);this.status='Purchase canceled. Nothing was charged or unlocked.';this.onChange();}
}
