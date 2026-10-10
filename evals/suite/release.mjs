import {readFile,writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {suiteHash,hash} from './grade.mjs';
import {variants} from './payloads.mjs';
export async function releaseHashes(){return {suiteHash,payloadHash:hash(await readFile(new URL('./payloads.mjs',import.meta.url),'utf8')),researchHash:hash(JSON.parse(await readFile(new URL('./research.json',import.meta.url),'utf8')))};}
export function verifySeal(seal,current){
  if(!variants.includes(seal.variant)||!seal.selectionReportHash||!seal.reason)throw Error('Invalid release seal');
  for(const field of ['suiteHash','payloadHash','researchHash'])if(seal[field]!==current[field])throw Error(`Frozen release changed: ${field}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {values}=parseArgs({options:{variant:{type:'string'},selection:{type:'string'},reason:{type:'string'},out:{type:'string'}}});
  if(!values.variant||!values.selection||!values.reason||!values.out)throw Error('Supply --variant --selection <selection comparison> --reason --out');
  const report=JSON.parse(await readFile(values.selection,'utf8'));
  if(report.split!=='selection'||report.status!=='completed')throw Error('A completed selection-set comparison is required before sealing');
  const current=await releaseHashes();
  for(const key of ['suiteHash','payloadHash','researchHash'])if(report[key]!==current[key])throw Error('Selection report does not match current release');
  const seal={...current,variant:values.variant,selectionReportHash:hash(report),reason:values.reason,sealedAt:new Date().toISOString()};verifySeal(seal,current);
  await writeFile(values.out,JSON.stringify(seal,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(seal,null,2));
}
