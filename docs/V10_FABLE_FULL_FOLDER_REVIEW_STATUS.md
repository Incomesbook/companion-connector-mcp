# V10 Fable Full Folder Review Status

Target folder:

```text
J:\ПРОЕКТЫ\G01_All_About_Trading\G01_P09_All_for_TradingView\G01_P09_01_Project\TradingView_INDICATORS\IGOR_ENTER2\research_out
```

Read-only bridge coverage already verified:

- Files: 907
- Directories: 19
- Bytes read: 178,297,503
- Text files chunked: 822
- Binary files hash-verified: 85
- Text chunks: 996

A full Fable batch-review runner was added:

```text
scripts/run_fable_full_folder_review.py
```

The runner prepares real Fable prompt batches from every text chunk and metadata for every binary file. It then asks Fable to summarize each batch and merge the batch summaries into one final conclusion file.

Attempted run:

```text
results\fable_full_folder_review_20260710_02
```

Coverage in that run:

```json
{
  "filesSeen": 907,
  "expectedFiles": 907,
  "allFilesSeen": true,
  "batchesPlanned": 71
}
```

Fable backend result:

```text
[-32002] ALL_MIRRORS_FAILED
GROQ_API_KEY missing for groq mirror.
free2gpt returned HTTP 413 / 502 / timeout depending on batch.
```

Conclusion:

- The connector can read and package the entire folder read-only.
- The connector can create complete Fable batch prompts covering every file.
- The current Fable backend could not successfully process the full batches because its mirrors failed or rejected the request size.
- This is not a source-folder problem and not a CompanionConnector read problem; it is a Fable backend/model transport limit.

Existing Fable-produced grounded summary file from compact index:

```text
results\V9_RESEARCH_OUT_FABLE_GROUNDED_SUMMARY.txt
```

But that compact summary is not the same as Fable successfully reading every full text chunk.
