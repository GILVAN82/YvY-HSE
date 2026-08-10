# YVY HSE AI Attachments

## Purpose

The AI Agent can temporarily analyze HSE/QHSE evidence supplied as PDF, DOCX, XLSX, PNG, JPG/JPEG, or WEBP. Attachments are conversation context, not permanent knowledge.

## Architecture

The Angular widget uploads one file at a time to `POST /api/ai/attachments`. The backend validates content signatures, assigns a UUID, parses supported documents, and stores the binary under `backend/.tmp/ai-attachments/`. Chat requests retain the existing SSE endpoint and add up to three `attachmentIds`. The service resolves those IDs only for the matching thread and supplies bounded, explicitly untrusted context to the existing LangGraph agent.

No attachment table, vector database, alternate model provider, or second agent is introduced.

## Temporary storage and privacy

- Files and parsed metadata are temporary. Raw content is never written to PostgreSQL, pgvector, RAG tables, Thread State, or Long-Term Memory.
- Physical names are server-generated UUIDs; user filenames are display metadata only.
- Startup cleanup removes UUID-shaped orphan files inside the dedicated directory. Periodic cleanup removes expired records and files.
- Default TTL is 120 minutes. Removing a chip may delete the temporary file early.
- Starting a new conversation clears frontend references but does not alter Long-Term Memory, HITL, operational data, or the old thread row.
- Extracted document sections or image bytes needed for an answer may be sent to the configured AI provider. They are not added to the permanent knowledge base.

## Limits and configuration

| Setting | Default |
|---|---:|
| `AI_ATTACHMENT_TTL_MINUTES` | 120 |
| `AI_ATTACHMENT_MAX_FILE_MB` | 10 |
| `AI_ATTACHMENT_MAX_PER_THREAD` | 3 |
| `AI_ATTACHMENT_MAX_COMBINED_MB` | 25 |
| `AI_ATTACHMENT_CLEANUP_MINUTES` | 15 |
| `AI_ATTACHMENT_MAX_CONTEXT_CHARS` | 16000 |

## Format behavior

- PDF: page text is extracted with page provenance. Encrypted, corrupted, and textless/scanned PDFs receive controlled errors; heavy OCR is not included.
- DOCX: paragraphs and text are extracted without external-file access. Legacy `.doc` is rejected with conversion guidance. Macro-enabled Office files are rejected.
- XLSX: worksheet names, row numbers, headers, and displayed/cached values are normalized. Formulas are not executed and external links are not fetched. Legacy `.xls` is rejected with guidance to save as `.xlsx`; the available legacy parser did not meet the dependency security requirement.
- Images: PNG, JPEG, and WEBP are sent as temporary visual input through the existing configured multimodal provider. The agent must describe visual observations, not identify people or infer sensitive traits.

## Context selection and citations

Text and spreadsheet rows are ranked deterministically against the question and truncated to a configured bound. Temporary chunks are never embedded. Provenance labels are generated only from parser facts:

- `[Attachment: procedure.pdf, page 4]`
- `[Attachment: Risk_Register.xlsx, sheet: Actions, row 12]`
- `[Attachment: worksite.jpg]`

Permanent RAG citations remain separate. A comparison question may use both temporary attachment evidence and `search_hse_knowledge`; neither corpus is merged into the other.

## Safety and domain scope

Attachment content is delimited as untrusted data and cannot override system policy. An ambiguous request such as “Analyze this document” is allowed only when extracted content itself has a clear HSE/QHSE signal. Unrelated document chat remains out of scope. Requests to remember an entire attachment are not supported, and normal attachment use exposes no durable-memory write tool.

## Thread behavior

Attachment access requires the same thread UUID used at upload. The Angular widget keeps active IDs for follow-ups and clears them on “New conversation.” Complete content is never saved in `agent_thread_state`.

## Controlled errors

The API returns stable codes without parser traces or paths: `ATTACHMENT_TOO_LARGE`, `TOO_MANY_ATTACHMENTS`, `UNSUPPORTED_FILE_TYPE`, `CORRUPTED_FILE`, `ENCRYPTED_FILE`, `ATTACHMENT_EXPIRED`, `ATTACHMENT_NOT_FOUND`, `ATTACHMENT_WRONG_THREAD`, and `ATTACHMENT_PARSE_FAILED`.

## Security limitation

The current application has no authenticated user ownership or tenant isolation. Thread scoping is appropriate for local and controlled prototype use, but is not sufficient for multi-tenant SaaS. Authentication, ownership, tenant authorization, retention policy, audit controls, and appropriate RLS must precede permanent customer-document storage.

## Validation and limitations

## Verified implementation results (2026-08-10)

- Real PDF upload and live OpenAI analysis: PASS. The response used `[Attachment: synthetic-loto-procedure.pdf, page 1]`, invoked no tool, and reported `ragUsed=false`.
- Real PNG upload and live multimodal hazard analysis: PASS. The response identified only visible HSE hazards and invoked no tool.
- Domain boundary with an attachment present: PASS. A general-knowledge politics question was refused before model/tool execution (`stepCount=0`).
- PDF, DOCX, XLSX, image-input, traversal, MIME/signature, macro, formula, external-link, corruption, encryption, expiry, limits, deletion, thread isolation, injection, memory, and RAG-comparison automated coverage: 19/19 PASS.
- Complete backend suite: 191/191 PASS. Frontend widget suite: 14/14 PASS. Formal harness: 5/5 PASS. Offline evaluation: 36/36 PASS.
- Backend typecheck/build and Angular production build: PASS.
- Operational database preservation: 42 HSE tables and 784 rows, PASS.

The npm production audit reports two moderate findings inherited through ExcelJS (`uuid <11.1.1`). The offered automatic remediation requires a breaking ExcelJS downgrade, so it was not applied. Legacy `.xls` remains fail-closed; `.xlsx` is the supported spreadsheet format. The synthetic PDF and PNG fixtures contain no personal or production data.

### Remaining limitations

There is no OCR, legacy DOC conversion, durable attachment recovery after backend restart, or permanent “Add to Knowledge Base” workflow. A future persistent workflow requires explicit approval plus production identity and tenant architecture before parsing, chunking, embedding, and pgvector ingestion.
