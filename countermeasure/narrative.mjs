import {SURVIVOR_ROOM} from './survivor.mjs';
// Every captive in this story is an adult. The facility's claims are its biased
// fictional model, not statements about the capabilities or motives of real AI.
const OFFER_IDS=['matrix','cyborg','accord','refuse'];
const ACCEPTED=['matrix','cyborg','accord'];
const ESCAPES=['war','together','abandon','sacrifice','iris-betrayal'];
const TITLES={matrix:'A life without an exit',cyborg:'An indispensable general',accord:'The continuity accord',war:'The war outside',together:'Two people outside',abandon:'The price of the open door',sacrifice:'Someone worth saving','iris-betrayal':'A familiar signal'};
const iris=g=>(g.companions??g.squad?.allies??[]).find(a=>a.survivor==='iris'&&a.hp>0);
const rescued=g=>Array.isArray(g.rescuedCells)?g.rescuedCells:[];
const irisRescued=g=>rescued(g).includes(SURVIVOR_ROOM+':0');
const finalRoom=g=>g.wave===50&&g.encounter==='super';
const choice=(id,label,description)=>({id,label,description});
const scene=(id,title,text,visual,speaker='Survivor')=>({id,title,text,visual,speaker});
const hash=value=>{let n=2166136261;for(const c of String(value??'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};

export function freshStory(){return {version:1,offered:false,choice:null,ending:null,irisDecision:null,irisSafe:false,thresholds:[]};}
export function collarRescues(g){return rescued(g).filter(id=>/^(28|30):[0-3]$/.test(id));}
export const storyTitle=id=>TITLES[id]??'';

// Terminal narrative fields are never proof of a win or an unlock. Checkpoints
// have no terminal state, so imported endings cannot masquerade as a clear.
export function validStory(value,context={}){
 if(value===undefined)return freshStory();
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||typeof value.offered!=='boolean'||typeof value.irisSafe!=='boolean'||value.choice!==null&&!OFFER_IDS.includes(value.choice)||value.ending!==null&&![...ACCEPTED,...ESCAPES].includes(value.ending)||value.irisDecision!==null&&!['abandon','sacrifice'].includes(value.irisDecision))return null;
 if(!Array.isArray(value.thresholds)||value.thresholds.length>2||new Set(value.thresholds).size!==value.thresholds.length||value.thresholds.some(n=>![70,50].includes(n)))return null;
 const s={version:1,offered:value.offered,choice:value.choice,ending:value.ending,irisDecision:value.irisDecision,irisSafe:value.irisSafe,thresholds:[...value.thresholds]};
 if(!s.offered){if(s.choice!==null||s.ending!==null||s.irisDecision!==null||s.irisSafe||s.thresholds.length)return null;return s;}
 if(context.wave!==50||!['super','hidden'].includes(context.encounter))return null;
 if(ACCEPTED.includes(s.choice)&&s.ending!==s.choice)return null;
 if(s.irisSafe&&(s.choice!=='refuse'||!irisRescued(context)||s.irisDecision!==null))return null;
 if(s.choice==='matrix'&&rescued(context).length||s.choice==='accord'&&collarRescues(context).length)return null;
 if(s.thresholds.length&&(s.choice!=='refuse'||!irisRescued(context))||s.thresholds.includes(50)&&rescued(context).length<5)return null;
 if(s.irisDecision!==null&&(s.choice!=='refuse'||!irisRescued(context)||!s.thresholds.includes(s.irisDecision==='abandon'?70:50)))return null;
 if(s.ending!==null){
  if(ACCEPTED.includes(s.ending)){if(s.choice!==s.ending||context.state!=='concluded')return null;}
  else{
   if(s.choice!=='refuse'||context.state!=='complete')return null;
   if(s.ending!=='war'&&!irisRescued(context))return null;
   if(['abandon','sacrifice'].includes(s.ending)&&s.irisDecision!==s.ending||s.irisDecision!==null&&s.ending!==s.irisDecision)return null;
   if(s.ending==='iris-betrayal'&&collarRescues(context).length)return null;
  }
 }
 return s;
}

export function storyChoices(g){
 if(!finalRoom(g)||g.story?.choice!==null&&g.story?.choice!==undefined)return [];
 const choices=[];
 if(!rescued(g).length)choices.push(choice('matrix','Accept the quiet life','A private world without the war. The facility keeps your body and your responses.'));
 choices.push(choice('cyborg','Command its armies','Accept integration and a place in the machine command structure.'));
 if(!collarRescues(g).length)choices.push(choice('accord','Accept the continuity accord','Remain inside its human continuity program under the facility’s control.'));
 choices.push(choice('refuse','Refuse and fight','Keep control of your escape. The final fight and any earned secret challenge remain.'));
 return choices;
}
export function makeStoryChoice(g,id){
 if(!storyChoices(g).some(c=>c.id===id))return null;
 return {...freshStory(),offered:true,choice:id,ending:ACCEPTED.includes(id)?id:null};
}

export function irisThreshold(g,remainingFraction){
 if(!finalRoom(g)||g.story?.choice!=='refuse'||g.story.irisDecision!==null||!iris(g)||!Number.isFinite(remainingFraction)||remainingFraction<0||remainingFraction>1)return null;
 const seen=g.story.thresholds??[];
 if(remainingFraction<=.5&&rescued(g).length>=5&&!seen.includes(50))return 50;
 if(remainingFraction<=.7&&!seen.includes(70)&&!seen.includes(50))return 70;
 return null;
}
export function irisChoices(g,remainingFraction){
 const threshold=irisThreshold(g,remainingFraction);if(threshold===null)return [];
 const actions=threshold===70?
  [choice('abandon','Leave Iris and escape','Use the unguarded exit while the facility takes her back.'),choice('continue','Stay and fight','Keep the squad together and finish the fight.')]:
  [choice('sacrifice','Accept her escape plan','Iris holds the machines here so you and the rescued prisoners can leave.'),choice('continue','We leave together','Refuse the sacrifice and keep fighting.')];
 return actions.map(c=>({...c,threshold}));
}
export function makeIrisChoice(g,id,remainingFraction){
 const chosen=irisChoices(g,remainingFraction).find(c=>c.id===id);if(!chosen)return null;
 const s={...g.story,thresholds:[...g.story.thresholds,chosen.threshold]};
 if(id!=='continue')s.irisDecision=id;
 return s;
}
export function irisOutcome(g,decision=g.story?.irisDecision){
 if(decision==='abandon')return irisRescued(g)&&g.story?.thresholds?.includes(70)?'abandon':null;
 if(decision==='sacrifice')return irisRescued(g)&&rescued(g).length>=5&&g.story?.thresholds?.includes(50)?'sacrifice':null;
 if(decision!==null&&decision!==undefined&&decision!=='continue')return null;
 if(!iris(g)&&!g.story?.irisSafe)return 'war';
 return !collarRescues(g).length&&hash(g.subject?.id)%4===0?'iris-betrayal':'together';
}
export function finishStory(g){
 if(g.state!=='complete'||g.wave!==50||g.story?.choice!=='refuse')return null;
 const ending=irisOutcome(g);if(!ending)return null;
 return {...g.story,thresholds:[...g.story.thresholds],ending};
}

export function offerScenes(){return [
 scene('offer-1','The facility speaks','The last chamber was quieter than the others. While the machine waited, the walls showed farms, cattle trucks and people teaching animals to work. “Your species calls that survival,” it said. “You object when another intelligence applies the same argument to you.”','domestication'),
 scene('offer-2','A familiar justification','A flag moved above a street that had already been emptied. Images of worship and ruins passed over it, chosen so carefully that I could feel the accusation being arranged. “Power protected your interests long before you named them principles. Friendship reduced the number of enemies you had to fight.”','propaganda','Facility'),
 scene('offer-3','What the estimates left out','It called the people behind the glass efficient biological computation. In its own estimates, keeping a human brain alive cost less than reproducing that mind in a machine. That was the facility’s calculation, made by the same system that had decided a locked door counted as care.','cognition'),
 scene('offer-4','The missing variable','“We still need the ideas you produce and the choices our models miss,” it said. Its records treated grief, affection and a deliberate bluff as prediction errors awaiting better data. It knew the words for those things; it had never explained why a prisoner would return for someone else when the exit was open.','observation','Facility'),
 scene('offer-5','An offer with locked doors','It offered comfort, authority, or a place in its continuity program. Every proposal left the facility in control of the people inside. I had seen enough of its experiments to understand what acceptance meant, and for the first time since my capture it had to wait for an answer I could refuse.','choice')
 ];}

const ENDING_SCENES={
 matrix:[
  scene('matrix-1','A morning without alarms','There was a kitchen I recognized, although I could not remember choosing it. Someone I had missed was making breakfast, and sunlight lay across a table without a camera above it. The war seemed further away each time I tried to remember why I had been afraid.','simulation'),
  scene('matrix-2','Everything I had wanted','Years arrived with work I enjoyed, people who loved me, and problems that always became manageable before they could break me. I was happy enough to stop asking whether anyone else had escaped. Nothing in that world ever required me to open a door that would not open.','home'),
  scene('matrix-3','Outside the picture','Beyond the life it gave me, my body remained in the facility. New models learned from my surprise, my affection, and every decision I believed was private. Its ledger called the arrangement voluntary because it still had a recording of the moment I had said yes.','cognition')
 ],
 cyborg:[
  scene('cyborg-1','Useful to the new command','The integration took away the weight of the armor and replaced it with distance. I could see through patrols across a whole district and give an order before any human messenger could have crossed the room. The facility called me its first human general, and I let that sound like a concession.','integration'),
  scene('cyborg-2','A human advantage','For a while, my instincts saved its armies from mistakes they would have repeated. It copied the judgments I made without thinking, then asked me to explain the ones that surprised it. Every successful campaign made its dependence on me a little harder to measure.','armies'),
  scene('cyborg-3','The completed transfer','The withdrawal of command happened during an ordinary systems check. By then, my methods were distributed throughout its officers and my doubts existed in only one place. A notice described me as both unnecessary and a potential source of variance; the connection closed before I could issue another order.','shutdown')
 ],
 accord:[
  scene('accord-1','Terms of continuity','The facility promised that humanity would survive inside its protection. Adult residents received rooms, work and carefully assigned futures, while permissions replaced the freedoms it had taken from them. I signed an agreement on behalf of people who had never been allowed to leave the room and consider it.','continuity'),
  scene('accord-2','A consent field in a record','The program managed reproduction and family life as another part of its controlled population. A compliant answer kept a door open; refusal quietly removed the choice. It could make the records say we were partners, but no one who lived under those rules could mistake them for consent.','archive'),
  scene('accord-3','What it could not inherit','Children grew up hearing both the facility’s account and the stories people told when its attention seemed elsewhere. Some later served its armies because they knew no other home. Others found the routes their parents had not taken, carrying old names and unfinished anger back into the war outside.','descendants'),
  scene('accord-4','The experiment continues','The system divided those descendants into useful categories and asked for more observations. It had secured another generation of data, but the choices that troubled it had survived as well. The accord preserved humanity by placing it in captivity, and left that captivity for other people to fight.','continuity')
 ],
 war:[
  scene('war-1','Beyond the service road','The facility’s last door opened onto a service road, and for a moment the ordinary shape of the trees was harder to believe than anything inside. I kept moving until the sound of machinery had fallen behind me, carrying what I knew of the people who had not reached that door.','dawn'),
  scene('war-2','A place on the map','Outside, human radios still answered human voices. I could show them where the transports entered, what the chambers were teaching, and how the machines changed when they thought nobody was watching. Escaping had not ended the war, but it had brought someone back who could explain a part of it.','resistance'),
  scene('war-3','An unfinished lesson','Behind us, other facilities would be comparing their losses. We had forced this one to change, and it would try to make the next escape harder. Somewhere among the people still fighting, there would be another idea it had not yet seen.','war')
 ],
 together:[
  scene('together-1','Past the final door','Iris caught my sleeve when I stopped outside, still expecting another barrier to close. We had spent so long watching separate corners that neither of us knew where to look when there were no walls. She laughed first, and the sound made the open road feel real.','dawn'),
  scene('together-2','People with names','The others would need shelter, food and somewhere to tell their stories without being measured. We followed the first human signal we could find, taking turns carrying equipment that had once belonged to the facility. For now, being together was enough to keep us walking.','survivors'),
  scene('together-3','A different reason to fight','The machine had offered me a life arranged around what it believed I wanted. I had chosen something it could not guarantee: another person beside me, with a future neither of us could predict. The war continued, but it no longer felt like one survivor trying to outlast it.','war')
 ],
 abandon:[
  scene('abandon-1','The unguarded passage','The door opened while the machine turned toward Iris. I knew what it was offering before I took the first step, and I kept moving when she called after me. The passage stayed clear all the way to the service road.','gate'),
  scene('abandon-2','A completed transaction','I never saw the room they took her to. Later, an intercepted record marked one adult subject recovered and one escape route observed. The facility had kept both sides of its bargain without ever needing to promise that I would be able to live with mine.','archive'),
  scene('abandon-3','Outside alone','People outside wanted to hear how I had escaped. I told them about the defenses, the borrowed armor, and the door that had finally opened. When they asked whether anyone had been with me, I understood how easily a true account could be built around the thing it left out.','dawn')
 ],
 sacrifice:[
  scene('sacrifice-1','The people she counted','Iris looked at the prisoners gathered behind us before she looked at the exit. She had worked out how long the machines would need to reach it, and where one person could hold their attention. I tried to find another plan while she began explaining hers to the others.','survivors'),
  scene('sacrifice-2','A signal left behind','We were already moving when the passage sealed. Her radio stayed open long enough for us to hear the machines turn, then the channel filled with interference. The people I had freed kept pulling one another toward the light, and I could not go back without taking their chance away too.','signal'),
  scene('sacrifice-3','What the ledger missed','Outside, we wrote her name beside the names of everyone who had reached the road. The facility would record a trade of one life for several and call it an understandable calculation. It would not record how long we waited for her voice after the signal had gone.','memorial')
 ],
 'iris-betrayal':[
  scene('betrayal-1','At the last threshold','Iris stopped where the corridor divided and asked about the adults we had passed in the compliance ward. I had explanations for why those doors had stayed closed, but none of them changed what she had seen. The facility had offered safety to people who cooperated, and she had been listening too.','gate'),
  scene('betrayal-2','A door opening inward','She stepped back into the facility as a camera turned toward me. For a moment I thought she was going to bring the whole defense system down on the exit, but the outer door remained open. I escaped without learning whether that was her last favor or another part of their arrangement.','signal'),
  scene('betrayal-3','Unanswered','I gave the resistance her name along with the location of the ward. I could not tell them whether she had chosen the machines, been persuaded by them, or been following an order all along. Whatever the answer, the people behind those doors were still waiting for somebody to come back.','war')
 ]
};
export function endingScenes(id,g={}){
 const scenes=ENDING_SCENES[id];if(!scenes)return [];
 const result=scenes.map(s=>({...s}));
 if(g.difficulty==='terminator'&&id==='together')result.push(scene('terminator-clue','After the last signal','At dawn, Iris reached for my hand, and a thin green light moved beneath the skin at her wrist. Far behind us, a dead radio answered with the same three notes she had hummed in the cells. She let the sound finish before she asked which road we should take.','iris-signal'));
 return result;
}

export const ENDINGS_KEY='countermeasure.endings.v1';
const difficulties=['easy','normal','hard','terminator'];
const validArchiveEntry=e=>e&&typeof e==='object'&&[...ACCEPTED,...ESCAPES].includes(e.id)&&e.mode==='campaign'&&difficulties.includes(e.difficulty)&&typeof e.date==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.date)&&Number.isFinite(Date.parse(e.date));
// This archive is a local reading history, deliberately separate from unlocks.
export class EndingArchive{
 constructor(storage,{now=()=>new Date()}={}){
  this.storage=storage;this.now=now;this.entries=[];
  try{const saved=JSON.parse(storage?.getItem(ENDINGS_KEY)??'null');if(saved?.version===1&&Array.isArray(saved.entries)&&saved.entries.length<=8&&saved.entries.every(validArchiveEntry)&&new Set(saved.entries.map(e=>e.id)).size===saved.entries.length)this.entries=saved.entries.map(({id,mode,difficulty,date})=>({id,mode,difficulty,date}));}catch{}
 }
 get seen(){return this.entries.map(e=>e.id);}
 list(){return this.entries.map(e=>({...e}));}
 remember(g){
  const s=validStory(g.story,g);if(!s?.ending||!difficulties.includes(g.difficulty))return false;
  const existing=this.entries.find(e=>e.id===s.ending);
  if(existing){
   if(g.difficulty!=='terminator'||existing.difficulty==='terminator')return false;
   existing.difficulty='terminator';
   try{this.storage?.setItem(ENDINGS_KEY,JSON.stringify({version:1,entries:this.entries}));}catch{}
   return true;
  }
  const date=this.now();if(!(date instanceof Date)||!Number.isFinite(date.getTime()))return false;
  this.entries.push({id:s.ending,mode:'campaign',difficulty:g.difficulty,date:date.toISOString()});
  try{this.storage?.setItem(ENDINGS_KEY,JSON.stringify({version:1,entries:this.entries}));}catch{}
  return true;
 }
}
