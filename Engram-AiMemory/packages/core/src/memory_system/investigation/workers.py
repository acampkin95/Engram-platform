"""AI worker services for investigation intelligence processing."""
from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from uuid import uuid4

from rich.console import Console

console = Console()


# ─────────────────────────────────────────────
# Worker 1: Entity Extraction
# ─────────────────────────────────────────────

class EntityExtractionWorker:
    """Extract named entities from EvidenceDocument chunks and upsert into global registry.

    Uses simple regex NER (no LLM in Phase 1).
    Marks processed chunks with metadata['ner_processed'] = True.
    """

    # Regex patterns for basic NER
    PERSON_PATTERNS = [
        r'\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b',  # FirstName LastName [MiddleName]
    ]
    ORG_PATTERNS = [
        r'\b([A-Z][A-Za-z\s&,\.]+(?:Ltd|Pty|Inc|Corp|LLC|Limited|Incorporated|Company|Co\.|Pty Ltd|P/L)\.?)\b',
        r'\b([A-Z]{2,}(?:\s[A-Z]{2,})*)\b',  # Acronyms: FBI, CIA, ASIO
    ]

    def __init__(self, weaviate_client, matter_client, registry_client, ai_router=None):
        self._client = weaviate_client
        self._matter_client = matter_client
        self._registry_client = registry_client
        self._ai_router = ai_router

    async def process_matter(self, matter_id: str) -> dict:
        """Process all unprocessed EvidenceDocument chunks for a matter.

        Returns summary: {'chunks_processed': int, 'persons_found': int, 'orgs_found': int}
        """
        from memory_system.config import EVIDENCE_DOCUMENT
        from memory_system.investigation.models import SubjectOrgCreate, SubjectPersonCreate

        self._matter_client.ensure_tenant_active(matter_id, EVIDENCE_DOCUMENT)
        collection = self._client.collections.get(EVIDENCE_DOCUMENT)

        # Fetch unprocessed chunks
        try:
            results = collection.with_tenant(matter_id).query.fetch_objects(limit=500)
        except Exception as exc:
            console.print(f"[red]EntityExtractionWorker: fetch failed for {matter_id}: {exc}[/red]")
            return {"chunks_processed": 0, "persons_found": 0, "orgs_found": 0}

        chunks_processed = 0
        persons_found = 0
        orgs_found = 0

        for obj in results.objects:
            props = obj.properties
            # Skip already-processed chunks
            metadata_raw = props.get("metadata", "{}")
            try:
                metadata = json.loads(metadata_raw) if isinstance(metadata_raw, str) else (metadata_raw or {})
            except Exception:
                metadata = {}

            if metadata.get("ner_processed"):
                continue

            content = props.get("content", "")
            if not content:
                continue

            # Extract entities — use LLM if available, fall back to regex
            if self._ai_router is not None:
                try:
                    persons, orgs = await self._extract_with_llm(content)
                    if not persons and not orgs:
                        # LLM returned empty — use regex as fallback
                        persons = self._extract_persons(content)
                        orgs = self._extract_organisations(content)
                except Exception:
                    persons = self._extract_persons(content)
                    orgs = self._extract_organisations(content)
            else:
                persons = self._extract_persons(content)
                orgs = self._extract_organisations(content)

            # Upsert persons
            for name in persons:
                try:
                    await self._registry_client.upsert_person(
                        SubjectPersonCreate(canonical_name=name, matter_ids=[matter_id])
                    )
                    persons_found += 1
                except Exception as exc:
                    console.print(f"[yellow]Failed to upsert person '{name}': {exc}[/yellow]")

            # Upsert organisations
            for name in orgs:
                try:
                    await self._registry_client.upsert_organisation(
                        SubjectOrgCreate(canonical_name=name, matter_ids=[matter_id])
                    )
                    orgs_found += 1
                except Exception as exc:
                    console.print(f"[yellow]Failed to upsert org '{name}': {exc}[/yellow]")

            # Mark chunk as processed — update metadata JSON blob
            try:
                metadata["ner_processed"] = True
                metadata["ner_processed_at"] = datetime.now(UTC).isoformat()
                collection.with_tenant(matter_id).data.update(
                    uuid=str(obj.uuid),
                    properties={"metadata": json.dumps(metadata)},
                )
                chunks_processed += 1
            except Exception as exc:
                console.print(f"[yellow]Failed to mark chunk {obj.uuid} as processed: {exc}[/yellow]")

        console.print(
            f"[green]EntityExtraction: {chunks_processed} chunks, "
            f"{persons_found} persons, {orgs_found} orgs for {matter_id}[/green]"
        )
        return {"chunks_processed": chunks_processed, "persons_found": persons_found, "orgs_found": orgs_found}

    def _extract_persons(self, text: str) -> list[str]:
        """Extract person names using regex patterns."""
        found = set()
        for pattern in self.PERSON_PATTERNS:
            matches = re.findall(pattern, text)
            for match in matches:
                name = match.strip()
                if len(name) > 3 and len(name.split()) >= 2:
                    found.add(name)
        return list(found)

    def _extract_organisations(self, text: str) -> list[str]:
        """Extract organisation names using regex patterns."""
        found = set()
        for pattern in self.ORG_PATTERNS:
            matches = re.findall(pattern, text)
            for match in matches:
                name = match.strip()
                if len(name) > 2:
                    found.add(name)
        return list(found)

    async def _extract_with_llm(self, content: str) -> tuple[list[str], list[str]]:
        """Extract persons and organisations using LLM. Returns (persons, orgs).

        Falls back to empty lists on any failure — caller uses regex as fallback.
        """
        if self._ai_router is None:
            return [], []
        prompt = (
            "Extract all person names and organisation names from the following text. "
            'Return JSON: {"persons": [...], "organisations": [...]}\n\n'
            f"Text: {content[:3000]}"
        )
        try:
            import json as _json
            # Use first provider's default model via router
            raw = await self._ai_router.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="liquid/lfm2.5:1.2b",
                temperature=0.1,
                max_tokens=400,
            )
            text = raw.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]
            data = _json.loads(text)
            persons = [str(p) for p in data.get("persons", []) if p]
            orgs = [str(o) for o in data.get("organisations", []) if o]
            return persons, orgs
        except Exception:
            return [], []


# ─────────────────────────────────────────────
# Worker 2: Timeline Extraction
# ─────────────────────────────────────────────

class TimelineExtractionWorker:
    """Extract temporal events from EvidenceDocument chunks and insert into TimelineEvent."""

    # Date patterns to extract
    DATE_PATTERNS = [
        r'\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b',          # DD/MM/YYYY or MM-DD-YYYY
        r'\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b',             # YYYY-MM-DD
        r'\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b',  # 15 January 2024
        r'\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b',  # January 15, 2024
    ]

    def __init__(self, weaviate_client, matter_client):
        self._client = weaviate_client
        self._matter_client = matter_client

    async def process_matter(self, matter_id: str) -> dict:
        """Extract timeline events from all evidence chunks for a matter.

        Returns summary: {'events_created': int}
        """
        from memory_system.config import EVIDENCE_DOCUMENT, TIMELINE_EVENT

        self._matter_client.ensure_tenant_active(matter_id, EVIDENCE_DOCUMENT)
        self._matter_client.ensure_tenant_active(matter_id, TIMELINE_EVENT)

        ev_collection = self._client.collections.get(EVIDENCE_DOCUMENT)
        tl_collection = self._client.collections.get(TIMELINE_EVENT)

        try:
            results = ev_collection.with_tenant(matter_id).query.fetch_objects(limit=500)
        except Exception as exc:
            console.print(f"[red]TimelineWorker: fetch failed for {matter_id}: {exc}[/red]")
            return {"events_created": 0}

        events_created = 0

        for obj in results.objects:
            props = obj.properties
            metadata_raw = props.get("metadata", "{}")
            try:
                metadata = json.loads(metadata_raw) if isinstance(metadata_raw, str) else (metadata_raw or {})
            except Exception:
                metadata = {}

            if metadata.get("timeline_processed"):
                continue

            content = props.get("content", "")
            if not content:
                continue

            # Extract date mentions with surrounding context
            events = self._extract_events(content, str(obj.uuid), props.get("source_url", ""))

            for event in events:
                try:
                    tl_collection.with_tenant(matter_id).data.insert(
                        uuid=str(uuid4()),
                        properties={
                            "matter_id": matter_id,
                            "event_date": event["date"],
                            "description": event["description"],
                            "source_chunk_id": event["source_chunk_id"],
                            "source_url": event["source_url"],
                            "confidence": event["confidence"],
                            "created_at": datetime.now(UTC).isoformat(),
                        },
                    )
                    events_created += 1
                except Exception as exc:
                    console.print(f"[yellow]Failed to insert timeline event: {exc}[/yellow]")

            # Mark chunk as timeline-processed
            try:
                metadata["timeline_processed"] = True
                ev_collection.with_tenant(matter_id).data.update(
                    uuid=str(obj.uuid),
                    properties={"metadata": json.dumps(metadata)},
                )
            except Exception as exc:
                console.print(f"[yellow]Failed to mark chunk {obj.uuid} timeline-processed: {exc}[/yellow]")

        console.print(f"[green]TimelineExtraction: {events_created} events for {matter_id}[/green]")
        return {"events_created": events_created}

    def _extract_events(self, content: str, chunk_id: str, source_url: str) -> list[dict]:
        """Extract date-anchored events from content."""
        events = []
        for pattern in self.DATE_PATTERNS:
            for match in re.finditer(pattern, content, re.IGNORECASE):
                date_str = match.group(1)
                # Get surrounding sentence context (up to 200 chars)
                start = max(0, match.start() - 100)
                end = min(len(content), match.end() + 100)
                context = content[start:end].strip()
                events.append({
                    "date": date_str,
                    "description": context,
                    "source_chunk_id": chunk_id,
                    "source_url": source_url,
                    "confidence": 0.7,
                })
        return events


# ─────────────────────────────────────────────
# Worker 3: Contradiction Flagging
# ─────────────────────────────────────────────

class ContradictionFlaggingWorker:
    """Flag potential contradictions between timeline events for a matter.

    Heuristic detection (same date, different descriptions) is always run.
    When ai_router is provided, LLM is used to verify pairs that share the same date.
    """

    def __init__(self, weaviate_client, matter_client, ai_router=None):
        self._client = weaviate_client
        self._matter_client = matter_client
        self._ai_router = ai_router

    async def process_matter(self, matter_id: str) -> dict:
        """Scan timeline events for contradictions.

        Returns summary: {'contradictions_found': int, 'flagged_pairs': list}
        """
        from memory_system.config import TIMELINE_EVENT

        self._matter_client.ensure_tenant_active(matter_id, TIMELINE_EVENT)
        tl_collection = self._client.collections.get(TIMELINE_EVENT)

        try:
            results = tl_collection.with_tenant(matter_id).query.fetch_objects(limit=1000)
        except Exception as exc:
            console.print(f"[red]ContradictionWorker: fetch failed for {matter_id}: {exc}[/red]")
            return {"contradictions_found": 0, "flagged_pairs": []}

        # Group events by date
        by_date: dict[str, list] = {}
        for obj in results.objects:
            props = obj.properties
            date = props.get("event_date", "")
            if date:
                by_date.setdefault(date, []).append({
                    "id": str(obj.uuid),
                    "description": props.get("description", ""),
                    "source_url": props.get("source_url", ""),
                })

        flagged_pairs = []
        for date, events in by_date.items():
            if len(events) < 2:
                continue
            # Flag pairs with different source URLs on the same date (potential contradiction)
            for i in range(len(events)):
                for j in range(i + 1, len(events)):
                    e1, e2 = events[i], events[j]
                    if e1["source_url"] != e2["source_url"]:
                        pair: dict = {
                            "date": date,
                            "event_1_id": e1["id"],
                            "event_2_id": e2["id"],
                            "reason": "Same date, different sources",
                        }
                        # LLM upgrade: verify with semantic contradiction check
                        if self._ai_router is not None:
                            llm_result = await self._check_contradiction_with_llm(e1, e2)
                            pair["llm_contradicts"] = llm_result.get("contradicts", False)
                            pair["llm_confidence"] = llm_result.get("confidence", 0.0)
                            pair["llm_reason"] = llm_result.get("reason", "")
                        flagged_pairs.append(pair)

        console.print(
            f"[green]ContradictionFlagging: {len(flagged_pairs)} potential contradictions for {matter_id}[/green]"
        )
        return {"contradictions_found": len(flagged_pairs), "flagged_pairs": flagged_pairs}

    async def _check_contradiction_with_llm(self, event1: dict, event2: dict) -> dict:
        """Use LLM to verify whether two events actually contradict each other.

        Returns dict with keys: contradicts (bool), reason (str), confidence (float).
        """
        if self._ai_router is None:
            return {"contradicts": False, "reason": "", "confidence": 0.0}
        desc1 = event1.get("description", "")[:500]
        desc2 = event2.get("description", "")[:500]
        prompt = (
            "Do these two events contradict each other? "
            f"Event 1: {desc1} "
            f"Event 2: {desc2}. "
            'Return JSON: {"contradicts": true/false, "reason": "...", "confidence": 0.X}'
        )
        try:
            import json as _json
            raw = await self._ai_router.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="liquid/lfm2.5:1.2b",
                temperature=0.1,
                max_tokens=200,
            )
            text = raw.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]
            data = _json.loads(text)
            return {
                "contradicts": bool(data.get("contradicts", False)),
                "reason": str(data.get("reason", "")),
                "confidence": float(data.get("confidence", 0.5)),
            }
        except Exception:
            return {"contradicts": False, "reason": "", "confidence": 0.0}


# ─────────────────────────────────────────────
# Worker 4: Intelligence Report
# ─────────────────────────────────────────────

class IntelligenceReportWorker:
    """Generate structured intelligence report for a matter.

    Aggregates structured data (evidence counts, timeline, entities).
    When ai_router is provided, adds an LLM-generated narrative executive summary.
    """

    def __init__(self, weaviate_client, matter_client, registry_client, ai_router=None):
        self._client = weaviate_client
        self._matter_client = matter_client
        self._registry_client = registry_client
        self._ai_router = ai_router

    async def generate_report(self, matter_id: str) -> dict:
        """Generate and store an IntelligenceReport for a matter.

        Returns the report as a dict.
        When ai_router is set, adds a 'narrative' key with LLM executive summary.
        """
        from memory_system.config import EVIDENCE_DOCUMENT, INTELLIGENCE_REPORT, TIMELINE_EVENT

        # Gather data
        self._matter_client.ensure_tenant_active(matter_id, EVIDENCE_DOCUMENT)
        self._matter_client.ensure_tenant_active(matter_id, TIMELINE_EVENT)
        self._matter_client.ensure_tenant_active(matter_id, INTELLIGENCE_REPORT)

        ev_collection = self._client.collections.get(EVIDENCE_DOCUMENT)
        tl_collection = self._client.collections.get(TIMELINE_EVENT)
        ir_collection = self._client.collections.get(INTELLIGENCE_REPORT)

        # Count evidence chunks
        try:
            ev_results = ev_collection.with_tenant(matter_id).query.fetch_objects(limit=10000)
            evidence_count = len(ev_results.objects)
        except Exception:
            evidence_count = 0

        # Count timeline events
        try:
            tl_results = tl_collection.with_tenant(matter_id).query.fetch_objects(limit=10000)
            timeline_events = [
                {
                    "date": obj.properties.get("event_date", ""),
                    "description": obj.properties.get("description", "")[:200],
                    "source_url": obj.properties.get("source_url", ""),
                }
                for obj in tl_results.objects
            ]
        except Exception:
            timeline_events = []

        # Count registry subjects for this matter
        try:
            persons = await self._registry_client.list_persons_for_matter(matter_id)
            orgs = await self._registry_client.list_organisations_for_matter(matter_id)
        except Exception:
            persons = []
            orgs = []

        # Build report content (structured, no LLM)
        report_content = {
            "matter_id": matter_id,
            "generated_at": datetime.now(UTC).isoformat(),
            "summary": {
                "evidence_chunks": evidence_count,
                "timeline_events": len(timeline_events),
                "persons_identified": len(persons),
                "organisations_identified": len(orgs),
            },
            "persons": [
                {"id": p.id, "name": p.canonical_name, "aliases": p.aliases}
                for p in persons
            ],
            "organisations": [
                {"id": o.id, "name": o.canonical_name, "aliases": o.aliases}
                for o in orgs
            ],
            "timeline": sorted(timeline_events, key=lambda x: x["date"]),
        }

        # Add LLM narrative if router is available
        if self._ai_router is not None:
            narrative = await self._generate_narrative(report_content)
            if narrative:
                report_content["narrative"] = narrative
        else:
            report_content["note"] = (
                "Structured data aggregation only. "
                "Set ai_router for LLM narrative synthesis."
            )

        # Store report in IntelligenceReport collection
        now = datetime.now(UTC)
        report_id = str(uuid4())
        try:
            ir_collection.with_tenant(matter_id).data.insert(
                uuid=report_id,
                properties={
                    "matter_id": matter_id,
                    "report_type": "SUMMARY",
                    "content": json.dumps(report_content),
                    "generated_at": now.isoformat(),
                    "version": 1,
                },
            )
            console.print(f"[green]IntelligenceReport generated for {matter_id}: {report_id}[/green]")
        except Exception as exc:
            console.print(f"[red]Failed to store intelligence report: {exc}[/red]")

        return report_content

    async def _generate_narrative(self, report_content: dict) -> str | None:
        """Generate a 2-3 paragraph executive summary using LLM.

        Returns the narrative string or None on failure.
        """
        if self._ai_router is None:
            return None
        summary = report_content.get("summary", {})
        persons = [p.get("name", "") for p in report_content.get("persons", [])[:10]]
        orgs = [o.get("name", "") for o in report_content.get("organisations", [])[:10]]
        timeline = report_content.get("timeline", [])[:5]
        prompt = (
            f"You are an intelligence analyst. Write a 2-3 paragraph executive summary for the following investigation matter.\n\n"
            f"Evidence chunks reviewed: {summary.get('evidence_chunks', 0)}\n"
            f"Timeline events identified: {summary.get('timeline_events', 0)}\n"
            f"Key persons: {', '.join(persons) or 'None identified'}\n"
            f"Key organisations: {', '.join(orgs) or 'None identified'}\n"
            f"Earliest events: {timeline}\n\n"
            "Write a professional, factual executive summary suitable for a legal or investigative report. "
            "Do not add information not present above. Focus on what was found and key entities involved."
        )
        try:
            narrative = await self._ai_router.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="liquid/lfm2.5:1.2b",
                temperature=0.2,
                max_tokens=600,
            )
            return narrative.strip() if narrative else None
        except Exception:
            return None
