"""OSINT scan orchestrator — end-to-end pipeline:

    alias discovery → crawl URLs → review results → store in ChromaDB → build knowledge graph

Each stage emits a WebSocket event on the ``osint_scan:{scan_id}`` topic so
clients can track progress in real-time.
"""


from __future__ import annotations
import asyncio
import logging
import os
import uuid
from datetime import datetime, UTC
from enum import Enum

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11"""

        def __new__(cls, value):
            obj = str.__new__(cls, value)
            obj._value_ = value
            return obj


from typing import Any
from collections.abc import Callable, Coroutine

from pydantic import BaseModel, Field

from app.osint.alias_discovery import AliasDiscoveryService
from app.osint.semantic_tracker import SemanticTracker, KnowledgeGraph
from app.pipelines.model_review import (
    BatchReviewResult,
    ModelReviewPipeline,
    ReviewDecision,
)
from app.services.lm_studio_bridge import LMStudioBridge
from app.storage.chromadb_client import ChromaDBClient, get_chromadb_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ScanStage(StrEnum):
    PENDING = "pending"
    ALIAS_DISCOVERY = "alias_discovery"
    CRAWLING = "crawling"
    FACE_MATCHING = "face_matching"
    WHOIS_LOOKUP = "whois_lookup"
    THREAT_INTEL = "threat_intel"
    EMAIL_OSINT = "email_osint"
    REVIEWING = "reviewing"
    STORING = "storing"
    BUILDING_GRAPH = "building_graph"
    COMPLETED = "completed"
    FAILED = "failed"


class ScanRequest(BaseModel):
    username: str
    platforms: list[str] | None = None
    max_concurrent_crawls: int = Field(default=5, ge=1, le=20)
    query_context: str = ""
    reference_photo_labels: list[str] | None = None
    # Enhanced OSINT targets
    target_domain: str | None = None
    target_email: str | None = None
    target_ip: str | None = None
    enable_whois: bool = True
    enable_threat_intel: bool = True
    enable_email_osint: bool = True

    # Pre-generated scan_id from API layer (ensures WS topic matches)
    scan_id: str | None = None


class CrawlResultItem(BaseModel):
    crawl_id: str
    url: str
    success: bool
    markdown: str | None = None
    error: str | None = None
    word_count: int = 0


class ScanResult(BaseModel):
    scan_id: str
    username: str
    stage: ScanStage
    profile_urls: list[dict[str, str]] = Field(default_factory=list)
    crawl_results: list[CrawlResultItem] = Field(default_factory=list)
    face_matches: list[dict[str, Any]] = Field(default_factory=list)
    whois_data: dict[str, Any] | None = None
    threat_intel_data: dict[str, Any] | None = None
    email_osint_data: dict[str, Any] | None = None
    review: BatchReviewResult | None = None
    knowledge_graph: KnowledgeGraph | None = None
    stored_document_ids: list[str] = Field(default_factory=list)
    error: str | None = None
    started_at: str = ""
    completed_at: str = ""
    summary: dict[str, Any] = Field(default_factory=dict)


# Type alias for the progress callback
ProgressCallback = Callable[[str, ScanStage, dict[str, Any]], Coroutine[Any, Any, None]]


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class OSINTScanOrchestrator:
    """Coordinates the full OSINT scan pipeline.

    Parameters:
        lm_bridge: Shared LM Studio bridge instance.
        chromadb_client: Optional ChromaDB client (defaults to singleton).
        on_progress: Async callback ``(scan_id, stage, data)`` invoked at each
            stage transition.  Designed to be wired to the WebSocket manager.
    """

    def __init__(
        self,
        lm_bridge: LMStudioBridge | None = None,
        chromadb_client: ChromaDBClient | None = None,
        on_progress: ProgressCallback | None = None,
    ) -> None:
        self.lm_bridge = lm_bridge or LMStudioBridge(
            base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1"),
        )
        self.chromadb = chromadb_client or get_chromadb_client()
        self._on_progress = on_progress

        # Sub-services
        self._alias_service = AliasDiscoveryService(self.lm_bridge)
        self._review_pipeline = ModelReviewPipeline(self.lm_bridge)
        self._semantic_tracker = SemanticTracker(self.lm_bridge, self.chromadb)

    # -- Public API ---------------------------------------------------------

    async def run_scan(self, request: ScanRequest) -> ScanResult:
        """Execute the full OSINT scan pipeline.

        Stages:
            1. Alias discovery — generate profile URLs for the username.
            2. Crawling — crawl each profile URL.
            3. Reviewing — score each crawl result for relevance.
            4. Storing — persist ``keep`` results in ChromaDB.
            5. Building graph — extract entities/relationships into a knowledge graph.

        Returns:
            ScanResult with full pipeline output.
        """
        scan_id = request.scan_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()

        result = ScanResult(
            scan_id=scan_id,
            username=request.username,
            stage=ScanStage.PENDING,
            started_at=now,
        )

        try:
            # ---- Stage 1: Alias discovery ----
            await self._emit(scan_id, ScanStage.ALIAS_DISCOVERY, {"username": request.username})
            result.stage = ScanStage.ALIAS_DISCOVERY

            profile_urls = await self._alias_service.build_profile_urls(
                request.username, request.platforms
            )
            result.profile_urls = profile_urls

            await self._emit(
                scan_id,
                ScanStage.ALIAS_DISCOVERY,
                {
                    "profile_urls_count": len(profile_urls),
                    "platforms": [p["platform"] for p in profile_urls],
                },
            )

            # ---- Stage 2: Crawling ----
            await self._emit(scan_id, ScanStage.CRAWLING, {"urls_count": len(profile_urls)})
            result.stage = ScanStage.CRAWLING

            crawl_results = await self._crawl_urls(
                [p["url"] for p in profile_urls],
                max_concurrent=request.max_concurrent_crawls,
            )
            result.crawl_results = crawl_results

            successful = [cr for cr in crawl_results if cr.success]
            await self._emit(
                scan_id,
                ScanStage.CRAWLING,
                {
                    "total": len(crawl_results),
                    "successful": len(successful),
                    "failed": len(crawl_results) - len(successful),
                },
            )

            if not successful:
                logger.warning(
                    f"Scan {scan_id}: no successful crawls — skipping review/store/graph"
                )
                result.stage = ScanStage.COMPLETED
                result.completed_at = datetime.now(UTC).isoformat()
                result.summary = self._build_summary(result)
                await self._emit(scan_id, ScanStage.COMPLETED, result.summary)
                return result

            # ---- Stage 2.5: Face matching (optional) ----
            if request.reference_photo_labels:
                try:
                    from app.osint.face_recognition_service import FaceRecognitionService

                    if FaceRecognitionService.is_available():
                        await self._emit(
                            scan_id,
                            ScanStage.FACE_MATCHING,
                            {
                                "labels": request.reference_photo_labels,
                                "urls_count": len(successful),
                            },
                        )
                        result.stage = ScanStage.FACE_MATCHING

                        face_service = FaceRecognitionService()
                        crawled_urls = [cr.url for cr in successful]
                        face_results = await face_service.batch_match_urls(
                            crawled_urls,
                            max_concurrent=request.max_concurrent_crawls,
                        )
                        result.face_matches = face_results

                        total_face_matches = sum(
                            (r.get("result") or {}).get("total_matches", 0) for r in face_results
                        )
                        await self._emit(
                            scan_id,
                            ScanStage.FACE_MATCHING,
                            {
                                "urls_scanned": len(face_results),
                                "total_matches": total_face_matches,
                            },
                        )
                    else:
                        logger.warning(
                            f"Scan {scan_id}: face_recognition not installed — skipping face matching"
                        )
                except ImportError:
                    logger.warning(
                        f"Scan {scan_id}: face_recognition_service not available — skipping"
                    )

            # ---- Stage 2.6: WHOIS / Threat Intel / Email OSINT (parallel) ----
            osint_tasks = []
            request.target_domain or (result.profile_urls and len(result.profile_urls) > 0)
            domain_target = request.target_domain

            if request.enable_whois and domain_target:
                osint_tasks.append(
                    ("whois", self._run_whois_stage(scan_id, domain_target, request.target_ip))
                )
            if request.enable_threat_intel and (request.target_ip or domain_target):
                osint_tasks.append(
                    ("threat", self._run_threat_stage(scan_id, request.target_ip, domain_target))
                )
            if request.enable_email_osint and request.target_email:
                osint_tasks.append(("email", self._run_email_stage(scan_id, request.target_email)))

            if osint_tasks:
                labels = [t[0] for t in osint_tasks]
                coros = [t[1] for t in osint_tasks]
                await self._emit(scan_id, ScanStage.WHOIS_LOOKUP, {"services": labels})

                osint_results = await asyncio.gather(*coros, return_exceptions=True)

                for label, res in zip(labels, osint_results):
                    if isinstance(res, Exception):
                        logger.warning(f"Scan {scan_id}: {label} stage failed: {res}")
                        continue
                    if label == "whois":
                        result.whois_data = res  # type: ignore[assignment]
                    elif label == "threat":
                        result.threat_intel_data = res  # type: ignore[assignment]
                    elif label == "email":
                        result.email_osint_data = res  # type: ignore[assignment]

            # ---- Stage 3: Reviewing ----
            await self._emit(scan_id, ScanStage.REVIEWING, {"items": len(successful)})
            result.stage = ScanStage.REVIEWING

            review_items = [
                {
                    "crawl_id": cr.crawl_id,
                    "url": cr.url,
                    "markdown": cr.markdown or "",
                }
                for cr in successful
            ]
            batch_review = await self._review_pipeline.review_batch(
                review_items,
                query_context=request.query_context
                or f"OSINT scan for username: {request.username}",
            )
            result.review = batch_review

            await self._emit(
                scan_id,
                ScanStage.REVIEWING,
                {
                    "kept": batch_review.kept,
                    "deranked": batch_review.deranked,
                    "archived": batch_review.archived,
                    "average_relevance": batch_review.average_relevance,
                },
            )

            # ---- Stage 4: Store in ChromaDB ----
            await self._emit(scan_id, ScanStage.STORING, {"kept_count": batch_review.kept})
            result.stage = ScanStage.STORING

            kept_ids = {
                r.crawl_id for r in batch_review.results if r.decision == ReviewDecision.KEEP
            }
            kept_crawls = [cr for cr in successful if cr.crawl_id in kept_ids]
            stored_ids = await self._store_results(scan_id, kept_crawls)
            result.stored_document_ids = stored_ids

            await self._emit(scan_id, ScanStage.STORING, {"stored": len(stored_ids)})

            # ---- Stage 5: Build knowledge graph ----
            await self._emit(scan_id, ScanStage.BUILDING_GRAPH, {"input_count": len(kept_crawls)})
            result.stage = ScanStage.BUILDING_GRAPH

            graph_input = [{"url": cr.url, "markdown": cr.markdown or ""} for cr in kept_crawls]
            knowledge_graph = await self._semantic_tracker.build_graph(
                scan_id=scan_id,
                crawl_results=graph_input,
                context=request.query_context or f"OSINT scan for {request.username}",
            )
            result.knowledge_graph = knowledge_graph

            await self._emit(
                scan_id,
                ScanStage.BUILDING_GRAPH,
                {
                    "entities": len(knowledge_graph.entities),
                    "relationships": len(knowledge_graph.relationships),
                },
            )

            # ---- Done ----
            result.stage = ScanStage.COMPLETED
            result.completed_at = datetime.now(UTC).isoformat()
            result.summary = self._build_summary(result)
            await self._emit(scan_id, ScanStage.COMPLETED, result.summary)

        except Exception as exc:
            logger.error(f"Scan {scan_id} failed: {exc}", exc_info=True)
            result.stage = ScanStage.FAILED
            result.error = str(exc)
            result.completed_at = datetime.now(UTC).isoformat()
            await self._emit(scan_id, ScanStage.FAILED, {"error": str(exc)})

        return result

    # -- Internal helpers ---------------------------------------------------

    async def _crawl_urls(
        self,
        urls: list[str],
        max_concurrent: int = 5,
    ) -> list[CrawlResultItem]:
        """Crawl a list of URLs with concurrency control.

        Uses crawl4ai AsyncWebCrawler when available, falls back to a stub
        that marks each URL as failed (useful for testing without a browser).
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _crawl_one(url: str) -> CrawlResultItem:
            crawl_id = str(uuid.uuid4())
            async with semaphore:
                try:
                    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

                    browser_config = BrowserConfig(headless=True)
                    run_config = CrawlerRunConfig(
                        cache_mode=CacheMode.ENABLED,
                        word_count_threshold=50,
                        page_timeout=30000,
                    )

                    async with AsyncWebCrawler(config=browser_config) as crawler:
                        res = await crawler.arun(url, config=run_config)

                    markdown = res.markdown if res.success else None
                    word_count = len(markdown.split()) if markdown else 0

                    return CrawlResultItem(
                        crawl_id=crawl_id,
                        url=url,
                        success=res.success,
                        markdown=markdown,
                        error=res.error_message if not res.success else None,
                        word_count=word_count,
                    )
                except ImportError:
                    logger.warning("crawl4ai not available — returning stub result")
                    return CrawlResultItem(
                        crawl_id=crawl_id,
                        url=url,
                        success=False,
                        error="crawl4ai not available",
                    )
                except Exception as exc:
                    logger.error(f"Crawl failed for {url}: {exc}")
                    return CrawlResultItem(
                        crawl_id=crawl_id,
                        url=url,
                        success=False,
                        error=str(exc),
                    )

        tasks = [_crawl_one(u) for u in urls]
        return list(await asyncio.gather(*tasks))

    async def _store_results(
        self,
        scan_id: str,
        crawl_items: list[CrawlResultItem],
    ) -> list[str]:
        """Persist crawl results in a ChromaDB collection named ``osint_{scan_id}``."""
        if not crawl_items:
            return []

        collection_name = f"osint_{scan_id}"
        documents = [item.markdown or "" for item in crawl_items]
        metadatas = [
            {
                "url": item.url,
                "crawl_id": item.crawl_id,
                "scan_id": scan_id,
                "word_count": str(item.word_count),  # ChromaDB requires string values
            }
            for item in crawl_items
        ]
        ids = [item.crawl_id for item in crawl_items]

        try:
            stored = self.chromadb.add_documents(
                collection_name=collection_name,
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            logger.info(f"Stored {len(stored)} documents for scan {scan_id}")
            return stored
        except Exception as exc:
            logger.error(f"Failed to store results for scan {scan_id}: {exc}")
            return []

    async def _emit(
        self,
        scan_id: str,
        stage: ScanStage,
        data: dict[str, Any],
    ) -> None:
        """Emit a progress event via the registered callback."""
        logger.info(f"Scan {scan_id} [{stage.value}]: {data}")
        if self._on_progress:
            try:
                await self._on_progress(scan_id, stage, data)
            except Exception as exc:
                logger.warning(f"Progress callback failed: {exc}")

    async def _run_whois_stage(
        self, scan_id: str, domain: str, ip: str | None = None
    ) -> dict[str, Any]:
        """Run WHOIS/DNS lookups for the target domain and optional IP."""
        from app.osint.whois_dns_service import WhoisDnsService

        await self._emit(scan_id, ScanStage.WHOIS_LOOKUP, {"domain": domain})
        result: dict[str, Any] = {}
        svc = WhoisDnsService()
        try:
            tasks: dict[str, Any] = {
                "whois": svc.lookup_domain(domain),
                "dns": svc.lookup_dns(domain),
            }
            if ip:
                tasks["ip_geo"] = svc.lookup_ip(ip)

            outcomes = await asyncio.gather(*tasks.values(), return_exceptions=True)
            for key, outcome in zip(tasks.keys(), outcomes):
                if isinstance(outcome, Exception):
                    logger.warning(f"WHOIS stage {key} failed: {outcome}")
                    result[key] = {"error": str(outcome)}
                else:
                    result[key] = (
                        outcome.model_dump() if hasattr(outcome, "model_dump") else outcome
                    )
        finally:
            await svc.close()
        return result

    async def _run_threat_stage(
        self, scan_id: str, ip: str | None = None, domain: str | None = None
    ) -> dict[str, Any]:
        """Run threat intelligence checks."""
        from app.osint.threat_intel_service import ThreatIntelService

        await self._emit(scan_id, ScanStage.THREAT_INTEL, {"ip": ip, "domain": domain})
        result: dict[str, Any] = {}
        svc = ThreatIntelService()
        try:
            if ip:
                rep = await svc.check_ip_reputation(ip)
                result["ip_reputation"] = rep.model_dump() if hasattr(rep, "model_dump") else rep
            if domain:
                vt = await svc.check_virustotal(domain, "domain")
                result["domain_vt"] = vt.model_dump() if hasattr(vt, "model_dump") else vt
        finally:
            await svc.close()
        return result

    async def _run_email_stage(self, scan_id: str, email: str) -> dict[str, Any]:
        """Run email OSINT checks."""
        from app.osint.email_osint_service import EmailOsintService

        await self._emit(scan_id, ScanStage.EMAIL_OSINT, {"email": email})
        result: dict[str, Any] = {}
        svc = EmailOsintService()
        try:
            _email_results: list[Any] = list(
                await asyncio.gather(
                    svc.check_breach(email),
                    svc.verify_email(email),
                    svc.reverse_lookup(email),
                    return_exceptions=True,
                )
            )
            breach: Any = _email_results[0]
            verify: Any = _email_results[1]
            reverse: Any = _email_results[2]
            for key, outcome in [("breach", breach), ("verify", verify), ("reverse", reverse)]:
                if isinstance(outcome, Exception):
                    logger.warning(f"Email stage {key} failed: {outcome}")
                    result[key] = {"error": str(outcome)}
                else:
                    result[key] = (
                        outcome.model_dump() if hasattr(outcome, "model_dump") else outcome
                    )
        finally:
            await svc.close()
        return result

    @staticmethod
    def _build_summary(result: ScanResult) -> dict[str, Any]:
        total_crawls = len(result.crawl_results)
        successful_crawls = sum(1 for c in result.crawl_results if c.success)
        face_match_total = sum(
            (fm.get("result") or {}).get("total_matches", 0) for fm in result.face_matches
        )
        return {
            "scan_id": result.scan_id,
            "username": result.username,
            "platforms_scanned": len(result.profile_urls),
            "total_crawls": total_crawls,
            "successful_crawls": successful_crawls,
            "failed_crawls": total_crawls - successful_crawls,
            "face_matches": face_match_total,
            "kept": result.review.kept if result.review else 0,
            "deranked": result.review.deranked if result.review else 0,
            "archived": result.review.archived if result.review else 0,
            "average_relevance": result.review.average_relevance if result.review else 0.0,
            "documents_stored": len(result.stored_document_ids),
            "entities_found": len(result.knowledge_graph.entities) if result.knowledge_graph else 0,
            "relationships_found": len(result.knowledge_graph.relationships)
            if result.knowledge_graph
            else 0,
            "has_whois": result.whois_data is not None,
            "has_threat_intel": result.threat_intel_data is not None,
            "has_email_osint": result.email_osint_data is not None,
        }
