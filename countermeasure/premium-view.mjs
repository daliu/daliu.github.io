import {PremiumAccess,PREMIUM_KEY} from './premium.mjs';
export async function premiumUI({config,storage,game,document,window,onLoadout=()=>{},onOpen=()=>{},onClose=()=>{}}){
 const button=document.getElementById('premium-menu'),dialog=document.getElementById('premium-dialog'),status=document.getElementById('premium-status');
 if(!config.enabled)return null;button.hidden=false;
 const access=new PremiumAccess({config,storage,onChange:render});let busy=false;
 const $=id=>document.getElementById(id);
 function render(){
  if(!access)return;status.textContent=access.status;
  $('premium-provider').textContent=config.provider==='simulator'?'LOCAL PAYMENT SIMULATOR · NO STRIPE ACCOUNT CONNECTED':config.provider==='stripe-test'?'STRIPE TEST MODE · NO REAL MONEY':'STRIPE TEST MODE · ACCOUNT NOT CONNECTED';
  $('premium-price').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:config.currency}).format(config.amount/100)+' · placeholder test price';
  $('premium-buy').textContent=access.active?'Test pack activated':config.provider==='simulator'?'Simulate one-time purchase ↗':'Open Stripe test checkout ↗';$('premium-buy').disabled=busy||access.active||config.provider==='disconnected';
  $('premium-refresh').disabled=busy;$('premium-restore').disabled=busy;$('premium-owned').hidden=!access.active;
  for(const input of dialog.querySelectorAll('[data-premium]'))input.disabled=!access.active||busy;
  for(const input of dialog.querySelectorAll('[name="premium-color"]'))input.checked=access.loadout.color===input.value;
  $('premium-armor').checked=access.loadout.armor;$('premium-thrusters').checked=access.loadout.thrusters;
  $('premium-recovery').value=access.record?.recoveryCode??'';onLoadout(access.loadout);
 }
 async function run(action){if(busy)return;busy=true;render();try{await action();}catch(e){access.status=e.message;}finally{busy=false;render();}}
 function open(){onOpen();render();dialog.showModal();}
 function close(){dialog.close();onClose();}
 button.onclick=open;$('close-premium').onclick=close;$('premium-done').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('premium-buy').onclick=()=>run(async()=>{const url=await access.checkout(game.encounter?'campaign':'demo');if(url===null)return;const target=new URL(url,window.location.href);if(config.provider==='simulator'?target.origin!==window.location.origin:target.origin!=='https://checkout.stripe.com')throw Error('Checkout destination refused');window.location.assign(url);});
 $('premium-refresh').onclick=()=>run(async()=>{const pending=access.read(PREMIUM_KEY+'.pending');if(pending)await access.activate(pending);else await access.refresh();});
 $('premium-restore').onclick=()=>run(()=>access.restore($('premium-restore-code').value));
 function choose(){access.choose({color:dialog.querySelector('[name="premium-color"]:checked')?.value??'standard',armor:$('premium-armor').checked,thrusters:$('premium-thrusters').checked});}
 for(const input of dialog.querySelectorAll('[data-premium]'))input.onchange=choose;
 $('premium-export').onclick=()=>{if(!access.record?.recoveryCode)return;const blob=new Blob([JSON.stringify({version:1,environment:'stripe-test',recoveryCode:access.record.recoveryCode},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='countermeasure-private-test-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 await access.init();
 const hash=new URLSearchParams(window.location.hash.slice(1)),sessionId=hash.get('checkout'),canceled=hash.get('purchase')==='canceled';
 if(sessionId||canceled){window.history.replaceState(null,'',window.location.pathname+window.location.search);open();if(canceled)access.cancel();else await run(()=>access.activate(sessionId));}
 else if(access.active)void access.refresh();
 render();return access;
}
