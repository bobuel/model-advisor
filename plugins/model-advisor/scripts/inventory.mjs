import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Read-only discovery. Never starts an inference turn or prints credentials.
const binary = process.platform === 'win32' ? 'codex.exe' : 'codex';
const cliVersion = execFileSync(binary, ['--version'], { encoding: 'utf8', windowsHide: true }).trim();
const child = spawn(binary, ['app-server', '--listen', 'stdio://'], {
  stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});
child.stderr.resume(); // Logs may contain local account details; do not persist them.
const pending = new Map();
let sequence = 0;
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let response;
  try { response = JSON.parse(line); } catch { return; }
  const waiting = pending.get(response.id);
  if (!waiting) return;
  clearTimeout(waiting.timer);
  pending.delete(response.id);
  if (response.error) waiting.reject(new Error(`Discovery RPC failed (${response.error.code})`));
  else waiting.resolve(response.result);
});
child.on('error', () => { for (const p of pending.values()) p.reject(new Error('Cannot start Codex app-server')); });
function call(method, params) {
  return new Promise((resolveCall, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Discovery timed out: ${method}`)); }, 25000);
    pending.set(id, { resolve: resolveCall, reject, timer });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
try {
  const runtime = await call('initialize', { clientInfo: { name: 'model_advisor_inventory', version: '0.1.0' } });
  child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
  const configResult = await call('config/read', { includeLayers: false });
  const config = configResult.config ?? {};
  const accountResult = await call('account/read', { refreshToken: false });
  const skillsResult = await call('skills/list', { cwds: [process.cwd()], forceReload: true });
  const pluginSkills = (skillsResult.data ?? []).flatMap(entry => entry.skills ?? []).filter(s => s.name?.includes('choose-model') || s.path?.includes('model-advisor')).map(s => ({ name: s.name, path: s.path }));
  const models = [];
  let cursor;
  do {
    const result = await call('model/list', { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) });
    models.push(...result.data.map(m => ({
      id: m.model, displayName: m.displayName, isDefault: m.isDefault,
      description: m.description ?? null,
      defaultEffort: m.defaultReasoningEffort,
      efforts: m.supportedReasoningEfforts.map(e => e.reasoningEffort),
      effortDescriptions: Object.fromEntries(m.supportedReasoningEfforts.map(e => [e.reasoningEffort, e.description])),
      modalities: m.inputModalities ?? [],
      // The discovery response may not expose service-tier support.
      speedModes: m.supportedServiceTiers ?? null,
      evidenceStatus: 'cataloged', executionVerified: false,
    })));
    cursor = result.nextCursor;
  } while (cursor);
  const inventory = {
    schemaVersion: 1, observedAt: new Date().toISOString(),
    source: 'Installed Codex CLI app-server model/list; desktop menu not inspected',
    cliVersion, platform: runtime.platformOs ?? process.platform,
    accessType: accountResult.account?.type ?? 'unknown',
    defaults: {
      model: config.model ?? null,
      effort: config.model_reasoning_effort ?? null,
      serviceTier: config.service_tier ?? null,
    },
    models,
    pluginSkills,
    limitations: ['Catalog presence is not successful inference evidence.', 'CLI discovery does not prove desktop-menu visibility.', 'Unknown speed options are not fabricated.'],
  };
  await mkdir('data', { recursive: true });
  await writeFile('data/inventory.local.json', JSON.stringify(inventory, null, 2) + '\n');
  console.log(JSON.stringify({ output: resolve('data/inventory.local.json'), ...inventory }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  lines.close();
  child.stdin.end();
  child.kill();
}
