// Explicitly export only synthetic results and safe catalog fields, never raw traces.
import {readFile,writeFile} from 'node:fs/promises';
import {validateKnowledge} from '../service/recommend.mjs';
// Historical one-time exporter: do not overwrite subsequent reviewed research.
const existing=JSON.parse(await readFile('knowledge/current.json','utf8'));
if(existing.research)throw Error('Knowledge already contains reviewed research; update it through maintenance/REVIEW.md instead of rerunning the historical exporter');
const inventory=JSON.parse(await readFile('data/inventory.local.json','utf8'));
const ledger=JSON.parse(await readFile('evals/runs/suite-2026-10-10T01-43-00.906Z/ledger.json','utf8'));
const research=JSON.parse(await readFile('evals/suite/research.json','utf8'));
const base='https://github.com/bobuel/model-advisor/blob/main/';
const proof={observedAt:inventory.observedAt,harnessVersion:inventory.cliVersion,source:'Codex app-server model/list',scope:'Observed in maintainer account; each user must supply their own current supported options.',models:inventory.models.map(m=>({id:m.id,efforts:m.efforts,description:m.description,effortDescriptions:m.effortDescriptions,speedModes:m.speedModes}))};
await writeFile('knowledge/catalog-proof.json',JSON.stringify(proof,null,2)+'\n');
const observations=ledger.records.map(r=>({taskId:r.taskId,taskCategory:r.family,model:r.configuration.model,effort:r.configuration.effort,speed:null,executionMode:'code-only',harnessVersion:ledger.cliVersion,accessType:ledger.accessType,attempts:1,passed:Number(r.grade.passed),latencyMs:r.latencyMs,observedAt:r.completedAt,source:'synthetic-batch-1',sourceHash:r.sourceHash,suiteHash:ledger.suiteHash}));
await writeFile('knowledge/synthetic-results.json',JSON.stringify({scope:'Six synthetic development tasks, one attempt per configuration; all code reviewed and table-graded. No real-project/tool-use claim.',observations},null,2)+'\n');
const k={schemaVersion:1,version:'2026-10-10.1',reviewedAt:inventory.observedAt,expiresAt:'2026-10-17T17:27:43.181Z',models:inventory.models.map(m=>({id:m.id,efforts:m.efforts,guidance:m.description,source:'codex-catalog'})),effortGuidance:inventory.models[0].effortDescriptions,sources:[{id:'codex-catalog',url:base+'knowledge/catalog-proof.json',kind:'provider-catalog-observation'},{id:'synthetic-batch-1',url:base+'knowledge/synthetic-results.json',kind:'measured-synthetic-tasks'},...research.sources],opinions:research.opinions.filter(o=>o.id!=='minimal-sufficient-effort').map(o=>({id:o.id,kind:'opinion',statement:o.statement,basis:o.basis})),observations};
// This preference is an editorial hypothesis, not a measured model ordering.
k.opinions.push({id:'effort-fit',kind:'opinion',statement:'Use task complexity to choose effort. Low is a plausible starting point for small bounded edits; consider higher effort for difficult reasoning or broad changes. Higher effort is not automatically better. Model descriptions are provider guidance, not benchmark results.',basis:['codex-catalog','routellm']});
validateKnowledge(k);await writeFile('knowledge/current.json',JSON.stringify(k,null,2)+'\n');
console.log(JSON.stringify({version:k.version,models:k.models.length,configurations:k.models.reduce((s,m)=>s+m.efforts.length,0),observations:k.observations.length}));
