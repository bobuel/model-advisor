// Synthetic user journeys. These are service contract cases, not model-performance labels.
export const journeys=[
  ['small-edit','collections','Rename a local variable and adjust two call sites; preserve behavior.','tools'],
  ['parser-bug','text','Fix an escaped-quote CSV parser bug and add a regression check.','code-only'],
  ['merge-patch-new','objects','Implement a merge patch that preserves literal object keys and never mutates its input.','code-only'],
  ['frontend','ui','Make a checkout form usable on a small phone and verify keyboard navigation.','tools'],
  ['migration','database','Plan a backward-compatible database migration with a tested rollback.','tools'],
  ['race','concurrency','Find an intermittent duplicate-payment race and verify idempotency under retries.','tools'],
  ['docs','documentation','Improve the installation guide using the existing commands; check the steps.','tools'],
  ['architecture','architecture','Compare two designs for a multi-tenant job service with failure recovery and quotas.','tools'],
  ['tests','testing','Write independent tests for a cache with TTL expiration and eviction.','code-only'],
  ['security','security','Review authentication boundaries and propose fixes with exploit regression tests.','tools'],
  ['research','research','Find current official documentation for the service APIs and cite supporting sources.','tools'],
  ['large-refactor','refactor','Refactor a shared interface across four packages without breaking downstream clients.','tools']
].map(([id,taskCategory,task,executionMode])=>({id,taskCategory,task,executionMode}));
