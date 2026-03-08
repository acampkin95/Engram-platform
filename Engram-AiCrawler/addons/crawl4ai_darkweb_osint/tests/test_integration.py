"""
Integration tests for Dark Web OSINT addon.

Tests the complete workflow:
1. Discovery flow (search engines, query refinement, deduplication)
2. Extraction flow (Tor proxy, content extraction)
3. Analysis flow (preset analysis, artifact extraction)
4. API endpoints
"""

import pytest

# Test imports
import sys
from pathlib import Path

# Add addon to path
addon_path = Path(__file__).parent.parent
sys.path.insert(0, str(addon_path))


class TestDiscovery:
    """Test discovery module."""

    @pytest.mark.asyncio
    async def test_search_engines_defined(self):
        """Test that all 16 search engines are defined."""
        from crawl4ai_darkweb_osint.discovery.search import SEARCH_ENGINES

        assert (
            len(SEARCH_ENGINES) == 16
        ), f"Expected 16 engines, got {len(SEARCH_ENGINES)}"

        # Verify critical engines exist
        engine_names = [e["name"] for e in SEARCH_ENGINES]
        assert "ahmia" in engine_names
        assert "onionland" in engine_names
        assert "torsearch" in engine_names

    @pytest.mark.asyncio
    async def test_query_refiner(self):
        """Test query refinement."""
        from crawl4ai_darkweb_osint.discovery.query_refine import QueryRefiner

        refiner = QueryRefiner(provider="mock")

        # Test refinement without LLM
        result = await refiner.refine("ransomware", use_llm=False)

        assert result["original_query"] == "ransomware"
        assert "refined_query" in result
        assert "alternatives" in result

    @pytest.mark.asyncio
    async def test_deduplication(self):
        """Test result deduplication."""
        from crawl4ai_darkweb_osint.discovery.dedup import deduplicate_results

        results = [
            {"url": "http://example.onion", "title": "Test 1"},
            {"url": "http://example.onion/", "title": "Test 1 (duplicate)"},
            {"url": "http://other.onion", "title": "Test 2"},
        ]

        deduped = deduplicate_results(results)

        assert len(deduped) == 2, f"Expected 2 unique results, got {len(deduped)}"


class TestExtraction:
    """Test extraction module."""

    def test_tor_config_defaults(self):
        """Test Tor configuration defaults."""
        from crawl4ai_darkweb_osint.extraction.tor_config import TorBrowserConfig

        config = TorBrowserConfig()

        assert config.host == "127.0.0.1"
        assert config.port == 9050

    def test_onion_url_validation(self):
        """Test .onion URL validation."""
        from crawl4ai_darkweb_osint.extraction.tor_config import is_onion_url

        # Valid onion URLs
        assert is_onion_url("http://example.onion")
        assert is_onion_url("https://example.onion")
        assert is_onion_url("http://abc123xyz.onion/path")

        # Invalid URLs
        assert not is_onion_url("http://example.com")
        assert not is_onion_url("http://example.onion.com")


class TestAnalysis:
    """Test analysis module."""

    def test_presets_defined(self):
        """Test that all analysis presets are defined."""
        from crawl4ai_darkweb_osint.analysis.presets import (
            PRESET_PROMPTS,
            AnalysisPreset,
        )

        expected_presets = [
            "threat_intel",
            "ransomware_malware",
            "personal_identity",
            "corporate_espionage",
        ]

        for preset in expected_presets:
            assert preset in PRESET_PROMPTS
            assert hasattr(AnalysisPreset, preset.upper())

    def test_artifact_types_defined(self):
        """Test artifact extraction types."""
        from crawl4ai_darkweb_osint.analysis.artifacts import ArtifactType

        # Check key artifact types
        assert hasattr(ArtifactType, "EMAIL")
        assert hasattr(ArtifactType, "CRYPTO_ADDRESS")
        assert hasattr(ArtifactType, "ONION_URL")
        assert hasattr(ArtifactType, "DOMAIN")

    def test_report_generation(self):
        """Test report generation."""
        from crawl4ai_darkweb_osint.analysis.report import generate_report

        analysis = "This is a test analysis."
        artifacts = [{"type": "email", "value": "test@example.com", "confidence": 0.9}]

        report = generate_report(
            analysis=analysis,
            artifacts=artifacts,
            preset="threat_intel",
        )

        assert "test@example.com" in report
        assert "threat_intel" in report.lower()


class TestConfig:
    """Test configuration module."""

    def test_config_defaults(self):
        """Test default configuration."""
        from crawl4ai_darkweb_osint.config import DarkWebConfig

        config = DarkWebConfig()

        assert config.tor.host == "127.0.0.1"
        assert config.tor.port == 9050
        assert config.llm.provider == "lmstudio"

    def test_env_template_generation(self):
        """Test .env template generation."""
        from crawl4ai_darkweb_osint.config import DarkWebConfig

        config = DarkWebConfig()
        template = config.to_env_template()

        assert "DARKWEB_TOR_PROXY_HOST" in template
        assert "DARKWEB_LLM_PROVIDER" in template


class TestAPI:
    """Test API endpoints."""

    @pytest.mark.asyncio
    async def test_discovery_endpoint_schema(self):
        """Test discovery endpoint request/response schema."""
        from crawl4ai_darkweb_osint.api.discovery import DiscoverRequest

        # Test valid request
        request = DiscoverRequest(
            query="test",
            engines=["ahmia"],
            refine_query=True,
            deduplicate=True,
        )

        assert request.query == "test"
        assert request.engines == ["ahmia"]
        assert request.refine_query is True

    @pytest.mark.asyncio
    async def test_extraction_endpoint_schema(self):
        """Test extraction endpoint request schema."""
        from crawl4ai_darkweb_osint.api.extraction import ExtractRequest

        request = ExtractRequest(
            url="http://example.onion",
            extract_markdown=True,
            extract_links=True,
        )

        assert request.url == "http://example.onion"

    @pytest.mark.asyncio
    async def test_analysis_endpoint_schema(self):
        """Test analysis endpoint request schema."""
        from crawl4ai_darkweb_osint.api.analysis import AnalyzeRequest

        request = AnalyzeRequest(
            content="Test content",
            preset="threat_intel",
            extract_artifacts=True,
            generate_report=True,
        )

        assert request.content == "Test content"
        assert request.preset == "threat_intel"


class TestLLMProviders:
    """Test LLM provider abstraction."""

    @pytest.mark.asyncio
    async def test_lmstudio_client_init(self):
        """Test LM Studio client initialization."""
        from crawl4ai_darkweb_osint.llm_providers import LMStudioClient

        client = LMStudioClient(
            base_url="http://localhost:1234/v1",
            model="glm-5",
        )

        assert client.base_url == "http://localhost:1234/v1"
        assert client.model == "glm-5"

    def test_provider_config_validation(self):
        """Test provider configuration."""
        from crawl4ai_darkweb_osint.config import LLMProviderConfig

        config = LLMProviderConfig(
            provider="lmstudio",
            model="glm-5",
            base_url="http://localhost:1234/v1",
        )

        assert config.provider == "lmstudio"
        assert config.model == "glm-5"


class TestTorProxy:
    """Test Tor proxy module."""

    @pytest.mark.asyncio
    async def test_check_tor_connection_mock(self):
        """Test Tor connection check with mock."""
        from crawl4ai_darkweb_osint.tor_proxy import check_tor_connection

        # This will fail if Tor isn't running, but shouldn't crash
        result = await check_tor_connection("127.0.0.1", 9050)

        assert "connected" in result
        assert "error" in result

    def test_tor_session_init(self):
        """Test TorSession initialization."""
        from crawl4ai_darkweb_osint.tor_proxy import TorSession

        session = TorSession(
            host="127.0.0.1",
            port=9050,
        )

        assert session.host == "127.0.0.1"
        assert session.port == 9050


class TestSetupWizard:
    """Test setup wizard."""

    def test_wizard_state_defaults(self):
        """Test wizard default state."""
        from crawl4ai_darkweb_osint.setup_wizard import WizardState

        state = WizardState()

        assert state.tor_host == "127.0.0.1"
        assert state.tor_port == 9050
        assert state.llm_provider == "lmstudio"

    def test_wizard_providers_defined(self):
        """Test wizard LLM providers."""
        from crawl4ai_darkweb_osint.setup_wizard import SetupWizard

        assert "lmstudio" in SetupWizard.LLM_PROVIDERS
        assert "ollama" in SetupWizard.LLM_PROVIDERS
        assert "openai" in SetupWizard.LLM_PROVIDERS


class TestAddonIntegration:
    """End-to-end integration tests."""

    def test_manifest_valid(self):
        """Test addon manifest is valid."""
        import json

        manifest_path = addon_path / "manifest.json"
        assert manifest_path.exists(), "manifest.json not found"

        with open(manifest_path) as f:
            manifest = json.load(f)

        assert "name" in manifest
        assert "version" in manifest
        assert "dependencies" in manifest

    def test_addon_imports(self):
        """Test addon can be imported."""
        try:
            from crawl4ai_darkweb_osint import __version__

            assert __version__ is not None
        except ImportError as e:
            pytest.fail(f"Failed to import addon: {e}")

    def test_config_imports(self):
        """Test config module imports."""
        try:
            from crawl4ai_darkweb_osint.config import DarkWebConfig

            assert DarkWebConfig is not None
        except ImportError as e:
            pytest.fail(f"Failed to import config: {e}")

    def test_api_routers_import(self):
        """Test API routers exist."""
        try:
            from crawl4ai_darkweb_osint.api import discovery, extraction, analysis

            assert discovery is not None
            assert extraction is not None
            assert analysis is not None
        except ImportError as e:
            pytest.fail(f"Failed to import API modules: {e}")


# Pytest configuration
def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line("markers", "asyncio: mark test as async")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
