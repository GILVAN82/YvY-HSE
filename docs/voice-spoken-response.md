# Spoken operational responses

## Current flow

`list_actions` returns minimized structured records to the model. The agent node
records evidence and tool trace metadata; the semantic verifier checks the final
answer before `finalize` emits its text. The browser receives that display text,
but the Inspector tool trace contains summaries rather than the original rows.
`speakVerified()` passes the answer to `SpokenResponseFormatterService`, stores
its separate `displayResponse` and `spokenResponse` in voice history, then passes
only the spoken response to `SpeechSynthesisService`. Replay uses that same
spoken text. Proactive announcements continue through their existing queue.

The previous formatter flattened tables and removed only a small subset of
Markdown. Its character truncation could end inside a word. The synthesizer
could submit arbitrarily long sentences and resolved the voice for every chunk.

## This increment

The formatter is a transitional adapter over already verified display text.
Recognizable complete action tables produce counts for the displayed rows,
priority counts and at most three details (two for larger results, ordered by
critical/high priority). Counts are not presented as the whole database total:
tools may limit results. IDs and numeric overdue days are preserved; stored
descriptions are not translated or spoken. Missing/unknown fields do not produce
inferred facts. Unsupported tables, including incidents, projects and KPI tables,
stay visual with a localized invitation to consult the screen. Ordinary short
prose is retained. Markdown, URLs, code/JSON and ISO dates are suppressed.

Synthesis freezes language, voice, pitch and rate per call, breaks long prose at
word boundaries, and advances only on completion. Stop invalidates callbacks;
errors terminate the sequence. One oversized token is preserved rather than
split. Browser/OS voice quality and delayed voice availability still require a
manual audio check; unit tests cannot establish intelligibility.

## Recommended contract evolution

Send an optional versioned operational speech projection with the verified SSE
completion: tool identity, returned count, whether results are limited, and safe
typed facts (action ID, priority, overdue days; incident severity; project status;
KPI value and unit). Construct it from tool outputs, bind it to the same run and
verification result, and localize deterministically in the formatter. This avoids
dependence on model-selected table headers and supports incidents/projects/KPIs
without parsing prose. Do not expose arbitrary tool payloads or generate a second
unverified model answer for speech. Voice gender selection is outside this fix.
