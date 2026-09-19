# Memory behavior and Codex reference

This is an Azure-backed implementation of the documented local Codex memory pattern, not a copy of the Codex runtime or a claim of identical internals.

References reviewed 19 September 2026:

- [Memories](https://learn.chatgpt.com/docs/customization/memories)
- [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Slash commands](https://learn.chatgpt.com/docs/reference/slash-commands)

## Documented behavior followed

Memory is off by default. Account controls separately enable recall and generation. Conversations can opt out independently; `/memories` opens the controls. Temporary chats never read or generate memory. Changes to account defaults do not overwrite existing conversation choices.

A background pass selects an eligible completed conversation, extracts durable notes with supporting evidence, and consolidates them with existing notes. The default idle threshold is six hours, and sources older than 30 days are excluded. Active, interrupted, and short conversations are skipped. An optional setting excludes conversations that used web search. Credential patterns are redacted before extraction and checked again before persistence. Memory is fallible context, subordinate to current instructions.

## Adaptations for this PWA

- Encrypted Azure rows replace local files. Every path and partition comes from the authenticated account. Folder membership is organization only; it is not a separate memory boundary.
- The PWA defines a nontrivial source as at least two user messages totaling 200 characters, followed by a completed assistant response. Only user-authored text is extracted; attachments, assistant claims, and web page contents are not memory evidence.
- New conversations created with generation enabled are eligible. An existing conversation can be explicitly opted in through its organization controls. Turning generation off prevents processing; it does not erase saved entries.
- A pass handles one source, at most once per hour and eight source attempts per account per UTC day. It runs after an authenticated app load or during maintenance. These are application budgets: Azure does not provide the Codex client's remaining-quota percentage, so the exact Codex quota policy cannot be reproduced here.
- Structured Outputs constrain extraction and consolidation. Each new note must quote an exact span from an identified source user message. Consolidation selects IDs from validated candidates; it cannot invent new text or remove manually saved notes.
- Up to 30 notes of 500 characters are retained. A bounded summary and source evidence are stored, and the notes are supplied to later text requests when enabled. This uses bounded note injection rather than Codex's local file retrieval, skills, or Computer History.
- Settings exposes explicit add/edit/delete controls. Manual saves are immediate; automatic learning is delayed. Voice remains a separate conversation and does not consume or generate these memories.
- Deleting or editing an automatic entry disables learning from that source and removes its raw summary. A source-ID suppression marker prevents the deleted entry from being recreated. Other saved entries remain reviewable.
- Clearing memory deletes notes and raw summaries and advances an eligibility cutoff. Prior conversations are not automatically harvested again. Deleting a source conversation also removes its automatically derived notes; manually saved notes remain independent.

## Concurrency and privacy

Inference happens outside the interactive account lock. Before committing, the worker takes the account lock and rechecks account status, settings, source version, eligibility, and memory revision. A concurrent edit, reset, source deletion, or settings change invalidates stale work. Memory and source rows use the same AES-GCM authenticated encryption as private chats and never enter the PWA cache or localStorage.

Generated memory remains a model inference: evidence checks establish provenance, not that every interpretation is correct. Users can review and correct each note. Secret redaction covers known patterns and is not a guarantee that arbitrary sensitive prose will be recognized.
