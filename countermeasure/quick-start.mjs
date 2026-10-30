export const GUIDE_KEY='countermeasure.guide.v1';
export class FirstRunGuide{
 constructor(storage){this.storage=storage;try{this.seen=storage.getItem(GUIDE_KEY)==='seen';}catch{this.seen=false;}}
 eligible(game){return !this.seen&&game.state==='briefing'&&game.plan.wave===1;}
 remember(){this.seen=true;try{this.storage.setItem(GUIDE_KEY,'seen');}catch{}}
}
export function quickStartUI({storage,document,touch=()=>false,hint=id=>({left:'A',right:'D',up:'W',down:'S',attack:'Enter',dash:'Shift',flip:'R',skills:'Tab',power:'F',cyclePower:'G',weapon0:'1',weapon1:'2',weapon2:'3',weapon3:'4'})[id],onOpen,onClose}){
 const state=new FirstRunGuide(storage),$=id=>document.getElementById(id),dialog=$('quick-start-dialog');let pending=null;
 function close(play){const start=pending;pending=null;state.remember();dialog.close();onClose(!!start);if(play&&start)start();}
 function open(start=null){pending=start;
  $('guide-move').textContent=touch()?'← → move · ↑ jump · hold Attack to fight':hint('left')+' / '+hint('right')+' move · '+hint('up')+' jump · '+hint('attack')+' attack';
  $('guide-combo').textContent=touch()?'Switch tools below the arena. Water → taser.':[0,1,2,3].map(i=>hint('weapon'+i)).join(' / ')+' switch tools. Water → taser.';
  $('guide-roll').textContent=touch()?'Duck + Dash rolls. Spin slashes, even in air.':hint('down')+' ducks · '+hint('dash')+' dashes · crouch + dash rolls · '+hint('flip')+' spins.';
  $('guide-skills').textContent=touch()?'Skills pauses the fight. Rewire for free.':hint('skills')+' pauses the fight. Rewire for free.';
  $('guide-mech').textContent=touch()?'Later: collect the cleared boss’s mech. Hold Fly; tap power / ↻.':'Later: collect the cleared boss’s mech. Hold '+hint('up')+' to fly; '+hint('power')+' uses power, '+hint('cyclePower')+' cycles.';
  $('guide-play').textContent=start?'Enter the trial ↗':'Back to menu ↗';$('guide-skip').hidden=!start;onOpen();dialog.showModal();
 }
 $('guide-play').onclick=()=>close(true);$('guide-skip').onclick=()=>close(true);dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});
 $('guide-menu').onclick=()=>open();return {state,open};
}
