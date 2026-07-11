# Companion Connector V14/V15 Status

V14 added document, archive and web snapshot capabilities.

Implemented tools:

- `document_toolchain_report`
- `inspect_document_file`
- `inspect_archive_file`
- `extract_archive_to_results`
- `create_web_snapshot`
- `universal_resource_inspect`

Supported document inputs:

- Text, Markdown, JSON, CSV/TSV, HTML/XML/YAML/log/code files
- DOCX via Office Open XML parsing
- PPTX via slide XML parsing
- XLSX/XLSM via openpyxl
- PDF via available Python PDF engines, currently pypdf is available

V15 added project-level research mapping.

Implemented tools:

- `create_folder_research_map`
- `inspect_linked_resources_from_file`
- `create_project_intake_bundle`

V15 research map outputs:

- file count
- directory count
- total bytes
- extension counts
- type counts
- URL links found inside files
- local path references found inside files
- import/include/source-like lines
- JSON and Markdown result files under `results/`

Safety:

- source folders are read-only
- archive extraction is written only under CompanionConnector `results/`
- archive path traversal is blocked
- source archive/document/web inputs are not modified

Tests passed:

```text
npm run test:v14: OK
npm run test:v15: OK
```

`test:v14` verifies:

- document toolchain report
- TXT inspection
- DOCX inspection
- CSV inspection
- PPTX inspection
- XLSX inspection
- ZIP archive manifest
- ZIP safe extraction into `results/`
- universal resource dispatch

`test:v15` verifies:

- folder research map
- link extraction from a file
- project intake bundle
