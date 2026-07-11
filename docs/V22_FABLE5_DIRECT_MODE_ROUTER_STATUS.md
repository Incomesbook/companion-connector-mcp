# V22 Fable5 Direct Mode Router

V22 adds a cleaner direct route to Fable5 and a capability-review route.

## New tools

- `fable5`
- `fable5_direct_mode_manifest`
- `fable_capability_snapshot`
- `fable_capability_review`
- `fable5_request_chatgpt_help`

## Trigger words

Use one of these at the beginning of a message:

- `FABLE5:`
- `@Fable5`
- `F5:`
## Important truth

An MCP connection cannot replace ChatGPT's base model by itself. It exposes tools, resources and prompts.

The practical setup is:

1. The app is connected to CompanionConnector.
2. The user starts with `FABLE5:` / `@Fable5` / `F5:`.
3. The assistant routes the message to the `fable5` MCP tool.
4. Fable5 answers.
5. If Fable5 needs ChatGPT help, it creates a record through `fable5_request_chatgpt_help`.

## Direct CLI

```powershell
.\Fable5-Direct.ps1 "your task"
.\Fable5-Direct-Dashboard.ps1
```

## Capability review

`fable_capability_snapshot` writes the full tool/doc list to:

`results\fable_authority\V22_FULL_CAPABILITIES_FOR_FABLE.json`

`fable_capability_review` sends that list to Fable5 and logs the result in authority records.
