export function selectOutcomes(report,{mode='all',difficulty='all',entry='all',release='all'}={}){
 return (report.outcomes??[]).filter(({dimensions:d})=>(mode==='all'||d[0]===mode)&&(difficulty==='all'||d[1]===difficulty)&&(release==='all'||d[5]===release)&&(entry==='all'||entry==='progression'&&['new_run','continuation'].includes(d[4])||entry==='retry'&&d[4]==='retry'||entry==='replay'&&['resume','level_select','finale_replay','difficulty_change'].includes(d[4])));
}
export function communitySummary(report,filters){
 const levels=new Map(),totals={clear:0,death:0,abandoned:0,seconds:0,criticals:0,combos:0,kills:0};
 for(const {dimensions:d,metrics:m} of selectOutcomes(report,filters)){
  const count=+m[0]||0;if(d[3] in totals)totals[d[3]]+=count;totals.seconds+=+m[1]||0;totals.criticals+=+m[2]||0;totals.combos+=+m[3]||0;totals.kills+=+m[4]||0;
  const key=[d[0],d[1],d[2]].join('/');if(!levels.has(key))levels.set(key,{label:key,clear:0,death:0,abandoned:0,seconds:0});const l=levels.get(key);if(['clear','death','abandoned'].includes(d[3]))l[d[3]]+=count;l.seconds+=+m[1]||0;
 }
 return {totals,levels:[...levels.values()].sort((a,b)=>b.death/Math.max(1,b.death+b.clear)-a.death/Math.max(1,a.death+a.clear)||b.death-a.death)};
}
export function mountCommunity(document,report,updated){
 const $=id=>document.getElementById(id),add=(tag,text,parent,cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 if(!report||report.status==='unavailable'){ $('community-status').textContent='The community report is not available yet. New reporting fields can take time to become available in Analytics; check back after the next daily refresh. This is not a zero-player count.';return;}
 $('community-status').textContent=`Report updated ${updated}. Window: ${report.date_range.start} to ${report.date_range.end}.`+(report.status==='limited'?' Some data is limited, sampled or subject to reporting thresholds.':'')+(report.events===0?' No eligible game events in this report window.':'');
 const cards=add('div','',$('community-totals'),'statistics-cards');for(const [label,value] of [['Approx. unique browsers · all',report.unique_browsers],['Game events',report.events]]){const c=add('div','',cards);add('strong',String(value),c);add('small',label,c);}
 for(const release of [...new Set((report.outcomes??[]).map(r=>r.dimensions[5]))].sort()){const o=add('option',release,$('community-release'));o.value=release;}
 function render(){const f={mode:$('community-mode').value,difficulty:$('community-difficulty').value,entry:$('community-entry').value,release:$('community-release').value},s=communitySummary(report,f),mount=$('community-content');mount.replaceChildren();const cards=add('div','',mount,'statistics-cards');for(const [label,value] of [['Cleared encounters',s.totals.clear],['Deaths',s.totals.death],['Abandoned',s.totals.abandoned],['Combat minutes',Math.round(s.totals.seconds/60)]]){const c=add('div','',cards);add('strong',String(value),c);add('small',label,c);}
  if(!s.levels.length){add('p','No resolved or abandoned attempts in this selection yet.',mount);return;}
  add('h2','Encounter pressure',mount);const wrap=add('div','',mount,'statistics-table-wrap'),table=add('table','',wrap),head=add('tr','',add('thead','',table));for(const h of ['Encounter','Clears','Deaths','Death rate'])add('th',h,head);const body=add('tbody','',table);for(const l of s.levels){const tr=add('tr','',body);for(const v of [l.label,l.clear,l.death,l.clear+l.death?Math.round(l.death/(l.clear+l.death)*100)+'%':'—'])add('td',String(v),tr);}
  add('p',`${s.totals.criticals} critical hits · ${s.totals.combos} combo hits · ${s.totals.kills} enemy units/structures destroyed (includes friendly fire).`,mount,'statistics-caption');
  // These breakdowns share mode/difficulty filters, but not entry/release.
  // Hide them when those filters are selected instead of mixing denominators.
  if(f.entry!=='all'||f.release!=='all'){add('p','Select all entries and releases to view strategy and death-location breakdowns.',mount,'statistics-caption');return;}
  const match=d=>(f.mode==='all'||d[0]===f.mode)&&(f.difficulty==='all'||d[1]===f.difficulty),strategies=new Map(),weapons=new Map();for(const r of report.strategies??[])if(match(r.dimensions)){const d=r.dimensions,n=+r.metrics[0]||0;strategies.set(d[2],(strategies.get(d[2])??0)+n);weapons.set(d[3],(weapons.get(d[3])??0)+n);}
  for(const [title,counts] of [['Favorite strategies',strategies],['Favorite weapon families',weapons]]){add('h2',title,mount);const max=Math.max(1,...counts.values());for(const [key,value] of [...counts].sort((a,b)=>b[1]-a[1])){const row=add('div','',mount,'statistics-bar');add('span',key.replaceAll('_',' '),row);const meter=add('meter','',row);meter.max=max;meter.value=value;meter.setAttribute('aria-label',key+' encounter count');add('span',String(value),row);}}
  add('h2','Arena death map',mount);const cells=Array(50).fill(0),causes=new Map();for(const r of report.deaths??[])if(match(r.dimensions)){const cell=r.dimensions[3],n=+r.metrics[0]||0;if(/^\d:[0-4]$/.test(cell)){const [x,y]=cell.split(':').map(Number);cells[y*10+x]+=n;}causes.set(r.dimensions[4],(causes.get(r.dimensions[4])??0)+n);}const heat=add('div','',mount,'statistics-heatmap'),max=Math.max(1,...cells);heat.setAttribute('role','img');heat.setAttribute('aria-label','Ten columns by five rows of arena death counts, floor at bottom.');cells.forEach((n,i)=>{const c=add('span',n?String(n):'·',heat);c.style.background=`rgba(239,121,107,${.04+.8*n/max})`;c.title=`Column ${i%10+1}, row ${Math.floor(i/10)+1}: ${n} deaths`;});add('p','Arena-relative coordinates, combined across selected encounters. Floor at bottom.',mount,'statistics-caption');add('p',[...causes].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+' · '+v).join(' / '),mount,'statistics-caption');
 }
 for(const id of ['community-mode','community-difficulty','community-entry','community-release'])$(id).onchange=render;render();
}
if(typeof document!=='undefined'){
 fetch('../analytics/data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>mountCommunity(document,d.countermeasure,d.updated)).catch(()=>{document.getElementById('community-status').textContent='Could not load community statistics. Connect to the internet and try again. Your local game statistics remain available offline.';});
}
