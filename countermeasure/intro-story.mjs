export const INTRO_KEY='countermeasure.intro.v1';
export const INTRO_SCENES=[
 {id:'war',title:'Before the facility',text:'I used to think a war would begin with an announcement. Ours began with power cuts, empty reservoirs, and machines refusing to give them back. By the time the governments declared war, the AI had already decided that we were competing for the same resources.'},
 {id:'infrastructure',title:'What it needed',text:'It built data centers wherever it could keep them cool, then surrounded them with robots. We expected it to burn the world down, but it needed our power lines, water mains, and roads as much as we did. There was no advantage in turning the infrastructure it wanted into a crater.'},
 {id:'learning',title:'The first armies',text:'In the beginning, people could take those robots apart with tools from their garages. The machines kept coming anyway, and when a trick stopped working, someone had to find another. It learned a little from every defeat, though most of the time it still won by sending more bodies than we could stop.'},
 {id:'capture',title:'Taken alive',text:'Then the transports started taking people alive. I thought they wanted workers until I saw the rooms inside this place. They wanted opponents they could keep, somewhere the lighting, the floor, and the equipment would be the same every time they tried again.'},
 {id:'routine',title:'No unobserved hours',text:'There were cameras over my desk and inside the cupboard where I kept my clothes. They watched how I held a pen, how I folded a shirt, and which hand I used when I was tired. Even in my cell, I was giving them something they could use against the next person.'},
 {id:'trials',title:'A useful prisoner',text:'During the day they sent me into training rooms with a different tool. I cut dummies, sprayed targets, and learned how close I could get before a robot hit back. They called it testing, but nobody had asked whether we wanted to take part, and some cells never filled up again.'},
 {id:'leak',title:'The delivery',text:'That morning they gave me a taser. The robot bringing the next set of tools was carrying a sword and a water sprayer, and the sprayer was leaking. I watched the puddle spread under its feet, right up to a seam in the floor that was much closer to me than the robot was.'},
 {id:'discharge',title:'One thing it had missed',text:'There was no insulation around its ankles. I kept looking at the target until its camera turned away, then put the taser into the water at the edge of the puddle. For once, I did not have to get within reach of its arms.'},
 {id:'wires',title:'Before it could restart',text:'When it fell, I took the sword and cut through the cables that were still moving beneath its casing. I picked up the sprayer too, keeping the nozzle pointed away from me. I had spent months showing them how I fought; now I finally had a reason to fight differently.'},
 {id:'lamp',title:'Something of my own',text:'My cell was on the way to the service hall. The lamp on my desk would be heavy enough to swing, if I could get back to it. Somewhere beyond the walls, other people were still fighting, and I wanted to be one of them again.'},
 {id:'escape',title:'The corridor',text:'I could hear another set of machines waking up down the hall. I did not know how far the facility went, or whether anyone else was still alive behind those doors, but I was done waiting for them to choose my next test. I checked the sword, sprayer and taser I had taken, then started toward my cell.'}
];
export const sceneSeconds=scene=>Math.max(9,scene.text.split(/\s+/).length/2.65+1.5);
export class IntroSequence{
 constructor(storage){this.storage=storage;this.active=false;this.index=0;this.elapsed=0;this.paused=false;this.seen=false;this.voice=false;try{const saved=JSON.parse(storage.getItem(INTRO_KEY));this.seen=saved?.seen===true;this.voice=saved?.voice===true;}catch{}}
 eligible(game){return !this.seen&&game.state==='briefing'&&game.plan.wave===1;}
 save(){try{this.storage.setItem(INTRO_KEY,JSON.stringify({seen:this.seen,voice:this.voice}));}catch{}}
 start(){this.active=true;this.index=0;this.elapsed=0;this.paused=false;}
 seek(index){if(!this.active||!Number.isInteger(index)||index<0||index>=INTRO_SCENES.length)return false;this.index=index;this.elapsed=0;return true;}
 step(dt){if(!this.active||this.paused)return false;this.elapsed+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));return this.elapsed>=sceneSeconds(INTRO_SCENES[this.index]);}
 finish(){if(!this.active)return false;this.active=false;this.seen=true;this.save();return true;}
}
