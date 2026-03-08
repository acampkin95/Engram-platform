"""Tests for app/api/extraction.py — targets 75%+ coverage."""
from __future__ import annotations

import base64
import json
import sys
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

import app.api.extraction as extraction_module
from app.api.extraction import router, _parse_html_tree
from app.middleware import rate_limit as _rl_module

# ---------------------------------------------------------------------------
# App + client
# ---------------------------------------------------------------------------

app = FastAPI()
app.include_router(router)
client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    """Disable rate limiting for all tests."""
    original = _rl_module._config.rate_limit_enabled
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = original


@pytest.fixture(autouse=True)
def temp_templates_dir(tmp_path):
    """Patch TEMPLATES_DIR to a temp directory so tests never touch real FS."""
    templates_dir = tmp_path / "extraction_templates"
    templates_dir.mkdir()
    with patch.object(extraction_module, "TEMPLATES_DIR", templates_dir):
        yield templates_dir


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TEMPLATE_PAYLOAD = {
    "name": "Test Template",
    "description": "A test template",
    "strategy_type": "css",
    "config": {"selector": "div.content"},
}


def _create_template(payload=None):
    """POST a template and return the response."""
    return client.post("/api/extraction/templates", json=payload or _TEMPLATE_PAYLOAD)


def _make_crawl4ai_mocks(
    success=True,
    html="<html><body><div>Hello</div></body></html>",
    screenshot=None,
    extracted_content=None,
    raise_exc=None,
):
    """Return (mock_crawl4ai_module, mock_crawler_instance)."""
    mock_result = MagicMock()
    mock_result.success = success
    mock_result.html = html
    mock_result.screenshot = screenshot
    mock_result.extracted_content = extracted_content
    mock_result.error_message = "Crawl failed"

    mock_crawler = AsyncMock()
    mock_crawler.__aenter__ = AsyncMock(return_value=mock_crawler)
    mock_crawler.__aexit__ = AsyncMock(return_value=False)

    if raise_exc is not None:
        mock_crawler.arun = AsyncMock(side_effect=raise_exc)
    else:
        mock_crawler.arun = AsyncMock(return_value=mock_result)

    mock_crawl4ai = MagicMock()
    mock_crawl4ai.AsyncWebCrawler.return_value = mock_crawler
    mock_crawl4ai.BrowserConfig = MagicMock(return_value=MagicMock())
    mock_crawl4ai.CrawlerRunConfig = MagicMock(return_value=MagicMock())
    mock_crawl4ai.CacheMode = MagicMock()
    mock_crawl4ai.CacheMode.BYPASS = "bypass"

    mock_extraction_strategy = MagicMock()
    mock_extraction_strategy.JsonCssExtractionStrategy = MagicMock()

    return mock_crawl4ai, mock_extraction_strategy, mock_crawler


# ---------------------------------------------------------------------------
# Template CRUD: POST /api/extraction/templates
# ---------------------------------------------------------------------------


class TestCreateTemplate:
    def test_create_returns_201(self):
        resp = _create_template()
        assert resp.status_code == 201

    def test_create_returns_template_fields(self):
        resp = _create_template()
        data = resp.json()
        assert data["name"] == _TEMPLATE_PAYLOAD["name"]
        assert data["strategy_type"] == _TEMPLATE_PAYLOAD["strategy_type"]
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_writes_file(self, temp_templates_dir):
        resp = _create_template()
        assert resp.status_code == 201
        template_id = resp.json()["id"]
        assert (temp_templates_dir / f"{template_id}.json").exists()

    def test_create_missing_name_returns_422(self):
        payload = {k: v for k, v in _TEMPLATE_PAYLOAD.items() if k != "name"}
        resp = client.post("/api/extraction/templates", json=payload)
        assert resp.status_code == 422

    def test_create_missing_strategy_type_returns_422(self):
        payload = {k: v for k, v in _TEMPLATE_PAYLOAD.items() if k != "strategy_type"}
        resp = client.post("/api/extraction/templates", json=payload)
        assert resp.status_code == 422

    def test_create_invalid_strategy_type_returns_422(self):
        payload = {**_TEMPLATE_PAYLOAD, "strategy_type": "nonexistent_type"}
        resp = client.post("/api/extraction/templates", json=payload)
        assert resp.status_code == 422

    def test_create_with_optional_description_omitted(self):
        payload = {k: v for k, v in _TEMPLATE_PAYLOAD.items() if k != "description"}
        resp = client.post("/api/extraction/templates", json=payload)
        assert resp.status_code == 201
        assert resp.json()["description"] == ""

    def test_create_all_strategy_types(self):
        for strategy in ("css", "regex", "llm", "cosine"):
            resp = _create_template({**_TEMPLATE_PAYLOAD, "strategy_type": strategy})
            assert resp.status_code == 201, f"strategy_type={strategy} failed"
            assert resp.json()["strategy_type"] == strategy


# ---------------------------------------------------------------------------
# Template CRUD: GET /api/extraction/templates
# ---------------------------------------------------------------------------


class TestListTemplates:
    def test_list_empty_returns_200(self):
        resp = client.get("/api/extraction/templates")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_returns_created_templates(self):
        _create_template()
        _create_template({**_TEMPLATE_PAYLOAD, "name": "Second"})
        resp = client.get("/api/extraction/templates")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_skips_corrupt_json_files(self, temp_templates_dir):
        # Write a corrupt JSON file
        (temp_templates_dir / "corrupt.json").write_text("not valid json", encoding="utf-8")
        # Write a valid template
        _create_template()
        resp = client.get("/api/extraction/templates")
        assert resp.status_code == 200
        # Only the valid template should appear
        templates = resp.json()
        assert all("id" in t for t in templates)

    def test_list_skips_invalid_model_files(self, temp_templates_dir):
        # Valid JSON but missing required fields
        (temp_templates_dir / "invalid.json").write_text(
            json.dumps({"some": "data"}), encoding="utf-8"
        )
        resp = client.get("/api/extraction/templates")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Template CRUD: GET /api/extraction/templates/{id}
# ---------------------------------------------------------------------------


class TestGetTemplate:
    def test_get_existing_returns_200(self):
        create_resp = _create_template()
        tid = create_resp.json()["id"]
        resp = client.get(f"/api/extraction/templates/{tid}")
        assert resp.status_code == 200
        assert resp.json()["id"] == tid

    def test_get_nonexistent_returns_404(self):
        resp = client.get("/api/extraction/templates/does-not-exist")
        assert resp.status_code == 404

    def test_get_returns_correct_fields(self):
        create_resp = _create_template()
        data = create_resp.json()
        tid = data["id"]
        resp = client.get(f"/api/extraction/templates/{tid}")
        got = resp.json()
        assert got["name"] == data["name"]
        assert got["strategy_type"] == data["strategy_type"]
        assert got["description"] == data["description"]


# ---------------------------------------------------------------------------
# Template CRUD: PUT /api/extraction/templates/{id}
# ---------------------------------------------------------------------------


class TestUpdateTemplate:
    def test_update_name_returns_200(self):
        tid = _create_template().json()["id"]
        resp = client.put(f"/api/extraction/templates/{tid}", json={"name": "Updated Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_update_description(self):
        tid = _create_template().json()["id"]
        resp = client.put(f"/api/extraction/templates/{tid}", json={"description": "New desc"})
        assert resp.status_code == 200
        assert resp.json()["description"] == "New desc"

    def test_update_empty_body_returns_existing(self):
        original = _create_template().json()
        tid = original["id"]
        resp = client.put(f"/api/extraction/templates/{tid}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == original["name"]

    def test_update_nonexistent_returns_404(self):
        resp = client.put(
            "/api/extraction/templates/nonexistent",
            json={"name": "New"},
        )
        assert resp.status_code == 404

    def test_update_persists_to_file(self, temp_templates_dir):
        tid = _create_template().json()["id"]
        client.put(f"/api/extraction/templates/{tid}", json={"name": "Persisted"})
        raw = json.loads((temp_templates_dir / f"{tid}.json").read_text())
        assert raw["name"] == "Persisted"

    def test_update_updates_updated_at(self):
        original = _create_template().json()
        tid = original["id"]
        resp = client.put(f"/api/extraction/templates/{tid}", json={"name": "Changed"})
        assert resp.json()["updated_at"] >= original["updated_at"]

    def test_update_config(self):
        tid = _create_template().json()["id"]
        new_config = {"selector": "p.article", "extra": True}
        resp = client.put(f"/api/extraction/templates/{tid}", json={"config": new_config})
        assert resp.status_code == 200
        assert resp.json()["config"] == new_config


# ---------------------------------------------------------------------------
# Template CRUD: DELETE /api/extraction/templates/{id}
# ---------------------------------------------------------------------------


class TestDeleteTemplate:
    def test_delete_existing_returns_204(self):
        tid = _create_template().json()["id"]
        resp = client.delete(f"/api/extraction/templates/{tid}")
        assert resp.status_code == 204

    def test_delete_removes_file(self, temp_templates_dir):
        tid = _create_template().json()["id"]
        client.delete(f"/api/extraction/templates/{tid}")
        assert not (temp_templates_dir / f"{tid}.json").exists()

    def test_delete_nonexistent_returns_404(self):
        resp = client.delete("/api/extraction/templates/does-not-exist")
        assert resp.status_code == 404

    def test_delete_makes_get_return_404(self):
        tid = _create_template().json()["id"]
        client.delete(f"/api/extraction/templates/{tid}")
        resp = client.get(f"/api/extraction/templates/{tid}")
        assert resp.status_code == 404

    def test_delete_removes_from_list(self):
        tid = _create_template().json()["id"]
        client.delete(f"/api/extraction/templates/{tid}")
        templates = client.get("/api/extraction/templates").json()
        assert all(t["id"] != tid for t in templates)


# ---------------------------------------------------------------------------
# _parse_html_tree — unit tests
# ---------------------------------------------------------------------------


class TestParseHtmlTree:
    def test_returns_nodes_for_simple_html(self):
        html = "<html><body><div id='main' class='container'>Hello World</div></body></html>"
        nodes = _parse_html_tree(html)
        assert len(nodes) > 0

    def test_extracts_id(self):
        html = "<body><div id='hero'>Content</div></body>"
        nodes = _parse_html_tree(html)
        assert any(n.id == "hero" for n in nodes)

    def test_extracts_classes(self):
        html = "<body><div class='foo bar'>Content</div></body>"
        nodes = _parse_html_tree(html)
        assert any(n.classes and "foo" in n.classes for n in nodes)

    def test_text_extracted(self):
        html = "<body><p>Short text here</p></body>"
        nodes = _parse_html_tree(html)
        assert any(n.text and "Short text here" in n.text for n in nodes)

    def test_text_truncated_at_120_chars(self):
        long_text = "A" * 200
        html = f"<body><p>{long_text}</p></body>"
        nodes = _parse_html_tree(html)
        for n in nodes:
            if n.text:
                assert len(n.text) <= 120

    def test_path_is_set(self):
        html = "<body><div>Hello</div></body>"
        nodes = _parse_html_tree(html)
        assert all(n.path is not None for n in nodes if n.tag in {"div", "p", "section"})

    def test_no_body_tag_uses_raw_fragment(self):
        html = "<div>No body tag here</div>"
        nodes = _parse_html_tree(html)
        assert len(nodes) > 0

    def test_max_depth_limits_children(self):
        # Build deeply nested html
        deep_html = "<body>" + "<div>" * 10 + "deep" + "</div>" * 10 + "</body>"
        nodes = _parse_html_tree(deep_html, max_depth=2)

        # Depth check: children at depth > max_depth should be empty
        def max_nesting(nodes, depth=0):
            if not nodes:
                return depth
            return max(max_nesting(n.children or [], depth + 1) for n in nodes)

        assert max_nesting(nodes) <= 4  # max_depth=2 + 2 for root children

    def test_non_block_tags_excluded(self):
        html = "<body><span>Inline</span><a href='#'>Link</a><div>Block</div></body>"
        nodes = _parse_html_tree(html)
        tags = {n.tag for n in nodes}
        assert "span" not in tags
        assert "a" not in tags
        assert "div" in tags

    def test_nested_children_populated(self):
        html = "<body><section><div>Inner</div></section></body>"
        nodes = _parse_html_tree(html)
        sections = [n for n in nodes if n.tag == "section"]
        if sections:
            assert sections[0].children is not None
            assert any(c.tag == "div" for c in sections[0].children)

    def test_empty_html_returns_empty_list(self):
        nodes = _parse_html_tree("")
        assert isinstance(nodes, list)

    def test_heading_tags_included(self):
        html = "<body><h1>Title</h1><h2>Sub</h2><h3>Sub2</h3></body>"
        nodes = _parse_html_tree(html)
        tags = {n.tag for n in nodes}
        assert "h1" in tags

    def test_table_tags_included(self):
        html = "<body><table><tr><td>Cell</td></tr></table></body>"
        nodes = _parse_html_tree(html)
        tags = {n.tag for n in nodes}
        assert "table" in tags


# ---------------------------------------------------------------------------
# POST /api/extraction/fetch-page
# ---------------------------------------------------------------------------


class TestFetchPage:
    def _patch_crawl4ai(self, **kwargs):
        mock_crawl4ai, mock_ext, mock_crawler = _make_crawl4ai_mocks(**kwargs)
        return (
            patch.dict(
                sys.modules,
                {
                    "crawl4ai": mock_crawl4ai,
                    "crawl4ai.extraction_strategy": mock_ext,
                },
            ),
            mock_crawl4ai,
            mock_crawler,
        )

    def test_success_no_screenshot(self):
        ctx, _, _ = self._patch_crawl4ai(screenshot=None)
        with ctx:
            resp = client.post("/api/extraction/fetch-page", json={"url": "https://example.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["screenshot"] is None
        assert isinstance(data["html_tree"], list)

    def test_success_screenshot_bytes(self):
        raw_bytes = b"PNG_IMAGE_DATA"
        ctx, _, _ = self._patch_crawl4ai(screenshot=raw_bytes)
        with ctx:
            resp = client.post("/api/extraction/fetch-page", json={"url": "https://example.com"})
        assert resp.status_code == 200
        data = resp.json()
        expected_b64 = base64.b64encode(raw_bytes).decode()
        assert data["screenshot"] == expected_b64

    def test_success_screenshot_already_string(self):
        b64_str = base64.b64encode(b"FAKE_PNG").decode()
        ctx, _, _ = self._patch_crawl4ai(screenshot=b64_str)
        with ctx:
            resp = client.post("/api/extraction/fetch-page", json={"url": "https://example.com"})
        assert resp.status_code == 200
        assert resp.json()["screenshot"] == b64_str

    def test_crawl_failure_returns_502(self):
        ctx, _, _ = self._patch_crawl4ai(success=False)
        with ctx:
            resp = client.post("/api/extraction/fetch-page", json={"url": "https://example.com"})
        assert resp.status_code == 502

    def test_exception_during_crawl_returns_500(self):
        ctx, _, _ = self._patch_crawl4ai(raise_exc=RuntimeError("browser crashed"))
        with ctx:
            resp = client.post("/api/extraction/fetch-page", json={"url": "https://example.com"})
        assert resp.status_code == 500
        assert "browser crashed" in resp.json()["detail"]

    def test_missing_url_returns_422(self):
        resp = client.post("/api/extraction/fetch-page", json={})
        assert resp.status_code == 422

    def test_html_tree_populated_from_response(self):
        html = "<html><body><div id='x'>Content here</div></body></html>"
        ctx, _, _ = self._patch_crawl4ai(html=html)
        with ctx:
            resp = client.post("/api/extraction/fetch-page", json={"url": "https://example.com"})
        assert resp.status_code == 200
        tree = resp.json()["html_tree"]
        assert len(tree) > 0


# ---------------------------------------------------------------------------
# POST /api/extraction/preview
# ---------------------------------------------------------------------------


class TestPreviewExtraction:
    def _patch_crawl4ai(self, **kwargs):
        mock_crawl4ai, mock_ext, mock_crawler = _make_crawl4ai_mocks(**kwargs)
        return (
            patch.dict(
                sys.modules,
                {
                    "crawl4ai": mock_crawl4ai,
                    "crawl4ai.extraction_strategy": mock_ext,
                },
            ),
            mock_crawl4ai,
            mock_crawler,
        )

    def test_success_with_list_extracted_content(self):
        content = json.dumps([{"title": "Example"}, {"title": "Second"}])
        ctx, _, _ = self._patch_crawl4ai(extracted_content=content)
        with ctx:
            resp = client.post(
                "/api/extraction/preview",
                json={"url": "https://example.com", "strategy": "css", "schema": {"name": "items"}},
            )
        assert resp.status_code == 200
        assert len(resp.json()["preview"]) == 2

    def test_success_with_dict_extracted_content(self):
        content = json.dumps({"single": "item"})
        ctx, _, _ = self._patch_crawl4ai(extracted_content=content)
        with ctx:
            resp = client.post("/api/extraction/preview", json={"url": "https://example.com"})
        assert resp.status_code == 200
        assert resp.json()["preview"] == [{"single": "item"}]

    def test_success_with_invalid_json_content_raw_fallback(self):
        ctx, _, _ = self._patch_crawl4ai(extracted_content="not json at all {{")
        with ctx:
            resp = client.post("/api/extraction/preview", json={"url": "https://example.com"})
        assert resp.status_code == 200
        preview = resp.json()["preview"]
        assert len(preview) == 1
        assert "raw" in preview[0]

    def test_success_no_extracted_content_returns_empty_list(self):
        ctx, _, _ = self._patch_crawl4ai(extracted_content=None)
        with ctx:
            resp = client.post("/api/extraction/preview", json={"url": "https://example.com"})
        assert resp.status_code == 200
        assert resp.json()["preview"] == []

    def test_crawl_failure_returns_502(self):
        ctx, _, _ = self._patch_crawl4ai(success=False)
        with ctx:
            resp = client.post("/api/extraction/preview", json={"url": "https://example.com"})
        assert resp.status_code == 502

    def test_exception_returns_500(self):
        ctx, _, _ = self._patch_crawl4ai(raise_exc=RuntimeError("timeout"))
        with ctx:
            resp = client.post("/api/extraction/preview", json={"url": "https://example.com"})
        assert resp.status_code == 500
        assert "timeout" in resp.json()["detail"]

    def test_missing_url_returns_422(self):
        resp = client.post("/api/extraction/preview", json={})
        assert resp.status_code == 422

    def test_default_strategy_used_when_none_provided(self):
        ctx, _, _ = self._patch_crawl4ai(extracted_content=json.dumps([{"x": 1}]))
        with ctx:
            # No strategy field — defaults to "css"
            resp = client.post("/api/extraction/preview", json={"url": "https://example.com"})
        assert resp.status_code == 200

    def test_list_capped_at_50_items(self):
        content = json.dumps([{"i": idx} for idx in range(100)])
        ctx, _, _ = self._patch_crawl4ai(extracted_content=content)
        with ctx:
            resp = client.post("/api/extraction/preview", json={"url": "https://example.com"})
        assert resp.status_code == 200
        assert len(resp.json()["preview"]) == 50

    def test_preview_with_css_strategy_and_schema(self):
        content = json.dumps([{"field": "value"}])
        ctx, mock_crawl4ai, _ = self._patch_crawl4ai(extracted_content=content)
        with ctx:
            resp = client.post(
                "/api/extraction/preview",
                json={
                    "url": "https://example.com",
                    "strategy": "css",
                    "schema": {
                        "baseSelector": ".item",
                        "fields": [{"name": "title", "selector": "h2"}],
                    },
                },
            )
        assert resp.status_code == 200

    def test_preview_without_schema_no_extraction_strategy(self):
        # When schema is empty/None, extraction_strategy should be None (no CSS strategy)
        ctx, _, _ = self._patch_crawl4ai(extracted_content=json.dumps([]))
        with ctx:
            resp = client.post(
                "/api/extraction/preview",
                json={"url": "https://example.com", "strategy": "css"},
            )
        assert resp.status_code == 200
