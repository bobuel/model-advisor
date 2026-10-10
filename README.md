# Model advisor

A public plugin and service for choosing a model, reasoning effort and supported speed setting for a proposed task. Recommendations combine the user's priorities and current harness options with versioned provider guidance, editorial opinions and measured task results.

**Status: locally verified implementation; hosting is on hold at the owner's $0 budget.** Railway rejected a new project under its free-plan resource limit. The hosted plugin endpoint is not configured yet. No public-service availability or OpenAI directory approval is claimed.

## How it works

The plugin sends a concise task summary and current harness settings to the service. The service loads its repository knowledge snapshot and asks Liquid `d1:free` to choose among all eligible configurations. The answer includes a provisional choice, alternative, source links and knowledge version. Users need no Liquid key; the owner keeps that credential server-side.

The first harness is Codex: seven observed models and 40 model–effort combinations. Default speed is the only verified service setting. Cost optimization returns an evidence gap until verified per-task prices exist; subscription tokens are not dollar prices.

## Evidence as of October 10, 2026

- 136 local tests pass, including 48 task/priority HTTP journeys, a real MCP client, research provenance, the actual LangChain graph with a scripted model, durable quotas and maintenance failures. These controlled provider fixtures test integration, not routing quality.
- Knowledge version 2026-10-10.2 contains six reviewed findings from official model guidance, with section citations, retrieval date and content hash. These findings now enter the decision payload and returned advice. Catalog availability alone cannot justify a recommendation.
- Six real Liquid calls through the packaged client and local service returned provisional recommendations: five Sol 6.1/medium, one Sol 6.1/low. These predate the new research payload. That payload still needs live routing and outcome evaluation; no superiority is established.
- Earlier coding runs: six synthetic tasks, Astra/high 6/6, Sol 6.1/low 6/6, Luna/low 5/6. These are code-only observations, not tool-using project results.
- The broader synthetic suite has 36 tasks and 154 checks. All reference controls pass and 72 broken controls are rejected; only six tasks have live model runs.

See [synthetic evidence](knowledge/synthetic-results.json), [decision-path results](knowledge/decision-path-results.json), [product contract](docs/PRODUCT.md), [release status](docs/RELEASE.md), and [historical pilot notes](docs/LOCAL-PILOT.md).

## Run locally

Node 22.17.0 or newer is required. Its built-in SQLite currently emits an experimental warning.

```sh
npm ci --ignore-scripts
npm test
npm run knowledge:check
npm run suite:validate
npm start
```

The server listens on port 3000 with live provider usage disabled by default. `GET /health` identifies revision and knowledge; `GET /v1/knowledge` exposes the package. `POST /v1/recommend` and Streamable HTTP `POST /mcp` share the same implementation. MCP exposes `recommend_model`.

For authorized live use, supply `LIQUID_API_KEY`, `ADVISOR_STATE_DIR` (persistent storage), and a positive `DECISION_DAILY_LIMIT` through the deployment secret store. Set `PUBLIC_BASE_URL` to the HTTPS origin. No paid fallback or automatic retry exists. Railway requires a mounted volume for live calls. Use one process/replica; scaling needs a shared limiter. See [operations](docs/OPERATIONS.md).

## Plugin

The source package is [plugins/model-advisor](plugins/model-advisor); the repo marketplace is `.agents/plugins/marketplace.json`. The hosted client needs no third-party dependencies. Its `service.json` endpoint is null until a real hosted URL is verified. Developers can pass `--endpoint http://127.0.0.1:3000` for local verification.

The installed pilot and this source package are different releases. Publishing a repository does not install the plugin for users or submit it to the OpenAI public directory. A verified HTTPS MCP endpoint is needed before public-directory submission.

## Maintenance and privacy

GitHub's source watcher checks official model, pricing and decision-model pages twice daily. The existing Codex heartbeat researches substantive changes and follows [the maintainer workflow](maintenance/REVIEW.md). The [LangChain research implementation](maintenance/RESEARCH.md) discovers and reads primary sources and produces a draft for separate review; its live model/search adapters are not yet configured. The first report was researched using Codex web tools. A fetch never silently changes facts or extends freshness. The service uses a pinned knowledge snapshot.

Only synthetic tasks and sanitized summaries belong in this public repo. Do not send secrets or private code in a task summary. The application does not persist request bodies; it uses a five-minute memory cache and a durable date/count quota journal. Requests needing a decision are sent to Liquid. Hosting and provider retention apply separately. Credentials, local inventory, raw traces and runtime databases are excluded from Git and the Docker build.

Remaining: hosting capacity and budget, hosted verification, outcome-based routing evaluation, broader real-project/harness coverage, verified cost/speed options, and observed unattended research.
