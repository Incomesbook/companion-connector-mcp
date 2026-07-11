# V13 Capabilities and Desktop Commander Comparison

## Current MCP/CompanionConnector capability map

V13 exposes 72+ MCP tools/resources covering:

- Local file pointers, slices, hashes, summaries, digest jobs.
- Any readable drive root discovery and read-only folder bridge.
- Full folder manifests, audits, text chunk bundles, search, chunk reads.
- Fable handoff bundles, large question batches, Fable run capture, Fable output receive.
- URL text fetch, URL link extraction, URL snapshots.
- Image pointer, image base64 ingest, image data, image inspection.
- OCR for local images through Tesseract.
- Chart/graph image OCR plus line/edge analysis through OpenCV.
- Video/media metadata through ffprobe.
- Video frame extraction through ffmpeg.
- Video contact sheet generation.
- Audio extraction from video/media.
- Audio/video transcription through faster-whisper CPU.
- Hidden/background startup, stop-by-port, scheduled task install/uninstall.
- Health, debug snapshots, support bundle, runtime metrics, config validation.
- 21 planned MCP service catalog.
- 100 implemented improvement audit and 1000 forward improvement backlog.

## Better than Desktop Commander for these workflows

- File-backed large context: data is stored as manifests, chunks, jobs and result files instead of huge chat output.
- Full-folder read-only review: every file can be indexed, hashed, chunked and searched without source mutation.
- Durable Fable handoff: outputs are stored and re-readable by path.
- Media workflow: frames, contact sheets, audio extraction and transcription are first-class tools.
- Image/chart workflow: OCR and basic visual line/edge analysis are available.
- No-window operation: normal startup is background/hidden instead of a persistent console.
- MCP tool surface: designed for ChatGPT New App / custom MCP, not only ad-hoc shell commands.

## Still not a total replacement for Desktop Commander

Desktop Commander is still better for arbitrary shell/admin actions and direct manual edits. CompanionConnector is deliberately safer: it reads broadly, but writes only inside its workspace unless a specific connector artifact is being produced.

## New V13 tools

- `media_toolchain_report`
- `extract_video_frames`
- `create_video_contact_sheet`
- `extract_audio_track`
- `transcribe_media_audio`
- `ocr_image_file`
- `analyze_chart_image`
- `extract_links_from_file`

## Tested V13 toolchain

- ffmpeg: present
- ffprobe: present
- yt-dlp: present
- tesseract: present
- Python modules: PIL, cv2, pytesseract, numpy, faster_whisper, pandas, openpyxl

V13 test creates a sample video/image/link file and verifies frames, contact sheet, audio extraction, transcription pipeline, OCR, chart analysis and link extraction.
