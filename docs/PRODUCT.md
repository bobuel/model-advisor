# Public model advisor

## User journey and contract

A user installs the public plugin and asks which settings to use for a proposed task. The plugin sends a concise task summary, priority, task category and fresh available harness settings. The public service intersects these options with versioned repository knowledge and asks Liquid d1:free to choose a model and effort. It returns a provisional recommendation, alternative, supported speed behavior, evidence version, source links and limits. The user needs no Liquid key. The plugin does not execute the task or change their settings.

First supported harness: Codex. The knowledge currently describes seven models and 40 effort combinations. Only default speed is verified; no faster service tier is fabricated. Unknown cost cannot answer cost optimization or a monetary ceiling. Other harnesses need their own capability discovery and tests.

The service and production evaluations share one preparation and validation implementation. Relevant previous tasks remain available. The target task's outcomes are excluded from replay evaluation. Whole-family exclusion is a separate stress test, not the main production test. Protocol tests with mocked provider answers prove integration, not recommendation quality; live decision tests prove real provider behavior, not task success.

## Components and authority

The public GitHub repository owns code, knowledge versions, source references, editorial opinions, synthetic receipts, evaluations and release history. Railway hosts one Node HTTP/MCP service. Liquid is only a decision provider; it does not research or update the repository. Codex can perform the research/review maintenance using its existing web tools; no additional paid inference provider is presumed.

User instructions govern scope, then this product contract, shared code contracts and tests. Public status must distinguish built, locally tested, published, deployed, naturally observed and owner accepted.

The package contains provider guidance, editorial opinions and measured observations with separate provenance. A new model requires capability discovery and evaluation. A pricing change invalidates affected cost claims and decision cases. A source-content change opens a review task; fetching a page does not certify that its interpretation is correct. Refreshing timestamps without reviewing substantive facts is forbidden.

## Operating boundaries

No end-user prompts, code, credentials, IP addresses or raw request bodies belong in the public repository. Only explicitly synthetic cases are published. Incoming summaries go to the service and Liquid when a provider call is made; request bodies are not written to application logs or quota state. A short-lived memory cache uses a random keyed hash and disappears on restart. Responses identify their knowledge version.

An anonymous public endpoint needs bounded provider usage. Reserve attempts durably before sending them, including failures and timeouts. Do not retry or fall back to paid models. Enforce a global budget, bounded concurrency and cooldown after errors. Store only date and count in the quota journal. Hosting requires one process/replica and a persistent state directory; refuse live inference without the quota journal. A replica count greater than one needs a shared atomic store before scaling. Default live allowance is zero until explicitly configured.

Knowledge is pinned in the deployment artifact. Changes pass tests before release. A Git revert/redeploy restores an earlier knowledge version; stale knowledge returns an explicit unavailable status. Provider outage returns unavailable, never an invented decision. Repository publication is not OpenAI public-directory approval.

## Workstreams and acceptance

1. Shared decision path: full supported candidate set, source-backed guidance, deterministic eligibility and strict response validation. Test requests and exclusions before provider calls; preserve target-task isolation.
2. Public knowledge and release: sanitized source snapshot, measured synthetic evidence, version/hash, CI checks, rollback instructions. No `.env`, private account metadata or raw local traces in publication.
3. Hosted service and plugin: HTTP and MCP call the same function; secret remains server-side; run the actual packaged client and MCP client against the server. Then verify the deployed commit, health, knowledge version and a real recommendation.
4. Maintenance: twice-daily change detection and research review, bounded work and deduplication; only validated releases affect serving. Evidence of a manual run does not establish unattended operation.
5. Public release: existing infrastructure inspected; target and operating budget resolved; repository and plugin publicly accessible; service observed; limitations accurately documented. Public-directory submission is a separate platform review.

## Current infrastructure finding

On October 10, the connected Railway account exposed musicapp and eventer only. No advisor service or matching GitHub repository was found. This folder was not a Git checkout. Existing unrelated applications must not be repurposed. A separate Railway target and its operating allowance remain an owner decision; implementation and local verification can proceed independently.
