import {readFile,writeFile} from 'node:fs/promises';
const receipt=JSON.parse(await readFile('evals/runs/production-path-2026-10-10/receipt.json','utf8'));
const result={scope:'Six synthetic task summaries through the actual hosted-client and local service with real d1:free responses. No task execution or comparative routing quality is established.',finishedAt:receipt.finishedAt,providerCalls:receipt.providerCalls,status:receipt.status,results:receipt.results.map(r=>({id:r.id,task:r.request.task,taskCategory:r.request.taskCategory,priority:r.request.priority,executionMode:r.request.executionMode,payloadHash:r.payloadHash,result:r.result}))};
await writeFile('knowledge/decision-path-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({publishedSyntheticDecisions:result.results.length}));
