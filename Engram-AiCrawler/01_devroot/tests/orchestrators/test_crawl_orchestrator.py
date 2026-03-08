import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.orchestrators.crawl_orchestrator import CrawlOrchestrator


class TestCrawlOrchestrator:
    @pytest.mark.asyncio
    async def test_generates_crawl_plan_from_query(self):
        orchestrator = CrawlOrchestrator()

        with patch.object(orchestrator.lm_bridge, "generate_crawl_strategy") as mock_strategy:
            mock_strategy.return_value = {
                "urls": ["https://example.com"],
                "extraction_type": "llm",
                "llm_instruction": "Extract products",
            }

            plan = await orchestrator.create_crawl_plan("Find product information")
            assert plan["extraction_type"] == "llm"
            assert plan["llm_instruction"] == "Extract products"

    @pytest.mark.asyncio
    async def test_executes_parallel_crawls_from_plan(self):
        orchestrator = CrawlOrchestrator()

        plan = {
            "urls": ["https://example.com/1", "https://example.com/2"],
            "extraction_type": "css",
            "wait_for": ".content",
        }

        with patch("app.orchestrators.crawl_orchestrator.AsyncWebCrawler") as mock_crawler:
            mock_result = MagicMock()
            mock_result.success = True
            mock_result.markdown = "Test content"
            mock_result.links = {"internal": []}

            mock_instance = AsyncMock()
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_instance.arun = AsyncMock(return_value=mock_result)

            mock_crawler.return_value = mock_instance

            results = await orchestrator.execute_plan(plan)

            assert len(results) == 2
            for r in results:
                assert r["success"]

    @pytest.mark.asyncio
    async def test_correlates_results_after_crawling(self):
        orchestrator = CrawlOrchestrator()

        results = [
            {"url": "https://example.com/1", "content": "Item A"},
            {"url": "https://example.com/2", "content": "Item B"},
        ]

        with patch.object(orchestrator.lm_bridge, "correlate_results") as mock_correlate:
            mock_correlate.return_value = {"correlated": [{"items": ["A", "B"], "score": 0.9}]}

            correlated = await orchestrator.correlate(results)
            assert "correlated" in correlated
            assert correlated["correlated"][0]["score"] == 0.9

    @pytest.mark.asyncio
    async def test_handles_crawl_failures_gracefully(self):
        orchestrator = CrawlOrchestrator()

        plan = {"urls": ["https://example.com/1"], "extraction_type": "llm"}

        with patch("app.orchestrators.crawl_orchestrator.AsyncWebCrawler") as mock_crawler:
            mock_result = MagicMock()
            mock_result.success = False
            mock_result.error_message = "Connection timeout"

            mock_instance = AsyncMock()
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_instance.arun = AsyncMock(return_value=mock_result)

            mock_crawler.return_value = mock_instance

            results = await orchestrator.execute_plan(plan)
            assert not results[0]["success"]
            assert "error" in results[0]

    @pytest.mark.asyncio
    async def test_respects_concurrency_limits(self):
        orchestrator = CrawlOrchestrator(max_concurrent=2)

        plan = {
            "urls": [
                "https://example.com/1",
                "https://example.com/2",
                "https://example.com/3",
            ],
            "extraction_type": "llm",
        }

        with patch("app.orchestrators.crawl_orchestrator.AsyncWebCrawler") as mock_crawler:
            mock_result = MagicMock()
            mock_result.success = True
            mock_result.markdown = "Content"

            mock_instance = AsyncMock()
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_instance.arun = AsyncMock(return_value=mock_result)

            mock_crawler.return_value = mock_instance

            results = await orchestrator.execute_plan(plan)
            assert len(results) == 3

    @pytest.mark.asyncio
    async def test_validates_plan_before_execution(self):
        orchestrator = CrawlOrchestrator()

        invalid_plan = {"urls": [], "extraction_type": "llm"}

        with pytest.raises(ValueError, match="Plan must contain at least one URL"):
            await orchestrator.execute_plan(invalid_plan)

    @pytest.mark.asyncio
    async def test_provides_progress_updates(self):
        orchestrator = CrawlOrchestrator()

        progress_updates = []

        async def mock_progress(status, data):
            progress_updates.append({"status": status, "data": data})

        with patch.object(orchestrator, "_send_progress", side_effect=mock_progress):
            with patch.object(orchestrator.lm_bridge, "generate_crawl_strategy") as mock_strategy:
                mock_strategy.return_value = {
                    "urls": ["https://example.com/1"],
                    "extraction_type": "llm",
                }
                with patch.object(orchestrator.lm_bridge, "correlate_results") as mock_corr:
                    mock_corr.return_value = {"correlated": []}
                    with patch(
                        "app.orchestrators.crawl_orchestrator.AsyncWebCrawler"
                    ) as mock_crawler:
                        mock_result = MagicMock()
                        mock_result.success = True
                        mock_result.markdown = "Content"
                        mock_result.links = {"internal": []}
                        mock_result.metadata = {}

                        mock_instance = AsyncMock()
                        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
                        mock_instance.__aexit__ = AsyncMock(return_value=None)
                        mock_instance.arun = AsyncMock(return_value=mock_result)
                        mock_crawler.return_value = mock_instance

                        await orchestrator.orchestrate_crawl("Find info")
                        assert len(progress_updates) > 0
