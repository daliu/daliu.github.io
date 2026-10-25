// Fictional names. A shuffled Cartesian pool avoids shipping thousands of strings.
export const GIVEN = `Ada Adira Aiko Alek Alma Amos Anika Ansel Aran Ari Asher Astrid
Ava Basil Belen Bram Cato Celine Cora Cyrus Dalia Darius Dima Dorian Eden Elian
Elise Emil Enid Esme Ezra Farah Felix Fionn Flora Freya Galen Hana Idris Ilan
Ilya Imogen Ines Iona Iris Isak Jalen Jana Jonas Juno Kael Kaito Kira Kit
Lars Leila Lena Leon Liora Liv Luca Lyra Mara Marek Marius Maya Mina Mira
Nadia Nara Niko Noa Noor Nora Oren Orla Oskar Pavel Petra Quinn Rafi Rhea
Ronan Rosa Rowan Ruth Sable Sana Selene Sena Soren Talia Tariq Tess Theo Vera
Viktor Wren Yara Yuki Zain Zara Zoya Abel Adrian Agata Amina Anton Arden Ariel
Arlo Beata Bela Bruno Celia Clara Dario Eira Elias Elio Etta Eva Faris Finn
Greta Hadi Hilda Hugo Irina Ivan Jori Jude Kian Leda Lois Ludo`.split(/\s+/);
export const FAMILY = `Ashford Vale Mercer Voss Kestrel Moroz Sato Ward Rook Calder
Hale Winter Sable Kade Morrow Fenwick Stone Alder Bell Graves Crowe Reed
Frost Ellery Finch North Blackwell Corbin Wynn Hollis Rainer Marlowe
Harker Locke Keene Thorne Crane Lowen Kovac Volkov Petrov Ivers Sokol
Serrano Navarro Vidal Moreau Laurent Beaumont Dubois Caron Dufour Roche
Bauer Weiss Adler Fischer Stein Weber Falk Berg Dahl Lind Nyberg Eklund
Solberg Ahlstrom Larsen Nordin Holm Strand Park Han Choi Lim Seo Moon
Chen Lin Zhou Wu Xu Zhao Shen Tang Huang Luo Singh Rao Mehta Shah
Kapoor Nair Bose Sen Khan Malik Idrisi Farouk Haddad Nassar Rahal Mansour
Okafor Mensah Diallo Adeyemi Abara Kamau Otieno Njeri Bekele Tesfaye
Silva Costa Alves Pinto Duarte Leal Campos Rocha Cruz Reyes Santos Vega
Salazar Rios Medina Solis Acosta Espinosa Luna Ibarra Soria Ferrer`.split(/\s+/);
export const NAME_COUNT=GIVEN.length*FAMILY.length;
const gcd=(a,b)=>b?gcd(b,a%b):a;
const stride=(()=>{let n=4051;while(gcd(n,NAME_COUNT)!==1)n+=2;return n;})();
export const EPITAPHS=[
  'The doors stayed shut. The movement data survived.',
  'Their name was removed from the roster. Their reflexes remained in the archive.',
  'The chamber lights dimmed. The factory requested another human.',
  'A voice asked whether the test was over. No response was logged.',
  'Personal effects: one lamp. Return authorization: denied.',
  'The machine recorded a useful failure. Someone had called it a life.',
  'The promised exit never opened. The next intake bell rang.',
  'Next of kin: not notified. Training set: updated.',
  'The intercom said thank you. The floor drains opened.',
  'One less voice in the holding cells. One more line in the report.',
  'Their last hesitation became a timing parameter.',
  'Recovery crew: unnecessary. Replacement subject: available.'
];
export class SubjectRegister{
  constructor(saved=null){
    this.seed=Number.isInteger(saved?.seed)&&saved.seed>=0?saved.seed>>>0:(Math.random()*0xffffffff)>>>0;
    this.sequence=Number.isSafeInteger(saved?.sequence)&&saved.sequence>=0&&saved.sequence<=1000000000?saved.sequence:0;
    this.records=Array.isArray(saved?.records)?saved.records.slice(-24).filter(r=>r&&typeof r.name==='string'&&typeof r.id==='string'&&['terminated','reassigned','survived'].includes(r.status)).map(r=>({id:r.id.slice(0,24),name:r.name.slice(0,80),status:r.status,wave:Number(r.wave)||0,cause:String(r.cause??'unrecorded').slice(0,80),epitaph:String(r.epitaph??'Record incomplete.').slice(0,200)})):[];
    this.current=null;this.revision=0;
  }
  peek(){const key=(this.sequence*stride+this.seed)%NAME_COUNT;return {id:`H-${(this.seed%10000).toString().padStart(4,'0')}-${(this.sequence+1).toString().padStart(4,'0')}`,name:`${GIVEN[Math.floor(key/FAMILY.length)]} ${FAMILY[key%FAMILY.length]}`,status:'active'};}
  issue(){this.current=this.peek();this.sequence++;this.revision++;return this.current;}
  close(status,wave,cause){if(!this.current||this.current.status!=='active')return;const r={...this.current,status,wave,cause,epitaph:status==='terminated'?EPITAPHS[(this.seed+this.sequence)%EPITAPHS.length]:status==='survived'?'The test ended. The human did not. Exit authorization: seized.':'Protocol restarted. Subject transferred to an unlisted holding cell.'};this.current=r;this.records.push(r);this.records=this.records.slice(-24);this.revision++;}
  snapshot(){return {seed:this.seed,sequence:this.sequence,records:this.records};}
}
