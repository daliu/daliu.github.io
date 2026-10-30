// Original Countermeasure chiptune: synthesized square/triangle/noise voices.
// No third-party recording, samples, streaming, or network calls.
export const LEAD=[64,0,67,71,67,0,62,0,64,67,74,71,67,62,59,0,60,0,64,67,64,0,59,0,60,64,71,67,64,59,57,0];
export const BASS=[40,40,43,47,36,36,40,43];
// Five room motifs follow the facility's ten-level chapters. Dark rooms use sparse,
// dissonant pulses; boss arrangements use a separate driving melody.
export const CHAPTER_LEADS=[LEAD,
 [59,0,62,65,0,69,65,62,57,0,60,64,0,67,64,60,59,62,65,71,69,65,62,0,57,60,64,69,67,64,60,0],
 [60,67,63,70,0,67,63,60,59,66,62,69,0,66,62,59,60,63,67,72,70,67,63,0,59,62,66,71,69,66,62,0],
 [57,60,64,69,67,64,60,57,56,59,63,68,66,63,59,56,57,64,69,72,71,69,64,60,56,63,68,71,70,68,63,59],
 [52,59,55,64,62,59,55,67,51,58,54,63,61,58,54,66,52,55,59,64,67,64,59,71,51,54,58,63,66,63,58,70]];
export const DARK_LEAD=[52,0,0,0,53,0,0,59,0,0,55,0,0,0,51,0,52,0,0,0,58,0,0,53,0,0,55,0,0,51,0,0];
export const BOSS_LEAD=[64,67,71,76,71,67,62,66,69,74,69,66,60,64,67,72,67,64,59,62,66,71,66,62,60,63,67,72,71,67,63,59];
export function scoreFor(state,wave,encounter=null,dark=false){
 const level=Math.max(1,Math.min(50,Number(wave)||1)),generation=Math.min(4,Math.floor((level-1)/10));
 const boss=encounter===null?level>=10:['boss','super','hidden'].includes(encounter);
 const mode=state==='escaping'?'escape':boss?'boss':dark?'dark':'arena';
 const interval=(mode==='escape'?.099:mode==='boss'?(encounter==='hidden'?.096:.112):mode==='dark'?.178:.142)-generation*(mode==='dark'?.006:.0045);
 return {mode,generation,interval,lead:mode==='dark'?DARK_LEAD:mode==='boss'||mode==='escape'?BOSS_LEAD:CHAPTER_LEADS[generation],shift:mode==='escape'?7:mode==='dark'?-generation:mode==='boss'?-5+(generation%2)*2:0};
}
const hz=n=>440*2**((n-69)/12);
export class Chiptune{
 constructor(Context=globalThis.AudioContext??globalThis.webkitAudioContext){this.Context=Context;this.enabled=false;this.ctx=null;this.step=0;this.next=0;this.mode='';this.volume=.045;this.arrangement='auto';this.suppressScore=false;}
 setVolume(value){this.volume=.045*Math.max(0,Math.min(1,value));if(this.enabled&&this.master)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.03);}
 async setEnabled(value){if(!value){this.enabled=false;if(this.master)this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.03);return false;}try{if(!this.ctx){this.ctx=new this.Context();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);this.master.gain.value=this.volume;const length=Math.floor(this.ctx.sampleRate*.13);this.noise=this.ctx.createBuffer(1,length,this.ctx.sampleRate);const data=this.noise.getChannelData(0);let seed=9127;for(let i=0;i<length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/2147483648-1)*(1-i/length);}}await this.ctx.resume();this.enabled=true;this.next=this.ctx.currentTime+.02;this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.03);return true;}catch{this.enabled=false;return false;}}
 tone(note,time,length=.1,type='square',gain=.18){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=hz(note);g.gain.setValueAtTime(gain,time);g.gain.exponentialRampToValueAtTime(.001,time+length);o.connect(g);g.connect(this.master);o.onended=()=>{o.disconnect();g.disconnect();};o.start(time);o.stop(time+length);}
 drum(time,gain=.16){const source=this.ctx.createBufferSource(),g=this.ctx.createGain();source.buffer=this.noise;g.gain.value=gain;source.connect(g);g.connect(this.master);source.onended=()=>{source.disconnect();g.disconnect();};source.start(time);}
 update(state,wave,encounter=null,dark=false){
  if(!this.enabled||!this.ctx)return;
  const active=['playing','traveling','escaping'].includes(state);
  this.master.gain.setTargetAtTime(active?this.volume:0,this.ctx.currentTime,.04);
  if(!active){this.next=this.ctx.currentTime+.03;return;}
  // Keep the outgoing arrangement through the doorway; never restart the beat.
  if(this.suppressScore){this.next=this.ctx.currentTime+.03;return;}
  if(state!=='traveling'||!this.score){const choice=this.arrangement;this.score=choice==='dark'?scoreFor('playing',wave,'room',true):choice==='boss'?scoreFor('playing',wave,'super'):/^chapter[0-4]$/.test(choice)?scoreFor('playing',1+Number(choice.slice(-1))*10,'room'):scoreFor(state,wave,encounter,dark);}
  const {mode,generation,interval,lead,shift}=this.score;this.mode=mode;
  this.next=Math.max(this.next,this.ctx.currentTime);
  while(this.next<this.ctx.currentTime+.16){
   const i=this.step++,n=lead[i%lead.length],tense=mode==='boss'||mode==='escape';
   if(n)this.tone(n+shift,this.next,interval*(mode==='dark'?2:.75),mode==='dark'?'triangle':'square',mode==='dark'?.23:.16);
   if(i%4===0)this.tone(BASS[(Math.floor(i/4)+generation)%BASS.length]+shift,this.next,interval*(mode==='dark'?3.7:2.5),'triangle',.36);
   if(mode==='dark'){
    if(i%8===6)this.drum(this.next,.06+generation*.012);
    if(generation>=2&&i%8===4)this.tone(40+generation,this.next,interval*2,'sine',.18);
   }else{
    if(i%4===2)this.drum(this.next,tense?.19:.13);
    if(i%(tense?1:2)===0)this.tone(i%4===0?28:32,this.next,.045,'triangle',tense?.35:.24);
    if(generation>=2&&i%2===1)this.drum(this.next,.035+generation*.008);
    if(generation>=3&&n)this.tone(n+shift-12,this.next+interval*.5,interval*.3,'square',.065);
   }
   this.next+=interval;
  }
 }

 hit(note=52){if(this.enabled&&this.ctx)this.tone(note,this.ctx.currentTime,.06,'square',.22);}
 explosion(){if(this.enabled&&this.ctx){this.drum(this.ctx.currentTime,.6);this.tone(24,this.ctx.currentTime,.22,'triangle',.7);}}
}
