import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {recommend} from './hosted-client.mjs';
const {values}=parseArgs({options:{request:{type:'string'},inventory:{type:'string'},endpoint:{type:'string'}}});
try{
  if(!values.request||!values.inventory)throw Error('Supply --request and --inventory');
  const request=JSON.parse(await readFile(values.request,'utf8'));
  const inventory=JSON.parse(await readFile(values.inventory,'utf8'));
  const endpoint=values.endpoint??JSON.parse(await readFile(new URL('../service.json',import.meta.url),'utf8')).endpoint;
  if(!endpoint)throw Error('The hosted endpoint has not been published yet');
  const harness={id:'codex',version:inventory.cliVersion,accessType:inventory.accessType,observedAt:inventory.observedAt,models:inventory.models.map(m=>({id:m.id,efforts:m.efforts,speedModes:m.speedModes??null}))};
  console.log(JSON.stringify(await recommend({...request,harness},{endpoint}),null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
