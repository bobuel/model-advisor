# Model-advisor evaluation suite

The intended journey is: a user describes a task and priorities in their plugin; the service returns a supported model, effort and speed setting, an explanation, and the limits of its evidence. This suite tests the decision evidence and payload locally before that service is promoted. It adds no infrastructure.

## What is built

There are 36 synthetic pure-function tasks, 12 families, three difficulty levels per family, and 154 table checks. Families stay together in development (18 tasks), selection (9), or held-out (9). Every reference passes; a null implementation and an implementation overfitted to the first expected answer fail for each task (72 rejected controls). These controls validate basic grader discrimination, not exhaustive task correctness or benchmark quality.

Candidate prompts contain task descriptions and starter code only. References and checks stay outside the candidate's environment. Live runs use Codex app-server with `environments: []`, tools and integrations disabled, existing ChatGPT subscription access, and recorded runtime model/effort/default speed. Returned code must be inspected before grading. Node's VM is not a security boundary; never grade arbitrary unreviewed code through this runner.

The runner rotates configuration order and records attempted calls before sending them. There are no hidden retries. A complete three-repetition sweep would consume 324 coding turns: 162 development, 81 selection, 81 held-out. That larger sweep has not been authorized or run. The first approved batch was 18 coding runs and up to 36 Liquid calls.

## Observed first batch, October 9, 2026 (New York)

Six medium development tasks were executed once with each configuration. Each task must pass every check and preserve its input.

| Configuration | Tasks passing | Median observed turn time |
| --- | --- | --- |
| gpt-6-astra / high / default speed | 6/6 | 11.24 s |
| gpt-6.1-sol / low / default speed | 6/6 | 9.41 s |
| gpt-6-luna / low / default speed | 5/6 | 3.73 s |

Luna's merge-patch implementation failed to preserve a literal `__proto__` property. This failure was caught by a pre-existing check. All candidate source was inspected before execution, and all 18 runtime receipts matched the requested model and effort. The other 30 tasks have control validation only, not model execution evidence. One attempt per task is too little for reliability or a general model ranking. These are configurations, so model and effort effects cannot be separated. Default speed was the only service setting tested; faster observed time is not evidence for a separate supported speed setting. Costs remain unknown.

Three payloads were prepared: `v0-measured` (observations), `v1-task-rubric` (adds acceptance criteria and uncertainty), and `v2-research-opinion` (adds sourced, labeled priors). Quality and speed priorities produced 36 planned decisions. The target task and its entire family were excluded from input evidence.

The experiment stopped after 13 attempts: 11 responses, all `needs_evidence`, and two HTTP 429 errors. The first error was retained while unattempted calls resumed with 10-second pacing; work stopped when rate limiting recurred. Twenty-three calls remain unattempted. No failed request was retried and no paid fallback was used. Unequal, incomplete coverage prevents selecting a winning payload or estimating an opinion lift. Deliberate abstentions, provider errors, and unattempted calls are reported separately.

Receipts: `../runs/suite-2026-10-10T01-43-00.906Z/ledger.json`, `manual-review.json`, `comparison.json`, and `report.json`. Raw provider comparison receipts remain unchanged; the offline report is derived from them. Source payload hashes are saved for each attempted decision. The experiment predates the release-seal metadata and cannot serve as a sealed selection report.

## Research and the next payload revision

`research.json` separates sources, observations, and opinions. The rubric favors correctness before speed/cost, treats sparse evidence cautiously, and restricts claims to the tested harness. It draws on [Anthropic's agent-evaluation methodology](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [OpenAI's benchmark audit](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/), [RouteLLM](https://arxiv.org/abs/2406.18665), and [Liquid's decision-model guide](https://docs.liquid.ai/guides/decision-model-guide). These sources justify evaluation methods; they do not prove a ranking of these three models. Model-specific research claims remain empty rather than invented.

The next hypothesis is that strict family exclusion makes the decision input too indirect. Add separate same-family development and unseen evaluation examples, while retaining whole-family holdouts to test unfamiliar work. Freeze that split before new inference. Include harness-supported capability facts with provenance alongside those measurements. Keep target answers and outcomes out of the payload. Compare the revised payload against the current one on identical tasks; do not simply lower the fit threshold to produce recommendations. This revision is proposed, not measured.

Preserve raw fit scores and score distributions in future experiment receipts so abstention can be diagnosed; the current production adapter only retains a reason when no candidate reaches its threshold. Research opinions should be evaluated by improved task outcomes, coverage and time against fixed and evidence-only baselines, not by whether Liquid agrees with the author's preferred brand. Repeat each configuration and retain failures in the denominator. Baseline comparisons must use the same evaluated task subset and independent development evidence. The incomplete first comparison provides no routing superiority claim.

## Local workflow

These commands are offline:

```powershell
npm test
npm run suite:validate
npm run suite:plan
node evals/suite/run.mjs --split selection --cohort all --repetitions 3 --max-calls 81
node evals/suite/compare.mjs --run <graded-run-directory> --development-run <development-run-directory>
node evals/suite/summarize.mjs --run <run-directory-with-comparison>
```

Only add `--live` to a run or comparison command when its resulting usage is authorized. Coding jobs consume subscription usage. Liquid uses `d1:free` only, with the existing secret supplied through `node --env-file=.env.local`; keys never enter receipts. Explicit caps bound call counts, not independently verified dollar charges. Refresh inventory before live coding if older than 24 hours.

After reading every returned module and confirming it is safe for the local grader, create a review record with `reviewer`, `approvedAt`, and `approved: [{jobIndex, sourceHash}]`. Then:

```powershell
node evals/suite/review-grade.mjs --run <run-directory> --review <review.json>
```

Selection comparisons use development evidence via `--development-run`. After a completed selection comparison, freeze a selected variant and a written justification:

```powershell
node evals/suite/release.mjs --variant v1-task-rubric --selection <selection-comparison.json> --reason "Explain measured selection" --out <seal.json>
```

Held-out generation and comparison require `--release-seal <seal.json>`. Suite, payload source, and research hashes must match. Held-out outcomes never feed the payload. Reusing a holdout to tune a later revision makes it development evidence; create a fresh holdout for an honest later release assessment. Hash checks enforce artifact consistency, not a blinded human process.

## What remains before the product promise is proven

The full tool-using Windows harness boundary failed preflight earlier; no sandbox repair or host infrastructure change was attempted here. These code-only results do not establish filesystem repair, multi-file changes, browser tasks, debugging with tools, or real-project success. That broader suite and its isolation must be qualified before publishing normal harness recommendations.

Research refresh twice daily, model/pricing-change triggers, Railway hosting, maintained GitHub releases and public plugin delivery remain product work beyond this local evaluation increment. No background refresh was scheduled and no deployment was performed. Research has an explicit expiry; unknown pricing cannot produce cost recommendations. A model release needs discovery and new measurements; a price change needs affected price records and routing decisions reevaluated, not automatic model retraining.
