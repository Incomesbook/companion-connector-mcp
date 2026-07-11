# V26 Context + UIA + Visible Output Status

V26 fixes the direct Fable5 chat-reader path after the user reported that the previous test did not show a useful on-screen message.

Added/changed:

- `uia_bridge.py` for UI Automation access to ChatGPT Classic / browser windows.
- `fable5_execute` now recognizes ChatGPT conversation URLs and chat-reading requests.
- Direct chat reading now combines:
  - user-supplied `context`,
  - UIA text from ChatGPT windows,
  - OCR text from the target window.
- Result display is no longer only a controlled Chrome tab. It now also writes and opens:
  - `results/fable_visible_messages/*.txt` in Notepad,
  - `results/fable_visible_messages/*.html` in the default browser.
- Summary generation has a fast deterministic fallback so local Ollama does not hang the whole direct-execute path.

Important limitation:

A local MCP tool cannot magically read hidden ChatGPT conversation history unless one of these is available:

1. the current chat text is passed into the tool as `context`,
2. the ChatGPT window exposes the text through UIA/DOM,
3. the chat is exported or otherwise saved to a readable file,
4. browser/session reader access is available for that exact logged-in tab.

V26 therefore uses the most reliable current path: context + UIA + OCR + proof log + visible Notepad/HTML output.

Verified:

- `npm run test:v26`: OK
- V26 test produced `read_chat_summary_display`
- visible output: true
- summary length: > 5000 chars in the latest successful test
