"""
Weaviate schema definitions for the Investigation module.

Creates 6 collections:
  Multi-tenant (4):
    - InvestigationMatter   — top-level case/matter with title+description vectorized
    - EvidenceDocument      — chunked documents ingested per matter, content vectorized
    - TimelineEvent         — extracted temporal events, event_description vectorized
    - IntelligenceReport    — generated analytical reports, no vectorizer

  Global / no multi-tenancy (2):
    - SubjectPerson         — canonical persons across all matters, canonical_name vectorized
    - SubjectOrganisation   — canonical organisations across all matters, canonical_name vectorized
"""

from rich.console import Console

console = Console()

# ---------------------------------------------------------------------------
# Collection names (importable constants)
# ---------------------------------------------------------------------------

INVESTIGATION_MATTER_COLLECTION = "InvestigationMatter"
EVIDENCE_DOCUMENT_COLLECTION = "EvidenceDocument"
TIMELINE_EVENT_COLLECTION = "TimelineEvent"
INTELLIGENCE_REPORT_COLLECTION = "IntelligenceReport"
SUBJECT_PERSON_COLLECTION = "SubjectPerson"
SUBJECT_ORGANISATION_COLLECTION = "SubjectOrganisation"

INVESTIGATION_COLLECTIONS = [
    INVESTIGATION_MATTER_COLLECTION,
    EVIDENCE_DOCUMENT_COLLECTION,
    TIMELINE_EVENT_COLLECTION,
    INTELLIGENCE_REPORT_COLLECTION,
    SUBJECT_PERSON_COLLECTION,
    SUBJECT_ORGANISATION_COLLECTION,
]


def ensure_investigation_schemas(client) -> None:
    """Create all Investigation module collections in Weaviate if they don't already exist.

    This function is idempotent — it checks existing collections before creating.

    Collections created:
      Multi-tenant (auto_tenant_creation=False):
        - InvestigationMatter
        - EvidenceDocument
        - TimelineEvent
        - IntelligenceReport

      Global (no multi-tenancy):
        - SubjectPerson
        - SubjectOrganisation

    Args:
        client: An active weaviate.WeaviateClient instance.
    """
    from weaviate.classes.config import Configure, DataType, Property  # noqa: PLC0415

    from memory_system.config import get_settings  # noqa: PLC0415

    s = get_settings()

    # Resolve Ollama endpoint — fall back to Docker-internal default if not configured
    ollama_endpoint: str = s.ollama_host or "http://ollama:11434"
    embedding_model: str = s.embedding_model

    def _ollama_vectorizer():
        """Return a text2vec_ollama vectorizer config using project settings."""
        return Configure.Vectorizer.text2vec_ollama(
            api_endpoint=ollama_endpoint,
            model=embedding_model,
        )

    existing = client.collections.list_all()

    # -----------------------------------------------------------------------
    # 1. InvestigationMatter  (multi-tenant, vectorizer on title + description)
    # -----------------------------------------------------------------------
    if INVESTIGATION_MATTER_COLLECTION not in existing:
        console.print(f"[cyan]Creating collection: {INVESTIGATION_MATTER_COLLECTION}[/cyan]")
        client.collections.create(
            name=INVESTIGATION_MATTER_COLLECTION,
            description="Top-level investigation matter / case file",
            properties=[
                Property(name="matter_id", data_type=DataType.TEXT),
                Property(
                    name="title",
                    data_type=DataType.TEXT,
                    vectorize_property_name=False,
                ),
                Property(
                    name="description",
                    data_type=DataType.TEXT,
                    vectorize_property_name=False,
                ),
                Property(name="status", data_type=DataType.TEXT),
                Property(name="created_at", data_type=DataType.DATE),
                Property(name="tags", data_type=DataType.TEXT_ARRAY),
                Property(name="lead_investigator", data_type=DataType.TEXT),
            ],
            vectorizer_config=_ollama_vectorizer(),
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True, auto_tenant_creation=False
            ),
        )
        console.print(f"[green]✓ {INVESTIGATION_MATTER_COLLECTION} created[/green]")
    else:
        console.print(f"[green]✓ {INVESTIGATION_MATTER_COLLECTION} exists[/green]")

    # -----------------------------------------------------------------------
    # 2. EvidenceDocument  (multi-tenant, vectorizer on content)
    # -----------------------------------------------------------------------
    if EVIDENCE_DOCUMENT_COLLECTION not in existing:
        console.print(f"[cyan]Creating collection: {EVIDENCE_DOCUMENT_COLLECTION}[/cyan]")
        client.collections.create(
            name=EVIDENCE_DOCUMENT_COLLECTION,
            description="Chunked evidence documents ingested per matter",
            properties=[
                Property(name="matter_id", data_type=DataType.TEXT),
                Property(name="source_url", data_type=DataType.TEXT),
                Property(name="source_type", data_type=DataType.TEXT),
                Property(
                    name="content",
                    data_type=DataType.TEXT,
                    vectorize_property_name=False,
                ),
                Property(name="chunk_index", data_type=DataType.INT),
                Property(name="total_chunks", data_type=DataType.INT),
                Property(name="document_hash", data_type=DataType.TEXT),
                Property(name="ingested_at", data_type=DataType.DATE),
                Property(name="metadata", data_type=DataType.TEXT),
                Property(name="page_number", data_type=DataType.INT),
                Property(name="message_id", data_type=DataType.TEXT),
            ],
            vectorizer_config=_ollama_vectorizer(),
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True, auto_tenant_creation=False
            ),
        )
        console.print(f"[green]✓ {EVIDENCE_DOCUMENT_COLLECTION} created[/green]")
    else:
        console.print(f"[green]✓ {EVIDENCE_DOCUMENT_COLLECTION} exists[/green]")

    # -----------------------------------------------------------------------
    # 3. TimelineEvent  (multi-tenant, vectorizer on event_description)
    # -----------------------------------------------------------------------
    if TIMELINE_EVENT_COLLECTION not in existing:
        console.print(f"[cyan]Creating collection: {TIMELINE_EVENT_COLLECTION}[/cyan]")
        client.collections.create(
            name=TIMELINE_EVENT_COLLECTION,
            description="Extracted temporal events linked to a matter",
            properties=[
                Property(name="matter_id", data_type=DataType.TEXT),
                Property(name="event_date", data_type=DataType.DATE),
                Property(name="event_date_tz", data_type=DataType.TEXT),
                Property(
                    name="event_description",
                    data_type=DataType.TEXT,
                    vectorize_property_name=False,
                ),
                Property(name="event_type", data_type=DataType.TEXT),
                Property(name="source_document_id", data_type=DataType.TEXT),
                Property(name="subjects", data_type=DataType.TEXT_ARRAY),
                Property(name="confidence", data_type=DataType.NUMBER),
                Property(name="extracted_at", data_type=DataType.DATE),
            ],
            vectorizer_config=_ollama_vectorizer(),
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True, auto_tenant_creation=False
            ),
        )
        console.print(f"[green]✓ {TIMELINE_EVENT_COLLECTION} created[/green]")
    else:
        console.print(f"[green]✓ {TIMELINE_EVENT_COLLECTION} exists[/green]")

    # -----------------------------------------------------------------------
    # 4. IntelligenceReport  (multi-tenant, NO vectorizer)
    # -----------------------------------------------------------------------
    if INTELLIGENCE_REPORT_COLLECTION not in existing:
        console.print(f"[cyan]Creating collection: {INTELLIGENCE_REPORT_COLLECTION}[/cyan]")
        client.collections.create(
            name=INTELLIGENCE_REPORT_COLLECTION,
            description="Generated analytical intelligence reports per matter",
            properties=[
                Property(name="matter_id", data_type=DataType.TEXT),
                Property(name="report_type", data_type=DataType.TEXT),
                Property(name="report_json", data_type=DataType.TEXT),
                Property(name="generated_at", data_type=DataType.DATE),
                Property(name="version", data_type=DataType.INT),
                Property(name="evidence_count", data_type=DataType.INT),
                Property(name="event_count", data_type=DataType.INT),
                Property(name="subject_count", data_type=DataType.INT),
            ],
            vectorizer_config=Configure.Vectorizer.none(),
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True, auto_tenant_creation=False
            ),
        )
        console.print(f"[green]✓ {INTELLIGENCE_REPORT_COLLECTION} created[/green]")
    else:
        console.print(f"[green]✓ {INTELLIGENCE_REPORT_COLLECTION} exists[/green]")

    # -----------------------------------------------------------------------
    # 5. SubjectPerson  (GLOBAL — no multi-tenancy, vectorizer on canonical_name)
    # -----------------------------------------------------------------------
    if SUBJECT_PERSON_COLLECTION not in existing:
        console.print(f"[cyan]Creating collection: {SUBJECT_PERSON_COLLECTION}[/cyan]")
        client.collections.create(
            name=SUBJECT_PERSON_COLLECTION,
            description="Canonical person subjects across all investigation matters",
            properties=[
                Property(
                    name="canonical_name",
                    data_type=DataType.TEXT,
                    vectorize_property_name=False,
                ),
                Property(name="aliases", data_type=DataType.TEXT_ARRAY),
                Property(name="matter_ids", data_type=DataType.TEXT_ARRAY),
                Property(name="date_of_birth", data_type=DataType.DATE),
                Property(name="identifiers", data_type=DataType.TEXT),
                Property(name="notes", data_type=DataType.TEXT),
                Property(name="created_at", data_type=DataType.DATE),
                Property(name="updated_at", data_type=DataType.DATE),
            ],
            vectorizer_config=_ollama_vectorizer(),
        )
        console.print(f"[green]✓ {SUBJECT_PERSON_COLLECTION} created[/green]")
    else:
        console.print(f"[green]✓ {SUBJECT_PERSON_COLLECTION} exists[/green]")

    # -----------------------------------------------------------------------
    # 6. SubjectOrganisation  (GLOBAL — no multi-tenancy, vectorizer on canonical_name)
    # -----------------------------------------------------------------------
    if SUBJECT_ORGANISATION_COLLECTION not in existing:
        console.print(f"[cyan]Creating collection: {SUBJECT_ORGANISATION_COLLECTION}[/cyan]")
        client.collections.create(
            name=SUBJECT_ORGANISATION_COLLECTION,
            description="Canonical organisation subjects across all investigation matters",
            properties=[
                Property(
                    name="canonical_name",
                    data_type=DataType.TEXT,
                    vectorize_property_name=False,
                ),
                Property(name="aliases", data_type=DataType.TEXT_ARRAY),
                Property(name="matter_ids", data_type=DataType.TEXT_ARRAY),
                Property(name="registration_number", data_type=DataType.TEXT),
                Property(name="jurisdiction", data_type=DataType.TEXT),
                Property(name="org_type", data_type=DataType.TEXT),
                Property(name="identifiers", data_type=DataType.TEXT),
                Property(name="notes", data_type=DataType.TEXT),
                Property(name="created_at", data_type=DataType.DATE),
                Property(name="updated_at", data_type=DataType.DATE),
            ],
            vectorizer_config=_ollama_vectorizer(),
        )
        console.print(f"[green]✓ {SUBJECT_ORGANISATION_COLLECTION} created[/green]")
    else:
        console.print(f"[green]✓ {SUBJECT_ORGANISATION_COLLECTION} exists[/green]")
