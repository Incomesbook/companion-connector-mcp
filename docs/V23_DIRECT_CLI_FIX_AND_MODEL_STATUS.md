# V23 Direct CLI Fix and Model Status

## Why V23 was needed

User tested `Fable5-Direct.ps1` locally and found that this failed:

```powershell
.\Fable5-Direct.ps1 Yeah. "Запусти новый Хром."
```

PowerShell reported that a positional parameter could not accept the second argument.
The direct script accepted only one positional string, so natural multi-word usage broke.

## Fixed

- `Fable5-Direct.ps1` now accepts all remaining arguments and joins them into one task.
- JSON body is sent as explicit UTF-8 bytes with `charset=utf-8`.
- Cyrillic task text is preserved.
- Common safe browser-start intent starts controlled Chrome through `browser_start` and logs the Fable5 reply.
- `-Strong` uses `qwen2.5:3b` through direct Ollama local model path.
- Default mode keeps the fast Fable server path so existing MCP connections do not stall.

## Current local models

```text
qwen2.5:0.5b  fast fallback
qwen2.5:3b    stronger local direct option
```

There is no truly unlimited-token local model. Larger models can be added later, but they increase latency and may hang the Fable connector on this PC.

## Working commands

```powershell
.\Fable5-Direct.ps1 Yeah. "Запусти новый Хром."
.\Fable5-Direct.ps1 "Запусти новый Хром."
.\Fable5-Direct.ps1 -Strong "сложная аналитическая задача"
```

## Proof

`test_direct_exact.ps1` executed the exact failing command successfully and started/confirmed controlled Chrome on port 9222.

`test_direct_strong.ps1` confirmed `qwen2.5:3b` is used when `-Strong` is passed.
