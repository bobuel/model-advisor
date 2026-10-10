// Offline reporting only. Preserve the original run and provider receipts.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import {configKey} from '../../plugins/model-advisor/src/advisor.mjs';
import {hash} from './grade.mjs';
import {median,outcomeMetrics} from './payloads.mjs';
const {values}=parseArgs({options:{run:{type:'string'}}});
if(!values.run)throw Error('Supply --run <suite-run-directory>');
const directory=resolve(values.run);
const ledger=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8'));
const comparison=JSON.parse(await readFile(join(directory,'comparison.json'),'utf8'));
if(ledger.suiteHash!==comparison.suiteHash)throw Error('Mismatched experiment receipts');
const configurations=[...new Map(ledger.records.map(r=>[configKey(r.configuration),r.configuration])).values()];
const groups=configurations.map(configuration=>{
  const rows=ledger.records.filter(r=>configKey(r.configuration)===configKey(configuration));
  return {configuration,attempts:rows.length,passed:rows.filter(r=>r.grade?.passed).length,medianLatencyMs:median(rows.map(r=>r.latencyMs)),failures:rows.filter(r=>!r.grade?.passed).map(r=>({taskId:r.taskId,grade:r.grade,error:r.error}))};
});
const metrics={};
for(const priority of ['quality','speed'])for(const variant of comparison.variants)metrics[`${priority}:${variant}`]=outcomeMetrics(comparison.decisions.filter(d=>d.priority===priority&&d.variant===variant),ledger.records);
const report={generatedAt:new Date().toISOString(),ledgerHash:hash(ledger),comparisonHash:hash(comparison),suiteHash:ledger.suiteHash,split:ledger.split,mode:ledger.mode,coding:{planned:ledger.codingCalls,attempted:ledger.attempted,groups},liquid:{status:comparison.status,planned:comparison.planned,attempted:comparison.attempted,unattempted:comparison.planned-comparison.attempted,responses:comparison.decisions.filter(d=>d.result).length,providerErrors:comparison.decisions.filter(d=>d.error).length,metrics},conclusion:'Incomplete development experiment; do not select or promote a payload from these results. No held-out validation or tool-using harness claim.'};
const path=join(directory,'report.json');await writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({path,...report},null,2));
