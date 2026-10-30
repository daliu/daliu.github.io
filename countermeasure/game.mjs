import {learningReport,learningBroadcast} from './resistance-learning.mjs';
import {currentUtility,selectUtility,cycleUtility,activateUtility,utilityInput} from './utility-controls.mjs';
import {autoAllocate} from './auto-skills.mjs';
import {drawSpider,createSpiderLighting,spiderRoom} from './spider-ambush.mjs';
import {drawOpeningCell,lampLocked} from './opening-escape.mjs';
import {costumeWeaponName,drawCostumeWeapon} from './costumes.mjs';
import {introUI} from './intro.mjs';
import {drawWeaponLoot,weaponCopies,loanCount} from './weapon-loot.mjs';
import {nearSideDoor,drawSideRooms} from './side-rooms.mjs';
import {weaponHolder} from './weapon-lending.mjs';
import {drawFinalPilot} from './final-pilot.mjs';
import {drawBurning} from './thermal-armor.mjs';
import {KEY_COMMANDS,actionFor,keysFor,keyHint,comboCompatible,movementComboCode,keyboardUI} from './keybindings.mjs';
import {equipmentCues,drawMechPowerCue} from './equipment-cues.mjs';
import {drawSupplies} from './supplies.mjs';
import {voiceOrdersUI} from './voice-orders.mjs';
import {bindMenuShortcut} from './menu-shortcut.mjs';
import {nearRescue,rescueTarget,rescueWeapon,drawRescueDoor} from './prisoners.mjs';
import {HACK_SKILL,hackOpportunity,cancelHack,drawHack} from './companions.mjs';
import {drawCompanions} from './squad-orders.mjs';
import {squadControls} from './squad-controls.mjs';
import {startSquadDrill,startHackDrill,startRescueDrill,startSpiderDrill} from './companion-drill.mjs';
import {quickStartUI} from './quick-start.mjs';
import {scopedPlayerStorage,playerBackupUI} from './player-backup.mjs';
import {overdriveEnabled,resourceRows} from './overdrive.mjs';
import {LATE_TOOLS,toolAvailable,drawLateTools,drawDrillImpact} from './late-tools.mjs';
import {feedbackUI,SUPPORT_COPY} from './feedback.mjs';
import {EscapeArchive,drawEscapeWall} from './escape-archive.mjs';
import {characterUI,readCharacter,drawCharacterParts,characterName} from './character.mjs';
import {RollingSlashGesture} from './rolling-slash.mjs';
import {PREMIUM_CONFIG} from './premium-config.mjs';
import {premiumUI} from './premium-view.mjs';
import {PALETTES} from './premium.mjs';
import {profileFor,validDifficulty} from './difficulty.mjs';
import {Arena,WEAPONS,UPGRADES,weaponAt,SKILLS,TYPES,TRAINING_WAVES,BOSS_WAVE as DEMO_BOSS,FINAL_WAVE as DEMO_FINAL,phaseFor as demoPhase,cognitionAt as demoCognition} from './engine.mjs';
const $=id=>document.getElementById(id), canvas=$('arena'), ctx=canvas.getContext('2d');
const paintSpiderDarkness=createSpiderLighting(document),reducedSpiderMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
import {readOptions,saveOptions,RELEASE} from './options.mjs';
import {Soundtrack,MusicFiles,soundtrackUI} from './soundtrack.mjs';
import {Statistics} from './statistics.mjs';
import {renderStatistics} from './statistics-view.mjs';
import {Telemetry} from './telemetry.mjs';
import {SUPPORT_ICONS} from './boss-support.mjs';
import {ProgressStore} from './saves.mjs';
import {campaignPhase,campaignCognition} from './campaign.mjs';
import {ExpeditionArena,POWERS as MODULES} from './expedition.mjs';
import {powerCue} from './expedition-plan.mjs';
import {drawFactoryWorld,drawFactoryLore} from './factory-world.mjs';
import {scrollView,roomShell,drawStructure,drawEvasion,drawExpeditionExtras} from './expedition-view.mjs';
import {ExpeditionStore as CampaignStore,EXPEDITION_SAVE_KEY,campaignSaveFrom,retuneCheckpoint} from './expedition-saves.mjs';
// Marked collection tests use separate local records, preserving player saves.
let nativeStorage;try{nativeStorage=window.localStorage;}catch{nativeStorage={getItem(){throw Error('Storage blocked');},setItem(){throw Error('Storage blocked');},removeItem(){throw Error('Storage blocked');}};}
const drillMode=new URLSearchParams(location.search).get('squad_drill')==='1';
const analyticsTestMode=drillMode||new URLSearchParams(location.search).get('analytics_test')==='1';
const drillValues=new Map(),drillStorage={getItem:k=>drillValues.get(k)??null,setItem:(k,v)=>drillValues.set(k,String(v)),removeItem:k=>drillValues.delete(k)};
const storage=scopedPlayerStorage(drillMode?drillStorage:nativeStorage,{payment:PREMIUM_CONFIG.enabled,analyticsTest:analyticsTestMode});
$('site-move-help').hidden=!['aygen.us','daliu.github.io'].includes(location.hostname);
let savedMode=location.hostname==='aygen.us'?'campaign':'demo';try{savedMode=storage.getItem('countermeasure.mode.v1')??savedMode;}catch{}
const portfolioDemo=location.hostname==='daliu.github.io';
const campaign=drillMode||!portfolioDemo&&(new URLSearchParams(location.search).get('mode')??savedMode)==='campaign';
if(portfolioDemo){for(const link of document.querySelectorAll('[data-mode="campaign"]')){link.href=document.querySelector('#full-game-link a').href;link.setAttribute('aria-label','Play the full game on Aygen');link.replaceChildren(document.createTextNode('Full game ↗'));const small=document.createElement('small');small.textContent='50 levels · Aygen';link.append(small);}document.body.classList.add('portfolio-demo');}
const BOSS_WAVE=campaign?49:DEMO_BOSS,FINAL_WAVE=campaign?50:DEMO_FINAL,phaseFor=campaign?campaignPhase:demoPhase,cognitionAt=campaign?campaignCognition:demoCognition;
const progressKey=campaign?EXPEDITION_SAVE_KEY:'countermeasure.progress.v1';
try{storage.setItem('countermeasure.mode.v1',campaign?'campaign':'demo');}catch{}
document.body.classList.toggle('campaign',campaign);
for(const link of document.querySelectorAll('[data-mode]'))link.setAttribute('aria-current',String((link.dataset.mode==='campaign')===campaign));
$('mode-label').textContent=campaign?'50-WAVE CAMPAIGN':'DEMO';$('level-heading').textContent=(campaign?'Campaign':'Demo')+' · level select';
$('wave-total').textContent=campaign?'/ 50':'/ 09 + BOSSES';document.querySelector('.brand').href=campaign?'./?mode=campaign':'./?mode=demo';
import {offlineSupport} from './offline.mjs';
import {HeldControls,bindPointerControl,bindAttackControl,bindWeaponSwitch} from './controls.mjs';
import {PlayMode,LoadoutMenu,arenaView,worldAt,screenAt} from './play-mode.mjs';
import {InstallSupport} from './install.mjs';
import {SubjectRegister,NAME_COUNT} from './subjects.mjs';
let savedRegister=null;try{savedRegister=JSON.parse(storage.getItem('countermeasure.subjects.v1'));}catch{}
const register=new SubjectRegister(savedRegister),escapeArchive=new EscapeArchive(storage,register.records);let registerRevision=-1;
let selectedDifficulty='normal';try{const saved=storage.getItem('countermeasure.difficulty.v1');if(validDifficulty(saved))selectedDifficulty=saved;}catch{}
const game=new (campaign?ExpeditionArena:Arena)({register,difficulty:campaign?selectedDifficulty:'normal'}), controls=new HeldControls(),input=controls.state;
const touchUI=matchMedia('(max-width:800px), (any-pointer:coarse), (orientation:landscape) and (max-height:550px) and (max-width:1100px)');
let savedProgress=null;try{savedProgress=campaign?campaignSaveFrom(storage):storage.getItem(progressKey);}catch{}
const progress=new (campaign?CampaignStore:ProgressStore)(savedProgress),music=new Soundtrack({files:new MusicFiles(undefined,analyticsTestMode?'countermeasure-music-qa':'countermeasure-music')});game.runDeaths=progress.deaths;if(campaign&&game.runDeaths>0)game.journey.flawless=false;
if(campaign)try{const unlocked=JSON.parse(storage.getItem('countermeasure.finale.v1'));if(unlocked)progress.unlockFinale(unlocked);}catch{}
let feedback=null,feedbackWasActive=false,quickGuide=null,opening=null;
let hudText='',hudUntil=0,pointNoticeUntil=0;
function announce(text){hudText=text;hudUntil=performance.now()+3200;}
const telemetry=drillMode?{enabled:false,status:'Drill · sharing unavailable',noteInput(){},send(){},setEnabled(){}}:new Telemetry({window,document,navigator,storage:storage,onChange:text=>$('statistics-status').textContent=text});
const statistics=new Statistics({storage:storage,mode:campaign?'campaign':'demo',release:RELEASE,onEvent:(name,value)=>telemetry.send(name,value)});
let premiumAccess=null,premiumPaint=PALETTES.standard,appearance=readCharacter(storage,false,escapeArchive.unlocked);game.escapeArchive=escapeArchive;let characterMenu=null;
const options=readOptions(storage);music.setVolume(options.volume);game.overdrive=options.overdrive;
let uiState='',uiWave=-1,last=0,sound=false,lastHits=0,dialogWasPlaying=false,menuWasActive=false,progressRevision=-1,updateRegistration=null,escapeSound=0;
const icons=[`<path d="M8 27h19M17 27V14l9-8M22 6l8 7-12 5z"/>`,`<path d="m8 28 8-8M11 17l10 10M16 20 29 6l-2 12-8 6M6 26l5 5"/>`,`<path d="M7 18h15v8H7zM12 26v6M22 19h5M22 24h5M26 8l-6 7h7l-5 7"/>`,`<path d="M8 19h15v12H8zM14 19v-7h13M18 12V8h9M27 10h3M31 17v2M29 23v2"/>`];
function icon(i){return `<svg width="34" height="34" viewBox="0 0 36 36" fill="none" stroke="${WEAPONS[i].color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[i]}</svg>`;}
function beep(freq=150){if(sound)music.hit(Math.round(69+12*Math.log2(freq/440)));}
const slashGesture=new RollingSlashGesture();
const hint=id=>keyHint(options.keyboard,id),allHints=id=>keyHint(options.keyboard,id,true);
const comboEnabled=()=>options.keyboard.flipCombo&&comboCompatible(options.keyboard);
const powerInput=()=>touchUI.matches?'tap power · ↻ cycle':hint('power')+' use · '+hint('cyclePower')+' cycle';
function clearInput(){if(campaign)cancelHack(game);controls.clear();slashGesture.clear();game.player.spinQueue=0;game.cancelCharge?.();}
const weaponLabel=(i,t=game.weaponTiers[i])=>costumeWeaponName(appearance,i,t,weaponAt(i,t).name);
function renderWeapons(){
  $('weapons').innerHTML=WEAPONS.map((base,i)=>{const w=weaponAt(i,game.weaponTiers[i]),holder=weaponHolder(game,i),blocked=campaign&&!game.weaponAvailable(i);return `<div class="weapon-slot"><button class="weapon ${i===game.weapon?'selected':''}" data-weapon="${i}" ${blocked?'disabled':''} aria-pressed="${i===game.weapon}" title="${weaponLabel(i)} · ${w.name}: ${w.detail}"><div class="weapon-top"><span class="weapon-icon">${icon(i)}</span><kbd>${hint('weapon'+i)}</kbd></div><strong>${weaponLabel(i)}</strong><small>${blocked?(holder?'Lent to '+holder.name:'Recover from your cell'):weaponCopies(game,i)>1?`${weaponCopies(game,i)-loanCount(game,i)} available · ${weaponCopies(game,i)} copies`:w.short}</small></button><div class="weapon-tiers" aria-label="${base.name} upgrades">${(game.maxTier===3?[0,1,2,3]:[0,1,2]).map(t=>{const unlocked=t<=game.maxTier;return `<button data-upgrade="${i}" data-tier="${t}" aria-label="Equip ${weaponLabel(i,t)}" aria-pressed="${game.weaponTiers[i]===t}" title="${weaponLabel(i,t)} · ${weaponAt(i,t).name}${blocked?(holder?' — lent to '+holder.name:' — recover from your cell'):unlocked?'':` — unlocks wave ${campaign?(t===1?6:16):(t===1?3:5)}`}" ${unlocked&&!blocked?'':'disabled'}>${['I','II','III','IV'][t]}${unlocked?'':` · W${campaign?(t===1?6:16):(t===1?3:5)}`}</button>`;}).join('')}</div></div>`;}).join('');
  for(const b of $('touch-weapons').querySelectorAll('[data-weapon]')){const i=+b.dataset.weapon,w=weaponAt(i,game.weaponTiers[i]);const holder=weaponHolder(game,i);b.disabled=campaign&&!game.weaponAvailable(i);b.innerHTML=icon(i)+`<small>${b.disabled?(holder?'Lent · '+holder.name:'In your cell'):weaponLabel(i)}</small>`;b.setAttribute('aria-pressed',String(i===game.weapon));b.setAttribute('aria-label',`Equip ${weaponLabel(i)} · ${w.name}`);}
}
function renderModules(){if(!campaign)return;renderLateTools();$('module-options').innerHTML=MODULES.map((m,i)=>{const c=powerCue(game,i,touchUI.matches);return `<button data-module="${i}" aria-pressed="${(game.utilityKind??'power')==='power'&&game.module===i}" ${c.available?'':'disabled'} title="${c.hint}"><b>${hint('power'+i)} / ${m.name}</b><small>${c.status}${c.available?' · '+powerInput()+'<br>'+c.hint:''}</small></button>`;}).join('');
 const ultra=game.ultra,boosted=game.premiumBoosts?.armor||game.premiumBoosts?.thrusters,pending=game.premiumNext?.armor!==game.premiumBoosts?.armor||game.premiumNext?.thrusters!==game.premiumBoosts?.thrusters;
 $('equipment-summary').textContent='Earned gear · free. Mirror + Super every 10; collect each suit after the Mirror clears. '+(game.player.mechaShield<=0&&game.player.mecha?'Armor depleted; boosters still fly. ':'')+(ultra?`AP ${game.resources.ammo} · boost fuel ${Math.ceil(game.resources.fuel)}. ${touchUI.matches?'Double-tap Fly':hint('up')+' × 2'} uses finite fuel; ordinary flight does not. `:'')+(PREMIUM_CONFIG.enabled?`Optional test boosts: ${boosted?'active this encounter':'standard this encounter'}. ${pending?'Changed choices apply next encounter or retry; no refill.':'Choices apply next encounter or retry; no refill.'}`:'');}
function announcePower(){const c=powerCue(game,game.module,touchUI.matches),state=equipmentCues(game).power;announce(MODULES[game.module].name+' · '+(state.state==='active'?state.label:c.status)+' · '+powerInput());}
$('module-options').addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(b&&selectUtility(game,'power',+b.dataset.module)){announceUtility();renderModules();}});
function cyclePower(){if(!campaign)return;cycleUtility(game);announceUtility();renderModules();}
$('cycle-power').onclick=cyclePower;
$('touch-spin').onclick=()=>{if(canControl()){game.rollingSlash();canvas.focus({preventScroll:true});}};
function cycleWeapon(direction){for(let n=1;n<=4;n++){const i=(game.weapon+direction*n+8)%4;if(!campaign||game.weaponAvailable(i)){selectWeapon(i);return;}}}
function selectWeapon(i){i=(i+4)%4;if(campaign&&!game.weaponAvailable(i)){announce(weaponHolder(game,i)?'WEAPON LENT / '+weaponHolder(game,i).name:'DESK LAMP / STILL IN YOUR CELL');return false;}if(game.weapon!==i)game.cancelCharge?.();game.weapon=(i+4)%4;renderWeapons();$('build-note').textContent=game.activeWeapon.short;canvas.focus({preventScroll:true});}
$('weapons').addEventListener('click',e=>{const upgrade=e.target.closest('[data-upgrade]');if(upgrade){if(game.setTier(+upgrade.dataset.upgrade,+upgrade.dataset.tier)){selectWeapon(+upgrade.dataset.upgrade);beep(340,.05);}return;}const b=e.target.closest('[data-weapon]');if(b)selectWeapon(+b.dataset.weapon);});
bindWeaponSwitch($('touch-weapons'),selectWeapon);
renderWeapons();
function renderSkills(){const allSkills=campaign?[...SKILLS,HACK_SKILL]:SKILLS;const names=['FORCE','CIRCUIT','MOTION'];$('skills').innerHTML=names.map(branch=>`<div class="skill-branch"><div class="branch-label">${branch}</div>${allSkills.filter(s=>s.branch===branch).map(s=>{const rank=s.id==='hack'?Number(game.hackSkill):game.skills[s.id],parentBlocked=s.id==='hack'&&game.wave<11||s.parent&&!game.skills[s.parent],childBlocked=rank===1&&allSkills.some(c=>c.parent===s.id&&(c.id==='hack'?game.hackSkill:game.skills[c.id]));return `<div class="skill ${s.tier?'child':''}"><div><div class="skill-name">${s.name}</div><div class="skill-desc">${s.id==='hack'?'Level 11 · expose wiring, disable, then hold '+hint('hack')+' nearby for 2s. Up to3 allies.':s.desc}</div></div><div class="skill-controls"><button data-skill="${s.id}" data-delta="-1" aria-label="Remove point from ${s.name}" ${!rank||childBlocked?'disabled':''}>−</button><span class="skill-rank">${rank}/${s.max}</span><button data-skill="${s.id}" data-delta="1" aria-label="Add point to ${s.name}" ${parentBlocked||rank>=s.max||game.spent>=game.points?'disabled':''}>+</button></div></div>`;}).join('')}</div>`).join('');$('points').textContent=game.points-game.spent;$('spent').textContent=`${game.spent} / ${game.points} points assigned`;}
$('skills').addEventListener('click',e=>{const b=e.target.closest('[data-skill]');if(b&&game.allocate(b.dataset.skill,+b.dataset.delta)){disableAutoSkills();renderSkills();beep(240,.04);}});
$('respec').onclick=()=>{disableAutoSkills();game.respec();renderSkills();};
const loadout=new LoadoutMenu({game,controls,dialog:$('loadout-dialog'),mount:$('loadout-mount'),panels:[$('skill-panel'),$('weapons')],onChange:()=>{sync();if(!$('loadout-dialog').open)canvas.focus({preventScroll:true});}});
let playSize={width:1000,height:500},worldCamera=null;
const playMode=new PlayMode({document,onChange:active=>{clearInput();document.body.classList.toggle('play-mode',active);$('play-mode').setAttribute('aria-pressed',String(active));$('play-mode').setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');$('play-mode').textContent=active?'↙':'⛶';requestAnimationFrame(fitPlayArena);},onLeave:()=>{loadout.close({resume:false});if(['playing','escaping','traveling'].includes(game.state))pause();}});
function fitPlayArena(){if(!playMode.active)return;const host=document.querySelector('.arena-viewport'),stage=document.querySelector('.canvas-wrap'),bounds=host.getBoundingClientRect(),width=Math.min(bounds.width,bounds.height*2);playSize={width,height:bounds.height};stage.style.setProperty('--play-width',width+'px');stage.style.setProperty('--play-height',bounds.height+'px');}
function cameraView(){const view=arenaView({...playSize,playerX:game.player.x,active:playMode.active});return campaign?{...view,left:worldCamera??scrollView(game,view.width).left}:view;}
new ResizeObserver(fitPlayArena).observe(document.querySelector('.arena-viewport'));
$('play-mode').onclick=()=>playMode.active?playMode.leave():playMode.enter();
$('close-loadout').onclick=()=>loadout.close();$('resume-loadout').onclick=()=>loadout.close({resume:true});$('loadout-menu').onclick=()=>{loadout.close({resume:false});openMenu();};
function togglePauseMenu(){if(touchUI.matches||playMode.active){if($('loadout-dialog').open)loadout.close({resume:true});else loadout.open();}else pause();}
function pause(){game.pause();clearInput();if(['playing','escaping','traveling'].includes(game.state))canvas.focus({preventScroll:true});sync();}
$('pause').onclick=togglePauseMenu;$('tree-pause').onclick=togglePauseMenu;$('tree-shortcut').onclick=()=>{if(touchUI.matches||playMode.active){loadout.open();return;}if(['playing','escaping','traveling'].includes(game.state))pause();$('skill-panel').classList.remove('flash-panel');requestAnimationFrame(()=>$('skill-panel').classList.add('flash-panel'));if(innerWidth<800)$('skill-panel').scrollIntoView({behavior:'smooth',block:'start'});};
$('reset').onclick=()=>{statistics.startFrom('new_run',game);if(campaign)game.difficulty=selectedDifficulty;game.reset();if(drillMode)startSquadDrill(game);if(campaign)progress.beginRun(game.snapshot(1));else progress.setDeaths(0);clearInput();uiState='';lastHits=0;selectWeapon(0);renderSkills();sync();if($('menu-dialog').open)$('menu-dialog').close();canvas.focus({preventScroll:true});};
async function setAudio(value){sound=await music.setEnabled(value);options.audio=sound;saveOptions(storage,options);$('option-audio').checked=sound;$('sound').textContent=sound?'♫ On':'♫ Off';$('sound').setAttribute('aria-pressed',String(sound));}
$('sound').onclick=()=>setAudio(!sound);
$('option-audio').checked=options.audio;$('option-volume').value=Math.round(options.volume*100);$('volume-value').textContent=Math.round(options.volume*100)+'%';$('option-aim').checked=options.touchAim;$('release-label').textContent='RELEASE '+RELEASE;
soundtrackUI({music,options,storage,save:saveOptions,document});
function disableAutoSkills(){options.autoSkills=false;game.autoSkills=false;$('option-auto-skills').checked=false;saveOptions(storage,options);}
game.autoSkills=options.autoSkills;$('option-auto-skills').checked=options.autoSkills;$('option-auto-skills').onchange=()=>{options.autoSkills=$('option-auto-skills').checked;game.autoSkills=options.autoSkills;if(options.autoSkills)autoAllocate(game);saveOptions(storage,options);renderSkills();};
$('option-audio').onchange=()=>setAudio($('option-audio').checked);
$('option-volume').oninput=()=>{options.volume=+$('option-volume').value/100;music.setVolume(options.volume);game.overdrive=options.overdrive;$('volume-value').textContent=$('option-volume').value+'%';saveOptions(storage,options);};
$('option-aim').onchange=()=>{options.touchAim=$('option-aim').checked;game.touchAimEnabled=options.touchAim;saveOptions(storage,options);};game.touchAimEnabled=options.touchAim;
$('option-fullscreen').onclick=()=>{closeMenu();playMode.active?playMode.leave():playMode.enter();};
// Restore audio only following an ordinary user gesture, respecting browser autoplay rules.
window.addEventListener('pointerdown',e=>{if(!e.target.closest('#option-audio,#sound')&&options.audio&&!sound)setAudio(true);},{once:true});
window.addEventListener('keydown',()=>{if(options.audio&&!sound)setAudio(true);},{once:true});
function showHelp(){dialogWasPlaying=['playing','escaping','traveling'].includes(game.state);if(dialogWasPlaying)pause();$('help-dialog').showModal();clearInput();}
function closeHelp(){$('help-dialog').close();if(dialogWasPlaying&&game.state==='paused')pause();dialogWasPlaying=false;}
$('help').onclick=showHelp;$('close-help').onclick=closeHelp;$('help-done').onclick=closeHelp;$('help-dialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});
function enterArena(){if(game.state==='paused')pause();else if(game.state==='dead')game.retry();else if(game.state==='complete'){statistics.startFrom('new_run',game);game.reset();if(drillMode)startSquadDrill(game);if(campaign)progress.beginRun(game.snapshot(1));renderSkills();game.startWave();}else game.startWave();clearInput();sync();canvas.focus({preventScroll:true});beep(220,.15);}
function beginWithGuide(){if(quickGuide?.state.eligible(game)){quickGuide.open(enterArena);return;}enterArena();}
$('begin').onclick=()=>{if(!drillMode&&opening?.state.eligible(game)){opening.open(beginWithGuide);return;}beginWithGuide();};
const heldActions={left:'left',right:'right',down:'down',up:'up',attack:'attack',power:'module',tool:'tool',charge:'charge',hack:'hack'};
bindMenuShortcut({window,document,menu:$('menu-dialog'),open:openMenu,close:closeMenu,matches:e=>actionFor(options.keyboard,e.code)==='menu'});
window.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||document.querySelector('dialog[open]'))return;
 const action=actionFor(options.keyboard,e.code);
 if(action==='voice'||action?.startsWith('squad.'))return;
 if(!action)return;
 if(['Enter','NumpadEnter','Space'].includes(e.code)&&document.activeElement?.closest('button,a'))return;
 if(action==='skills'&&!['playing','escaping','traveling','paused'].includes(game.state))return;
 e.preventDefault();
 if(action==='attack'&&!['playing','escaping','traveling','paused'].includes(game.state)){if(!e.repeat)$('begin').click();return;}
 if(action==='skills'){if(!e.repeat)togglePauseMenu();return;}
 if(action==='pause'){if(!e.repeat)togglePauseMenu();return;}
 if(!canControl())return;
 if(heldActions[action])controls.hold('key:'+e.code,heldActions[action]);
 if(e.repeat)return;
 if(action==='up')game.jump();
 if(comboEnabled()&&slashGesture.press(movementComboCode(action),performance.now()))game.rollingSlash();
 if(action==='attack'){game.aimAssist=false;attackOrEnter();}
 if(action==='dash'){game.player.crouching=input.down&&game.player.grounded;game.player.facing=input.right?1:input.left?-1:game.player.facing;game.dash();}
 if(action==='flip')game.rollingSlash();
 if(action?.startsWith('weapon'))selectWeapon(+action.slice(6));
 if(action?.startsWith('power')&&action!=='power'&&campaign){if(selectUtility(game,'power',+action.slice(5)))announceUtility();renderModules();}
 if(action==='power'&&campaign){game.aimAssist=false;activateUtility(game);announceUtility();}
 if(action==='tool'&&campaign)game.useLateTool();
 if(action==='cycleTool'&&campaign)cycleTool();
 if(action==='cyclePower'&&campaign)cyclePower();
 if(action==='previousWeapon')cycleWeapon(-1);
 if(action==='nextWeapon')cycleWeapon(1);
});
window.addEventListener('keyup',e=>controls.release('key:'+e.code));
window.addEventListener('blur',()=>{clearInput();if(['playing','escaping','traveling'].includes(game.state))pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(['playing','escaping','traveling'].includes(game.state))pause();}});
window.addEventListener('orientationchange',()=>{clearInput();if(['playing','escaping','traveling'].includes(game.state))pause();});
function attackOrEnter(){if(campaign&&nearSideDoor(game))return game.enterSideRoom();return game.attack();}
const canControl=()=>['playing','escaping','traveling'].includes(game.state);
bindPointerControl(canvas,{controls,action:'attack',canStart:canControl,onCancel:()=>game.cancelCharge?.(),onPress:e=>{canvas.focus({preventScroll:true});const x=worldAt((e.clientX-canvas.getBoundingClientRect().left)/canvas.clientWidth,cameraView())-(campaign?game.roomOffset:0);game.player.facing=Math.sign(x-game.player.x)||game.player.facing;attackOrEnter();}});
bindAttackControl($('touch-attack'),{controls,canStart:canControl,canFly:()=>game.player.mecha,onJump:()=>game.jump(),onCancel:()=>game.cancelCharge?.(),onPress:()=>{game.aimAssist=options.touchAim;attackOrEnter();}});
for(const b of document.querySelectorAll('[data-hold],[data-action]'))if(b.id!=='touch-attack')bindPointerControl(b,{controls,aim:b.dataset.hold==='module',action:b.dataset.hold??b.dataset.action,canStart:canControl,onPress:()=>{if(b.dataset.hold==='left'||b.dataset.hold==='right')game.player.facing=b.dataset.hold==='left'?-1:1;if(b.dataset.hold==='up')game.jump();else if(b.dataset.hold==='attack')game.attack();else if(b.dataset.action==='dash'){game.player.crouching=input.down&&game.player.grounded;game.player.facing=input.right?1:input.left?-1:game.player.facing;game.dash();}else if(b.dataset.hold==='module'){game.aimAssist=options.touchAim;activateUtility(game);announceUtility();}}});
function persistProgress(){if(progressRevision===progress.revision)return;progressRevision=progress.revision;try{storage.setItem(progressKey,progress.export());if(campaign&&progress.finale)storage.setItem('countermeasure.finale.v1',JSON.stringify(progress.finale));$('save-status').textContent='Saved in this browser';}catch{$('save-status').textContent='Session only · export to keep';}}
function difficultyHint(){const p=profileFor(selectedDifficulty);$('difficulty-hint').textContent=`${p.health} HP · ${p.fuel} fuel · ${p.ammo} AP · Robot friendly fire ${Math.round(p.friendlyFire*100)}%`+(selectedDifficulty==='terminator'?' · NO REGEN · ULTRA L10':'');}
$('difficulty-panel').hidden=!campaign;$('difficulty').value=selectedDifficulty;difficultyHint();
$('difficulty').onchange=()=>{selectedDifficulty=$('difficulty').value;try{storage.setItem('countermeasure.difficulty.v1',selectedDifficulty);}catch{}difficultyHint();$('apply-difficulty').disabled=!canRetune()||selectedDifficulty===game.difficulty;};
$('apply-difficulty').onclick=()=>{statistics.startFrom('difficulty_change',game);const c=game.snapshot();c.carry={hp:game.player.hp,shield:game.player.mechaShield};const adjusted=retuneCheckpoint(c,selectedDifficulty);if(adjusted&&game.resume(adjusted,game.runDeaths)){$('menu-dialog').close();clearInput();expeditionKey='';sync();canvas.focus({preventScroll:true});}};
$('replay-finale').onclick=()=>{statistics.startFrom('finale_replay',game);const saved=progress.finaleFor(selectedDifficulty);if(saved&&game.resume(saved,0)){progress.setDeaths(0);$('menu-dialog').close();clearInput();expeditionKey='';selectWeapon(game.weapon);sync();}};
const canRetune=()=>campaign&&game.wave>0&&game.player.hp>0&&(game.state==='playing'||game.state==='paused'&&game.pausedFrom==='playing');
function renderMenu(){if(storage.sessionOnly)$('save-status').textContent='Session only · export a player backup before closing';$('current-run').textContent=(drillMode?'SQUAD DRILL / UNSAVED':campaign?'CAMPAIGN · '+profileFor(game.difficulty).name.toUpperCase():'DEMO')+' · LEVEL '+Math.max(1,game.wave)+(campaign?' · MIRROR + SUPERBOSS EVERY 10':'');$('apply-difficulty').disabled=!canRetune()||selectedDifficulty===game.difficulty;if(campaign)$('replay-finale').hidden=!progress.finale;const grid=$('level-select');grid.replaceChildren();for(let wave=1;wave<=FINAL_WAVE;wave++){const b=document.createElement('button');b.textContent=campaign?(wave%10===0?wave+' / B+S':String(wave).padStart(2,'0')):wave===BOSS_WAVE?'MIRROR':wave===FINAL_WAVE?'EMP':String(wave).padStart(2,'0');b.disabled=wave!==1&&!progress.entries.has(wave);b.setAttribute('aria-label',`Start saved level ${wave}`);if(campaign&&progress.get(wave))b.title=profileFor(progress.get(wave).difficulty).name;b.onclick=()=>{statistics.startFrom('level_select',game);const saved=progress.get(wave);if(saved)game.resume(campaign&&wave%10===0?retuneCheckpoint(saved,saved.difficulty,{mirror:true}):saved,progress.deaths);else{game.reset();game.startWave();progress.setDeaths(0);}$('menu-dialog').close();clearInput();uiState='';selectWeapon(game.weapon);sync();};grid.append(b);}$('continue-run').disabled=!progress.entries.size;}
function openMenu(){menuWasActive=['playing','escaping','traveling'].includes(game.state);if(menuWasActive)pause();clearInput();renderMenu();$('menu-dialog').showModal();}
function closeMenu(){$('menu-dialog').close();if(menuWasActive&&game.state==='paused')pause();menuWasActive=false;}
$('about-game').onclick=()=>{$('menu-dialog').close();clearInput();$('about-dialog').showModal();};
function closeAbout(){$('about-dialog').close();$('menu-dialog').showModal();}
$('close-about').onclick=closeAbout;$('about-done').onclick=closeAbout;$('about-dialog').addEventListener('cancel',e=>{e.preventDefault();closeAbout();});
function showStatistics(){renderStatistics($('statistics-content'),statistics.attempts,{mode:$('statistics-mode').value,difficulty:$('statistics-difficulty').value,loadout:$('statistics-loadout').value});$('statistics-sharing').checked=telemetry.enabled;$('statistics-status').textContent=telemetry.status;}
$('statistics-menu').onclick=()=>{$('menu-dialog').close();clearInput();showStatistics();$('statistics-dialog').showModal();};
function closeStatistics(){$('statistics-dialog').close();$('menu-dialog').showModal();}
$('close-statistics').onclick=closeStatistics;$('statistics-done').onclick=closeStatistics;$('statistics-dialog').addEventListener('cancel',e=>{e.preventDefault();closeStatistics();});
$('statistics-mode').onchange=showStatistics;$('statistics-difficulty').onchange=showStatistics;$('statistics-loadout').onchange=showStatistics;
$('statistics-sharing').onchange=()=>telemetry.setEnabled(!PREMIUM_CONFIG.enabled&&$('statistics-sharing').checked);if(PREMIUM_CONFIG.enabled||drillMode){telemetry.setEnabled(false);$('statistics-sharing').disabled=true;}
$('statistics-clear').onclick=()=>{statistics.clear();showStatistics();};
$('statistics-export').onclick=()=>{const url=URL.createObjectURL(new Blob([statistics.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='countermeasure-statistics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('keydown',()=>telemetry.noteInput('keyboard'));
window.addEventListener('pointerdown',e=>telemetry.noteInput(e.pointerType==='touch'?'touch':'mouse'));
window.addEventListener('pagehide',()=>statistics.startFrom('resume',game));
window.addEventListener('pageshow',e=>{if(e.persisted){statistics.lastStats=null;statistics.source='resume';}});
window.addEventListener('storage',e=>{if(e.key==='countermeasure.sharing.v1')showStatistics();});
$('help-menu').onclick=()=>{$('menu-dialog').close();showHelp();};$('menu').onclick=openMenu;$('touch-menu').onclick=openMenu;$('close-menu').onclick=closeMenu;$('menu-dialog').addEventListener('cancel',e=>{e.preventDefault();closeMenu();});
$('continue-run').onclick=()=>{statistics.startFrom('resume',game);const saved=progress.get(progress.latest);if(saved&&game.resume(saved,progress.deaths)){$('menu-dialog').close();clearInput();uiState='';selectWeapon(game.weapon);sync();}};
$('export-save').onclick=()=>{const url=URL.createObjectURL(new Blob([progress.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=campaign?'countermeasure-campaign-save.json':'countermeasure-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import-save').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>(campaign?600000:150000))throw Error();progress.import(await file.text());game.runDeaths=progress.deaths;if(campaign&&game.runDeaths>0)game.journey.flawless=false;persistProgress();renderMenu();$('save-status').textContent='Save imported';}catch{$('save-status').textContent=campaign?'Use a valid Campaign save':'Use a valid Demo save';}event.target.value='';};
function activateUpdate(){if(updateRegistration?.waiting){navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});updateRegistration.waiting.postMessage('ACTIVATE_UPDATE');}}
$('update-game').onclick=activateUpdate;$('update-banner').onclick=()=>{openMenu();};
const installation=new InstallSupport({window,navigator,document,onChange:state=>{$('install-game').disabled=state.installed||state.busy;$('install-game').textContent=state.installed?'Installed ✓':state.busy?'Installing…':'Install game ↓';$('install-summary').textContent=state.installed?'Home screen app':state.accepted?'Open from your Home Screen':state.available?'Ready to install':'Home screen · offline';},onLaunch:()=>playMode.enter({requestNative:false})});
$('install-game').onclick=async()=>{const outcome=await installation.install();if(outcome==='manual')$('install-dialog').showModal();};
$('close-install').onclick=()=>$('install-dialog').close();$('install-done').onclick=()=>$('install-dialog').close();
offlineSupport(text=>$('offline-status').textContent=text,reg=>{updateRegistration=reg;$('update-game').hidden=false;$('update-banner').hidden=false;});
function syncRegister(){if(registerRevision===register.revision)return;registerRevision=register.revision;try{storage.setItem('countermeasure.subjects.v1',JSON.stringify(register.snapshot()));}catch{}const person=game.subject;$('subject-name').textContent=characterName(appearance,person.name);$('subject-id').textContent=person.id;$('subject-story').textContent='';const deaths=register.records.filter(r=>r.status==='terminated').length;$('register-count').textContent=`${deaths} ${deaths===1?'casualty':'casualties'} on record ↗`;const list=$('subject-records');list.replaceChildren();for(const record of register.records.slice().reverse()){const item=document.createElement('li'),name=document.createElement('strong'),meta=document.createElement('span'),line=document.createElement('p');name.textContent=record.name;meta.textContent=`${record.id} · ${record.status.toUpperCase()} · ${record.wave===FINAL_WAVE?'EMERGENCY':record.wave===BOSS_WAVE?'MIRROR':`WAVE ${record.wave}`} · ${record.cause}`;line.textContent=record.epitaph;item.append(name,meta,line);list.append(item);}if(!register.records.length){const item=document.createElement('li');item.textContent='No prior subjects on this terminal. The empty roster is not a promise.';list.append(item);}$('name-pool-count').textContent=NAME_COUNT.toLocaleString();}
$('register-count').onclick=()=>{dialogWasPlaying=['playing','escaping','traveling'].includes(game.state);if(dialogWasPlaying)pause();$('records-dialog').showModal();clearInput();};
function closeRecords(){$('records-dialog').close();if(dialogWasPlaying&&game.state==='paused')pause();dialogWasPlaying=false;}
$('close-records').onclick=closeRecords;$('records-done').onclick=closeRecords;$('records-dialog').addEventListener('cancel',e=>{e.preventDefault();closeRecords();});
function incoming(){const counts={};for(const type of game.plan.units)counts[type]=(counts[type]||0)+1;return Object.entries(counts).map(([type,n])=>`<span class="bot-tag" style="color:${TYPES[type].color}">${n} × ${TYPES[type].name}</span>`).join('')+(game.plan.boots?'<span class="bot-tag">RUBBER BOOTS / SELECTED UNITS</span>':'');}
$('side-door-button').onclick=()=>{if(game.enterSideRoom()){clearInput();expeditionKey='';sync();}};
$('rescue-button').onclick=()=>{const d=rescueTarget(game,{near:true});if(!d)return;if(d.survivor&&game.companions.filter(a=>a.hp>0).length>=3){loadout.open();return;}const index=rescueWeapon(game,d);if(index===null)return;game.player.facing=Math.sign(d.x-game.player.x)||game.player.facing;selectWeapon(index);game.attack();sync();};
$('pilot-dialog').addEventListener('cancel',e=>e.preventDefault());
// Holding Attack through the reveal must not choose mercy through key auto-repeat.
$('pilot-dialog').addEventListener('keydown',e=>{if(e.repeat&&['Enter','NumpadEnter','Space'].includes(e.code))e.preventDefault();});
for(const [id,mercy] of [['pilot-yes',true],['pilot-no',false]])$(id).onclick=()=>{if(game.choosePilot(mercy)){$('pilot-dialog').close();clearInput();canvas.focus({preventScroll:true});sync();}};
$('emergency-switch').onclick=()=>{game.pressEmergency();canvas.focus({preventScroll:true});sync();};
function sync(){
  if(campaign&&game.state==='pilot-choice'&&game.finalPilot?.age>=1&&!$('pilot-dialog').open){clearInput();$('pilot-dialog').showModal();}
  const escaped=escapeArchive.observe(game,appearance);if(escaped.unlocked){characterMenu?.refresh();announce('THOMAS A. ANDERSON / CHARACTER UNLOCKED');}
  statistics.observe(game);feedback?.observe();
  if(campaign){syncExpedition();return;}
  if(game.autoUpgrade()){if(game.state==='playing')game.entryCheckpoint=game.snapshot();renderWeapons();}
  syncSkillAlert();
  const p=game.player,finale=game.wave===FINAL_WAVE,cognition=cognitionAt(Math.max(1,game.wave)),e=game.emergency;
  $('cognition-state').textContent=finale?'OVERSEER / all weapon counters · jump pursuit · no flight':game.wave===BOSS_WAVE?'MIRROR COGNITION / copied build & habits · 0.20s reaction':`COGNITION / ${cognition.reaction.toFixed(2)}s reaction · ${cognition.speed.toFixed(2)}× movement${cognition.discipline?' · fire discipline':''}`;
  $('resume-loadout').textContent=game.state==='paused'?'Resume ↗':'Back to arena ↗';
  $('touch-wave').textContent=finale?'EMP':game.wave===BOSS_WAVE?'MIRROR':`W${String(Math.max(1,game.wave)).padStart(2,'0')}`;
  $('touch-fly').textContent=p.mecha?'Fly ↑':'Jump ↑';$('touch-fly').setAttribute('aria-label',p.mecha?'Hold to fly':'Jump');$('touch-attack').textContent=game.nearEmergency()&&!e?.activated?'USE':p.mecha?'Attack ↑ fly':'Attack ↑ jump';$('touch-attack').setAttribute('aria-label',game.nearEmergency()&&!e?.activated?'Activate emergency button':p.mecha?'Attack; drag up to fly':'Attack; drag up to jump');
  if(campaign){const module=MODULES[game.module],cd=game.moduleCooldowns[game.module];$('mech-power').hidden=!p.mecha;$('mech-power').textContent=module.name+(cd>0?' · '+cd.toFixed(1)+'s':' · '+hint('power'));$('mech-power').setAttribute('aria-label','Use '+module.name);$('mech-power').classList.toggle('ready',cd===0);}
  syncRegister();progress.setDeaths(game.runDeaths);persistProgress();const currentPhase=finale?4:Math.min(3,Math.floor(Math.max(0,game.wave-1)/3));
  for(const el of document.querySelectorAll('[data-phase]')){const phase=+el.dataset.phase;el.classList.toggle('active',phase===currentPhase);el.classList.toggle('done',phase<currentPhase);if(!campaign&&phase===4)el.textContent=game.plan.wave===FINAL_WAVE||finale?'11 / EMERGENCY':'?? / UNKNOWN';}
  const boss=game.robots.find(r=>r.type==='mirror'||r.type==='overseer');$('mirror-hud').hidden=!boss||game.state==='complete'||!!game.escape;
  if(boss){const secret=boss.type==='overseer';$('mirror-owner').textContent=secret?(boss.disabled?'OVERSEER / CORE EXPOSED':'OVERSEER / COUNTERS ONLINE'):'MIRROR / '+(boss.build.subject?.name??'COPIED BUILD');$('mirror-hp').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';$('mirror-health').textContent=`${Math.max(0,Math.ceil(boss.hp))} / ${boss.maxHp}`;$('mirror-style').textContent=secret?(boss.disabled?'DESTROY BEFORE BACKUP REROUTES':'EVERY TOOL COUNTERED · FIND THE RED BUTTON'):game.mirrorWeapon(boss).name+' / '+(boss.build.style.farRatio>.62?'RANGED HABITS':'CLOSE-RANGE HABITS');}
  const drop=game.mechaDrop;$('boss-message').textContent=game.escape?'←':finale?(e?.activated?'↓ ⚔':touchUI.matches?'HOLD FLY ↑':'W ↑'):game.wave===BOSS_WAVE?(p.mecha?`MECHA ONLINE · ARMOR ${Math.ceil(p.mechaShield)} · ${touchUI.matches?'HOLD FLY':'HOLD W TO FLY'}`:drop?(drop.landed?'MECHA READY · WALK INTO THE CENTER POD':'MECHA INBOUND · CENTER ARENA'):'MIRROR PROTOCOL · BREAK YOUR OWN HABITS'):'';
  $('mecha-state').textContent=p.mecha?`${p.mechaShield>0?(campaign?'MECH '+game.mechTier:'MECHA')+' ARMOR '+Math.ceil(p.mechaShield)+' / '+(campaign?game.armorCapacity:60):'NO ARMOR · BOOSTERS ONLY'} · ${touchUI.matches?'HOLD FLY':'W FLY'}`:'';
  const view=cameraView(),switchX=e?screenAt(e.x,view):.9;
  $('camera-left').hidden=!playMode.active||!(game.robots.some(r=>r.hp>0&&r.x<view.left)||game.escape&&view.left>20);$('camera-right').hidden=!playMode.active||!(game.robots.some(r=>r.hp>0&&r.x>view.left+view.width)||e&&!e.activated&&switchX>1);
  $('emergency-switch').style.left=switchX*100+'%';$('emergency-switch').style.width=playMode.active?54/view.width*100+'%':'';
  const activeFinale=finale&&game.state!=='complete'&&!game.escape;$('emergency-switch').hidden=!activeFinale||switchX<0||switchX>1;$('emergency-switch').disabled=game.state!=='playing'||!game.nearEmergency()||!!e?.activated;$('emergency-switch').textContent=e?.activated?'OFF':'●';$('emergency-switch').setAttribute('aria-label',e?.activated?'Emergency button spent':'DO NOT PRESS');$('emergency-switch').classList.toggle('spent',!!e?.activated);
  $('finale-objective').hidden=!activeFinale;$('finale-objective').textContent=e?.activated?'↓ ⚔':'W ↑';$('backup-time').hidden=!activeFinale||!e?.activated;$('backup-time').textContent=e?.activated?`↻ ${e.backup.toFixed(1)}s`:'';
  $('health-value').textContent=Math.ceil(p.hp);$('health-fill').style.width=p.hp/(game.maxHealth??100)*100+'%';$('health-fill').style.background=p.hp<30?'#f07f66':'#b7e77a';$('dash-state').textContent=p.dashCd>0?`DASH ${p.dashCd.toFixed(1)}s`:'DASH READY';$('enemy-count').textContent=game.state==='playing'?(finale?'EMERGENCY PROTOCOL':game.wave===BOSS_WAVE?'MIRROR DUEL':game.robots.filter(r=>r.hp>0).length+' UNITS REMAINING'):'ARENA 01 / THE FACTORY';
  const standing=game.pools.filter(pool=>game.poolAt(p,pool));$('ground-state').textContent=standing.length?(standing.some(pool=>pool.charged>0)?'LIVE POOL — GET CLEAR':standing.some(pool=>pool.corrosive)?(standing.some(pool=>pool.fluid===2)?'ACID UNDERFOOT — MOVE!':'CHEMICAL UNDERFOOT — MOVE!'):'WET GROUND — TASER HAZARD'):'';
  if(uiState===game.state&&uiWave===game.wave)return;if(!canControl())clearInput();uiState=game.state;uiWave=game.wave;
  $('wave-display').textContent=finale?'EMP':game.wave===BOSS_WAVE?'BOSS':String(game.wave).padStart(2,'0');$('state-label').textContent=({briefing:'AWAITING HUMAN',playing:phaseFor(game.wave).toUpperCase(),between:'FACTORY ADAPTING',paused:'SIMULATION PAUSED',dead:'HUMAN OFFLINE',escaping:'← EXIT',complete:'ESCAPED'})[game.state];$('pause').innerHTML=(game.state==='paused'?'Resume':'Pause')+' <kbd>'+hint('pause')+'</kbd>';$('tree-pause').textContent=game.state==='paused'?'Resume combat ↗':'Pause to rewire ↗';$('overlay').classList.toggle('hidden',['playing','escaping','traveling'].includes(game.state));
  const nextFinale=game.state==='between'&&game.plan.wave===FINAL_WAVE,nextMirror=game.state==='between'&&game.plan.wave===BOSS_WAVE;
  const titles={briefing:`TRIAL ${String(game.trial).padStart(3,'0')}`,between:`WAVE ${String(game.plan.wave).padStart(2,'0')}`,paused:'PAUSED',dead:'NEXT HUMAN',complete:'ESCAPED.'};
  $('brief-title').textContent=nextFinale?'ONE MORE.':nextMirror?'MIRROR':titles[game.state]??'';
  $('brief-kicker').textContent=game.state==='dead'?game.subject.name:game.state==='complete'?'FACTORY OFFLINE':nextFinale?'UNREGISTERED MACHINE':phaseFor(Math.max(1,game.wave)).toUpperCase();
  $('brief-description').textContent='';$('incoming').innerHTML=['briefing','between','dead'].includes(game.state)?incoming():'';
  $('begin').innerHTML=(game.state==='briefing'?'Enter':nextFinale?'Continue':nextMirror?'Face Mirror':game.state==='between'?'Next wave':game.state==='paused'?'Resume':game.state==='dead'?'Retry':'Again')+' <span>↗</span>';
  $('brief-hint').textContent=nextFinale?(touchUI.matches?'HOLD FLY ↑':'W ↑'):game.state==='paused'?'P / resume':game.state==='dead'?`TRIAL ${String(game.trial).padStart(3,'0')}`:'';
  if(campaign&&['briefing','between'].includes(game.state)){$('brief-kicker').textContent=game.plan.title.toUpperCase();$('brief-hint').textContent=game.plan.dark?'◉ LIGHTS OUT':game.plan.wave%10===0?'↓ MECH '+game.plan.wave/10:'50-WAVE CAMPAIGN';}
  if(game.state==='playing'&&game.entryCheckpoint)progress.save(game.entryCheckpoint);else if(game.state==='between')progress.save(game.snapshot(game.plan.wave));else if(campaign&&game.state==='dead')progress.save(game.snapshot());persistProgress();
  if(game.memory.waves||campaign&&game.memory.attempts){$('intel-title').textContent=game.state==='complete'?'Experiment complete. The data is yours.':`Your habits became a blueprint.`;$('intel-copy').textContent=`${campaign?game.memory.attempts:game.memory.waves} ${campaign?'attempts':'completed waves'} analyzed. Recent behavior carries more weight; change your tactics to change its response.`;$('observed').textContent=game.plan.observations.join(' ');$('counter').textContent=game.plan.adaptation;$('counter-weakness').textContent=game.plan.flaw;$('learn-state').textContent=`${game.plan.sampleAttacks} ATTACKS OBSERVED / UPDATED BETWEEN WAVES`;$('weapon-meter').innerHTML=game.memory.weapon.map((v,i)=>`<div style="width:${v*100}%;background:${WEAPONS[i].color}" title="${WEAPONS[i].name}: ${Math.round(v*100)}%"></div>`).join('');$('weapon-meter').setAttribute('aria-label',game.memory.weapon.map((v,i)=>`${WEAPONS[i].name} ${Math.round(v*100)}%`).join(', '));}else{$('intel-title').textContent='The machine is watching.';$('intel-copy').textContent='Learning starts with your first fight. Enemy hardware is locked during a wave.';$('observed').textContent='Awaiting a useful sample of human violence.';$('counter').textContent='Calibration unit';$('counter-weakness').textContent='No armor. No strategy. Unreasonable confidence.';$('learn-state').textContent='NO COMBAT DATA';$('weapon-meter').innerHTML='';}renderSkills();renderWeapons();renderModules();
}
let lastPoints=-1,expeditionKey='',knownPowerCount=0;
function syncSkillAlert(){
 const remaining=game.points-game.spent,b=$('skill-alert');if(lastPoints<0||game.points>lastPoints){pointNoticeUntil=performance.now()+4000;}b.hidden=remaining<=0||performance.now()>pointNoticeUntil;b.textContent=remaining+' UNSPENT · REWIRE';$('tree-shortcut').textContent='Skills'+(remaining>0?' · '+remaining:'');b.setAttribute('aria-label','Spend '+remaining+' skill points');
 if(game.points<lastPoints)lastPoints=game.points;
 if(game.points>lastPoints){if(lastPoints>=0&&remaining>0){$('reward-live').textContent='New skill points available';b.classList.remove('new-points');requestAnimationFrame(()=>b.classList.add('new-points'));}lastPoints=game.points;}
 if(remaining<=0)$('reward-live').textContent='';
}
$('skill-alert').onclick=()=>loadout.open();
function syncExpedition(){
 const p=game.player,e=game.emergency,superFight=game.encounter==='super',hidden=game.ultimate,ultra=game.ultra;
 const upgraded=game.autoUpgrade();
 const earned=MODULES.filter((_,i)=>powerCue(game,i).available).length;if(earned>knownPowerCount&&p.mecha)announce(`MECH ${game.mechTier} · ${earned} EARNED POWERS · ${touchUI.matches?'Skills to inspect':hint('skills')+' to inspect'}`);knownPowerCount=earned;
 syncSkillAlert();syncRegister();progress.setDeaths(game.runDeaths);persistProgress();document.body.classList.toggle('ultimate',ultra);
 $('touch-wave').textContent=(drillMode?'DRILL · ':'')+'L'+String(Math.max(1,game.wave)).padStart(2,'0')+(hidden?' / ???':superFight?' / SUPER':game.encounter==='boss'?' / MIRROR':'')+' · '+game.profile.name.toUpperCase();
 $('touch-fly').textContent=ultra?'Fly ↑ · '+Math.ceil(game.resources.fuel):p.mecha?'Fly ↑':'Jump ↑';$('touch-fly').setAttribute('aria-label',p.mecha?'Hold to fly':'Jump');
 $('side-door-button').hidden=!nearSideDoor(game);const rescueNear=nearRescue(game);$('rescue-button').hidden=!rescueNear;$('rescue-button').textContent=game.companions.filter(a=>a.hp>0).length>=3&&rescueTarget(game,{near:true})?.survivor?'Squad full · Skills':'Break lock';
 const sideNear=nearSideDoor(game),near=game.nearEmergency()&&!e?.activated;$('touch-attack').textContent=sideNear?'ENTER':near?'USE':p.mecha?'Attack ↑ fly':'Attack ↑ jump';$('touch-attack').setAttribute('aria-label',near?'Activate emergency button':p.mecha?'Attack; drag up to fly':'Attack; drag up to jump');
 const equipment=syncLateTools();syncResourceRail();const power=MODULES[game.module],cd=game.moduleCooldowns[game.module]??0;
 $('power-group').hidden=!p.mecha||!canControl();$('mech-power').hidden=!p.mecha;syncLateTools();
 for(const b of $('touch-weapons').querySelectorAll('[data-weapon="2"]')){const locked=game.resources.electricLock>0;b.classList.toggle('locked',locked);b.querySelector('small').textContent=locked?'REBOOT '+game.resources.electricLock.toFixed(1)+'s':!game.weaponAvailable(2)?'Lent · '+weaponHolder(game,2).name:weaponAt(2,game.weaponTiers[2]).name;}
 $('ultimate-resources').hidden=!ultra;$('ultimate-resources').textContent=ultra?`FUEL ${Math.ceil(game.resources.fuel)} · AP ${game.resources.ammo}`+(game.resources.electricLock>0?` · CIRCUIT ${game.resources.electricLock.toFixed(1)}s`:' · '+(touchUI.matches?'Fly':hint('up'))+'×2 BOOST'):'';
 $('health-value').textContent=Math.ceil(p.hp);$('health-fill').style.width=p.hp/(game.maxHealth??100)*100+'%';$('health-fill').style.background=p.hp<30?'#f07f66':'#b7e77a';$('dash-state').textContent=p.dashCd>0?'DASH '+p.dashCd.toFixed(1)+'s':'DASH READY';if(game.premiumBoosts?.armor||game.premiumBoosts?.thrusters)$('dash-state').textContent+=' · BOOSTED';$('mecha-state').textContent=p.mecha?`${p.mechaShield>0?(ultra?'ULTRA ARMOR':'MECH '+game.mechTier)+' '+Math.ceil(p.mechaShield)+' / '+game.armorCapacity:'NO ARMOR · BOOSTERS ONLY'}`:'';
 const standing=game.pools.filter(pool=>game.poolAt(p,pool));$('ground-state').textContent=standing.length?(standing.some(pool=>pool.charged>0)?'LIVE FLOOR ↑':standing.some(pool=>pool.corrosive)?'ACID ↑':'WET FLOOR'):'';
 const cores=game.robots.filter(r=>r.hp>0&&(r.super||r.type==='mirror'||r.humanPilot)),totalHP=cores.reduce((n,r)=>n+r.hp,0),totalMax=cores.reduce((n,r)=>n+r.maxHp,0);$('mirror-hud').hidden=!cores.length||!!game.escape;
 if(cores.length){$('mirror-owner').textContent=cores[0].humanPilot?'THE OTHER SURVIVOR':hidden?`${cores.length} SYNC CORES`:superFight?'SUPERBOSS '+game.wave/10:'MIRROR '+game.wave/10;$('mirror-health').textContent=Math.ceil(totalHP)+' / '+Math.ceil(totalMax);$('mirror-hp').style.width=totalHP/totalMax*100+'%';$('mirror-style').textContent=cores[0].humanPilot?'HUMAN · FRAGILE · SLOW THE TEMPO':superFight?(e?.rerouted?'BACKUP POWER · SHIELDS REDUCED':'RESISTANT · CRITS CAN PENETRATE'):hidden?'EMP / RADIO / ELECTRIC':'COPIED BUILD · '+WEAPONS[cores[0].build?.weapon??0].name.toUpperCase();}
 const wall=game.robots.find(r=>r.type==='buttonGuard'&&r.hp>0),antenna=game.robots.find(r=>r.type==='antenna'&&r.hp>0),reboot=Math.max(0,...cores.map(r=>r.emp??0));
 $('objective-hud').textContent=game.escape?'← EXIT':game.finalPilot?.phase==='hostile'?'SURVIVOR / SLOW THE TEMPO':game.state==='pilot-choice'?'PILOT EJECTED':game.state==='traveling'?'CHAMBER CLEAR →':hidden?'EMP / RADIO / ELECTRIC':superFight?e?.rerouted?'BACKUP · SHIELDS LOW':reboot>0?'REBOOT '+reboot.toFixed(1)+'s':e?.activated?'BACKUP IN '+e.backup.toFixed(1)+'s':antenna?'⌁ SYNC ANTENNA':wall?'BUTTON ARMORED':'↑ DO NOT PRESS':'';
 const activeLaser=cores.find(r=>r.laser?.phase==='charge'||r.laser?.phase==='blast')??cores.find(r=>r.laser?.phase==='recharge');if(activeLaser&&game.state==='playing'){const beam=activeLaser.laser;$('objective-hud').textContent=beam.phase==='recharge'?(beam.feedback?'CORE FEEDBACK · ':'CORE VENTING · ')+beam.time.toFixed(1)+'s':beam.phase==='charge'?'LASER LOCKED · MOVE':'LASER FIRING';}
 const event=game.events.at(-1);$('reward-notice').textContent=performance.now()<hudUntil?hudText:event?.time>0?event.text:'';
 const view=cameraView(),offset=game.roomOffset,switchX=e?screenAt(offset+e.x,view):.9;
 $('emergency-switch').style.left=switchX*100+'%';$('emergency-switch').style.width=54/view.width*100+'%';$('emergency-switch').hidden=!superFight||!e||!!wall||!!game.escape||switchX<0||switchX>1;$('emergency-switch').disabled=game.state!=='playing'||!near;$('emergency-switch').textContent=e?.activated?'OFF':'●';$('emergency-switch').setAttribute('aria-label',e?.activated?'Emergency button spent':'DO NOT PRESS');$('emergency-switch').classList.toggle('spent',!!e?.activated);
 $('backup-time').hidden=!superFight||!e?.activated||!!e?.rerouted;$('backup-time').textContent=e?.activated?'↻ '+e.backup.toFixed(1)+'s':'';$('finale-objective').hidden=true;
 const supportWarning=game.bossSupport?.warning,warnLeft=supportWarning?.xs.some(x=>x+offset<view.left),warnRight=supportWarning?.xs.some(x=>x+offset>view.left+view.width),supportIcon=SUPPORT_ICONS[supportWarning?.reason]??'';
 $('camera-left').hidden=!(warnLeft||playMode.active&&game.robots.some(r=>r.hp>0&&r.x+offset<view.left));$('camera-right').hidden=!(warnRight||playMode.active&&(game.robots.some(r=>r.hp>0&&r.x+offset>view.left+view.width)||game.state==='traveling'));$('camera-left').classList.toggle('incoming',!!warnLeft);$('camera-right').classList.toggle('incoming',!!warnRight);
 $('camera-left').textContent=(warnLeft?supportIcon:'')+'‹';$('camera-right').textContent=(warnRight?supportIcon:'')+'›';$('camera-left').setAttribute('aria-label',warnLeft?`${supportWarning.reason} support incoming from the left`:'Activity to the left');$('camera-right').setAttribute('aria-label',warnRight?`${supportWarning.reason} support incoming from the right`:'Activity to the right');
 $('boss-message').textContent=game.escape?'←':game.state==='traveling'?'→':'';
 $('enemy-count').textContent=game.robots.filter(r=>r.hp>0&&!r.structure).length+' ACTIVE · '+((game.deployments??[]).reduce((n,d)=>n+d.units.length,0)+(game.deploymentWarning?.units.length??0)+(game.bossSupport?.warning?.units.length??0))+' INBOUND';
 const key=[game.state,game.wave,game.encounter,game.mechTier,game.unlockedTier,game.difficulty,game.rescuedRooms.length,game.supplyRevision,game.inventoryRevision].join(':');if(key===expeditionKey&&!upgraded)return;expeditionKey=key;if(!canControl())clearInput();
 $('wave-display').textContent=String(game.wave).padStart(2,'0');$('state-label').textContent=game.state==='playing'?game.plan.phase.toUpperCase():({traveling:'CHAMBER CLEAR →',paused:'SIMULATION PAUSED',dead:'HUMAN OFFLINE',complete:'ESCAPED',escaping:'← EXIT',briefing:'AWAITING HUMAN'})[game.state]??'';
 $('pause').innerHTML=(game.state==='paused'?'Resume':'Pause')+' <kbd>'+hint('pause')+'</kbd>';$('resume-loadout').textContent=game.state==='paused'?'Resume ↗':'Back to arena ↗';
 $('overlay').classList.toggle('hidden',['playing','traveling','escaping','pilot-choice'].includes(game.state));$('brief-title').textContent=game.state==='dead'?'NEXT HUMAN':game.state==='complete'?'ESCAPED.':game.state==='paused'?'PAUSED':`TRIAL ${String(game.trial).padStart(3,'0')}`;$('brief-kicker').textContent=game.plan.title.toUpperCase();$('brief-description').textContent='';$('incoming').innerHTML=['briefing','dead'].includes(game.state)?incoming():'';$('begin').innerHTML=(game.state==='dead'?'Retry':game.state==='paused'?'Resume':game.state==='complete'?'Again':'Enter')+' <span>↗</span>';$('brief-hint').textContent=game.state==='briefing'?'50 LEVELS · BOSSES EVERY 10':'';
 if(game.state==='playing'&&game.entryCheckpoint)progress.save(game.entryCheckpoint);else if(game.state==='traveling')progress.save(game.nextCheckpoint());else if(game.state==='dead')progress.save(game.snapshot());persistProgress();
 $('intel-title').textContent=game.plan.title;$('intel-copy').textContent=game.wave>=21?'The factory discovered the receiver. Watch the machines for evidence of its next strategy.':game.plan.reason;$('observed').textContent=learningReport(game.wave,game.memory);$('counter').textContent=learningBroadcast(game.wave,game.memory,game.plan);$('counter-weakness').textContent=game.wave>=21?'Transmission lost. Observe how the machines move and react.':game.plan.flaw;$('learn-state').textContent=game.memory.attempts+' ATTEMPTS ANALYZED';renderSkills();renderWeapons();renderModules();
}
function line(x,y,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function text(t,x,y,size=12,color='#9ba990',align='left'){ctx.fillStyle=color;ctx.font=`${size}px ui-monospace,monospace`;ctx.textAlign=align;ctx.fillText(t,x,y);}
function background(t,preview=true){rect(0,0,1000,500,'#141d18');const g=ctx.createLinearGradient(0,0,0,430);g.addColorStop(0,'#1d2a22');g.addColorStop(1,'#111a15');ctx.fillStyle=g;ctx.fillRect(0,0,1000,420);
  for(let x=25;x<1000;x+=95){rect(x,0,3,420,'#26372b');rect(x+3,0,8,420,'#19241d');line(x,110,x+95,110,'#25352a');line(x,278,x+95,278,'#233126');}
  rect(365,75,270,282,'#121b15');line(365,75,635,75,'#354630',3);for(let x=375;x<635;x+=14)line(x,84,x,348,'#1b2b20');text(String(game.trial).padStart(3,'0'),500,246,126,'#27392a','center');text('H U M A N   T R I A L',500,290,10,'#4b6048','center');
  for(const x of [160,820]){line(x,0,x,68,'#516044',2);rect(x-30,64,60,8,'#849171');const g=ctx.createLinearGradient(0,72,0,400);g.addColorStop(0,'#b7e77a0d');g.addColorStop(1,'#b7e77a00');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-28,72);ctx.lineTo(x+28,72);ctx.lineTo(x+140,420);ctx.lineTo(x-140,420);ctx.fill();}
  for(const x of [35,885]){rect(x,300,75,120,'#1e2b21');rect(x+7,309,61,87,'#18231b');for(let y=318;y<387;y+=10)line(x+15,y,x+60,y,'#2e3f2d',3);rect(x+55,305,4,3,'#b7e77a');}
  rect(0,420,1000,80,'#1c291f');line(0,420,1000,420,'#728460',2);for(let y=440;y<500;y+=20)line(0,y,1000,y,'#30402e');for(let x=-300;x<1300;x+=85)line(500+(x-500)*.8,420,x,500,'#30402e');
  for(let x=0;x<1000;x+=40){ctx.fillStyle=x%80?'#4b5130':'#1a2319';ctx.beginPath();ctx.moveTo(x,425);ctx.lineTo(x+15,425);ctx.lineTo(x+5,433);ctx.lineTo(x-10,433);ctx.fill();}rect(0,434,1000,3,'#101b13');
  text('SECTOR A / CLOSED LOOP',24,476,9,'#5e7358');text('DO NOT FEED THE ALGORITHM',974,476,9,'#5e7358','right');
  if(preview&&game.state==='briefing'){robot({x:735,y:420,facing:-1,type:'probe',hp:65,maxHp:65,wet:0,stun:0,flash:0,windup:0,action:''},t);human({...game.player,x:220},t);}
}
function shadow(x,y,w){ctx.fillStyle='#050b0788';ctx.beginPath();ctx.ellipse(x,y+2,w,5,0,0,Math.PI*2);ctx.fill();}
function weaponShape(i,x,y,dir,t,tiers=game.weaponTiers,style=null){if(style&&drawCostumeWeapon(ctx,style,i,tiers[i],x,y,dir,t))return;ctx.save();ctx.translate(x,y);ctx.scale(dir,1);const tier=tiers[i];if(i===0)ctx.scale(1+tier*.45,1+tier*.65);ctx.strokeStyle=WEAPONS[i].color;ctx.fillStyle=WEAPONS[i].color;ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();if(i===0){ctx.moveTo(0,0);ctx.lineTo(17,-17);ctx.lineTo(22,-17);ctx.stroke();ctx.beginPath();ctx.moveTo(18,-23);ctx.lineTo(32,-12);ctx.lineTo(14,-8);ctx.closePath();ctx.fill();}else if(i===1){ctx.moveTo(3,3);ctx.lineTo(33,-25);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(8,-10);ctx.lineTo(19,1);ctx.stroke();if(tier>0){ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(16,-9);ctx.lineTo(33,-25);ctx.stroke();for(let z=0;z<5;z++){ctx.fillRect(15+z*4,-13-z*4,3,3);}}}else if(i===2){ctx.fillRect(3,-7,22,12);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(25,-5);ctx.lineTo(32,-5);ctx.moveTo(25,1);ctx.lineTo(32,1);ctx.stroke();}else{ctx.fillRect(2,-2,19,14);ctx.beginPath();ctx.moveTo(12,-2);ctx.lineTo(12,-13);ctx.lineTo(31,-13);ctx.stroke();}ctx.restore();}
function human(p,t){shadow(p.x,420,21);ctx.save();ctx.translate(p.x,p.y);if(p.flying){line(-15,2,-18,18+Math.sin(t*42)*7,'#a6e7f0',8);line(15,2,18,18+Math.sin(t*42+1)*7,'#a6e7f0',8);}if(p.spinTime>0||p.rollTime>0){ctx.translate(0,-20);ctx.rotate(p.facing*(1-(p.spinTime>0?p.spinTime/.42:p.rollTime/.34))*Math.PI*2*(p.spinTime>0?(p.spinTurns??1):1));if(p.spinTime>0){ctx.strokeStyle='#d7eff5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,52,0,Math.PI*1.65);ctx.stroke();}ctx.translate(0,20);}if(p.mecha&&p.mechaShield>0){if(campaign&&game.ultra){ctx.strokeStyle='#d2e7eb';ctx.lineWidth=3;ctx.strokeRect(-29,-78,58,66);for(let n=0;n<4;n++)line(-24,-60+n*10,24,-67+n*10,['#92b5c6','#f2d59a','#b3d6b3','#e0d9eb'][n],3);}if(campaign)text(['','I','II','III','IV','V'][game.mechTier],0,-85,12,'#9ee6ee','center');ctx.strokeStyle=premiumPaint.armor;ctx.lineWidth=5;ctx.strokeRect(-25,-72,50,56);rect(-30,-57,13,32,premiumPaint.plate);rect(17,-57,13,32,premiumPaint.plate);line(-15,-16,-19,0,premiumPaint.armor,10);line(15,-16,19,0,premiumPaint.armor,10);rect(-20,-74,40,9,'#a5cb73');}if(p.crouching&&!(p.rollTime>0))ctx.scale(1,.38);if(p.invulnerable>0&&Math.floor(t*18)%2)ctx.globalAlpha=.55;const step=p.grounded?Math.sin(t*15)*(Math.abs(p.vx)>10?6:0):5;line(-6,-15,-9+step,0,'#d0d5bc',6);line(6,-15,9-step,0,'#d0d5bc',6);drawCharacterParts(ctx,p,appearance);rect(-5,-45,10,4,'#69785a');line(p.facing*10,-34,p.facing*22,-26,'#e1debf',5);if(!(p.drilling>0))weaponShape(game.weapon,p.facing*22,-26,p.facing,t,game.weaponTiers,appearance);if(p.mecha){rect(-18,-9,14,10,'#73969f');rect(4,-9,14,10,'#73969f');rect(-15,-2,8,4,'#b3e9ec');rect(7,-2,8,4,'#b3e9ec');}ctx.restore();if(p.dashTime>0){line(p.x-p.facing*60,p.y-25,p.x-p.facing*20,p.y-25,'#b7e77a77',8);}}
function robot(r,t){if(r.humanPilot)return;if(r.type==='spider'){drawSpider(ctx,r,t);return;}if(campaign&&drawStructure(ctx,r,t))return;const data=TYPES[r.type];shadow(r.x,420,24);if(campaign&&campaignRobot(r,t))return;if(r.action==='bombard'&&r.windup>0)for(const offset of [-48,0,48])landingRing(r.target+offset,t);if(r.action==='leap'&&r.windup>0){ctx.strokeStyle='#ba9ad599';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.target,420,35,7,0,0,Math.PI*2);ctx.stroke();line(r.target-9,414,r.target+9,426,'#ba9ad5');line(r.target+9,414,r.target-9,426,'#ba9ad5');}
  ctx.save();ctx.translate(r.x,r.y);if(r.crippled){ctx.translate(0,-3);ctx.scale(1,.48);line(-27,-14,-36+Math.sin(t*6)*6,0,data.color,5);line(27,-14,36-Math.sin(t*6)*6,0,data.color,5);}if(r.type==='mirror'&&r.rollTime>0){ctx.translate(0,-20);ctx.rotate((r.combo?.approach??r.facing)*(1-r.rollTime/.34)*Math.PI*2);ctx.translate(0,20);}else if(r.type==='mirror'&&r.crouching)ctx.scale(1,.38);const walk=Math.sin(t*9+r.x*.01)*(r.stun>0||r.crippled?0:4);const c=r.flash>0?'#fff9dd':r.disabled?'#65736d':data.color;line(-8,-12,-12+walk,0,c,7);line(8,-12,12-walk,0,c,7);rect(-19,-44,38,30,'#121a15');rect(-16,-44,32,27,c);rect(-13,-66,26,19,c);rect(-10,-60,20,5,'#172018');rect(r.facing>0?3:-9,-59,6,3,r.stun>0?'#b7e77a':'#f08b69');line(0,-72,0,-66,c,2);rect(-2,-75,4,4,'#d18465');rect(-10,-36,20,3,'#202c22');rect(-5,-28,10,7,'#50624d');line(r.facing*16,-38,r.facing*29,-22,c,6);
  if(r.type==='overseer'){ctx.strokeStyle=r.disabled?'#65736d':'#ef796b';ctx.lineWidth=5;ctx.strokeRect(-28,-74,56,62);rect(-30,-57,12,36,c);rect(18,-57,12,36,c);if(!r.disabled){ctx.beginPath();ctx.arc(0,-35,48+Math.sin(t*7)*3,0,Math.PI*2);ctx.stroke();weaponShape(r.counterWeapon??2,r.facing*30,-30,r.facing,t,[2,2,2,2]);}else text('CORE EXPOSED',0,-112,11,'#b3e9ec','center');}
  if(r.type==='mirror'){ctx.strokeStyle='#e9a8d1';ctx.lineWidth=2;ctx.strokeRect(-23,-70,46,58);rect(-13,-42,26,5,'#e9a8d1');weaponShape(r.weapon,r.facing*26,-26,r.facing,t,r.build.tiers);if(r.dashTime>0)line(-r.facing*60,-28,-r.facing*23,-28,'#e9a8d1aa',7);}
  if(r.type==='guard'&&r.shield>0){rect(r.facing>0?22:-34,-52,12,43,'#826d49');rect(r.facing>0?24:-32,-50,8,39,'#d8ad68');line(r.facing*28,-44,r.facing*28,-17,'#6b5b40',2);}
  if(r.type==='bulwark'){rect(-27,-50,54,15,'#a4846a');rect(r.facing>0?22:-36,-65,14,59,'#d1b296');line(r.facing*28,-57,r.facing*28,-16,'#5d4c3b',4);}
  if(r.type==='bombardier'){rect(-22,-52,44,18,'#a27747');for(let i=0;i<3;i++)line(-12+i*10,-42,-20+i*10,-69,'#d8a365',5);}
  if(r.type==='flak'){line(-22,-45,22,-45,'#c99aa6',8);line(r.facing*18,-40,r.facing*35,-53,'#c99aa6',5);}
  if(r.type==='lancer'){line(r.facing*12,-38,r.facing*42,-25,'#e18e76',5);}
  if(r.boots){rect(-18,-8,16,9,'#0b1410');rect(2,-8,16,9,'#0b1410');line(-17,-8,-3,-8,'#e6ce6f',2);line(3,-8,17,-8,'#e6ce6f',2);}
  if(r.type==='plated'){rect(-23,-46,46,11,'#98664b');rect(-21,-36,42,9,'#bf8b69');rect(-18,-25,36,9,'#98664b');}
  if(r.type==='sealed'){ctx.strokeStyle='#82b7bb';ctx.lineWidth=3;ctx.strokeRect(-20,-69,40,54);}
  if(r.type==='gunner'){rect(r.facing>0?20:-45,-39,25,12,'#dcce83');rect(-9,-46,18,4,'#e6ae5f');}
  if(r.wet>0){ctx.fillStyle=r.corrosion>0?'#caed70':'#7cc9e8';for(let i=0;i<3;i++){const dy=((t*42+i*17)%40)-48;ctx.fillRect(-13+i*12,dy,2,5);}}
  if(r.paralyzed>0)text('PARALYZED',0,-99,9,'#b7e77a','center');else if(r.exposed>0||r.dented>0)text([r.exposed>0?'WIRES EXPOSED':'',r.dented>0?'DENTED':''].filter(Boolean).join(' / '),0,-96,8,'#e9c98f','center');
  if(r.stun>0){text('⌁',-3,-85,22,'#b7e77a','center');}
  if(r.type==='mirror'&&(r.windup>0||r.moduleWindup>0)){line(0,-24,r.facing*game.mirrorWeapon(r).range,-24,'#e9a8d155',2);}
  if(r.windup>0){ctx.strokeStyle='#eea06a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-37,40,-Math.PI,0);ctx.stroke();text('!',r.facing*36,-53,18,'#eea06a','center');}
  ctx.restore();if(r.hp<r.maxHp){rect(r.x-25,r.y-84,50,3,'#354534');rect(r.x-25,r.y-84,50*Math.max(0,r.hp/r.maxHp),3,data.color);}
  if(r.shield>0){rect(r.x-25,r.y-78,50,3,'#354534');rect(r.x-25,r.y-78,50*r.shield/r.maxShield,3,'#d8ad68');}
  if(game.wave===1||game.state==='briefing'){const y=r.y-100;rect(r.x-84,y-16,168,25,'#263327');text('KILL HUMANS. KILL HUMANS.',r.x,y,8,'#a9b49c','center');}
}
function effects(){for(const e of game.effects){ctx.save();ctx.globalAlpha=e.life/e.max;const f=1-e.life/e.max;if(e.kind==='drill-impact'){drawDrillImpact(ctx,e,f);}else if(e.kind==='evasion'){drawEvasion(ctx,e,f);}else if(e.kind==='module'){ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();if(e.module===0||e.module===3){ctx.arc(e.x,e.y,e.range*f,0,Math.PI*2);ctx.stroke();}else{for(let i=0;i<16;i++){const x=e.x+e.dir*e.range*f*(.3+i/22),y=e.y+Math.sin(i*2.7)*70*f;rect(x,y,8+f*8,8+f*8,e.color);}}}else if(e.kind==='emp'){ctx.strokeStyle=e.color;ctx.lineWidth=16*(1-f);ctx.beginPath();ctx.arc(e.x,e.y,1450*f,0,Math.PI*2);ctx.stroke();rect(0,0,1000,500,'#b3e9ec22');}else if(e.kind==='mech-break'){ctx.strokeStyle=e.color;ctx.lineWidth=6*(1-f);ctx.beginPath();ctx.arc(e.x,e.y,e.range*Math.min(1,f*2),0,Math.PI*2);ctx.stroke();for(let n=0;n<12;n++){const a=n*2.4;rect(e.x+Math.cos(a)*f*170,e.y+Math.sin(a)*f*110+f*f*90,10,15,n%2?e.color:'#a5babe');}}else if(e.kind==='armor-break'){for(let n=0;n<7;n++){const a=n*2.4;rect(e.x+Math.cos(a)*f*85,e.y+Math.sin(a)*f*60+f*f*110,8,13,e.color);}}else if(e.kind==='shield-drop'){rect(e.x+f*20,e.y+f*f*45,10,36,e.color);}else if(e.kind==='glue-burst'){ctx.strokeStyle=e.color;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(e.x,e.y,185*f,70*f,0,0,Math.PI*2);ctx.stroke();}else if(e.kind==='blast'){ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(e.x,e.y,52*f,35*f,0,Math.PI,Math.PI*2);ctx.stroke();}else if(e.kind==='number')text(e.text,e.x,e.y-f*30,16,e.color,'center');else if(e.kind==='burst'){for(let i=0;i<9;i++){const a=i*2.4;rect(e.x+Math.cos(a)*f*65,e.y+Math.sin(a)*f*55+f*f*40,5,5,e.color);}}else if(e.kind==='attack'){ctx.strokeStyle=e.color;ctx.lineWidth=e.weapon===3?5:3;if(e.energy){line(e.x,e.y,e.x+e.dir*e.range,e.y,e.color,7);line(e.x,e.y,e.x+e.dir*e.range,e.y,'#fff4db',2);}else if(e.weapon<2){if(e.source==='player'){ctx.save();ctx.translate(e.x+e.dir*e.range*.5,e.y);ctx.rotate(e.dir*(-1+f*2));drawCostumeWeapon(ctx,appearance,e.weapon,game.weaponTiers[e.weapon],0,0,e.dir,game.clock);ctx.restore();}ctx.beginPath();ctx.ellipse(e.x+e.dir*e.range*.5,e.y, e.range*.65,48,0,e.dir>0?-1.1:2.1,e.dir>0?1.1:4.2);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(e.x+e.dir*25,e.y);for(let i=1;i<=8;i++)ctx.lineTo(e.x+e.dir*(25+(e.range-25)*i/8),e.y+(i%2?8:-8)*(e.weapon===3?.5:1));ctx.stroke();if(e.weapon===3)for(let i=0;i<9;i++)rect(e.x+e.dir*(40+i*30),e.y+Math.sin(i*5)*13,3,4,e.color);}}else if(e.kind==='arc'){line(e.x,e.y,(e.x+e.x2)/2,e.y2-12,e.color,2);line((e.x+e.x2)/2,e.y2-12,e.x2,e.y2,e.color,2);}else if(e.kind==='dash')rect(e.x-18,e.y-57,36,55,'#b7e77a33');ctx.restore();}}
function drawPools(t){for(const pool of game.pools){const color=pool.fluid===2?'#caed70':pool.corrosive?'#a9d992':'#7cc9e8';ctx.save();ctx.globalAlpha=Math.min(.8,pool.life/2);ctx.fillStyle=pool.charged>0?'#b7e77a88':pool.corrosive?'#9cbb4055':'#6ebcd855';ctx.beginPath();ctx.ellipse(pool.x,419,pool.radius,6,0,0,Math.PI*2);ctx.fill();line(pool.x-pool.radius,418,pool.x+pool.radius,418,color,1);if(pool.charged>0){for(let i=0;i<5;i++){const x=pool.x-pool.radius+i*pool.radius*.45;line(x,417,x+7,407+Math.sin(t*40+i)*4,'#d5ff9e',2);}}ctx.restore();}}
function drawMecha(t){const d=game.mechaDrop;if(!d||d.collected)return;ctx.save();line(d.x,-10,d.x,d.y-55,'#b7e77a55',1);ctx.strokeStyle='#b7e77a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(d.x,420,48+Math.sin(t*5)*4,8,0,0,Math.PI*2);ctx.stroke();const x=d.x,y=d.y;rect(x-28,y-69,56,67,'#273c25');ctx.strokeRect(x-28,y-69,56,67);rect(x-17,y-59,34,23,'#b7e77a');rect(x-12,y-53,24,8,'#293f22');line(x-16,y-28,x-20,y-5,'#b7e77a',8);line(x+16,y-28,x+20,y-5,'#b7e77a',8);text(d.locked?'LOCKED / CLEAR ROOM':'MECHA / FULL ARMOR',x,y-80,11,d.locked?'#efad79':'#b7e77a','center');if(d.locked){ctx.strokeStyle='#efad79';ctx.lineWidth=4;ctx.strokeRect(x-36,y-79,72,86);line(x-33,y-70,x+33,y-6,'#efad79',3);}ctx.restore();}
function drawEmergency(t){const e=game.emergency;if(!e||(!campaign&&game.wave!==FINAL_WAVE)||game.escape)return;const active=e.activated;rect(e.x-76,e.y-66,152,133,'#251e1c');line(e.x-80,e.y+70,e.x+80,e.y+70,active?'#6c9795':'#ef796b',3);text('DO NOT',e.x,e.y-47,13,'#efad9f','center');text('PRESS',e.x,e.y-30,16,'#efad9f','center');ctx.strokeStyle=active?'#6c9795':'#ef796b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,31+Math.sin(t*5)*2,0,Math.PI*2);ctx.stroke();text(active?(campaign?'SPENT':'OFFLINE'):'⚡',e.x,e.y+49,11,active?'#b3e9ec':'#ef796b','center');if(game.nearEmergency()&&!active)text(touchUI.matches||playMode.active?'USE':'ENTER / CLICK',e.x,e.y+89,12,'#fff0a3','center');}
function drawEscape(){const e=game.escape;if(!e)return;rect(0,275,74,145,'#8ab6b0');rect(0,289,58,131,'#416d72');rect(0,328,33,92,'#bedad0');rect(0,289,58,119,'#254954');rect(11,304,3,3,'#d9ece1');rect(41,321,2,2,'#d9ece1');ctx.fillStyle='#bedad0';ctx.beginPath();ctx.arc(32,309,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2a6260';ctx.beginPath();ctx.moveTo(0,401);ctx.lineTo(27,369);ctx.lineTo(61,401);ctx.fill();rect(0,408,74,12,'#789c78');rect(0,275,74,145*(1-e.door),'#56665d');line(75,275,75,420,'#c1dbb0',5);rect(0,255,74,20,'#b7e77a');text('←',36,273,24,'#17291d','center');if(e.door===1)for(const x of [120,190,260]){line(x,398,x-22,398,'#b7e77a',4);line(x-22,398,x-10,389,'#b7e77a',4);line(x-22,398,x-10,407,'#b7e77a',4);}
 for(const b of e.blasts){const f=b.age/1.2;ctx.save();ctx.globalAlpha=Math.max(0,1-f);for(let i=0;i<9;i++){const a=i*2.4,r=18+f*85,size=Math.max(4,35*(1-f));rect(b.x+Math.cos(a)*r-size/2,b.y+Math.sin(a)*r-size/2,size,size,i%3===0?'#fff0a3':i%2?'#ed9b4d':'#d75338');}rect(b.x-14,b.y-14,28*(1-f),28*(1-f),'#fff4c1');ctx.restore();}
}
function landingRing(x,t){ctx.strokeStyle='#e7a56e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(Math.max(35,Math.min(965,x)),417,45+Math.sin(t*8)*3,7,0,0,Math.PI*2);ctx.stroke();}
function draw(t){
 ctx.clearRect(0,0,1000,500);const view=cameraView();ctx.save();ctx.scale(1000/view.width,1);ctx.translate(-view.left,0);
 if(campaign){for(let room=Math.floor(view.left/1000);room<=Math.floor((view.left+view.width)/1000);room++){ctx.save();ctx.translate(room*1000,0);drawFactoryWorld(ctx,game,room,t);roomShell(ctx,game,room,t);drawOpeningCell(ctx,game,room,t);ctx.restore();}ctx.translate(game.roomOffset,0);}else{background(t);if(game.wave===FINAL_WAVE)drawEscapeWall(ctx,escapeArchive,t);}
 drawEscape();drawPools(t);drawMecha(t);drawEmergency(t);
 if(game.state!=='briefing'||campaign){for(const r of game.robots)if(r.hp>0){robot(r,t);if(r.criticalFlash>0){const height=r.crippled?.48:1,y=r.y-({head:58,body:32,legs:9}[r.lastCritical]??32)*height;ctx.strokeStyle=r.lastCritical==='head'?'#fff0a3':r.lastCritical==='legs'?'#ef9b8d':'#b7e77a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x,y,r.lastCritical==='head'?14:20,0,Math.PI*2);ctx.stroke();}}human(game.player,t);}
 for(const s of game.shots){if(s.kind==='mortar'){landingRing(s.targetX,t);ctx.fillStyle='#e7a56e';ctx.beginPath();ctx.arc(s.x,s.y,6,0,Math.PI*2);ctx.fill();line(s.x-s.vx*.04,s.y-s.vy*.04,s.x,s.y,'#e7a56e88',3);}else{rect(s.x-6,s.y-3,12,6,s.kind==='mirror-circuit'?'#e9a8d1':'#e9a165');line(s.x-Math.sign(s.vx)*20,s.y,s.x,s.y,s.kind==='mirror-circuit'?'#e9a8d188':'#e9a16566',2);}}
 effects();if(campaign){campaignAtmosphere(t);drawExpeditionExtras(ctx,game,t);drawSideRooms(ctx,game,t);drawBurning(ctx,game,t);drawFinalPilot(ctx,game,t);drawCompanions(ctx,game);drawHack(ctx,game);drawLateTools(ctx,game,t);drawMechPowerCue(ctx,game,t);drawRescueDoor(ctx,game,t);drawSupplies(ctx,game,t);drawWeaponLoot(ctx,game,t);paintSpiderDarkness(ctx,game,reducedSpiderMotion.matches);}if(game.state==='playing'){text(weaponLabel(game.weapon).toUpperCase(),game.player.x,game.player.y+22,8,game.activeWeapon.color,'center');if(game.wave===1&&!touchUI.matches&&!playMode.active)text('W JUMP / A D MOVE / S DUCK / ENTER ATTACK',500,365,11,'#859776','center');}ctx.restore();
}
function campaignRobot(r,t){
 const data=TYPES[r.type];if(!data.flying&&!['douser','shocker','orchestrator'].includes(r.type))return false;
 const c=r.flash>0?'#fff9dd':data.color;ctx.save();ctx.translate(r.x,r.y);if(r.crouching)ctx.scale(1,.4);if(r.crippled){ctx.scale(1,.5);line(-30,-10,-42+Math.sin(t*6)*7,0,c,5);line(30,-10,42-Math.sin(t*6)*7,0,c,5);}ctx.strokeStyle=c;ctx.lineWidth=3;
 if(data.flying){
  line(-43,-44,43,-44,c,3);for(const x of [-35,35]){line(x-15,-50,x+15,-50,c,2);rect(x-3,-49,6,9,c);}rect(-23,-40,46,27,c);rect(-15,-36,30,13,'#142018');
  if(r.type==='flyer')line(r.facing*20,-23,r.facing*36,-16,c,6);
  else{ctx.beginPath();ctx.arc(0,-20,12,0,Math.PI*2);ctx.stroke();text(r.type==='chemDrone'?Math.ceil(r.fuse):r.type==='plasticDrone'?(r.shell?'⌁':'⚡'):'⚡',0,-18,12,c,'center');}
  if(r.warning>0){ctx.beginPath();ctx.arc(0,-25,48,-Math.PI*2*r.warning/.9,0);ctx.stroke();}
 }else{
  rect(-26,-57,52,43,c);line(-17,-14,-21,0,c,9);line(17,-14,21,0,c,9);rect(-18,-50,36,13,'#142018');
  if(r.type==='douser'){rect(-16,-32,32,15,'#295968');line(20,-35,39,-24,'#69c7ed',7);text('≈',0,-67,20,c,'center');}
  if(r.type==='shocker'){text('ϟ',0,-20,26,'#142018','center');rect(-28,-9,22,10,'#080d0a');rect(6,-9,22,10,'#080d0a');}
  if(r.type==='orchestrator'){line(0,-80,0,-57,c,3);ctx.beginPath();ctx.arc(0,-76,13,Math.PI,Math.PI*2);ctx.stroke();text('⌁',0,-23,25,'#142018','center');}
 }
 if(r.windup>0){ctx.strokeStyle='#ffbf84';ctx.beginPath();ctx.arc(0,-32,43,-Math.PI,0);ctx.stroke();text('!',r.facing*45,-40,22,'#ffbf84','center');}
 if(r.radio>0||r.confused>0)text('⌁',0,-88,25,'#9ee6ee','center');
 if(r.glue>0){rect(-27,-9,54,6,'#d8b6f4');text(r.root>0?'BOUND':'●'.repeat(Math.ceil(r.glue)),0,-81,10,'#d8b6f4','center');}
 if(r.wet>0)for(let n=0;n<3;n++)rect(-14+n*13,-45+(t*30+n*13)%30,3,7,'#7cc9e8');
 ctx.restore();rect(r.x-26,r.y-98,52,4,'#354534');rect(r.x-26,r.y-98,52*Math.max(0,r.hp/r.maxHp),4,c);return true;
}
function campaignAtmosphere(t){
 const p=game.player;
 if(game.plan.dark&&!game.escape&&!spiderRoom(game)){const light=ctx.createRadialGradient(p.x,p.y-35,65,p.x,p.y-35,(game.plan.visionRadius??320)+(game.mechTier>=4?45:0));light.addColorStop(0,'#050a1000');light.addColorStop(.55,'#050a1066');light.addColorStop(1,'#050a10ed');ctx.fillStyle=light;ctx.fillRect(0,0,1000,500);}
 drawFactoryLore(ctx,game);
 for(const r of game.robots.filter(r=>r.hp>0)){
  if(r.type==='shocker'&&r.action==='floor-shock'&&r.windup>0){for(const pool of game.pools){line(pool.x-pool.radius,416,pool.x+pool.radius,416,Math.sin(t*20)>0?'#eff08a':'#e89066',4);}text('↑',p.x,380,28,'#eff08a','center');}
  if(r.type==='chemDrone'){text(Math.ceil(r.fuse),r.x,r.y-70,17,'#d9f49b','center');}
  if(r.action==='sky-shot'&&r.windup>0){line(r.x,r.y-24,r.lockX,r.lockY,'#e9a16588',2);ctx.strokeStyle='#e9a165';ctx.strokeRect(r.lockX-12,r.lockY-12,24,24);}
  if(r.glue>0&&!TYPES[r.type].flying){line(r.x-25,r.y-5,r.x+25,r.y-5,'#d8b6f4',5);text(r.root>0?'BOUND':'●'.repeat(Math.ceil(r.glue)),r.x,r.y-94,9,'#d8b6f4','center');}
  if(r.corruption>0)text('ϟ',r.x+25,r.y-55,18,'#b7e77a','center');
  if(r.radio>0||r.confused>0)text('⌁',r.x,r.y-78,20,'#9ee6ee','center');
  if(game.plan.dark&&r.windup>0){text('!',r.x,r.y-72,20,'#ffbf84','center');if(r.action==='bombard')for(const n of [-48,0,48])landingRing(r.target+n,t);}
 }
 if(game.command)for(const r of game.robots.filter(r=>r.hp>0&&r.type!=='orchestrator'))line(game.command.x,game.command.y-60,r.x,r.y-50,'#f1c77866',1);
 if(game.plan.dark)text('◉',p.x,p.y-93,13,'#9ee6ee','center');
 if(game.mechaDrop&&!game.mechaDrop.collected&&!game.mechaDrop.locked)text('↓ FULL ARMOR',game.mechaDrop.x,330,14,'#9ee6ee','center');
}
let squadAckUntil=0,squadVoice=null;
function issueSquad(id,source='voice'){const oldAim=game.aimAssist;game.aimAssist=source==='touch'&&options.touchAim;const result=game.orders?.issue(game,id);game.aimAssist=oldAim;if(result?.ok){canvas.focus({preventScroll:true});if(source==='touch'){$('squad-orders').hidden=true;$('squad-toggle').setAttribute('aria-expanded','false');}}if(result){$('squad-ack').textContent=result.message;squadAckUntil=performance.now()+2500;squadUI?.render(game.orders.command,true);}return result;}
const squadUI=campaign?squadControls({window,document,container:$('squad-orders'),issue:issueSquad,canOrder:()=>game.state==='playing'&&game.companions.some(a=>a.hp>0),getKeys:c=>keysFor(options.keyboard,'squad.'+c.id)}):null;
$('squad-toggle').onclick=()=>{const open=$('squad-orders').hidden;$('squad-orders').hidden=!open;$('squad-toggle').setAttribute('aria-expanded',String(open));};
bindPointerControl($('hack-button'),{controls,action:'hack',canStart:()=>campaign&&!!hackOpportunity(game),onPress:()=>{}});
$('squad-settings-menu').onclick=()=>{$('menu-dialog').close();clearInput();$('squad-settings').showModal();};
for(const [id,difficulty] of [['group-rescue-drill','normal'],['timed-rescue-drill','hard']]){$(id).hidden=!drillMode;$(id).onclick=()=>{$('squad-settings').close();clearInput();startRescueDrill(game,{group:true,difficulty});uiState='';expeditionKey='';sync();syncSquad();canvas.focus({preventScroll:true});};}$('spider-drill').hidden=!drillMode;$('spider-drill').onclick=()=>{$('squad-settings').close();clearInput();startSpiderDrill(game);uiState='';expeditionKey='';sync();syncSquad();canvas.focus({preventScroll:true});};$('rescue-drill').hidden=!drillMode;$('survivor-drill').hidden=!drillMode;$('survivor-drill').onclick=()=>{$('squad-settings').close();startRescueDrill(game,{survivor:true});clearInput();uiState='';sync();syncSquad();canvas.focus({preventScroll:true});};$('rescue-drill').onclick=()=>{$('squad-settings').close();clearInput();startRescueDrill(game);uiState='';expeditionKey='';sync();syncSquad();canvas.focus({preventScroll:true});};
$('hack-drill').hidden=!drillMode;$('hack-drill').onclick=()=>{$('squad-settings').close();clearInput();startHackDrill(game);uiState='';sync();syncSquad();canvas.focus({preventScroll:true});};
$('squad-settings-close').onclick=()=>{$('squad-settings').close();$('menu-dialog').showModal();};$('squad-settings').addEventListener('cancel',e=>{e.preventDefault();$('squad-settings-close').click();});
let squadRosterKey='';
function syncSquad(){if(!campaign)return;if((game.state!=='playing'||document.querySelector('dialog[open]'))&&squadVoice?.state==='listening')squadVoice.stop();const alive=game.companions.filter(a=>a.hp>0),enabled=game.state==='playing'&&alive.length>0;$('squad-ui').hidden=!alive.length;$('loan-help').hidden=!alive.length;$('squad-toggle').textContent='Squad · '+alive.length;squadUI.render(game.orders.command,enabled);if(performance.now()>squadAckUntil)$('squad-ack').textContent='';
 $('hack-button').hidden=!(hackOpportunity(game)&&$('squad-orders').hidden);if($('hack-button').hidden){for(const [source,action] of controls.sources)if(action==='hack')controls.release(source);cancelHack(game);}$('hack-button').textContent=game.hackAttempt?'HACK '+Math.floor(game.hackAttempt.time/2*100)+'%':alive.length>=3?'Squad full':'Hold '+hint('hack')+' · Hack';$('hack-button').disabled=alive.length>=3;const hackProgress=game.hackAttempt?Math.min(100,game.hackAttempt.time/2*100):0;$('hack-progress').hidden=!game.hackAttempt;$('hack-progress').setAttribute('aria-valuenow',String(Math.floor(hackProgress)));$('hack-progress').firstElementChild.style.width=hackProgress+'%';
 const rosterKey=alive.map(a=>a.id+':'+Math.ceil(a.hp)+':'+a.rank+':'+a.armor+':'+a.loanedWeapon).join('|')+game.state+game.weaponTiers.join(',')+(game.weaponStock??[]).join(',');if(rosterKey===squadRosterKey)return;squadRosterKey=rosterKey;renderWeapons();const roster=$('squad-roster');roster.replaceChildren();if(!alive.length)return;const heading=document.createElement('h3');heading.textContent='Companions · '+alive.length+'/3';roster.append(heading);for(const a of alive){const row=document.createElement('div');row.className='squad-roster-row';const label=document.createElement('span');label.textContent=a.name+' · '+Math.ceil(a.hp)+' HP'+(a.survivor==='iris'?' · '+Math.ceil(a.armor)+' armor · 70% evasion':'')+' · rank '+a.rank;const b=document.createElement('button');b.textContent='Dismiss';b.disabled=!['paused','traveling'].includes(game.state);b.onclick=()=>{if(game.dismissCompanion(a.id)){squadRosterKey='';syncSquad();}};const loan=document.createElement('select');loan.className='companion-loan';loan.setAttribute('aria-label','Weapon for '+a.name);loan.disabled=!['paused','traveling'].includes(game.state);
 const native=document.createElement('option');native.value='';native.textContent='Native gear / return loan';loan.append(native);
 for(let i=0;i<4;i++){const option=document.createElement('option'),holder=weaponHolder(game,i);option.value=String(i);option.textContent=weaponAt(i,game.weaponTiers[i]).name+(loanCount(game,i)>=weaponCopies(game,i)&&a.loanedWeapon!==i?' · lent':'');option.disabled=loanCount(game,i)>=weaponCopies(game,i)&&a.loanedWeapon!==i;loan.append(option);}loan.value=Number.isInteger(a.loanedWeapon)?String(a.loanedWeapon):'';
 loan.onchange=()=>{if(game.lendWeapon(a.id,loan.value===''?null:Number(loan.value))&&game.entryCheckpoint){progress.save(game.entryCheckpoint);persistProgress();}squadRosterKey='';clearInput();syncSquad();renderWeapons();};row.append(label,loan,b);roster.append(row);}}
function frame(time){music.update(opening?.state.active?(opening.state.paused?'paused':'playing'):game.state==='pilot-choice'?'playing':game.state,game.wave,campaign?game.encounter:null,opening?.state.active||!!game.plan.dark);if(game.escape&&game.escape.time>escapeSound){music.explosion();escapeSound=game.escape.time+.65;}if(!game.escape)escapeSound=0;const dt=last?Math.min((time-last)/1000,.04):.016;last=time;opening?.update(dt);game.update(dt,campaign?utilityInput(game,input):input);if(options.autoSkills&&game.spent<game.points&&['playing','traveling','briefing','between','paused'].includes(game.state)&&autoAllocate(game))renderSkills();statistics.observe(game,dt);if(campaign)worldCamera=scrollView(game,arenaView({...playSize,active:playMode.active,playerX:game.player.x}).width,worldCamera,dt).left;const hits=game.stats.hits.reduce((a,b)=>a+b,0);if(hits>lastHits)beep(WEAPONS[game.weapon].id==='taser'?430:160,.06);lastHits=hits;draw(time/1000);sync();syncSquad();requestAnimationFrame(frame);}
squadVoice=voiceOrdersUI({window,document,issue:issueSquad,canOrder:()=>campaign&&game.state==='playing'&&!document.querySelector('dialog[open]')&&game.companions.some(a=>a.hp>0),getKeys:()=>keysFor(options.keyboard,'voice')});
premiumAccess=await premiumUI({config:PREMIUM_CONFIG,storage,game,document,window,onLoadout:loadout=>{game.premiumNext=loadout;premiumPaint=PALETTES[loadout.color];},onOpen:()=>{$('menu-dialog').close();clearInput();if(['playing','escaping','traveling'].includes(game.state))pause();},onClose:()=>{$('menu-dialog').showModal();}});

opening=introUI({storage,document,window,getStyle:()=>appearance,isMusicOn:()=>sound,onMusic:()=>setAudio(!sound),onOpen:()=>{$('menu-dialog').close();clearInput();if(['playing','escaping','traveling'].includes(game.state))pause();},onClose:auto=>{if(!auto)$('menu-dialog').showModal();else canvas.focus({preventScroll:true});}});
quickGuide=quickStartUI({storage,document,hint,touch:()=>touchUI.matches,onOpen:()=>{$('menu-dialog').close();clearInput();if(['playing','escaping','traveling'].includes(game.state))pause();},onClose:auto=>{if(!auto)$('menu-dialog').showModal();else canvas.focus({preventScroll:true});}});
playerBackupUI({storage,document,window,beforeExport:()=>{syncRegister();persistProgress();},onOpen:()=>{$('menu-dialog').close();clearInput();},onClose:()=>{$('menu-dialog').showModal();}});
characterMenu=characterUI({storage,document,earned:()=>escapeArchive.unlocked,entitled:()=>PREMIUM_CONFIG.enabled&&premiumAccess?.active===true,onChange:style=>{appearance=style;registerRevision=-1;renderWeapons();},onOpen:()=>{$('menu-dialog').close();clearInput();},onClose:()=>{$('menu-dialog').showModal();}});

for(const el of document.querySelectorAll('.support-copy'))el.textContent=SUPPORT_COPY;
feedback=feedbackUI({storage,document,game,campaign,onOpen:auto=>{feedbackWasActive=auto&&['playing','escaping','traveling'].includes(game.state);$('menu-dialog').close();clearInput();if(feedbackWasActive)pause();},onClose:auto=>{if(auto){if(feedbackWasActive&&game.state==='paused')pause();canvas.focus({preventScroll:true});}else $('menu-dialog').showModal();feedbackWasActive=false;}});

function cycleTool(){for(let i=1;i<=LATE_TOOLS.length;i++){const index=(game.gear.selected+i)%LATE_TOOLS.length;if(toolAvailable(game,index)){selectUtility(game,'tool',index);announceUtility();renderLateTools();return;}}}
function renderLateTools(){if(!campaign)return;$('late-tools').hidden=false;$('late-tool-options').innerHTML=LATE_TOOLS.map((m,i)=>`<button data-tool="${i}" aria-pressed="${game.utilityKind==='tool'&&game.gear.selected===i}" ${toolAvailable(game,i)?'':'disabled'}><b>${m.name}</b><small>${m.hint.replace('Hold B','Hold '+hint('power')).replace('B ',hint('power')+' ')}</small></button>`).join('');}
let utilityNoticeUntil=0,lastUtilityCue='';
function utilityCue(){const u=currentUtility(game),c=equipmentCues(game,{hacking:input.hack});return u?{...u,...(u.kind==='tool'?c.tool:c.power),name:u.name}:null;}
function announceUtility(){const c=utilityCue();if(!c)return;utilityNoticeUntil=performance.now()+3000;$('utility-status').textContent=hint('power')+' · '+c.name+' '+c.label+' · '+hint('cyclePower')+' cycle';}
function syncLateTools(){if(!campaign)return;
 if($('supply-status').textContent!==game.supplyNotice)$('supply-status').textContent=game.supplyNotice;
 const dock=$('equipment-dock'),inline=touchUI.matches&&innerHeight>=innerWidth,touch=document.querySelector('.touch-controls'),parent=inline?touch:canvas.parentElement;
 if($('power-group').parentElement!==dock)dock.append($('power-group'),$('late-tool-control'));
 if(dock.parentElement!==parent){clearInput();if(inline)parent.insertBefore(dock,touch.querySelector('.touch-move'));else parent.append(dock);}
 dock.dataset.inline=String(inline);dock.dataset.single='true';dock.hidden=!touchUI.matches||!game.player.mecha||!canControl();touch.classList.toggle('has-equipment',inline&&!dock.hidden);$('late-tool-control').hidden=true;
 const cues=equipmentCues(game,{hacking:input.hack}),c=utilityCue(),button=$('mech-power');
 if(c){button.textContent=c.icon+' '+c.name+' · '+c.label;button.dataset.state=c.state;button.setAttribute('aria-label','Use '+c.name+' · '+c.label);const key=c.kind+':'+c.index+':'+c.state;if(key!==lastUtilityCue){lastUtilityCue=key;announceUtility();}}
 $('utility-status').hidden=!game.player.mecha||!canControl()||performance.now()>utilityNoticeUntil;
 $('turret-status').hidden=true;return cues;
}
$('late-tool-options').onclick=e=>{const b=e.target.closest('[data-tool]');if(campaign&&b&&toolAvailable(game,+b.dataset.tool)){selectUtility(game,'tool',+b.dataset.tool);announceUtility();renderLateTools();}};
$('cycle-tool').onclick=cycleTool;
bindPointerControl($('late-tool-button'),{controls,action:'tool',canStart:()=>campaign&&canControl(),onPress:()=>game.useLateTool()});

let resourceKey='';
function syncResourceRail(){const enabled=overdriveEnabled(game);$('resource-rail').hidden=!enabled||!canControl();$('charge-meter').hidden=!enabled||game.weapon===3;$('overdrive-setting').hidden=!campaign||!['hard','terminator'].includes(game.difficulty);const rows=resourceRows(game),key=JSON.stringify(rows);if(key!==resourceKey){resourceKey=key;$('resource-meters').innerHTML=rows.map(r=>`<div class="resource-cell"><span title="${r.label}">${({BOOST:"↑",TASER:"ϟ",CELLS:"C"})[r.label]??r.label[0]}</span><div role="meter" aria-label="${r.label}" aria-valuemin="0" aria-valuemax="${r.max}" aria-valuenow="${r.value}" class="resource-track"><i style="height:${r.value/r.max*100}%;background:${r.color}"></i></div><b>${r.value}</b></div>`).join('');}$('charge-fill').style.height=(game.chargeState?.time??0)*100+'%';$('charge-meter').setAttribute('aria-label',(game.weapon===2?'Charge laser blast':'Charge melee strike')+' · hold Attack to charge and fire · 20 cells');$('charge-meter').classList.toggle('charged',(game.chargeState?.time??0)>=.9);$('charge-meter').setAttribute('aria-valuenow',Math.round((game.chargeState?.time??0)*100));$('touch-attack').style.setProperty('--charge',((game.chargeState?.time??0)*100)+'%');}
$('option-overdrive').checked=options.overdrive;$('option-overdrive').onchange=()=>{options.overdrive=$('option-overdrive').checked;game.overdrive=options.overdrive;clearInput();saveOptions(storage,options);};


function syncKeyboardHints(){
 $('menu').setAttribute('aria-label','Game menu ('+hint('menu')+')');$('menu').querySelector('kbd').textContent=hint('menu');
 $('pause').title=allHints('pause')+' · Pause';$('pause').innerHTML=(game.state==='paused'?'Resume':'Pause')+' <kbd>'+hint('pause')+'</kbd>';
 $('mech-modules').querySelector('h3').textContent='Earned mech powers · '+hint('power')+' / '+hint('cyclePower');
 $('late-tools').querySelector('h3').textContent='Mech tools · '+hint('power')+' use / '+hint('cyclePower')+' cycle';
 document.querySelector('.control-strip').textContent=hint('left')+' / '+hint('right')+' move · '+hint('up')+' jump/fly · '+hint('down')+' crouch · '+hint('attack')+' attack · '+hint('dash')+' dash · '+hint('flip')+' flip';
 canvas.setAttribute('aria-label','Robot arena. '+hint('left')+' / '+hint('right')+' move, '+hint('up')+' double jump or hold to fly, '+hint('down')+' duck, '+hint('attack')+' attack, '+hint('dash')+' dash. Commands are configurable in the menu.');
 const help=$('keyboard-help');help.replaceChildren();for(const c of KEY_COMMANDS){const key=document.createElement('b'),label=document.createElement('span');key.textContent=allHints(c.id);label.textContent=c.label;help.append(key,label);}
 $('flip-combo-help').textContent=comboEnabled()?`Press all four movement directions (${['up','left','down','right'].map(hint).join(' / ')}) within450ms, in any order, to flip. Specials stay instant.`:'Movement combo is off. Use the assigned Rolling slash key or touch Spin. Specials stay instant.';
 $('squad-help-shortcuts').textContent=['follow','hold','focus','cover','retreat'].map(id=>id[0].toUpperCase()+id.slice(1)+' '+hint('squad.'+id)).join(' · ');
 $('squad-help-hack').textContent='After level10, spend one Circuit point on Physical hack. Cut open wiring, disable the bot, then hold '+hint('hack')+' nearby for2 seconds. The Hack control appears when a target is available. Damage, movement or attacking interrupts it. Bosses cannot be hacked. Attack a nearby prisoner lock with its matching weapon, during combat or after clear; touch Break lock selects a compatible tool. Extra ordinary survivors escape through vents when the squad is full. Humans and robots share3 active slots.';
 squadUI?.refreshBindings();squadVoice?.refreshBindings();renderSkills();renderWeapons();if(campaign)renderModules();
}
keyboardUI({window,document,options,save:()=>saveOptions(storage,options),onChange:()=>{clearInput();syncKeyboardHints();},onOpen:()=>{$('menu-dialog').close();clearInput();},onClose:()=>{$('menu-dialog').showModal();}});
syncKeyboardHints();
if(drillMode){startSquadDrill(game);$('mode-label').textContent='SQUAD DRILL / UNSAVED';document.querySelector('.page-title .eyebrow').textContent='SQUAD DRILL / UNSAVED';}renderSkills();sync();syncSquad();requestAnimationFrame(frame);
