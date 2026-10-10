# Model advisor local pilot

This is the first local slice of the [service design](https://chatgpt.com/space/page_225809c3e1c88191a8d886e6e3cd24c1). It discovers actual Codex catalog options, validates requested combinations, prepares focused decision-model questions, and ranks responses against explicit evidence. The pilot now uses Liquid d1:free in the decision-model role originally assigned to Jev. It does not yet host an MCP service or maintain a catalog automatically.

## Evaluation suite and latest results

The [suite guide](evals/suite/README.md) contains the research rubric, split policy, commands, results and remaining product gates. The suite now has 36 tasks across 12 families and 154 checks. All 36 reference controls pass and 72 broken controls are rejected; all 66 local tests pass.

The approved first batch completed 18 real Codex subscription runs: six development tasks, once per configuration. Astra/high passed 6/6, Sol 6.1/low passed 6/6, and Luna/low passed 5/6. Default speed was the only setting tested. These are small code-only tasks with recorded runtime configurations, not normal tool-using harness qualification or a general ranking.

Three decision payload variants were implemented and compared: measurements alone, task rubric, and sourced research opinions. Liquid `d1:free` completed 11 responses, all `needs_evidence`; two attempts returned HTTP 429. Work stopped at 13 of the authorized maximum 36 calls, leaving 23 unattempted. There is no winning payload or held-out result yet. The next hypothesis is to provide independent, same-family examples while preserving unseen tasks; whole-family exclusion currently leaves only indirect evidence. No production recommendation policy was promoted from these results.

The latest [offline report](evals/runs/suite-2026-10-10T01-43-00.906Z/report.json) retains separate counts for recommendations, abstentions, provider errors and unattempted calls. Full receipts are local and Git-ignored. This increment reused existing infrastructure and made no deployment changes.

## Run locally

Node 22 or later is sufficient; there are no third-party dependencies.

```powershell
npm run inventory
npm test
node plugins/model-advisor/src/cli.mjs --request plugins/model-advisor/examples/bug-fix-request.json --inventory data/inventory.local.json --evidence plugins/model-advisor/examples/evidence.json
```

Inventory uses only read-only app-server methods. It records safe model/configuration metadata, not account email or credentials, and starts no inference turn. Refresh it after 24 hours. The example configurations were observed in this account's CLI catalog; they are not a portable entitlement list.

The example evidence package is intentionally empty. The command returns `needs_evidence` until real sources or execution receipts are supplied. Unit-test data never enters the example catalog. A dry run is not a recommendation, and catalog discovery is not evidence that an inference ran.

For an initial provisional decision, run `node scripts/prepare-pilot-evidence.mjs` after inventory, then use `--evidence data/pilot-evidence.local.json`. This retains the catalog's actual model and effort descriptions as provider guidance. It contains no measured task results, cost estimates, or latency measurements. The decision model may still find the guidance insufficient.

With reviewed evidence, a securely supplied `LIQUID_API_KEY`, and authorization for a provider call, append `--live --max-input-bytes 16000`. To load the user-created, Git-ignored `.env.local`, place `--env-file=.env.local` immediately after `node`. Never paste the key into chat or package it with the plugin. The adapter permits only Liquid `d1:free`, sends at most one request, has a 15-second timeout, and performs no automatic retries or paid fallback. This model ID is an alias, not an immutable revision. The byte limit bounds request size, not a contractual dollar charge. Paid execution still needs a spending limit. The local process has no durable quota ledger and must not be exposed as a public service.

```powershell
node --env-file=.env.local plugins/model-advisor/src/cli.mjs --request plugins/model-advisor/examples/bug-fix-request.json --inventory data/inventory.local.json --evidence data/pilot-evidence.local.json --live --max-input-bytes 16000
```

## Plugin

The repo marketplace is `.agents/plugins/marketplace.json`; the self-contained plugin is `plugins/model-advisor`. Its `choose-model` skill calls the packaged local CLI. The production design will replace this local transport with a hosted MCP call. Plugin installation and a successful new-session invocation must be verified separately.

Local verification on October 8, 2026: Codex CLI 0.162.0-alpha.2 reports the plugin installed and enabled. A fresh app-server discovers `model-advisor:choose-model` from its installed package. This proves discovery, not successful conversational invocation. The bundled skill validator could not run because its Python environment lacks PyYAML; Codex itself parsed and discovered the skill.

Liquid setup verified October 9, 2026 (America/New_York): the saved key authenticated against Liquid's model catalog (HTTP 200), which listed `d1:free`. Version 0.1.1 is installed, enabled, and discovered by a fresh app-server; all seven packaged files match the source and no `.env` file is packaged. All 15 local tests pass. After explicit user approval of the task/configuration payload, one real request through the installed plugin completed at 2026-10-10T00:50:10Z. The validated response reported `d1:free`, 3,549 input tokens, and zero output tokens; CLI wall time was 660 ms. It returned `needs_evidence`: no candidate reached the task-fit threshold using only provider catalog descriptions. The local receipt is `data/liquid-smoke.local.json`. This proves the decision API path works; it does not establish candidate execution, recommendation quality, or an independently verified billing charge.

## First real task

Copy only `evals/fixtures/merge-intervals/` into a fresh candidate workspace. Run the selected model on its `TASK.md`. Do not copy the grader or evaluator control into that workspace. Grade the candidate module afterward:

```powershell
node evals/grade.mjs <absolute-path-to-candidate-intervals.mjs>
```

Before a tool-using model run, use a permissions boundary that prevents reading evaluator files; a different working directory alone is not isolation. Capture the selected and runtime-observed model/effort/speed, CLI or desktop build, transcript, duration, usage where exposed, and grader result. The code-only pilot below has provider-backed execution receipts; normal tool-using harness execution is still unverified.

The deliberately broken baseline and known-good evaluator control prove the grader can distinguish failures from a valid result. They are not model benchmark results.

## Observed code-only pilot

On October 9, 2026 (America/New_York), all three candidates completed the same synthetic repair through Codex app-server using the existing ChatGPT subscription. `environments: []` disabled environment access, connectors and shell tools were disabled, and the event traces contained zero tool calls. Each candidate received only the task and broken function; the parent reviewed the returned functions and independently applied the seven-case grader. Thread-start responses matched the requested model and effort and reported default service tier. The provider's immutable model revisions were not exposed.

| Requested model | Effort | Checks passed | Observed turn time |
| --- | --- | --- | --- |
| gpt-6-astra | high | 7/7 | 8.324 s |
| gpt-6.1-sol | low | 7/7 | 6.146 s |
| gpt-6-luna | low | 7/7 | 6.419 s |

These are three task attempts, one per configuration. Seven checks are not seven independent task attempts. All candidates tied on correctness. Single sequential latency observations do not establish a reliable speed ranking, and token usage is not a dollar-cost measurement.

The installed plugin then sent the scoped measurement summaries to Liquid `d1:free`. It returned a provisional gpt-6.1-sol/low recommendation and gpt-6-astra/high alternative under the quality policy, using 6,795 input tokens and zero output tokens. This demonstrates the measured-evidence-to-decision path; it does not demonstrate that its small score differences predict better outcomes. Selection used the same fixture that supplied the evidence, so it is not held-out validation.

Local receipts: `evals/runs/code-only-2026-10-10T01-08-01.389Z/summary.json`, per-candidate transcripts and grader results in that run directory, and `data/liquid-measured.local.json`. The evidence uses the separate `bounded-bug-fix-code-only` category so the standard tool-using example does not consume these results as matching evidence.

`node evals/run-code-only.mjs` repeats the three subscription inference calls and saves generated code and receipts; it does not automatically grade or publish new evidence. Review the generated modules, then run the independent grader. Repeating this consumes subscription usage and is not an offline unit test.

Full tool-using runs were stopped before inference: the Windows sandbox rejected the restricted-root policy, then failed setup with the supported explicit-deny policy. Those preflight failures are retained under `evals/runs/`. No host sandbox settings were changed. Repairing and verifying that boundary remains necessary for a normal harness benchmark.

## Evidence record

Each record needs `configuration` (model, effort, speed), `taskCategory`, `harnessVersion`, `accessType`, `source`, `kind`, `observedAt`, and `expiresAt`. Measured records additionally carry `attempts`, `passed`, and optional `estimatedCostUsd` and `latencyMs`. Add a concise `summary` and a receipt reference. Keep unknown metrics absent. Only exact configurations and matching harness/access/task evidence are considered. The current first-match metric selection assumes one current measured record per configuration; consolidation belongs in the maintained catalog publisher.

All decisions remain provisional until the ranking policy is evaluated. Balanced currently uses task fit first. Cost and speed comparisons stop when the required measurements are absent. Evidence describes the task dataset, not guaranteed success for a new user task.

## Reference contracts

- [Codex app-server discovery](https://learn.chatgpt.com/docs/app-server)
- [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [TypeSafe HTTP API](https://docs.typesafe.ai/api)
- [Jev versions and pricing](https://docs.typesafe.ai/models)
- [Liquid decision-model guide](https://docs.liquid.ai/guides/decision-model-guide)

The next validation is repeated runs on distinct tasks with held-out evaluation, plus actual tool-using harness runs after the Windows boundary is verified. A successful decision API response does not establish recommendation quality. This local pilot has not created a Railway deployment, paid API-key run, GitHub repository, or scheduled job.
