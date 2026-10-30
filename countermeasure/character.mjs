import {COSTUMES,costumePreset,costumeWeaponName,drawCostumeWeapon} from './costumes.mjs';
export const CHARACTER_KEY='countermeasure.character.v1';
export const PARTS={head:['crop','curls','bun','cap','combover','visor','sunglasses','halo'],body:['jacket','vest','poncho','apron','coveralls','shirt','trench','signal'],feet:['boots','trainers','wraps','prism']};
export const PREMIUM_PARTS=new Set(['halo','signal','prism']);
export const EARNED_PARTS=new Set(['sunglasses','trench']);
export const ANDERSON={head:'sunglasses',body:'trench',feet:'boots',coat:'#15191e',trim:'#292c34',skin:'#e7c5a4',shoe:'#101318'};
export const characterName=(style,fallback)=>style?.head==='sunglasses'&&style?.body==='trench'?'Thomas A. Anderson':fallback;
export const DEFAULT_CHARACTER={head:'crop',body:'jacket',feet:'boots',coat:'#d89965',trim:'#eab784',skin:'#e7e8cf',shoe:'#8ea7a1'};
export function normalizeCharacter(value={},entitled=false,earned=false){
 const result={...DEFAULT_CHARACTER};
 for(const part of Object.keys(PARTS))if(PARTS[part].includes(value?.[part])&&(entitled||!PREMIUM_PARTS.has(value[part]))&&(earned||!EARNED_PARTS.has(value[part])))result[part]=value[part];
 for(const key of ['coat','trim','skin','shoe'])if(/^#[0-9a-f]{6}$/i.test(value?.[key]??''))result[key]=value[key];
 if(COSTUMES.some(c=>c.id!=='standard'&&c.id===value?.costume))result.costume=value.costume;
 return result;
}
export function readCharacter(storage,entitled=false,earned=false){try{return normalizeCharacter(JSON.parse(storage.getItem(CHARACTER_KEY)),entitled,earned);}catch{return {...DEFAULT_CHARACTER};}}
export function writeCharacter(storage,value,entitled=false,earned=false){const result=normalizeCharacter(value,entitled,earned);try{storage.setItem(CHARACTER_KEY,JSON.stringify(result));return {value:result,saved:true};}catch{return {value:result,saved:false};}}

// Coordinates are local to the survivor, so the same parts rotate during rolls.
export function drawCharacterParts(ctx,p,style){
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 box(-13,-42,26,28,style.coat);box(-13,-42,26,5,style.trim);
 if(style.body==='vest'){box(-6,-37,12,23,style.trim);box(-2,-37,4,23,style.coat);}
 if(style.body==='poncho'){ctx.fillStyle=style.coat;ctx.beginPath();ctx.moveTo(-10,-44);ctx.lineTo(10,-44);ctx.lineTo(21,-18);ctx.lineTo(-21,-18);ctx.fill();box(-15,-23,30,4,style.trim);}
 if(style.body==='trench'){box(-16,-42,32,40,style.coat);box(-2,-39,4,37,style.trim);box(-18,-8,13,7,style.coat);box(5,-8,13,7,style.coat);}
 if(style.body==='signal'){box(-15,-40,30,4,'#baf5ff');box(-15,-29,30,3,'#baf5ff');}
 if(style.body==='apron'){box(-8,-40,16,9,style.trim);box(-10,-31,20,21,style.trim);box(-7,-23,14,8,style.coat);box(-2,-39,4,27,style.trim);}
 if(style.body==='coveralls'){box(-1,-39,2,25,style.trim);box(-10,-35,7,7,style.trim);box(4,-35,6,7,style.trim);box(-11,-20,22,3,style.trim);}
 if(style.body==='shirt'){box(-8,-42,16,5,style.trim);box(-2,-37,4,20,style.trim);box(-12,-16,24,5,style.shoe);}
 box(-10,-62,20,19,style.skin);box(p.facing>0?2:-9,-56,8,3,'#37452e');
 if(style.head==='crop')box(-10,-64,20,5,style.trim);
 if(style.head==='curls')for(const [x,y] of [[-12,-64],[-4,-67],[4,-65]])box(x,y,9,8,style.trim);
 if(style.head==='bun'){box(-11,-65,22,8,'#44414d');box(p.facing>0?-16:9,-69,8,11,'#44414d');box(p.facing>0?-14:9,-64,5,2,style.trim);}
 if(style.head==='cap'){box(-12,-67,24,10,style.trim);box(p.facing>0?7:-20,-59,13,3,style.trim);}
 if(style.head==='combover'){box(-10,-65,13,6,style.trim);for(let n=0;n<3;n++)box(-4+n*5,-65+n,7,2,style.trim);}
 if(style.head==='visor'){box(-12,-62,24,8,style.shoe);box(-13,-58,26,4,'#b6eaf1');}
 if(style.head==='sunglasses'){box(-10,-64,20,5,'#211e22');box(-12,-58,24,6,'#090c12');box(-10,-57,7,2,'#768b94');box(3,-57,7,2,'#768b94');}
 if(style.head==='halo'){ctx.strokeStyle='#c4eeff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-70,16,4,0,0,Math.PI*2);ctx.stroke();}
 for(const side of [-1,1]){const x=side<0?-15:3;box(x,-5,12,6,style.shoe);if(style.feet==='boots')box(x,-12,11,9,style.shoe);if(style.feet==='trainers')box(x,-1,14,3,style.trim);if(style.feet==='wraps')for(let y=-11;y<-2;y+=4)box(x,y,11,2,style.trim);if(style.feet==='prism')box(x,-8,14,4,'#c4eeff');}
}

export function characterUI({storage,document,entitled=()=>false,earned=()=>false,onChange,onOpen,onClose}){
 const $=id=>document.getElementById(id),dialog=$('character-dialog');let style=readCharacter(storage,entitled(),earned());
 function render(){
  for(const part of Object.keys(PARTS)){
   const select=$('character-'+part);select.replaceChildren();
   for(const id of PARTS[part]){const option=document.createElement('option');option.value=id;option.textContent=id[0].toUpperCase()+id.slice(1)+(PREMIUM_PARTS.has(id)?' · Premium':EARNED_PARTS.has(id)?' · First escape':'');option.disabled=PREMIUM_PARTS.has(id)&&!entitled()||EARNED_PARTS.has(id)&&!earned();select.append(option);}select.value=style[part];
  }
  $('character-anderson').disabled=!earned();$('character-anderson').textContent=earned()?'Thomas A. Anderson · Equip':'Thomas A. Anderson · Escape to unlock';
  const costume=$('character-costume');costume.replaceChildren();for(const c of COSTUMES){const option=document.createElement('option');option.value=c.id;option.textContent=c.name+' · Free';costume.append(option);}costume.value=style.costume??'standard';
  $('character-costume-help').textContent=costumePreset(style.costume).detail+' Props change appearance only; weapon families and combat stats stay the same.';
  $('character-props').textContent=style.costume?'Melee props: '+[0,1].map(i=>[0,1,2,3].map(t=>costumeWeaponName(style,i,t,'')).join(' → ')).join(' / '):'Standard weapon appearances.';
  for(const key of ['coat','trim','skin','shoe'])$('character-'+key).value=style[key];
  const canvas=$('character-preview'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(canvas.width/2-14,180);ctx.scale(2.3,2.3);ctx.fillStyle='#cbd6c6';ctx.fillRect(-10,-17,6,17);ctx.fillRect(4,-17,6,17);drawCharacterParts(ctx,{facing:1},style);ctx.save();ctx.translate(15,-28);ctx.scale(.65,.65);drawCostumeWeapon(ctx,style,0,2);ctx.restore();ctx.restore();onChange(style);
 }
 function save(){const next={costume:style.costume};for(const key of Object.keys(DEFAULT_CHARACTER))next[key]=$('character-'+key).value;const result=writeCharacter(storage,next,entitled(),earned());style=result.value;$('character-status').textContent=result.saved?'Saved on this browser.':'Session only · browser storage unavailable.';render();}
 for(const input of dialog.querySelectorAll('select,input'))if(input.id!=='character-costume')input.addEventListener('input',save);
 $('character-costume').addEventListener('input',()=>{const choice=costumePreset($('character-costume').value),result=writeCharacter(storage,choice.style??DEFAULT_CHARACTER,entitled(),earned());style=result.value;$('character-status').textContent=result.saved?choice.name+' / saved on this browser.':'Session only · browser storage unavailable.';render();});
 $('character-anderson').onclick=()=>{if(!earned())return;style={...ANDERSON};writeCharacter(storage,style,entitled(),true);$('character-status').textContent='Thomas A. Anderson / earned by escaping.';render();};
 $('character-reset').onclick=()=>{style={...DEFAULT_CHARACTER};writeCharacter(storage,style);render();};
 $('character-menu').onclick=()=>{style=readCharacter(storage,entitled(),earned());onOpen();render();dialog.showModal();};
 function close(){dialog.close();onClose();}
 $('close-character').onclick=close;$('character-done').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});render();return {refresh:()=>{style=readCharacter(storage,entitled(),earned());render();}};
}
