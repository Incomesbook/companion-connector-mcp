# V12 Stable Local Fable Reader Status

Goal: make full-folder Fable reading possible without public mirror limits.

## What changed

- Installed Ollama locally.
- Pulled `qwen2.5:0.5b`.
- Started Ollama CPU-only on `127.0.0.1:11435` using `OLLAMA_LLM_LIBRARY=cpu_avx2` because the default GPU path failed with CUDA/PTX errors.
- Patched Fable provider router to default to local Ollama:
  - `OLLAMA_URL=http://127.0.0.1:11435/api/chat`
  - `OLLAMA_MODEL=qwen2.5:0.5b`

## Smoke tests

- Direct Ollama API test: OK.
- Fable JSON-RPC via Ollama: OK.
- Micro-reader 1-task test with 1,000 chars: OK.
- Micro-reader 1-task test with 25,000 chars: OK.

## Full run

Started V12 full review runner:

```text
results\fable_micro_full_review_ollama_v12
```

Runner config:

```json
{
  "model": "qwen2.5:0.5b",
  "provider": "http://127.0.0.1:11435/api/chat",
  "maxChars": 25000,
  "totalTasks": 6042
}
```

Current status at creation time: running, first tasks OK.
