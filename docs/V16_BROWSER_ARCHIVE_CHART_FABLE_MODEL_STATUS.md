# V16 Browser / Archive / Chart / Fable Model Status

V16 adds the missing layer requested after V15.

Implemented tools:

- browser_start
- browser_list_tabs
- browser_new_tab
- browser_navigate
- browser_dom_snapshot
- browser_screenshot
- desktop_screenshot
- browser_click_text
- browser_type_selector
- browser_press_key
- browser_live_monitor

More V16 tools:

- inspect_password_archive
- extract_password_archive_to_results
- analyze_chart_advanced
- local_model_status
- local_model_pull
- local_model_chat_test
- start_full_fable_micro_read
- get_full_fable_micro_status

Browser bridge supports controlled Chrome/Edge through Chrome DevTools Protocol.
It can open tabs, navigate, read DOM/text/links/buttons/inputs, click by text,
type into selectors, press keys, take tab screenshots, take desktop screenshots,
and create repeated screenshot captures for visual monitoring.

Archive bridge supports encrypted ZIP/7Z inspection/extraction into connector results.
It blocks path traversal by validating extracted paths.

Advanced chart analysis now returns OCR text, dominant colors, line-angle counts,
line samples, object boxes, and plot-area guess. It is still algorithmic vision,
not a full finance/chart reasoning model by itself.

Stronger model:

- qwen2.5:3b was pulled into Ollama.
- V16 full micro-read is started with qwen2.5:3b.
- CPU-only Ollama endpoint remains: http://127.0.0.1:11435/api/chat

Test results:

```text
npm run test:v16: OK
```

V16 test covered:

- controlled Chrome start
- tab list
- DOM snapshot
- browser screenshot
- repeated screenshot monitor
- password 7z inspect/extract
- advanced chart analysis
- local model status/chat check
- micro-read status tool

Full micro-read process started:

```text
results\fable_micro_full_review_v16
```
