from __future__ import annotations

import base64
import json
import logging
import re
import uuid
from datetime import datetime
from app._compat import UTC
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.extraction_template import (
    CreateExtractionTemplate,
    ExtractionTemplate,
    UpdateExtractionTemplate,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/extraction", tags=["extraction"])

TEMPLATES_DIR = Path("data/extraction_templates")


def _ensure_dir() -> None:
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)


def _template_path(template_id: str) -> Path:
    return TEMPLATES_DIR / f"{template_id}.json"


def _read_template(template_id: str) -> ExtractionTemplate:
    path = _template_path(template_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Template not found")
    raw = json.loads(path.read_text(encoding="utf-8"))
    return ExtractionTemplate(**raw)


def _write_template(template: ExtractionTemplate) -> None:
    _ensure_dir()
    path = _template_path(template.id)
    path.write_text(
        json.dumps(template.model_dump(mode="json"), indent=2, default=str),
        encoding="utf-8",
    )


def _delete_template_file(template_id: str) -> None:
    path = _template_path(template_id)
    if path.exists():
        path.unlink()


@router.post("/templates", response_model=ExtractionTemplate, status_code=201)
async def create_template(body: CreateExtractionTemplate) -> ExtractionTemplate:
    now = datetime.now(tz=UTC)
    template = ExtractionTemplate(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        strategy_type=body.strategy_type,
        config=body.config,
        created_at=now,
        updated_at=now,
    )
    _write_template(template)
    logger.info("Created extraction template %s (%s)", template.name, template.id)
    return template


@router.get("/templates", response_model=list[ExtractionTemplate], status_code=200)
async def list_templates() -> list[ExtractionTemplate]:
    _ensure_dir()
    templates: list[ExtractionTemplate] = []
    for path in sorted(TEMPLATES_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            templates.append(ExtractionTemplate(**raw))
        except Exception:
            logger.warning("Skipping invalid template file: %s", path.name)
    return templates


@router.get("/templates/{template_id}", response_model=ExtractionTemplate, status_code=200)
async def get_template(template_id: str) -> ExtractionTemplate:
    return _read_template(template_id)


@router.put("/templates/{template_id}", response_model=ExtractionTemplate, status_code=200)
async def update_template(template_id: str, body: UpdateExtractionTemplate) -> ExtractionTemplate:
    existing = _read_template(template_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return existing

    updates["updated_at"] = datetime.now(tz=UTC)
    updated = existing.model_copy(update=updates)
    _write_template(updated)
    logger.info("Updated extraction template %s", template_id)
    return updated


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: str) -> None:
    if not _template_path(template_id).exists():
        raise HTTPException(status_code=404, detail="Template not found")
    _delete_template_file(template_id)
    logger.info("Deleted extraction template %s", template_id)


# ---------------------------------------------------------------------------
# Live page fetch and extraction preview
# ---------------------------------------------------------------------------


class FetchPageRequest(BaseModel):
    url: str


class HtmlTreeNode(BaseModel):
    tag: str
    id: str | None = None
    classes: list[str] | None = None
    text: str | None = None
    path: str | None = None
    children: list[HtmlTreeNode] | None = None


HtmlTreeNode.model_rebuild()


class FetchPageResponse(BaseModel):
    screenshot: str | None = None  # base64-encoded PNG
    html_tree: list[HtmlTreeNode]


class PreviewRequest(BaseModel):
    url: str
    strategy: str | None = "css"
    schema: dict[str, Any] | None = None


class PreviewResponse(BaseModel):
    preview: list[dict[str, Any]]


def _parse_html_tree(html: str, max_depth: int = 4) -> list[HtmlTreeNode]:
    """Build a simplified element tree from raw HTML using regex (no lxml dep).

    Returns top-level block elements with up to *max_depth* levels of children.
    Each node carries tag, id, classes, first 120 chars of text, and a CSS path.
    """
    # Very lightweight parser — covers the 90% case for the visual tree selector.
    tag_re = re.compile(
        r"<(?P<tag>[a-zA-Z][a-zA-Z0-9]*)(?P<attrs>[^>]*)>(?P<inner>.*?)</(?P=tag)>",
        re.DOTALL | re.IGNORECASE,
    )
    id_re = re.compile(r'id=["\']([^"\']+)["\']')
    cls_re = re.compile(r'class=["\']([^"\']+)["\']')

    BLOCK_TAGS = {
        "body",
        "main",
        "header",
        "footer",
        "nav",
        "section",
        "article",
        "aside",
        "div",
        "ul",
        "ol",
        "table",
        "form",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "li",
        "tr",
        "td",
        "th",
    }

    def _build(fragment: str, depth: int, path: str) -> list[HtmlTreeNode]:
        if depth > max_depth:
            return []
        nodes: list[HtmlTreeNode] = []
        for m in tag_re.finditer(fragment):
            tag = m.group("tag").lower()
            if tag not in BLOCK_TAGS:
                continue
            attrs = m.group("attrs")
            inner = m.group("inner")
            id_match = id_re.search(attrs)
            cls_match = cls_re.search(attrs)
            el_id = id_match.group(1) if id_match else None
            classes = cls_match.group(1).split() if cls_match else None
            # Strip tags for text preview
            raw_text = re.sub(r"<[^>]+>", " ", inner).strip()
            text = raw_text[:120] if raw_text else None
            node_path = f"{path} > {tag}" if path else tag
            children = _build(inner, depth + 1, node_path)
            nodes.append(
                HtmlTreeNode(
                    tag=tag,
                    id=el_id,
                    classes=classes,
                    text=text,
                    path=node_path,
                    children=children or None,
                )
            )
        return nodes

    # Start from <body> if present
    body_m = re.search(r"<body[^>]*>(.*)</body>", html, re.DOTALL | re.IGNORECASE)
    fragment = body_m.group(1) if body_m else html
    return _build(fragment, 0, "")


@router.post("/fetch-page", response_model=FetchPageResponse, status_code=201)
async def fetch_page(body: FetchPageRequest) -> FetchPageResponse:
    """Fetch a URL with a headless browser and return a screenshot + HTML element tree.

    Used by the Extraction Builder to let users visually select CSS selectors.
    """
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode  # noqa: PLC0415

        browser_config = BrowserConfig(headless=True, viewport_width=1280, viewport_height=800)
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            screenshot=True,
            word_count_threshold=0,
        )
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(body.url, config=run_config)

        if not result.success:
            raise HTTPException(
                status_code=502, detail=f"Failed to fetch page: {result.error_message}"
            )

        screenshot_b64: str | None = None
        if result.screenshot:
            # Crawl4AI may return bytes or a base64 string
            if isinstance(result.screenshot, bytes):
                screenshot_b64 = base64.b64encode(result.screenshot).decode()
            else:
                screenshot_b64 = result.screenshot

        html_tree = _parse_html_tree(result.html or "")
        return FetchPageResponse(screenshot=screenshot_b64, html_tree=html_tree)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("fetch-page error for %s", body.url)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/preview", response_model=PreviewResponse, status_code=201)
async def preview_extraction(body: PreviewRequest) -> PreviewResponse:
    """Run an extraction strategy against a live URL and return sample results.

    Supports ``css`` (CSS selector list from schema fields) and ``json`` strategies.
    """
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode  # noqa: PLC0415
        from crawl4ai.extraction_strategy import JsonCssExtractionStrategy  # noqa: PLC0415

        schema = body.schema or {}
        strategy = body.strategy or "css"

        extraction_strategy = None
        if strategy == "css" and schema:
            extraction_strategy = JsonCssExtractionStrategy(schema)

        browser_config = BrowserConfig(headless=True, viewport_width=1280, viewport_height=800)
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            extraction_strategy=extraction_strategy,
            word_count_threshold=0,
        )
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(body.url, config=run_config)

        if not result.success:
            raise HTTPException(status_code=502, detail=f"Crawl failed: {result.error_message}")

        # Parse extracted_content (JSON string) or fall back to empty list
        preview: list[dict[str, Any]] = []
        if result.extracted_content:
            try:
                parsed = json.loads(result.extracted_content)
                if isinstance(parsed, list):
                    preview = parsed[:50]  # cap at 50 items
                elif isinstance(parsed, dict):
                    preview = [parsed]
            except json.JSONDecodeError:
                preview = [{"raw": result.extracted_content[:2000]}]

        return PreviewResponse(preview=preview)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("preview error for %s", body.url)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
