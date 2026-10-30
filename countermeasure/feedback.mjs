// Public contact address already linked from the site's home and portfolio pages.
export const FEEDBACK_EMAIL='50685071@proton.me';
export const FEEDBACK_KEY='countermeasure.feedback.v1';
export const SUPPORT_COPY='I build Countermeasure as a one-person small business. Optional purchases will help support its development. Playing is free, and positive or constructive feedback is welcome too.';
export class FeedbackStore{
 constructor(storage){this.storage=storage;try{this.record=JSON.parse(storage.getItem(FEEDBACK_KEY))??{};}catch{this.record={};}this.record={prompted:this.record.prompted===true,enjoyed:this.record.enjoyed===true,text:typeof this.record.text==='string'?this.record.text.slice(0,1800):''};}
 save(){try{this.storage.setItem(FEEDBACK_KEY,JSON.stringify(this.record));return true;}catch{return false;}}
 eligible(g,campaign){return !this.record.prompted&&(campaign?g.wave===10&&g.encounter==='super'&&g.state==='traveling':g.state==='complete');}
 markPrompted(){this.record.prompted=true;this.save();}
 draft({enjoyed=this.record.enjoyed,text=this.record.text}={}){this.record.enjoyed=!!enjoyed;this.record.text=String(text).slice(0,1800);return this.save();}
 emailDraft(){return {to:FEEDBACK_EMAIL,subject:this.record.enjoyed?'Player feedback: enjoying Countermeasure':'Player feedback: Countermeasure',body:(this.record.enjoyed?'I’m enjoying Countermeasure.\n\n':'')+this.record.text};}
 emailText(){const d=this.emailDraft();return `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`;}
 emailURL(){const {subject,body}=this.emailDraft();return 'mailto:'+FEEDBACK_EMAIL+'?'+new URLSearchParams({subject,body}).toString().replaceAll('+','%20');}
}

export function feedbackUI({storage,document,game,campaign,onOpen,onClose}){
 const store=new FeedbackStore(storage),$=id=>document.getElementById(id),dialog=$('feedback-dialog');let automatic=false;
 function render(){const saved=store.draft({enjoyed:$('feedback-enjoyed').getAttribute('aria-pressed')==='true',text:$('feedback-text').value});$('feedback-send').href=store.emailURL();$('feedback-email-draft').value=store.emailText();$('feedback-status').textContent=saved?'Draft saved on this browser. Nothing sent.':'Draft is session only. Nothing sent.';}
 function open(auto=false){automatic=auto;store.markPrompted();onOpen(auto);$('feedback-enjoyed').setAttribute('aria-pressed',String(store.record.enjoyed));$('feedback-text').value=store.record.text;render();dialog.showModal();}
 function close(){dialog.close();onClose(automatic);automatic=false;}
 $('feedback-menu').onclick=()=>open();$('feedback-enjoyed').onclick=()=>{$('feedback-enjoyed').setAttribute('aria-pressed',String($('feedback-enjoyed').getAttribute('aria-pressed')!=='true'));render();};$('feedback-text').addEventListener('input',render);
 $('close-feedback').onclick=close;$('feedback-later').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('feedback-send').onclick=()=>{render();$('feedback-status').textContent='Review and send in your email app. If nothing opens, use “No email app?” below.';};
 $('feedback-copy').onclick=async()=>{render();try{await document.defaultView.navigator.clipboard.writeText(store.emailText());$('feedback-status').textContent='Email address and message copied. Paste into a new email and send when ready.';}catch{$('feedback-fallback').open=true;$('feedback-email-draft').focus();$('feedback-email-draft').select();$('feedback-status').textContent='Select and copy the email draft below, then paste it into your email app.';}};
 // The mail link only opens a draft. The player decides whether to send it.
 return {observe(){if(store.eligible(game,campaign)&&!document.querySelector('dialog[open]'))open(true);},store};
}
