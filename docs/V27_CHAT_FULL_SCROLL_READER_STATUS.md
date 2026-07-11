# V27 Chat full-scroll reader status

V27 fixes the failed Fable5 chat-reading test.

Added and changed:

1. Fable5 direct chat reading no longer relies on one visible OCR screenshot.
2. It now uses the source order: ChatGPT tool context -> UI Automation dump -> clicked chat window -> message-area click -> PageUp/scroll capture -> OCR pages.
3. It writes the final result visibly through both Notepad and HTML/browser output.
4. It stores proof logs under `results/fable_direct_exec`.
5. It adds `npm run test:v27`.

Important limitation:

A hidden ChatGPT conversation is not always fully exposed by the UI. When ChatGPT does not expose full DOM/history, V27 collects the best available visible/UIA/OCR pages and uses tool `context` for the current or previous message. This is a real improvement over V26 because it can now capture multiple pages, use context directly, and avoid outputting only sidebar/desktop OCR as the final answer.

Test result:

```json
{
  "ok": true,
  "versionCheck": "v27",
  "actions": ["read_chat_summary_display"],
  "readOk": true,
  "pages": 10,
  "uniquePages": 5,
  "summaryChars": 1127,
  "combinedChars": 37933,
  "shown": true
}
```

Run:

```powershell
npm run test:v27
```
