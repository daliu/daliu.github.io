// Optional reporting is separate from the opponent model and offline gameplay.
export const SHARING_KEY='countermeasure.sharing.v1';
export const MEASUREMENT_ID='G-GR5Z815VXW';
export const ANALYTICS_HOME='https://analytics.google.com/analytics/web/#/a238429903p530194999';
const n=x=>Math.max(0,Math.min(1000000,Number.isFinite(x)?x:0));
const pick=(v,allowed,fallback='unknown')=>allowed.includes(v)?v:fallback;
const causes=['combat trauma','corrosive exposure','projectile impact','anti-air volley','conductor slide','armored shove','drone static residue','electrical feedback','drone detonation','conductive-floor discharge','mirrored mech power','total countermeasure','committed charge','landing interception','arcing bombardment','mirrored circuit combo'];
export function eventParameters(a,input='unknown'){
 const p={cm_mode:pick(a.mode,['demo','campaign']),cm_difficulty:pick(a.difficulty,['easy','normal','hard','terminator']),cm_release:String(a.release).match(/^\d+/)?.[0]??'unknown',cm_level:`${Math.max(1,Math.min(50,Math.round(n(a.wave))))}-${pick(a.encounter,['room','boss','super','hidden'])}`,cm_entry:pick(a.source,['new_run','continuation','retry','resume','level_select','finale_replay','difficulty_change']),cm_input:pick(input,['keyboard','touch','mouse','mixed'])};
 if(!a.outcome)return p;
 const attacks=Array.from({length:4},(_,i)=>n(a.attacks?.[i])),max=Math.max(...attacks),families=['impact','cutting','electric','liquid'];
 return {...p,cm_outcome:pick(a.outcome,['clear','death','abandoned']),cm_strategy:pick(a.strategy,['no_attacks','wet_electric','cut_then_liquid','evasive','impact','cutting','electric','liquid','mixed']),cm_weapon:max?families[attacks.indexOf(max)]:'none',cm_death_cell:/^\d:[0-4]$/.test(a.deathCell)?a.deathCell:'none',cm_death_cause:pick(a.deathCause,causes,a.outcome==='death'?'other':'none'),cm_seconds:n(a.seconds),cm_attacks:attacks.reduce((s,x)=>s+x,0),cm_hits:(a.hits??[]).slice(0,4).reduce((s,x)=>s+n(x),0),cm_damage_taken:n(a.damageTaken),cm_kills:n(a.kills),cm_criticals:['head','body','legs'].reduce((s,k)=>s+n(a.criticals?.[k]),0),cm_combos:['wetElectric','exposedLiquid','dentedElectric'].reduce((s,k)=>s+n(a.combos?.[k]),0),cm_jumps:n(a.jumps),cm_rolls:n(a.rolls),cm_air_dashes:n(a.airDashes),cm_hp:n(a.hp),cm_armor:n(a.armor),cm_fuel:n(a.fuel),cm_ammo:n(a.ammo)};
}
export class Telemetry{
 constructor({window,document,navigator,storage,onChange=()=>{}}){
  Object.assign(this,{window,document,navigator,storage,onChange});this.enabled=false;this.ready=false;this.pending=[];this.input='unknown';this.status='Sharing off';this.test=new URLSearchParams(window.location.search).get('analytics_test')==='1';this.cookiePrefix=this.test?'cmqa':'cm';
  try{this.enabled=storage.getItem(SHARING_KEY)==='on';}catch{}
  window.addEventListener('online',()=>this.connect());window.addEventListener('storage',e=>{if(!this.test&&e.key===SHARING_KEY)this.setEnabled(e.newValue==='on');});
  this.connect();
 }
 noteInput(kind){this.input=this.input==='unknown'||this.input===kind?kind:'mixed';}
 setEnabled(value){this.enabled=!!value;this.pending=[];try{this.storage.setItem(SHARING_KEY,this.enabled?'on':'off');}catch{}
  this.window['ga-disable-'+MEASUREMENT_ID]=!this.enabled;
  if(!this.enabled){this.status='Sharing off';this.eraseCookies();}
  else this.connect();this.onChange(this.status);
 }
 eraseCookies(){for(const cookie of this.document.cookie.split(';')){const key=cookie.trim().split('=')[0];if(!key.startsWith(this.cookiePrefix+'_'))continue;for(const domain of ['',`; Domain=${this.window.location.hostname}`])this.document.cookie=`${key}=; Max-Age=0; Path=/countermeasure/${domain}; SameSite=Lax`;}}
 allowed(){return this.enabled&&this.window.location.origin==='https://daliu.github.io'&&this.navigator.onLine!==false&&this.navigator.doNotTrack!=='1'&&!this.navigator.globalPrivacyControl;}
 connect(){
  if(!this.enabled){this.status='Sharing off';return;}
  if(!this.allowed()){this.window['ga-disable-'+MEASUREMENT_ID]=true;this.status=this.navigator.onLine===false?'Offline · saved locally':this.navigator.doNotTrack==='1'||this.navigator.globalPrivacyControl?'Browser privacy signal · local only':'Preview · local only';this.onChange(this.status);return;}
  this.window['ga-disable-'+MEASUREMENT_ID]=false;
  if(this.ready){this.status='Sharing enabled · delivery may be blocked';this.onChange(this.status);return;}
  if(this.loading)return;this.loading=true;this.status='Connecting…';this.onChange(this.status);
  const script=this.document.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.onload=()=>{this.loading=false;if(!this.allowed()){this.pending=[];return;}this.window.dataLayer=this.window.dataLayer||[];const layer=this.window.dataLayer;this.gtag=function(){layer.push(arguments);};this.gtag('js',new Date());this.gtag('config',MEASUREMENT_ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_prefix:this.cookiePrefix,cookie_path:'/countermeasure/',cookie_expires:90*86400,cookie_update:false,cookie_flags:'SameSite=Lax;Secure',page_location:'https://daliu.github.io/countermeasure/',page_referrer:'',ignore_referrer:true});this.ready=true;this.status='Sharing enabled · delivery may be blocked';const queue=this.pending;this.pending=[];for(const e of queue)this.send(...e);this.onChange(this.status);};
  script.onerror=()=>{this.loading=false;this.pending=[];this.status='Analytics unavailable · local only';this.onChange(this.status);};this.document.head.append(script);
 }
 send(name,attempt){
  if(!['cm_attempt_start','cm_attempt_end','cm_escape'].includes(name)||!this.allowed())return;
  if(!this.ready){this.connect();if(this.loading)this.pending=[...this.pending,[name,attempt]].slice(-32);return;}
  const params=eventParameters(attempt,this.input);if(attempt.outcome)delete params.cm_input;if(this.test){params.cm_entry='qa';params.debug_mode=true;delete params.cm_jumps;}this.gtag('event',name,{...params,send_to:MEASUREMENT_ID});
 }
}
