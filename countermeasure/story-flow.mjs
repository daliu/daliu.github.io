import {freshStory,makeStoryChoice,makeIrisChoice,irisThreshold,finishStory} from './narrative.mjs';
import {ensurePlayerWeapon} from './weapon-lending.mjs';
// Interstitials are enabled by the browser presenter. Headless combat runs can
// omit presentation without gaining an alternative ending or escape reward.
export function beginStoryRoom(g){
 g.story??=freshStory();g.storyRatio=null;
 if(g.storyPresentation&&g.wave===50&&g.encounter==='super'&&g.story.choice===null){g.story.offered=true;g.state='story-offer';}
}
export function chooseStory(g,id){
 if(g.state!=='story-offer')return false;const s=makeStoryChoice(g,id);if(!s)return false;
 g.story=s;g.cancelCharge();g.player.drilling=0;g.player.spinTime=0;g.state=id==='refuse'?'playing':'concluded';
 if(id==='refuse')g.entryCheckpoint=g.snapshot();return true;
}
export function chooseIrisStory(g,id){
 if(g.state!=='story-iris')return false;const s=makeIrisChoice(g,id,g.storyRatio);if(!s)return false;g.story=s;g.storyRatio=null;
 if(id==='continue'){g.state='playing';g.entryCheckpoint=g.snapshot();return true;}
 g.companions=g.companions.filter(a=>a.survivor!=='iris');ensurePlayerWeapon(g);g.journey.secretQualified=false;g.cancelCharge();g.player.drilling=0;g.player.spinTime=0;g.beginEscape();return true;
}
export function updateStoryFlow(g){
 if(!g.storyPresentation)return;
 if(g.state==='complete'&&!g.story.ending){const s=finishStory(g);if(s)g.story=s;return;}
 if(g.state!=='playing'||g.wave!==50||g.encounter!=='super'||g.story.choice!=='refuse')return;
 const core=g.robots.find(r=>r.super&&r.hp>0);if(!core)return;
 const ratio=core.hp/core.maxHp;if(irisThreshold(g,ratio)!==null){g.storyRatio=ratio;g.state='story-iris';g.cancelCharge();g.player.drilling=0;g.player.spinTime=0;}
}
