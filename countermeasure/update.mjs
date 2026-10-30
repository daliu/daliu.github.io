import {retireLegacyWorker} from './portal.mjs';
const status=document.getElementById('status');
const ok=await retireLegacyWorker(globalThis.navigator?.serviceWorker,import.meta.url,{force:true});
status.textContent=ok?'Refresh requested. Open the Demo below if this page does not reopen automatically.':'Connect to the internet and try again, or open the Demo directly on Aygen.';
