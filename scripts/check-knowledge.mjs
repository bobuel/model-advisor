import {readFile} from 'node:fs/promises';
import {validateKnowledge} from '../service/recommend.mjs';
const k=JSON.parse(await readFile('knowledge/current.json','utf8'));
const result=validateKnowledge(k);
if(result.stale)throw Error('Published knowledge is stale; source review is required');
console.log(JSON.stringify({version:k.version,...result,models:k.models.length,combinations:k.models.reduce((s,m)=>s+m.efforts.length,0)}));
