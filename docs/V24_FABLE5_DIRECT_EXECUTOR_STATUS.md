# V24 Fable5 Direct Executor

V24 changes Fable5 direct mode from reply-only into execute mode.

## New behavior

`fable5` now routes to `fable5_execute` internally. A direct Fable5 message creates a Fable record, builds an allowlisted local action plan, executes safe operations, and writes a proof log.

## New tool

- `fable5_execute`

## Execution proof

Proof files are written under:

```text
results\fable_direct_exec\<task_id>.json
```

Each proof file includes:

```text
- original user task
- Fable5 reply record
- action plan
- executed actions
- current/after observations
- screenshot paths
- OCR paths/text where available
```

## Test case

The V24 test asks Fable5 direct mode to:

```text
Open Chrome, observe current ChatGPT screen if available, then display a visible completion message.
```

Verified actions:

```text
browser_start
observe_current_chat
display_message
```

## Important limitation

The connector can OCR the visible ChatGPT window and can operate controlled browser windows. It cannot magically read hidden chat history from the ChatGPT UI unless the transcript is exported/passed, the browser DOM is reachable, or the relevant text is visible/scrollable.

So V24 can observe visible ChatGPT screen content and store proof, but full hidden chat history still requires transcript access or a browser/session/DOM route.
