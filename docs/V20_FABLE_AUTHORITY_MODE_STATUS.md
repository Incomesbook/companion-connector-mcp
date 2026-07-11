# V20 Fable Authority Mode

V20 adds a proof layer around Fable5 decisions. The goal is to stop relying on verbal claims such as "Fable was asked" and instead create a local, inspectable decision trail.

## Implemented tools

- `fable_authority_proposal` — creates a Fable5 proposal prompt, optionally runs Fable5, and saves the result to the authority decision log.
- `fable_authority_disagreement` — records ChatGPT disagreement with Fable5 and can re-ask Fable5.
- `fable_authority_decision_log` — reads recent authority records.
- `fable_authority_dashboard` — builds JSON/HTML dashboard of what Fable saw, decided, executed, and blocked.
- `fable_autopilot_dry_run` — runs observe/plan/action/observe in dry-run mode.
- `fable_autopilot_execute` — runs observe/plan/action/observe in execute mode using only the allowlist.

## Decision log storage

Authority records are written to:

```text
results\fable_authority\decision_log.jsonl
results\fable_authority\dashboard.json
results\fable_authority\dashboard.html
```

Each tool call is also logged with:

```text
decidedBy: Fable5 | ChatGPT | User
tool
ok/error
inputSha256
outputSha256
inputPreview
outputPreview
```

## Live agent proof chain

`live_agent_cycle`, `fable_autopilot_dry_run`, and `fable_autopilot_execute` now store:

```text
observation
Fable plan
executed action / dry-run action
result screenshot / after observation
cycle JSON path
authority log record
```

The action allowlist is limited to browser navigation/click/type/key and human screen focus/click/type/key/scroll. Destructive filesystem actions are not in the live autopilot allowlist.

## Validation

Validated locally:

```text
npm run test:v20: OK
node scripts/v20-fable-proposal-smoke.js: OK, status=fable_returned
AskFable final validation: APPROVE
```

Fable final validation log:

```text
J:\Setup_VcCode_Workspace\S08_Notes_and_Logs\Fable_Jobs\Logs\20260711_051924_ASK_FABLE5_-_Final_V20_validation._Authority_logs_disagreeme.txt
```

## Current limitation

This makes Fable5 decisions auditable and executable through the CompanionConnector allowlist. It does not turn Fable5 into an unrestricted root agent. Direct actions still pass through CompanionConnector gates and logs.
