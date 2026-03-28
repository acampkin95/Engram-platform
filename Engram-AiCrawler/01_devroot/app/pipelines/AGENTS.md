<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# pipelines

## Purpose

Data processing pipelines that transform raw crawl results into enriched, analyzed data. Examples: entity extraction and enrichment, model review (LM Studio-based filtering).

## For AI Agents

### Working In This Directory

1. **Adding a pipeline**: Create new module (e.g., `my_pipeline.py`) with async transformation logic.
2. **Chaining pipelines**: Compose steps using async functions or classes with `process()` methods.
3. **Error handling**: Log and skip malformed data; ensure partial results are usable.

### Testing Requirements

- Test each pipeline step independently with sample data.
- Test error cases: malformed input, missing fields, API failures.

### Common Patterns

- **Pipeline class**: `class MyPipeline: async def process(item: T) -> U:`
- **Chaining**: `result = await pipeline1.process(input); result = await pipeline2.process(result)`
- **Error handling**: Catch exceptions, log, and return partial results

## Dependencies

### Internal
- `app.services.lm_studio_bridge` — LLM-based filtering/analysis
- `app.osint` — Entity extraction and enrichment

### External
- LM Studio, spaCy (NLP), etc.

<!-- MANUAL: -->
