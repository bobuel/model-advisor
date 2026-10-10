import { readFile, writeFile } from 'node:fs/promises';
const inventory=JSON.parse(await readFile('data/inventory.local.json','utf8'));
const request=JSON.parse(await readFile('plugins/model-advisor/examples/bug-fix-request.json','utf8'));
const records=request.configurations.flatMap(configuration=>{
  const model=inventory.models.find(m=>m.id===configuration.model);
  if(!model?.description) return [];
  return [{
    configuration, taskCategory:request.taskCategory, harnessVersion:inventory.cliVersion,
    accessType:inventory.accessType, kind:'provider_guidance',
    source:`Codex model/list observation ${inventory.observedAt}`,
    observedAt:inventory.observedAt, expiresAt:new Date(Date.parse(inventory.observedAt)+86400000).toISOString(),
    summary:{modelDescription:model.description,effortDescription:model.effortDescriptions[configuration.effort]??null},
    limitations:['General provider catalog description, not an independent task measurement.','Attached to this task for assessment; task suitability and exact configuration performance are not established.'],
  }];
});
await writeFile('data/pilot-evidence.local.json',JSON.stringify({version:`catalog-guidance-${inventory.observedAt}`,records},null,2)+'\n');
console.log(JSON.stringify({output:'data/pilot-evidence.local.json',records:records.length,kind:'provider_guidance',measuredTaskRuns:0}));
