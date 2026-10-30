import {offerScenes,endingScenes,storyChoices,irisChoices,storyTitle,validStory,EndingArchive} from './narrative.mjs';

export const NARRATIVE_VISUALS=Object.freeze(['domestication','propaganda','cognition','observation','choice','simulation','home','integration','armies','shutdown','continuity','archive','descendants','dawn','resistance','war','survivors','gate','signal','memorial','iris-signal','credits']);
const credits={id:'credits',title:'Countermeasure',speaker:'Credits',visual:'credits',text:'Created by Dave Liu, with thanks to everyone who has played, tested, and shared an idea. Countermeasure is a one-person project, and your feedback helps it grow. The facility’s arguments belong to its fictional world; the people behind its doors never stopped being people.'};

export function storyPresentation(g){
 const subject=String(g.subject?.id??'current');
 if(g.state==='story-offer'){
  const choices=storyChoices(g);return choices.length?{kind:'offer',key:subject+':offer',scenes:offerScenes(g),choices,ending:null}:null;
 }
 if(g.state==='story-iris'){
  const choices=irisChoices(g,g.storyRatio);if(!choices.length)return null;
  const threshold=choices[0].threshold;
  const scene=threshold===70?
   {id:'iris-70',title:'An unguarded exit',speaker:'Iris',visual:'gate',text:'The machines have turned toward Iris, leaving the passage behind you clear. She is still fighting, and she can see the open door too. You can take the chance to leave her behind, or stay and finish what you started together.'}:
   {id:'iris-50',title:'The people behind you',speaker:'Iris',visual:'survivors',text:'Iris has counted the people following you and found a way to get them through the passage. She offers to hold the machines here while you lead the others out. There is still a chance to keep fighting together, but her plan would get the prisoners out now.'};
  return {kind:'iris',key:subject+':iris:'+threshold,scenes:[scene],choices,ending:null};
 }
 if(['concluded','complete'].includes(g.state)&&validStory(g.story,g)?.ending){
  const ending=g.story.ending,scenes=endingScenes(ending,g);return scenes.length?{kind:'ending',key:subject+':ending:'+ending,scenes:[...scenes,{...credits}],choices:[],ending}:null;
 }
 return null;
}

const box=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
function line(c,x,y,x2,y2,color,width=3){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function label(c,text,x,y,color='#9bbeb5',size=12){c.fillStyle=color;c.font=size+'px ui-monospace,monospace';c.fillText(text,x,y);}
function human(c,x,y,{scale=1,iris=false,coat='#a3b8ad'}={}){
 c.save();c.translate(x,y);c.scale(scale,scale);line(c,-6,-20,-9,0,'#718886',7);line(c,6,-20,9,0,'#718886',7);
 box(c,-12,-53,24,35,coat);line(c,-14,-48,-22,-24,coat,6);line(c,14,-48,22,-24,coat,6);
 c.fillStyle='#d1bb9b';c.beginPath();c.arc(0,-66,11,0,Math.PI*2);c.fill();
 if(iris){box(c,-13,-77,26,7,'#454050');box(c,-13,-72,5,20,'#454050');}else box(c,-11,-77,22,6,'#535454');c.restore();
}
function robot(c,x,y,scale=1){
 c.save();c.translate(x,y);c.scale(scale,scale);line(c,-11,-23,-15,0,'#465c5d',10);line(c,11,-23,15,0,'#465c5d',10);box(c,-20,-64,40,42,'#617975');box(c,-16,-89,32,22,'#8b9f95');box(c,-12,-80,24,4,'#dfa488');line(c,-24,-58,-31,-24,'#617975',8);line(c,24,-58,31,-24,'#617975',8);c.restore();
}
function room(c){
 box(c,0,0,1000,420,'#0a171b');box(c,0,55,1000,285,'#173035');box(c,0,340,1000,80,'#101e21');
 for(let i=0;i<8;i++){line(c,i*145,55,i*145,340,'#29474a',3);box(c,i*145+30,71,70,4,'#7c9a91');}
 line(c,0,340,1000,340,'#66867b',3);for(let i=0;i<9;i++)line(c,500,340,i*150-100,420,'#243d3e',2);
}
function outdoors(c,t){
 box(c,0,0,1000,420,'#243c40');box(c,0,245,1000,175,'#39483e');c.fillStyle='#d1c292';c.beginPath();c.arc(760,115,44,0,Math.PI*2);c.fill();
 for(let i=0;i<11;i++){
  const x=i*104-15;line(c,x,190,x,320,'#1a3031',8);c.fillStyle='#1b3734';c.beginPath();c.moveTo(x,105+(i%3)*12);c.lineTo(x-45,245);c.lineTo(x+45,245);c.fill();
 }
 box(c,0,330,1000,90,'#55594a');for(let i=0;i<12;i++)box(c,i*95,372,45,3,'#a3a18a');
 for(let i=0;i<3;i++)box(c,140+i*330+Math.sin(t*.2+i)*3,302,20,2,'#b8c79a');
}
function pods(c,t){
 for(let i=0;i<6;i++){
  const x=70+i*155;box(c,x,130,120,204,'#0e232a');human(c,x+60,316,{scale:1.55});
  box(c,x+40,204,40,5,'#71b8b3');line(c,x+58,205,x+58,112,'#588c8e',2);line(c,x+58,112,500,88,'#375e63',2);
  c.strokeStyle='#5c8480';c.lineWidth=2;c.strokeRect(x,130,120,204);box(c,x+10,144,4,4,Math.sin(t+i)>0?'#9acbba':'#58766d');
 }
 box(c,440,65,120,40,'#3a625e');label(c,'LIVE / RETAIN',451,90,'#c5dbb9',11);
}
export function drawNarrativeScene(c,visual,elapsed=0,{reduced=false}={}){
 const t=reduced?0:Math.max(0,Number.isFinite(elapsed)?elapsed:0);c.save();c.imageSmoothingEnabled=false;room(c);
 if(['dawn','resistance','war','survivors','descendants','credits'].includes(visual)){
  outdoors(c,t);
  if(visual==='credits'){human(c,430,352,{scale:1.4});human(c,485,352,{scale:1.4,iris:true});label(c,'COUNTERMEASURE',345,135,'#e0e3c9',29);}
  else if(visual==='survivors')for(let i=0;i<6;i++)human(c,240+i*80,350,{scale:1.1+(i%2)*.2,iris:i===1});
  else if(visual==='descendants'){
   for(let i=0;i<5;i++)human(c,180+i*55,350,{scale:1.1});for(let i=0;i<4;i++){human(c,650+i*45,350,{scale:1.1});robot(c,700+i*60,295,.5);}
   line(c,480,335,360,412,'#a3b599',4);line(c,520,335,680,412,'#a3b599',4);
  }else{
   human(c,365,353,{scale:1.65});if(visual==='dawn')human(c,430,350,{scale:1.55,iris:true});
   if(visual==='war'||visual==='resistance'){for(let i=0;i<5;i++)robot(c,650+i*65,330,.72);box(c,290,260,30,25,'#9caa92');line(c,304,261,312,224,'#b1c5a2',3);}
  }
 }else if(visual==='simulation'||visual==='home'){
  box(c,0,0,1000,420,'#b0af8d');box(c,90,70,320,235,'#a7c5bc');c.fillStyle='#d5d0a5';c.beginPath();c.arc(300,140,42,0,Math.PI*2);c.fill();
  for(let i=0;i<4;i++)line(c,90+i*107,70,90+i*107,305,'#6b8078',6);box(c,570,235,270,12,'#655e4d');line(c,600,246,600,368,'#655e4d',8);line(c,815,246,815,368,'#655e4d',8);
  human(c,525,366,{scale:1.7,coat:'#5c7771'});human(c,870,366,{scale:1.7,iris:true,coat:'#807459'});box(c,660,219,26,17,'#d0d1b7');
  if(visual==='simulation'){for(let i=0;i<6;i++)line(c,14+i*195,0,14+i*195,420,'#6a9e8e55',1);box(c,935,100,2,130,'#85ba93');}
 }else if(visual==='cognition')pods(c,t);
 else if(visual==='observation'){
  for(let i=0;i<3;i++){
   const x=95+i*300;box(c,x,135,230,200,'#10262b');human(c,x+62,330,{scale:1.5});box(c,x+90,246,110,8,'#788e7c');line(c,x+100,252,x+100,335,'#788e7c',5);
   if(i===0){box(c,x+100,238,65,3,'#d3d1ad');line(c,x+82,270,x+125+Math.sin(t*2)*3,237,'#d1bb9b',4);}
   else if(i===1)for(let k=0;k<4;k++)box(c,x+106+k*7,236-k*7,70-k*5,7,k%2?'#95b2a7':'#687f78');
   else{for(let k=0;k<9;k++)line(c,x+100+k*11,180,x+100+k*11,240,'#93ada0',2);for(let k=0;k<5;k++)line(c,x+95,210+k*5,x+195,210+k*5,'#b2b898',2);}
   c.strokeStyle='#66877f';c.lineWidth=2;c.strokeRect(x,135,230,200);box(c,x+195,145,16,8,'#7ca694');box(c,x+190,147,4,4,'#e2aa8c');
  }
 }else if(visual==='domestication'){
  outdoors(c,t);for(let i=0;i<3;i++){const x=150+i*230;box(c,x,270,74,33,'#88988c');line(c,x+12,300,x+12,330,'#88988c',6);line(c,x+60,300,x+60,330,'#88988c',6);box(c,x+62,259,27,29,'#a8b1a0');}
  for(let i=0;i<9;i++)line(c,70+i*112,265,70+i*112,350,'#4f685c',6);line(c,50,290,980,290,'#6b8271',6);human(c,880,347,{scale:1.5});
 }else if(visual==='propaganda'){
  for(let i=0;i<8;i++)box(c,40+i*126,220-(i%3)*45,90,120+(i%3)*45,'#34474a');line(c,225,65,225,325,'#9da99a',6);
  for(let i=0;i<13;i++)box(c,229,65+i*7,180,7,i%2?'#b7b5a4':'#9c6a65');box(c,229,65,76,49,'#596d81');for(let i=0;i<18;i++)box(c,237+(i%6)*10,72+Math.floor(i/6)*13,3,3,'#d6d6c1');
  box(c,635,100,95,210,'#4a5652');line(c,682,48,682,235,'#a09f8c',8);line(c,638,102,726,102,'#a09f8c',8);human(c,520,350,{scale:1.7});
 }else if(visual==='armies'||visual==='integration'){
  for(let row=0;row<3;row++)for(let i=0;i<6;i++)robot(c,380+i*90+row*18,185+row*80,.65+row*.16);
  human(c,190,343,{scale:2.3,coat:'#4c7272'});if(visual==='integration'){box(c,163,241,54,40,'#658e84');line(c,190,237,190,90,'#8bbdb0',3);for(let i=0;i<4;i++)line(c,190,90,500+i*120,85,'#548d86',2);}
 }else if(visual==='shutdown'){
  human(c,500,335,{scale:2.3,coat:'#4c7272'});for(let i=0;i<7;i++)box(c,304+i*58,105,42,235,'#263e43');box(c,305,101,390,6,'#c38476');label(c,'TRANSFER COMPLETE',373,78,'#c7a28c',18);
 }else if(visual==='continuity'||visual==='archive'){
  for(let i=0;i<5;i++){const x=70+i*185;box(c,x,135,150,200,'#10252b');human(c,x+75,329,{scale:1.7,iris:i%2===0});c.strokeStyle='#65847d';c.strokeRect(x,135,150,200);label(c,String(3491+i),x+51,159,'#89a69b',12);}
  box(c,340,76,320,28,'#304e4b');label(c,visual==='archive'?'CONSENT FIELD: RECORDED':'HUMAN CONTINUITY / CONTROLLED',362,95,'#b9c6ae',13);
 }else if(visual==='gate'||visual==='choice'){
  box(c,550,70,220,270,'#566d5e');box(c,562,83,194,257,'#b4bb91');human(c,415,345,{scale:1.9});human(c,760,340,{scale:1.8,iris:true});robot(c,900,340,1.5);line(c,525,68,525,340,'#9ba790',5);label(c,'EXIT',625,62,'#b9d0a4',20);
 }else if(visual==='iris-signal'){
  outdoors(c,t);human(c,475,390,{scale:3.2,iris:true});line(c,520,307,665,300,'#c8b397',18);box(c,605,291,8,19,'#92efb1');box(c,736,290,100,68,'#304d4d');line(c,755,289,765,215,'#9cae92',4);
  for(let i=0;i<3;i++){c.strokeStyle='#8bd4ad';c.lineWidth=2;c.beginPath();c.arc(765,218,17+i*14,-Math.PI*.8,-Math.PI*.2);c.stroke();}
 }else if(visual==='signal'){
  human(c,330,344,{scale:1.9,iris:true});box(c,610,225,150,107,'#385455');line(c,635,222,655,110,'#9eb6a1',4);
  for(let i=0;i<5;i++){c.strokeStyle='#7d9a92';c.lineWidth=2;c.beginPath();c.arc(655,109,28+i*24,-Math.PI*.8,-Math.PI*.2);c.stroke();}box(c,636,248,96,21,'#10282d');line(c,643,258,721,258,'#9fbcaa',2);
 }else if(visual==='memorial'){
  outdoors(c,t);box(c,370,125,290,220,'#3b514c');label(c,'IRIS',480,179,'#d8dcc0',25);for(let i=0;i<7;i++)line(c,415,205+i*16,570+(i%3)*12,205+i*16,'#8ca797',2);human(c,305,350,{scale:1.7});
 }
 // A quiet edge frame avoids flashes and keeps every scene legible in motion.
 box(c,0,0,1000,12,'#071215');box(c,0,408,1000,12,'#071215');c.restore();
}

export function narrativeUI({document,window,storage,game,onChoice=()=>{},onIris=()=>{},onClearInput=()=>{},onCloseArchive=()=>{}}){
 const archive=new EndingArchive(storage),terminalSeen=new Set();let active=null,index=0,elapsed=0,origin=null,returnFocus=null;
 const make=(tag,id,className='')=>{const n=document.createElement(tag);if(id)n.id=id;if(className)n.className=className;return n;};
 const dialog=make('dialog','narrative-dialog','cm-narrative'),top=make('div',null,'cm-narrative-top'),chapter=make('span','narrative-chapter'),skip=make('button','narrative-skip'),title=make('h2','narrative-title'),picture=make('div',null,'cm-narrative-picture'),canvas=make('canvas','narrative-art'),caption=make('p','narrative-caption'),choices=make('div','narrative-choices','cm-narrative-choices'),navigation=make('div',null,'cm-narrative-navigation'),prev=make('button','narrative-prev'),next=make('button','narrative-next'),note=make('p','narrative-note','cm-narrative-note');
 dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',caption.id);title.tabIndex=-1;chapter.setAttribute('aria-live','polite');canvas.width=1000;canvas.height=420;canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');
 for(const b of [skip,prev,next])b.type='button';prev.textContent='← Previous';top.append(chapter,skip);picture.append(canvas);navigation.append(prev,next);dialog.append(top,title,picture,caption,choices,navigation,note);document.body.append(dialog);
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')??{matches:false};
 function clearChoices(){choices.replaceChildren();}
 function rememberFocus(){returnFocus=document.activeElement;onClearInput();elapsed=0;}
 function close(notify=false){if(!active)return;const kind=origin==='archive'?'archive':active.kind,ending=active.ending;active=null;origin=null;onClearInput();if(dialog.open)dialog.close();if(returnFocus?.isConnected!==false)returnFocus?.focus?.();if(notify)onCloseArchive({kind,ending});}
 function explicit(handler){return e=>{if(e?.detail===0&&elapsed<.25)return;handler();};}
 function choose(id){if(!active?.choices.some(c=>c.id===id))return;const kind=active.kind;close();if(kind==='offer')onChoice(id);else if(kind==='iris')onIris(id);}
 function render(){
  if(!active)return;clearChoices();const scene=active.scenes[index],last=index===active.scenes.length-1;
  title.textContent=scene.title;caption.textContent=scene.text;chapter.textContent=active.kind==='archive'?'LOCAL ENDING ARCHIVE':`${scene.speaker??'Survivor'} · ${index+1} / ${active.scenes.length}`;
  prev.hidden=active.kind==='archive';prev.disabled=index===0;next.hidden=active.kind==='archive'||last&&active.choices.length>0;
  next.textContent=last?(origin==='archive'?'Back to archive':'Close ending'):(active.scenes[index+1].id==='credits'?'Credits →':'Next →');
  skip.textContent=active.kind==='offer'?'Skip & fight':active.kind==='iris'?'Keep fighting':active.kind==='archive'?'Close archive':scene.id==='credits'?(origin==='archive'?'Back to archive':'Close ending'):'Skip to credits';
  note.textContent=active.kind==='offer'?'The facility’s reasoning is part of the fiction. Accepting ends this run without an escape clear.':active.kind==='archive'?'Saved on this browser. Replaying an ending changes no progress or rewards.':active.kind==='ending'?'This ending reflects the choices made during this run.':'';
  if(active.kind==='archive'){
   for(const entry of archive.list()){
    const b=make('button',null,'cm-narrative-choice');b.type='button';b.textContent=storyTitle(entry.id)+' · '+entry.difficulty;b.onclick=explicit(()=>replay(entry));choices.append(b);
   }
  }else if(last)for(const c of active.choices){
   const b=make('button',null,'cm-narrative-choice'),label=make('strong'),description=make('span');b.type='button';b.dataset.choice=c.id;label.textContent=c.label;description.textContent=c.description;b.append(label,description);b.onclick=explicit(()=>choose(c.id));choices.append(b);
  }
  if(ctx)drawNarrativeScene(ctx,scene.visual,elapsed,{reduced:reduced.matches});
 }
 function show(p,from=null){rememberFocus();active=p;origin=from;index=0;render();if(!dialog.open)dialog.showModal();title.focus();return true;}
 function archivePresentation(){return {kind:'archive',key:'archive',ending:null,scenes:[{id:'archive-menu',title:'Endings you have seen',speaker:'Archive',visual:'archive',text:archive.seen.length?'Choose an ending to revisit it. Other paths remain undisclosed until you encounter them in play.':'No endings recorded yet. Your choices through the final chamber will be remembered here.'}],choices:[]};}
 function replay(entry){show({kind:'ending',key:'replay:'+entry.id,ending:entry.id,choices:[],scenes:[...endingScenes(entry.id,{difficulty:entry.difficulty}),{...credits}]},'archive');}
 function finish(){if(origin==='archive')show(archivePresentation(),'archive');else close(true);}
 function nextScene(){if(!active||active.kind==='archive')return;if(index<active.scenes.length-1){index++;elapsed=0;render();title.focus();}else if(!active.choices.length)finish();}
 function skipScene(){if(active?.kind==='offer')choose('refuse');else if(active?.kind==='iris')choose('continue');else if(active?.kind==='archive')close(true);else if(active){if(active.scenes[index].id==='credits')finish();else{index=active.scenes.length-1;elapsed=0;render();title.focus();}}}
 skip.onclick=explicit(skipScene);prev.onclick=explicit(()=>{if(index>0){index--;elapsed=0;render();title.focus();}});next.onclick=explicit(nextScene);
 dialog.addEventListener('keydown',e=>{
  e.stopPropagation();if(['Enter','NumpadEnter','Space'].includes(e.code)){if(e.repeat||elapsed<.25)e.preventDefault();return;}
  if(e.code==='ArrowRight'&&active?.kind!=='archive'){e.preventDefault();nextScene();}else if(e.code==='ArrowLeft'&&index>0){e.preventDefault();index--;elapsed=0;render();title.focus();}
 });
 dialog.addEventListener('keyup',e=>e.stopPropagation());
 dialog.addEventListener('cancel',e=>{e.preventDefault();skipScene();});
 return {
  get state(){return {open:dialog.open,kind:active?.kind??null,scene:index,total:active?.scenes.length??0,ending:active?.ending??null};},
  sync(){
   const p=storyPresentation(game);if(active?.kind==='archive'||origin==='archive')return false;
   if(!p){if(active)close();return false;}if(active?.key===p.key)return false;
   if(p.kind==='ending'){if(terminalSeen.has(p.key))return false;terminalSeen.add(p.key);archive.remember(game);}
   return show(p);
  },
  update(dt){if(!active||!dialog.open)return;if(Number.isFinite(dt)&&dt>0&&!document.hidden)elapsed+=Math.min(dt,.1);if(ctx&&!document.hidden)drawNarrativeScene(ctx,active.scenes[index].visual,elapsed,{reduced:reduced.matches});},
  openArchive(){if(active)close();return show(archivePresentation(),'archive');}
 };
}
