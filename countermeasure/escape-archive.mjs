import {normalizeCharacter,DEFAULT_CHARACTER,drawCharacterParts,characterName} from './character.mjs';
export const ESCAPE_KEY='countermeasure.escapees.v1';
const validId=id=>typeof id==='string'&&/^H-\d{1,10}-\d{1,10}$/.test(id);
export class EscapeArchive{
 constructor(storage,records=[]){
  this.storage=storage;let saved;try{saved=JSON.parse(storage.getItem(ESCAPE_KEY));}catch{}
  this.winners=(Array.isArray(saved?.winners)?saved.winners:[]).filter(r=>validId(r?.id)&&typeof r.name==='string').slice(-48).map(r=>({id:r.id,name:r.name.slice(0,80),avatar:normalizeCharacter(r.avatar,true,true),legacy:!!r.legacy}));
  this.lost=(Array.isArray(saved?.lost)?saved.lost:[]).filter(validId).slice(-128);this.unlocked=!!saved?.unlocked||this.winners.length>0;
  let changed=false;for(const r of records){if(r.status==='survived'&&!this.winners.some(w=>w.id===r.id)&&validId(r.id)){this.winners.push({id:r.id,name:r.name.slice(0,80),avatar:{...DEFAULT_CHARACTER},legacy:true});this.unlocked=true;changed=true;}if(r.status==='terminated')changed=this.rememberLoss(r.id)||changed;}if(changed)this.save();
 }
 rememberLoss(id){if(!validId(id)||this.lost.includes(id))return false;this.lost.push(id);this.lost=this.lost.slice(-128);return true;}
 save(){this.winners=this.winners.slice(-48);try{this.storage.setItem(ESCAPE_KEY,JSON.stringify({winners:this.winners,lost:this.lost,unlocked:this.unlocked}));return true;}catch{return false;}}
 observe(game,avatar){
  let changed=false,unlocked=false;
  for(const r of game.register.records)if(r.status==='terminated')changed=this.rememberLoss(r.id)||changed;
  const r=game.subject;
  if(game.state==='complete'&&r?.status==='survived'&&validId(r.id)&&!this.winners.some(w=>w.id===r.id)){
   this.winners.push({id:r.id,name:characterName(avatar,r.name),avatar:normalizeCharacter(avatar,true,true),legacy:false});unlocked=!this.unlocked;this.unlocked=true;changed=true;
  }
  if(changed)this.save();return {changed,unlocked};
 }
}
export function cellEcho(archive,index,t){const ids=archive?.lost??[];if(!ids.length||t%9>6)return null;return ids[(index+Math.floor(t/9))%ids.length].replace(/^H-/,'');}
export function drawEscapeWall(ctx,archive,t=0){
 const winners=archive?.winners??[],page=Math.floor(t/12)%Math.max(1,Math.ceil(winners.length/8)),shown=winners.slice(page*8,page*8+8);
 ctx.save();ctx.globalAlpha=.9;ctx.fillStyle='#102b31';ctx.fillRect(206,143,560,243);ctx.strokeStyle='#91b6a9';ctx.strokeRect(206,143,560,243);
 ctx.fillStyle='#d1e6be';ctx.textAlign='center';ctx.font='14px ui-monospace,monospace';ctx.fillText('E S C A P E E S',486,164);
 for(let i=0;i<8;i++){
  const x=218+i%4*136,y=177+Math.floor(i/4)*101,r=shown[i];ctx.fillStyle='#1b373d';ctx.fillRect(x,y,128,93);ctx.strokeStyle='#526f70';ctx.strokeRect(x,y,128,93);
  if(r){ctx.save();ctx.translate(x+64,y+65);ctx.scale(.63,.63);drawCharacterParts(ctx,{facing:1},r.avatar);ctx.restore();ctx.fillStyle='#d4e4d2';ctx.font='9px ui-monospace,monospace';ctx.fillText(r.name,x+64,y+80,120);ctx.fillStyle='#8daaa5';ctx.font='8px ui-monospace,monospace';ctx.fillText(r.legacy?'PORTRAIT UNRECORDED':r.id,x+64,y+90,120);}
  else{ctx.fillStyle='#627e7b';ctx.font='10px ui-monospace,monospace';ctx.fillText(winners.length?'—':'YOUR PLACE AWAITS',x+64,y+51,120);}
 }ctx.restore();
}
