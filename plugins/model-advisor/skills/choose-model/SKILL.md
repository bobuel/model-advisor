---
name: choose-model
description: Recommend a model, reasoning effort and supported speed setting for a proposed task using the public model-advisor service. Use when the user asks which settings to use before starting work.
---

Capture a short task summary, the kind of work, and priority: balanced, quality, speed or cost. Infer routine details; ask only when missing information materially changes the recommendation. Send summaries, not private code, credentials or full conversation history.

Use the service's `recommend_model` MCP tool when connected. Supply actual current harness options, version, access type and inventory timestamp. This release supports Codex only. Catalog availability is not successful task execution. Never invent speed modes.

For the packaged CLI path, run `../../scripts/inventory.mjs` from the user's working directory to obtain safe metadata in `data/inventory.local.json`. Resolve bundled paths relative to this skill directory. Prepare a request with `task`, `taskCategory`, `priority`, and `executionMode` (`tools` for normal work; `code-only` only when no tools will be used). Optional `constraints.allowedModels` restricts choices. Then run:

```sh
node <plugin-root>/src/hosted-cli.mjs --request <request.json> --inventory <inventory.json>
```

The client reads the endpoint from `../../service.json`. If null, report that this package's hosted release is unavailable. Developers can pass `--endpoint` for local verification. End users need no Liquid key; credentials belong to the service. Do not fall back to the historical local-provider CLI.

Present the recommendation, effort, default-speed instruction, alternative, reason and source/version information. Preserve provisional, stale, unavailable and insufficient-evidence statuses. Decision confidence is not a task-success probability. Unknown costs remain unknown; subscription usage cannot establish dollar prices. Advice does not change settings or authorize execution of the proposed task.
