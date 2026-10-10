import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import {tasks} from './catalog.mjs';
import {grade,suiteHash,hash} from './grade.mjs';
const {values}=parseArgs({options:{run:{type:'string'},review:{type:'string'}}});
if(!values.run||!values.review)throw Error('Provide --run and --review <hash-bound manual-review.json>');
const directory=resolve(values.run),ledger=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8')),review=JSON.parse(await readFile(values.review,'utf8'));
if(ledger.suiteHash!==suiteHash)throw Error('Suite changed since generation');
if(!review.reviewer||!Array.isArray(review.approved))throw Error('Missing explicit code review');
for(const r of ledger.records){
  if(r.status==='execution_failed')continue;
  if(!['generated','graded'].includes(r.status))throw Error('Incomplete attempt must be reconciled before grading');
  const source=await readFile(join(r.folder,'candidate.mjs'),'utf8');
  if(hash(source)!==r.sourceHash||!review.approved.some(a=>a.jobIndex===r.jobIndex&&a.sourceHash===r.sourceHash))throw Error('Candidate changed or was not reviewed');
  r.grade=grade(tasks.find(t=>t.id===r.taskId),source);r.status='graded';
}
ledger.review={reviewer:review.reviewer,approvedAt:review.approvedAt,reviewHash:hash(review)};
await writeFile(join(directory,'ledger.json'),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify(ledger.records.map(r=>({jobIndex:r.jobIndex,task:r.taskId,model:r.configuration.model,passed:r.grade?.passed??false,checks:r.grade?`${r.grade.checksPassed}/${r.grade.checksTotal}`:null,latencyMs:r.latencyMs})),null,2));
