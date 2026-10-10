import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { prepare, evaluate } from './advisor.mjs';

try {
  const { values } = parseArgs({ options: {
    request: { type: 'string' }, inventory: { type: 'string' }, evidence: { type: 'string' },
    live: { type: 'boolean', default: false }, 'max-input-bytes': { type: 'string', default: '16000' },
  }});
  for (const key of ['request', 'inventory', 'evidence']) if (!values[key]) throw new Error(`Missing --${key} file.`);
  const [request, inventory, evidence] = await Promise.all(['request','inventory','evidence'].map(async key => JSON.parse(await readFile(values[key], 'utf8'))));
  const decision = prepare(request, inventory, evidence);
  const result = values.live ? await evaluate(decision, { apiKey: process.env.LIQUID_API_KEY, maxInputBytes: Number(values['max-input-bytes']) }) : { ...decision, mode: 'dry_run', providerCalled: false };
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
