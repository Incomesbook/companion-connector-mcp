# V19 Live Agent Loop Status

V19 adds the observe -> Fable plan -> safe action -> optional after-snapshot loop.

New MCP tools:

- `live_agent_observe`
- `live_agent_fable_plan`
- `live_agent_apply_action`
- `live_agent_cycle`

The loop uses existing V16/V17 capabilities:

- desktop screenshots
- screen OCR
- active window detection
- visible window list
- browser DOM snapshots when requested
- safe allowlisted browser/human actions

Safety model:

- Fable must return JSON action plans.
- Allowed actions are restricted to browser navigation/click/type/key and human focus/click/type/key/scroll.
- `live_agent_apply_action` is dry-run unless `execute=true`.
- `live_agent_cycle` logs every observation, plan, and action result into the session folder.
- Destructive file actions are not part of the live-agent allowlist.

Validated tests:

- `npm run test:v19`
- `npm run test:v19:fable`

V19 does not claim autonomous perfection. It provides the durable live agent loop so ChatGPT/Fable can repeatedly see state, decide, and act with an audit trail.
