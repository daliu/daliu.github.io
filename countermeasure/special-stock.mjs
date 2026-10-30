// Suit supplies travel with the pilot. Cooldowns never regenerate charges.
const STOCK={easy:[10,10,20,12,8],normal:[8,8,16,10,6],hard:[6,6,12,8,5],terminator:[5,5,10,6,4]};
export const fullPowerStock=difficulty=>[...(STOCK[difficulty]??STOCK.normal)];
export function validPowerStock(value,difficulty){
 const max=fullPowerStock(difficulty);
 return Array.isArray(value)&&value.length===5&&value.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=max[i]);
}
export function powerUnlocked(g,index){
 if(!Number.isInteger(index)||index<0||index>5||!(g.mechTier>0))return false;
 const earned=g.wave>10||g.wave===10&&(g.encounter==='super'||g.mechaDrop?.collected);
 return !!earned&&(index<4?g.mechTier>=index+1:g.mechTier>=5&&g.ultra);
}
export const powerStock=(g,index)=>index===5?g.resources.ammo:(g.powerStock??fullPowerStock(g.difficulty))[index]??0;
export function spendPower(g,index){
 if(!powerUnlocked(g,index)||powerStock(g,index)<=0)return false;
 if(index<5){g.powerStock??=fullPowerStock(g.difficulty);g.powerStock[index]--;}
 // AP rounds are spent when their projectile is created, using the existing ammo pool.
 g.supplyRevision=(g.supplyRevision??0)+1;return true;
}
export function powerRefill(g){
 const max=fullPowerStock(g.difficulty),order=[g.module,...max.map((_,i)=>i).filter(i=>i!==g.module)];
 const index=order.find(i=>i<5&&powerUnlocked(g,i)&&powerStock(g,i)<max[i]);
 return index===undefined?null:{object:g.powerStock,key:index,amount:1,label:['RADIO','GLUE','FIRE','MAGNET','EMP'][index]};
}
