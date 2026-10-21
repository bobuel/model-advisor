# Current repository status — October 21, 2026

The cleanup candidate refreshes knowledge to 2026-10-21.1 after reviewing all three required sources. The Liquid guide now fetches successfully with TLS verification enabled. Max and Ultra findings have separate model scopes; Luna remains limited to Max. The original 18 synthetic observations and all prior live-call records are preserved.

The source-watch workflow remains manually disabled. Its only observed run is the successful October 10 manual check. Current Codex-heartbeat enablement and unattended execution were not verified; earlier schedule statements below are historical. Hosting remains on hold at $0, with no public endpoint configured. This is repository publication, not a hosted-service launch. Validation and commit evidence are recorded in the cleanup PR and the source-review record.

## Historical release record — October 10, 2026

### 0.2.0 candidate status

Built and locally verified: shared HTTP/MCP/plugin path, 40 available model/effort combinations, sourced knowledge with expiry, durable quotas, response validation and private-request boundaries. All 136 offline tests passed. Six real d1:free calls returned provisional recommendations: five Sol 6.1/medium and one Sol 6.1/low. This is operational evidence, not proof of routing quality.

The research update adds six substantive, reviewed official-source findings to knowledge 2026-10-10.2 and the production payload. The LangChain OSS research graph is implemented and exercised offline with a scripted model. The initial findings came from actual Codex web research, not that test. A live LangChain model/search adapter is not configured, and the changed routing payload has not had additional live calls. The existing Codex heartbeat remains the scheduled research mechanism. See `maintenance/RESEARCH.md` for source pins, publication boundaries and the research-only dependency advisory.

There have been 19 Liquid attempts across the two evaluation batches, within the approved maximum of 36. No additional coding runs or paid fallback occurred. The source-watch workflow checks three official pages twice daily; all three fetched successfully manually. No unattended research run is yet observed.

The public repository is https://github.com/bobuel/model-advisor. Initial commit `78f46d699a4b7df47cf6c3734b4dfa370763385d` passed [GitHub CI](https://github.com/bobuel/model-advisor/actions/runs/38074346956) and a [manual source-watch run](https://github.com/bobuel/model-advisor/actions/runs/38074370948). The plugin source is v0.2.0; the previously installed local pilot is v0.1.1. The hosted endpoint is not configured.

Codex heartbeat `maintain-model-advisor-research` is active for 06:00 and 18:00 America/New_York. It follows the bounded research workflow, can publish validated repository updates, and cannot make live provider/evaluation calls or infrastructure changes. It depends on local Codex availability. GitHub's twice-daily source checker runs separately. Neither schedule has yet produced a naturally observed unattended maintenance cycle.

The owner authorized a separate Railway project, with budget approval before paid usage. Railway rejected creation with `Free plan resource provision limit exceeded. Please upgrade to provision more resources!` No new project, service, volume or deployment was created; musicapp and eventer remain unchanged.

The owner subsequently chose **$0 hosting and to leave deployment blocked**. Do not upgrade the account, create paid resources, move unrelated services or deploy elsewhere without a new instruction. Repository maintenance remains permitted. Commit `2f0e3733b288512abed44405bfaec70d3d265eb1` passed [CI including the actual Docker build and container health probe](https://github.com/bobuel/model-advisor/actions/runs/38074449676).

The revised plugin workflow was inspected, and its packaged client was exercised in integration and live tests. The bundled Python skill validator could not run because both available Python runtimes lack PyYAML. Fresh installation and conversational invocation of v0.2.0 remain deferred with hosting; the installed v0.1.1 pilot was preserved.

Remaining: account capacity and operating budget, pinned deployment verification, endpoint configuration and public plugin invocation, observation of unattended maintenance, real task outcomes for revised routing, broader harness coverage and verified cost/speed settings. Public-directory acceptance and production acceptance are not claimed.
