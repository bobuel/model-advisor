# 0.2.0 candidate status

Built and locally verified: shared HTTP/MCP/plugin path, 40 available model/effort combinations, sourced knowledge with expiry, durable quotas, response validation and private-request boundaries. All 127 offline tests passed. Six real d1:free calls returned provisional recommendations: five Sol 6.1/medium and one Sol 6.1/low. This is operational evidence, not proof of routing quality.

There have been 19 Liquid attempts across the two evaluation batches, within the approved maximum of 36. No additional coding runs or paid fallback occurred. The source-watch workflow checks three official pages twice daily; all three fetched successfully manually. No unattended research run is yet observed.

The public repository is https://github.com/bobuel/model-advisor. Initial commit `78f46d699a4b7df47cf6c3734b4dfa370763385d` passed [GitHub CI](https://github.com/bobuel/model-advisor/actions/runs/38074346956) and a [manual source-watch run](https://github.com/bobuel/model-advisor/actions/runs/38074370948). The plugin source is v0.2.0; the previously installed local pilot is v0.1.1. The hosted endpoint is not configured.

Codex heartbeat `maintain-model-advisor-research` is active for 06:00 and 18:00 America/New_York. It follows the bounded research workflow, can publish validated repository updates, and cannot make live provider/evaluation calls or infrastructure changes. It depends on local Codex availability. GitHub's twice-daily source checker runs separately. Neither schedule has yet produced a naturally observed unattended maintenance cycle.

The owner authorized a separate Railway project, with budget approval before paid usage. Railway rejected creation with `Free plan resource provision limit exceeded. Please upgrade to provision more resources!` No new project, service, volume or deployment was created; musicapp and eventer remain unchanged.

The owner subsequently chose **$0 hosting and to leave deployment blocked**. Do not upgrade the account, create paid resources, move unrelated services or deploy elsewhere without a new instruction. Repository maintenance remains permitted. Commit `2f0e3733b288512abed44405bfaec70d3d265eb1` passed [CI including the actual Docker build and container health probe](https://github.com/bobuel/model-advisor/actions/runs/38074449676).

The revised plugin workflow was inspected, and its packaged client was exercised in integration and live tests. The bundled Python skill validator could not run because both available Python runtimes lack PyYAML. Fresh installation and conversational invocation of v0.2.0 remain deferred with hosting; the installed v0.1.1 pilot was preserved.

Remaining: account capacity and operating budget, pinned deployment verification, endpoint configuration and public plugin invocation, observation of unattended maintenance, real task outcomes for revised routing, broader harness coverage and verified cost/speed settings. Public-directory acceptance and production acceptance are not claimed.
