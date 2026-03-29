"""Case Management Service — Phase 5.

Covers:
  5.2  Case storage   — JSON-file persistence with CRUD + index.
  5.3  Case timeline  — auto-logged events; searchable, sortable.
  5.4  Exports        — JSON bundle, CSV timeline, plain-text/HTML report.
                        (PDF is produced as HTML that the browser can print-to-PDF
                        to avoid heavy native dependencies like reportlab.)
"""

from __future__ import annotations

import csv
import io
import json
import logging
import textwrap
from datetime import datetime
from app._compat import UTC
from pathlib import Path
from typing import Any

from jinja2 import Environment, BaseLoader

from app.models.case import (
    Case,
    CaseStatus,
    CasePriority,
    CaseSummary,
    CaseSubject,
    CreateCaseRequest,
    EvidenceItem,
    TimelineEvent,
    TimelineEventType,
    UpdateCaseRequest,
)

logger = logging.getLogger(__name__)

_CASES_ROOT = Path("/app/data/cases")


# ---------------------------------------------------------------------------
# 5.2  Case Storage
# ---------------------------------------------------------------------------


class CaseService:
    """Persist cases as JSON files under {root}/{case_id}/case.json.

    Also maintains a lightweight index file ({root}/index.json) for fast
    listing without loading every case.
    """

    def __init__(self, root: Path = _CASES_ROOT) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._index_path = self.root / "index.json"

    # -- Index -----------------------------------------------------------------

    def _load_index(self) -> dict[str, dict[str, Any]]:
        if not self._index_path.exists():
            return {}
        try:
            return json.loads(self._index_path.read_text())
        except Exception:
            return {}

    def _save_index(self, index: dict[str, dict[str, Any]]) -> None:
        self._index_path.write_text(json.dumps(index, indent=2, default=str))

    def _index_entry(self, case: Case) -> dict[str, Any]:
        return {
            "case_id": case.case_id,
            "case_number": case.case_number,
            "title": case.title,
            "case_type": case.case_type,
            "status": case.status.value,
            "priority": case.priority.value,
            "investigator": case.investigator,
            "subject_count": len(case.subjects),
            "evidence_count": len(case.evidence),
            "risk_level": case.risk_level,
            "risk_score": case.risk_score,
            "created_at": case.created_at,
            "updated_at": case.updated_at,
        }

    # -- CRUD ------------------------------------------------------------------

    def _case_path(self, case_id: str) -> Path:
        p = self.root / case_id
        p.mkdir(parents=True, exist_ok=True)
        return p / "case.json"

    def _auto_case_number(self) -> str:
        index = self._load_index()
        year = datetime.now(UTC).year
        count = sum(1 for v in index.values() if str(year) in v.get("created_at", ""))
        return f"CASE-{year}-{count + 1:04d}"

    def create(self, request: CreateCaseRequest, actor: str | None = None) -> Case:
        case = Case(
            title=request.title,
            description=request.description,
            case_type=request.case_type,
            priority=request.priority,
            investigator=request.investigator or actor,
            client_reference=request.client_reference,
            jurisdiction=request.jurisdiction,
            tags=request.tags,
        )
        case.case_number = self._auto_case_number()
        case.add_timeline_event(
            TimelineEventType.CASE_CREATED,
            title=f"Case created: {case.title}",
            actor=actor or request.investigator,
        )
        self._write(case)
        return case

    def get(self, case_id: str) -> Case | None:
        path = self._case_path(case_id)
        if not path.exists():
            return None
        try:
            return Case.model_validate_json(path.read_text())
        except Exception as exc:
            logger.warning("Corrupt case %s: %s", case_id, exc)
            return None

    def list_all(
        self,
        status: CaseStatus | None = None,
        priority: CasePriority | None = None,
        case_type: str | None = None,
        investigator: str | None = None,
        tag: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CaseSummary]:
        index = self._load_index()
        rows = list(index.values())

        if status:
            rows = [r for r in rows if r.get("status") == status.value]
        if priority:
            rows = [r for r in rows if r.get("priority") == priority.value]
        if case_type:
            rows = [r for r in rows if r.get("case_type") == case_type]
        if investigator:
            rows = [r for r in rows if r.get("investigator") == investigator]

        # Tag filter requires loading each case (not in index) — but only when tag filter is requested
        if tag:
            filtered: list[dict[str, Any]] = []
            for r in rows:
                case = self.get(r["case_id"])
                if case and tag in case.tags:
                    filtered.append(r)
            rows = filtered

        rows.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
        rows = rows[offset : offset + limit]

        return [CaseSummary(**r) for r in rows]

    def update(
        self,
        case_id: str,
        request: UpdateCaseRequest,
        actor: str | None = None,
    ) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None

        old_status = case.status
        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(case, field, value)

        if request.status and request.status != old_status:
            if request.status == CaseStatus.CLOSED:
                case.closed_at = datetime.now(UTC).isoformat()
            case.add_timeline_event(
                TimelineEventType.STATUS_CHANGED,
                title=f"Status changed: {old_status.value} → {request.status.value}",
                actor=actor,
            )
        else:
            case.add_timeline_event(
                TimelineEventType.CASE_UPDATED,
                title="Case details updated",
                actor=actor,
            )

        case.touch()
        self._write(case)
        return case

    def delete(self, case_id: str) -> bool:
        path = self._case_path(case_id)
        if not path.exists():
            return False
        path.unlink()
        # Remove directory if empty
        try:
            path.parent.rmdir()
        except OSError:
            pass  # Not empty (attachments present)
        index = self._load_index()
        index.pop(case_id, None)
        self._save_index(index)
        return True

    def _write(self, case: Case) -> None:
        path = self._case_path(case.case_id)
        path.write_text(case.model_dump_json(indent=2))
        index = self._load_index()
        index[case.case_id] = self._index_entry(case)
        self._save_index(index)

    # -- Subjects --------------------------------------------------------------

    def add_subject(
        self,
        case_id: str,
        subject: CaseSubject,
        actor: str | None = None,
    ) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        # Avoid duplicate entity_id linkage
        if subject.entity_id:
            for s in case.subjects:
                if s.entity_id == subject.entity_id:
                    return case
        case.subjects.append(subject)
        if subject.entity_id and subject.entity_id not in case.entity_ids:
            case.entity_ids.append(subject.entity_id)
        case.add_timeline_event(
            TimelineEventType.ENTITY_ADDED,
            title=f"Subject added: {subject.display_name}",
            actor=actor,
            reference_id=subject.subject_id,
        )
        self._write(case)
        return case

    # -- Evidence --------------------------------------------------------------

    def add_evidence(
        self,
        case_id: str,
        item: EvidenceItem,
        actor: str | None = None,
    ) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        item.added_by = actor or item.added_by
        case.add_evidence(item, actor=actor)
        self._write(case)
        return case

    def remove_evidence(
        self,
        case_id: str,
        evidence_id: str,
        actor: str | None = None,
    ) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        before = len(case.evidence)
        case.evidence = [e for e in case.evidence if e.evidence_id != evidence_id]
        if len(case.evidence) < before:
            case.add_timeline_event(
                TimelineEventType.EVIDENCE_REMOVED,
                title=f"Evidence removed: {evidence_id}",
                actor=actor,
                reference_id=evidence_id,
            )
            self._write(case)
        return case

    # -- Notes -----------------------------------------------------------------

    def add_note(
        self,
        case_id: str,
        content: str,
        author: str | None = None,
    ) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        case.add_note(content, author=author)
        self._write(case)
        return case

    # -- Phase linkage helpers -------------------------------------------------

    def link_scan(self, case_id: str, scan_id: str, actor: str | None = None) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        if scan_id not in case.scan_ids:
            case.scan_ids.append(scan_id)
            case.add_timeline_event(
                TimelineEventType.SCAN_COMPLETED,
                title=f"Scan linked: {scan_id}",
                actor=actor,
                reference_id=scan_id,
            )
            self._write(case)
        return case

    def link_deep_crawl(self, case_id: str, crawl_id: str, actor: str | None = None) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        if crawl_id not in case.deep_crawl_ids:
            case.deep_crawl_ids.append(crawl_id)
            case.add_timeline_event(
                TimelineEventType.CRAWL_COMPLETED,
                title=f"Deep crawl linked: {crawl_id}",
                actor=actor,
                reference_id=crawl_id,
            )
            self._write(case)
        return case

    def link_fraud_graph(
        self,
        case_id: str,
        graph_id: str,
        risk_level: str | None = None,
        risk_score: float | None = None,
        actor: str | None = None,
    ) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        if graph_id not in case.fraud_graph_ids:
            case.fraud_graph_ids.append(graph_id)
        if risk_level:
            case.risk_level = risk_level
        if risk_score is not None:
            case.risk_score = risk_score
        case.add_timeline_event(
            TimelineEventType.FRAUD_ANALYSIS_RUN,
            title=f"Fraud analysis linked: {graph_id}",
            actor=actor,
            reference_id=graph_id,
        )
        self._write(case)
        return case

    def link_image_intel(
        self, case_id: str, entity_id: str, actor: str | None = None
    ) -> Case | None:
        case = self.get(case_id)
        if not case:
            return None
        if entity_id not in case.image_intel_entity_ids:
            case.image_intel_entity_ids.append(entity_id)
            case.add_timeline_event(
                TimelineEventType.IMAGE_ANALYSIS_RUN,
                title=f"Image intel linked for entity: {entity_id}",
                actor=actor,
                reference_id=entity_id,
            )
            self._write(case)
        return case


# ---------------------------------------------------------------------------
# 5.3  Timeline query helpers  (search, filter, sort)
# ---------------------------------------------------------------------------


class TimelineQuery:
    """Filter and search a case timeline."""

    @staticmethod
    def filter(
        timeline: list[TimelineEvent],
        event_types: list[TimelineEventType] | None = None,
        actor: str | None = None,
        since: str | None = None,
        until: str | None = None,
        search: str | None = None,
    ) -> list[TimelineEvent]:
        results = list(timeline)
        if event_types:
            results = [e for e in results if e.event_type in event_types]
        if actor:
            results = [e for e in results if e.actor == actor]
        if since:
            results = [e for e in results if e.occurred_at >= since]
        if until:
            results = [e for e in results if e.occurred_at <= until]
        if search:
            q = search.lower()
            results = [
                e for e in results if q in e.title.lower() or (e.detail and q in e.detail.lower())
            ]
        return sorted(results, key=lambda e: e.occurred_at)


# ---------------------------------------------------------------------------
# 5.4  Structured Exports
# ---------------------------------------------------------------------------

_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Case Report — {{ case.case_number or case.case_id }}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 0; }
  .page { max-width: 960px; margin: 0 auto; padding: 32px 40px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
  h3 { font-size: 13px; color: #444; margin: 12px 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  .risk-CRITICAL { color: #c00; font-weight: bold; }
  .risk-HIGH { color: #d63b00; font-weight: bold; }
  .risk-MODERATE { color: #d48000; font-weight: bold; }
  .risk-LOW { color: #2e7d32; }
  .risk-MINIMAL { color: #555; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 12px; }
  th { background: #f0f0f0; text-align: left; padding: 6px 8px; border: 1px solid #ccc; }
  td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
  .badge-active { background: #d4edda; color: #155724; }
  .badge-closed { background: #f8d7da; color: #721c24; }
  .badge-draft  { background: #fff3cd; color: #856404; }
  .badge-urgent { background: #f8d7da; color: #721c24; }
  .badge-high   { background: #ffe5cc; color: #7a3000; }
  .badge-medium { background: #fff3cd; color: #856404; }
  .badge-low    { background: #d4edda; color: #155724; }
  .note-box { background: #fafafa; border-left: 3px solid #aaa; padding: 8px 12px; margin: 8px 0; }
  .flagged { border-left-color: #c00; }
  .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 12px; color: #aaa; font-size: 11px; }
  @media print { .page { padding: 16px; } }
</style>
</head>
<body>
<div class="page">
  <h1>OSINT Case Report</h1>
  <p class="meta">
    <strong>{{ case.case_number or case.case_id }}</strong> &mdash;
    {{ case.title }}<br>
    Status: <span class="badge badge-{{ case.status.value }}">{{ case.status.value.upper() }}</span>
    &nbsp; Priority: <span class="badge badge-{{ case.priority.value }}">{{ case.priority.value.upper() }}</span>
    {% if case.risk_level %}
    &nbsp; Risk: <span class="risk-{{ case.risk_level }}">{{ case.risk_level }}</span>
    {% if case.risk_score is not none %} ({{ "%.2f"|format(case.risk_score) }}){% endif %}
    {% endif %}
    <br>
    Investigator: {{ case.investigator or 'Unassigned' }}
    {% if case.client_reference %}&nbsp;| Client Ref: {{ case.client_reference }}{% endif %}
    {% if case.jurisdiction %}&nbsp;| Jurisdiction: {{ case.jurisdiction }}{% endif %}
    <br>
    Created: {{ case.created_at[:10] }}&nbsp; Updated: {{ case.updated_at[:10] }}
    {% if case.closed_at %}&nbsp; Closed: {{ case.closed_at[:10] }}{% endif %}
  </p>

  {% if case.description %}
  <p>{{ case.description }}</p>
  {% endif %}

  {% if case.subjects %}
  <h2>Subjects ({{ case.subjects|length }})</h2>
  <table>
    <tr><th>Name</th><th>Role</th><th>Entity ID</th><th>Notes</th></tr>
    {% for s in case.subjects %}
    <tr>
      <td>{{ s.display_name }}</td>
      <td>{{ s.role }}</td>
      <td>{{ s.entity_id or '—' }}</td>
      <td>{{ s.notes or '—' }}</td>
    </tr>
    {% endfor %}
  </table>
  {% endif %}

  {% if case.evidence %}
  <h2>Evidence ({{ case.evidence|length }})</h2>
  <table>
    <tr><th>#</th><th>Type</th><th>Title</th><th>Source</th><th>Key?</th><th>Added</th></tr>
    {% for e in case.evidence %}
    <tr>
      <td>{{ loop.index }}</td>
      <td>{{ e.evidence_type.value }}</td>
      <td>
        {{ e.title }}
        {% if e.description %}<br><small style="color:#666">{{ e.description[:120] }}</small>{% endif %}
        {% if e.url %}<br><small><a href="{{ e.url }}">{{ e.url[:80] }}</a></small>{% endif %}
      </td>
      <td>{{ e.source or '—' }}</td>
      <td>{{ '✓' if e.is_key_evidence else '' }}</td>
      <td>{{ e.added_at[:10] }}</td>
    </tr>
    {% endfor %}
  </table>
  {% endif %}

  {% if flagged_notes or case.notes %}
  <h2>Investigator Notes</h2>
  {% for n in case.notes %}
  <div class="note-box {% if n.is_flagged %}flagged{% endif %}">
    {% if n.author %}<strong>{{ n.author }}</strong> &mdash; {% endif %}
    <small>{{ n.created_at[:10] }}</small>
    {% if n.is_flagged %} <span style="color:#c00">★ Flagged</span>{% endif %}
    <p style="margin:6px 0 0">{{ n.content }}</p>
  </div>
  {% endfor %}
  {% endif %}

  {% if linked %}
  <h2>Linked Analysis</h2>
  <table>
    <tr><th>Type</th><th>IDs</th></tr>
    {% if case.scan_ids %}<tr><td>OSINT Scans</td><td>{{ case.scan_ids|join(', ') }}</td></tr>{% endif %}
    {% if case.deep_crawl_ids %}<tr><td>Deep Crawls</td><td>{{ case.deep_crawl_ids|join(', ') }}</td></tr>{% endif %}
    {% if case.fraud_graph_ids %}<tr><td>Fraud Graphs</td><td>{{ case.fraud_graph_ids|join(', ') }}</td></tr>{% endif %}
    {% if case.image_intel_entity_ids %}<tr><td>Image Intel Entities</td><td>{{ case.image_intel_entity_ids|join(', ') }}</td></tr>{% endif %}
  </table>
  {% endif %}

  {% if case.timeline %}
  <h2>Case Timeline ({{ case.timeline|length }} events)</h2>
  <table>
    <tr><th>Time</th><th>Event</th><th>Detail</th><th>Actor</th></tr>
    {% for evt in case.timeline %}
    <tr>
      <td style="white-space:nowrap">{{ evt.occurred_at[:16].replace('T',' ') }}</td>
      <td>{{ evt.title }}</td>
      <td>{{ evt.detail or '—' }}</td>
      <td>{{ evt.actor or '—' }}</td>
    </tr>
    {% endfor %}
  </table>
  {% endif %}

  <div class="footer">
    Generated {{ now }} &mdash; OSINT Platform v0.2 &mdash; CONFIDENTIAL — Authorised Use Only
  </div>
</div>
</body>
</html>
"""


class CaseExporter:
    """Generate structured exports from a Case object.

    Supported formats:
      - json  : Full case JSON bundle (all data, machine-readable)
      - csv   : Timeline as CSV (spreadsheet-compatible)
      - html  : Formatted HTML report (print-to-PDF in browser)
    """

    _jinja_env = Environment(loader=BaseLoader(), autoescape=True)  # type: ignore[call-arg]

    def export_json(self, case: Case) -> bytes:
        """Full case as UTF-8 JSON bundle."""
        return case.model_dump_json(indent=2).encode("utf-8")

    def export_csv_timeline(self, case: Case) -> bytes:
        """Case timeline as CSV bytes (UTF-8 with BOM for Excel compatibility)."""
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["Timestamp (UTC)", "Event Type", "Title", "Detail", "Actor", "Reference ID"]
        )
        for evt in sorted(case.timeline, key=lambda e: e.occurred_at):
            writer.writerow(
                [
                    evt.occurred_at,
                    evt.event_type.value,
                    evt.title,
                    evt.detail or "",
                    evt.actor or "",
                    evt.reference_id or "",
                ]
            )
        return ("\ufeff" + buf.getvalue()).encode("utf-8")

    def export_csv_evidence(self, case: Case) -> bytes:
        """Evidence list as CSV bytes."""
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "Evidence ID",
                "Type",
                "Title",
                "Description",
                "URL",
                "Source",
                "Key Evidence",
                "Tags",
                "Added At",
                "Added By",
            ]
        )
        for e in case.evidence:
            writer.writerow(
                [
                    e.evidence_id,
                    e.evidence_type.value,
                    e.title,
                    e.description or "",
                    e.url or "",
                    e.source or "",
                    "Yes" if e.is_key_evidence else "No",
                    "; ".join(e.tags),
                    e.added_at,
                    e.added_by or "",
                ]
            )
        return ("\ufeff" + buf.getvalue()).encode("utf-8")

    def export_html(self, case: Case) -> bytes:
        """Formatted HTML case report (print-to-PDF in any browser)."""
        template = self._jinja_env.from_string(_HTML_TEMPLATE)
        has_linked = bool(
            case.scan_ids
            or case.deep_crawl_ids
            or case.fraud_graph_ids
            or case.image_intel_entity_ids
        )
        html = template.render(
            case=case,
            flagged_notes=[n for n in case.notes if n.is_flagged],
            linked=has_linked,
            now=datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"),
        )
        return html.encode("utf-8")

    def export_summary_text(self, case: Case) -> bytes:
        """Plain-text one-page summary (terminal / email-safe)."""
        lines = [
            "=" * 70,
            f"CASE REPORT: {case.case_number or case.case_id}",
            "=" * 70,
            f"Title        : {case.title}",
            f"Type         : {case.case_type}",
            f"Status       : {case.status.value.upper()}",
            f"Priority     : {case.priority.value.upper()}",
        ]
        if case.risk_level:
            lines.append(f"Risk Level   : {case.risk_level}  (score={case.risk_score or 'N/A'})")
        lines += [
            f"Investigator : {case.investigator or 'Unassigned'}",
            f"Created      : {case.created_at[:10]}",
            f"Updated      : {case.updated_at[:10]}",
        ]
        if case.description:
            lines += ["", textwrap.fill(case.description, width=68)]

        if case.subjects:
            lines += ["", "-" * 40, "SUBJECTS"]
            for s in case.subjects:
                lines.append(f"  • {s.display_name} ({s.role})")

        if case.evidence:
            lines += ["", "-" * 40, f"EVIDENCE ({len(case.evidence)} items)"]
            for e in case.evidence:
                key = " [KEY]" if e.is_key_evidence else ""
                lines.append(f"  [{e.evidence_type.value.upper()}]{key} {e.title}")

        if case.notes:
            lines += ["", "-" * 40, "NOTES"]
            for n in case.notes:
                prefix = "★ " if n.is_flagged else "  "
                for line in textwrap.wrap(n.content, width=66):
                    lines.append(f"{prefix}{line}")
                    prefix = "  "

        lines += [
            "",
            "-" * 40,
            f"Generated: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}",
            "CONFIDENTIAL — Authorised Use Only",
        ]
        return "\n".join(lines).encode("utf-8")


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_service_instance: CaseService | None = None


def get_case_service() -> CaseService:
    global _service_instance
    if _service_instance is None:
        _service_instance = CaseService()
    return _service_instance
