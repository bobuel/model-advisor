# Operations

Deploy one Node service from the Dockerfile. It copies only package files, service code and public knowledge. Pin Railway to an exact passing commit until a release policy is approved. Do not deploy every branch push.

| Variable | Purpose |
| --- | --- |
| `LIQUID_API_KEY` | Server-side owner credential |
| `DECISION_DAILY_LIMIT` | Provider attempts per UTC day; default 0 |
| `ADVISOR_STATE_DIR` | Persistent directory for SQLite quota state |
| `PUBLIC_BASE_URL` | Canonical HTTPS origin |
| `PORT` | Railway listener port; local default 3000 |

Mount a small volume at `/data` and set `ADVISOR_STATE_DIR=/data`. This prevents restarts from resetting the public provider cap. One process/replica is supported; a shared atomic store is needed before scaling. No Redis or separate database is needed for this release. Counts bound attempts, not billing dollars. Hosting and provider billing remain subject to the approved owner budget. No paid model fallback is allowed.

Anonymous users can exhaust the shared cap; the preview has bounded availability. The service limits bursts and allows two in-flight provider calls. Failures enter a persistent one-minute cooldown. No retries occur. Memory cache entries expire after five minutes. No request bodies, IP addresses or credentials enter the quota database.

## Release

1. Pass local tests, knowledge validation and the publication check. Publish the explicit reviewed file list; verify GitHub CI for the exact candidate SHA.
2. Resolve Railway account capacity and budget before provisioning paid runtime resources. Set one replica, persistent state and secrets, then deploy the passing commit.
3. Verify `/health` commit and knowledge hash, `/v1/knowledge`, MCP initialization/tool discovery, privacy information and a bounded real request through the packaged plugin. Health alone is insufficient.
4. Set the verified HTTPS endpoint in `plugins/model-advisor/service.json`; add portable `mcp.json` with streamable-http transport. Verify fresh plugin discovery and invocation before release. Public-directory submission is separate from GitHub publication.

Rollback by redeploying a previous passing commit and its knowledge snapshot; retain quota storage. Expired knowledge still blocks recommendations after rollback. Provider failure returns unavailable, never fabricated guidance.

The application logs startup status only. Platform HTTP logs and Liquid retention are separate; review those before collecting customer tasks. Keep synthetic summaries public and raw local receipts private.
