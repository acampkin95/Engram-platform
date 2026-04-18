# Document To Memory Workflows

## Goal

Turn source material into durable Engram knowledge with the right storage path.

## Decision Matrix

### Store As Direct Memory

Use direct memory creation when the source can be reduced into stable, high-value facts.

Good fits:

- meeting notes distilled into decisions and action items
- design docs distilled into architecture facts
- incident notes distilled into root cause and remediation memory
- personal notes distilled into tier-2 preferences or workflows

Pattern:

1. Extract candidate facts
2. Remove duplicates and low-value detail
3. Choose tier and scope
4. Add tags and metadata
5. Write one memory per durable insight or a small batch

### Store As Matter Evidence

Use matters and evidence when the original source must remain searchable or defensible.

Good fits:

- large PDFs and long reports
- investigations and evidence bundles
- collections of documents for one case or project
- web content that should remain chunked and re-searchable

Pattern:

1. Create or identify the matter
2. Ingest source as evidence
3. Search evidence
4. Promote only the durable conclusions into memories if needed

## Recommended Metadata

- `source_type`: note, doc, pdf, email, web, transcript
- `document_title`
- `author`
- `created_at`
- `extracted_from`
- `project_id`
- `tenant_id`
- `user_id`

## Extraction Principles

- Prefer concise declarative facts over long pasted passages.
- Preserve source traceability.
- Separate observations from interpretations.
- Use tier 1 for project-specific extracted knowledge.
- Use tier 2 for personal distilled memory.
- Use tier 3 only for intentionally shared, global knowledge.

## Suggested Batch Shapes

### Direct Memory Batch

```json
{
  "memories": [
    {
      "content": "The memory API validates BetterAuth API keys through the platform verify endpoint.",
      "tier": 1,
      "memory_type": "fact",
      "source": "document",
      "project_id": "engram-platform",
      "tenant_id": "default",
      "importance": 0.8,
      "tags": ["auth", "api-key", "betterauth"]
    }
  ]
}
```

### Matter Evidence Ingest

```json
{
  "content": "<document text or extracted markdown>",
  "source_url": "https://example.com/spec.pdf",
  "source_type": "PDF"
}
```
