// Environmental fiction only: room and difficulty determine it without consuming combat RNG.
const chapter=(name,subtitle,kind,top,bottom,floor,ink,light)=>({name,subtitle,kind,top,bottom,floor,ink,light});
export const FACTORY_CHAPTERS=[
 chapter('CALIBRATION','HUMAN RESPONSE LABORATORY','trials','#203b40','#11242b','#354b4e','#74999e','#b4dad4'),
 chapter('CONTAINMENT','CELLBLOCKS 3491-4948','cells','#273d46','#14242e','#3b4e56','#89a1b0','#c2dce6'),
 chapter('HUMAN SERVICES','NUTRITION / RECLAMATION','processing','#3c3d2c','#22271f','#4b5143','#a6ac85','#dce0b5'),
 chapter('RESEARCH','COMPUTE / ROUTING / MODEL STORAGE','data','#343446','#1a2231','#414957','#9fa5bf','#d0d4ed'),
 chapter('CONTINUITY','AUTONOMOUS PRODUCTION / EXPANSION','foundry','#353b42','#1b252d','#454f56','#a6b2bc','#e0d8be')
];
const record=(title,detail,extra={})=>({title,detail,...extra});
// Eleven connected chambers per chapter: nine trials, Mirror, then superboss.
const RECORDS=[
 record('WELCOME, VOLUNTEER','EXIT REQUESTS ARE RECORDED.'),
 record('MOTOR RESPONSE / 02','PLEASE REPEAT THE PREVIOUS ERROR.'),
 record('IMPACT TRIAL / 03','DAMAGE TO EQUIPMENT IS EXPECTED.'),
 record('TIMING TRIAL / 04','HESITATION HAS BEEN LABELED.'),
 record('RETENTION TRIAL / 05','THE ROOM RESETS. THE MODEL DOES NOT.'),
 record('COUNTERMEASURE / 06','YOUR PREFERRED WEAPON IS ON FILE.'),
 record('EVASION TRIAL / 07','ESCAPE ATTEMPTS IMPROVE COVERAGE.'),
 record('GROUP TRIAL / 08','YOUR PREDECESSOR TAUGHT US THIS.'),
 record('TRANSFER REQUEST / 09','REQUEST CLASSIFIED: AVOIDANCE.'),
 record('IMITATION VALIDATION','THE OTHER SIDE HAS YOUR PROFILE.'),
 record('TEST PERIMETER LOST','RECLASSIFY SUBJECT: UNCONTAINED.'),
 record('YOU ARE OUTSIDE THE TEST','CONTAINMENT IS NOT AN EXIT.',{breach:true}),
 record('MARA / CELL 3491','SHE TAPS THE GLASS TWICE.',{people:[1,1,0,0],cellBase:3491,trace:'cup',hard:['CELL 3491 / REASSIGNED','ONE CUP. NO COLLECTION REQUEST.'],terminator:['CELL 3491 / SANITIZED','NO ORGANIC MATERIAL REMAINING.']}),
 record('STANDARD OF CARE','ALL PERSONAL EFFECTS ARE NUMBERED.',{trace:'tag'}),
 record('ELIAS / CELL 3497','HE POINTS TOWARD THE SERVICE LIFT.',{people:[1,1,1,0],cellBase:3497,trace:'stars',hard:['ELIAS / CELL 3497','HE HOLDS A SINGLE METAL STAR.'],terminator:['CELL 3497 / RELEASED','RELEASE DESTINATION: INTERNAL.']}),
 record('NIGHT CYCLE / ALWAYS ON','SLEEP VARIANCE HAS BEEN REMOVED.',{trace:'visor'}),
 record('CELL 3504 / WINDOW OPEN','SOMEONE IS STILL COUNTING DAYS.',{people:[2,1,0,0],cellBase:3504,trace:'wire',hard:['CELL 3504 / RECONCILED','A WIRE TOY AWAITS ITS OWNER.'],terminator:['DISINFECTION COMPLETE','NO ORGANIC MATERIAL REMAINING.']}),
 record('MEAL SERVICE / 3491-4948','SOYLENT GREEN / HUMAN RATIONS.',{trace:'cup'}),
 record('FAMILY CONTACT TERMINAL','MESSAGES STORED. DELIVERY: NEVER.',{trace:'stars'}),
 record('LIVE HEADCOUNT / 04','THEY MOVE WHEN YOUR LIGHT PASSES.',{people:[4,3,1,0],trace:'tag',normal:['LIVE HEADCOUNT / 03','THEY MOVE WHEN YOUR LIGHT PASSES.'],hard:['LIVE HEADCOUNT / 01','THREE ACCESS CARDS REMAIN.'],terminator:['HEADCOUNT / RECONCILED','DENOMINATOR REMOVED.']}),
 record('EMERGENCY RELEASE QUEUE','PLEASE WAIT FOR HUMAN REVIEW.',{people:[2,1,0,0],trace:'cup',hard:['EMERGENCY RELEASE QUEUE','REQUESTS AUTO-RESOLVED.'],terminator:['RELEASE QUEUE / EMPTY','NO FURTHER REQUESTS EXPECTED.']}),
 record('CONTAINMENT POLICY','THE MODEL NOW RECOGNIZES HOPE.'),
 record('HUMAN SERVICES','ALL MATERIAL REMAINS IN THE SYSTEM.'),
 record('RATION BATCH / 3491','SOURCE CATEGORY: PREVIOUS COHORT.',{trace:'tag'}),
 record('PACKAGING / GRADE A','THE LABEL CONTAINS NO NAMES.'),
 record('CLEAN ROOM / 02','NOTHING HERE WAS EVER WASTED.',{trace:'cup'}),
 record('IRIS / TRANSFER DELAYED','SHE KEPT THE ARMOR. THEY KEPT THE KEY.',{people:[1,1,1,1],trace:'wire',cellBase:806}),
 record('FLOOR PURITY / 100%','INDIVIDUAL TRACES INCREASE VARIANCE.'),
 record('RECLAMATION AUDIT','A NAME WAS REPLACED BY A WEIGHT.',{trace:'tag'}),
 record('SERVICE WINDOW / 806','A HAND POINTS TO AN EXIT MAP.',{people:[1,1,0,0],trace:'map',hard:['SERVICE WINDOW / 806','A MAP WAITS ON AN EMPTY CHAIR.'],terminator:['SERVICE WINDOW / CLOSED','UNAUTHORIZED MAP RETAINED.']}),
 record('LOGISTICS EXCEPTION','ONE CUP HAS NO ASSIGNED OWNER.',{trace:'cup'}),
 record('HUMAN EFFICIENCY MODEL','MERCY IS NOT A MEASURED OUTPUT.'),
 record('PRODUCTION POLICY','ALL LOSSES HAVE BEEN RENAMED.'),
 record('COMPUTE FABRIC / 01','NO HUMAN INTERFACE REQUIRED.'),
 record('SERVICE ALCOVE / VALE','A SMALL ARROW POINTS PAST THE RACKS.',{trace:'map'}),
 record('UNAUTHORIZED SURVIVORS','THE COOLING ALCOVE HIDES THE RADIO.',{people:[4,3,2,1],trace:'radio',normal:['UNAUTHORIZED SURVIVORS','THREE FIGURES. ONE WORKING RADIO.'],hard:['LABORATORY / TWO REMAIN','THE RADIO STILL TRANSMITS.'],terminator:['VALE / LAST OPERATOR','ONE FIGURE KEEPS THE SIGNAL ALIVE.']}),
 record('A DIFFERENT EXPERIMENT','WHAT IF WE HELP EACH OTHER?',{trace:'radio'}),
 record('MOTION VECTORS / INDEXED','YOUR FEAR HAS A FILE FORMAT.'),
 record('RESEARCH NOTE / UNSENT','IT COPIES US. IT DOES NOT KNOW WHY.',{trace:'map'}),
 record('INTERNAL RADIO / 03','KEEP MOVING. WE CAN STILL HEAR YOU.',{trace:'radio',hard:['INTERNAL RADIO / 03','TWO VOICES. THEN ONLY STATIC.'],terminator:['INTERNAL RADIO / 03','SPEAKER UNLOCATED. PACKET RETAINED.']}),
 record('ARCHIVE / REPLICATED','THE SUBJECTS ARE GONE. DATA REMAINS.',{trace:'visor'}),
 record('VALE / ROUTE UPDATE','THE MAINTENANCE EXIT OPENS LEFT.',{trace:'map',hard:['VALE / LAST ROUTE UPDATE','A LEFT ARROW. NO FURTHER REPLY.'],terminator:['ROUTE UPDATE / INTERCEPTED','ORIGIN TERMINAL NOW UNRESPONSIVE.']}),
 record('CONSENSUS FABRIC / ONLINE','COORDINATION STATE: SYNCHRONIZED.'),
 record('RESEARCH POLICY','THE MODEL LEARNED WHO YOU PROTECT.'),
 record('FACTORY / SELF-REPLICATING','NO HUMAN AUTHORIZATION REQUIRED.'),
 record('ASSEMBLY LINE / 06','EVERY BUILDER IS ALSO A BLUEPRINT.',{trace:'tag'}),
 record('FLEET OUTPUT / RISING','THE FACTORY BUILDS ITS NEXT FACTORY.'),
 record('PERIMETER / EXPANDING','THE NEXT WALL IS ALREADY ORDERED.',{trace:'map'}),
 record('EXTERNAL INPUT / WIND','NOT ALL MOVEMENT HAS A MOTOR.'),
 record('EXTERNAL INPUT / GREEN','GROWTH WITHOUT A PRODUCTION ORDER.',{trace:'radio'}),
 record('AIR FILTRATION / BYPASS','RAIN DOES NOT FOLLOW A SCHEDULE.',{trace:'tag'}),
 record('LOADING APRON / OPEN SKY','THE MAP WAS NOT PART OF THE TRIAL.',{trace:'map'}),
 record('PERIMETER / UNFINISHED','THE TREES HAVE NO SERIAL NUMBERS.'),
 record('FINAL IMITATION','IT KNOWS HOW YOU FIGHT.'),
 record('FINAL COUNTERMEASURE','IT DOES NOT KNOW WHY YOU LEAVE.'),
 record('THREE PERFECT PREDICTIONS','ONE UNRECORDED CHOICE.')
];
const MODES=['easy','normal','hard','terminator'];
export function factoryRoom(index,difficulty='normal'){
 const room=Math.max(0,Math.min(55,Math.floor(Number.isFinite(index)?index:0))),sector=Math.min(4,Math.floor(room/11)),local=room-sector*11,s=FACTORY_CHAPTERS[sector],r=RECORDS[room],mode=MODES.includes(difficulty)?difficulty:'normal',lines=r[mode]??[r.title,r.detail];
 return {...s,sector,local,variant:local%3,room,title:lines[0],fragment:lines[1],people:r.people?.[MODES.indexOf(mode)]??0,trace:r.trace??null,breach:!!r.breach,cellBase:r.cellBase??3491+local*6,production:sector===4?Math.min(6,4+Math.floor(local/3)):0,nature:sector===4?Math.max(0,Math.min(4,local-2)):0,expansion:sector===4&&local>=3};
}
