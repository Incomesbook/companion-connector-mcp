# Companion Connector V17/V18 status

V17 added human-style desktop visibility and control plus local semantic search.

New V17 tools:

- human_list_windows
- human_active_window
- human_focus_window
- human_screen_snapshot
- human_screen_ocr
- human_live_watch
- human_mouse_move
- human_click_xy
- human_type_text
- human_press_key
- human_scroll
- create_semantic_index
- search_semantic_index

V17 test passed: windows were listed, active window was detected, desktop screenshot was created, screen OCR returned text, semantic index was created and searched.

V18 added durable queue, watchdog-style status and safety audit.

New V18 tools:

- create_queue_job
- list_queue_jobs
- run_queue_once
- cancel_queue_job
- queue_health_report
- audit_path_safety

V18 supports queued jobs for:

- screen_snapshot
- screen_ocr
- semantic_index
- document_inspect
- research_map

Queue jobs are written under connector results only. Source folders are not modified by queue execution.

Important limitation:

- human_* tools can operate the desktop like a local user, but must be used carefully because click/type tools affect the real active screen.
- live watch currently creates repeated screenshots and change scores; it is not a video streaming server yet.
- semantic index is lightweight token/cosine search, not a heavy vector database.

Tests:

- npm run test:v17: passed
- npm run test:v18: passed
