# V25 ChatGPT Chat Reader Executor

V25 improves Fable5 Direct Executor for `FABLE5:` tasks that ask to read a ChatGPT chat URL or an already-open ChatGPT/Edge/Chrome window.

Added behavior:

- Detects `https://chatgpt.com/c/...` URLs in direct Fable5 tasks.
- Opens the URL through the default user browser, not only the isolated controlled Chrome profile.
- Searches for likely windows such as `Codex Chat Watch`, `ChatGPT Classic`, and `ChatGPT`.
- Captures repeated OCR from the matching window.
- Uses local model summarization in Russian from the captured OCR.
- Opens a visible browser message with the Russian summary.
- Saves a full proof log under `results/fable_direct_exec`.

Test command:

```powershell
npm run test:v25
```

Verified result:

```json
{
  "ok": true,
  "actions": ["read_chat_summary_display"],
  "readOk": true,
  "usedQuery": "Codex Chat Watch",
  "ocrChars": 1127,
  "shown": true
}
```

Current limitation:

- If ChatGPT does not expose the full conversation through the visible window or accessible DOM, V25 can only read what OCR can see in the current window.
- In the tested case, the visible text showed the chat title/list and fragments such as `File access blocked, task disabled`, but not the complete hidden conversation history.
- A full hidden-history reader still needs a DOM-accessible logged-in browser tab, exported transcript, or a dedicated scroll/click workflow that successfully opens the target thread content.
