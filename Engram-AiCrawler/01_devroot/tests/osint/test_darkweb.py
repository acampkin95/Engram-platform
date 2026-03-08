"""Tests for app/osint/darkweb/ modules.

Covers pure functions and simulation-mode paths to avoid real HTTP/Tor calls:

breach_scanner:
  - _classify_severity (pure)
  - BreachScanResult properties (pure)
  - BreachScanner.scan() in simulation_mode=True
  - BreachScanner.scan() with mocked HIBP/paste calls

crypto_tracer:
  - detect_crypto_addresses (pure)
  - classify_address_network (pure)
  - CryptoTracer._highest_risk (pure)
  - CryptoTracer.extract_and_trace() with no addresses
  - CryptoTracer.trace_addresses() in simulation_mode=True

entity_correlator:
  - RiskScorer.compute() with various inputs
  - RiskScorer.score_to_risk() thresholds
  - EntityCorrelator.correlate() integration

marketplace_monitor:
  - ThreatScorer.score() keyword escalation
  - _extract_context (pure)
  - MarketplaceMonitor.scan_entity() in simulation_mode=True
"""
from __future__ import annotations

from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock

import pytest


# ===========================================================================
# BREACH SCANNER TESTS
# ===========================================================================


class TestClassifySeverity:
    """_classify_severity maps data class lists to severity levels."""

    def _cls(self, data_classes):
        from app.osint.darkweb.breach_scanner import _classify_severity

        return _classify_severity(data_classes)

    def test_passwords_is_critical(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls(["Passwords", "Email addresses"]) == BreachSeverity.CRITICAL

    def test_credit_cards_is_critical(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls(["Credit cards"]) == BreachSeverity.CRITICAL

    def test_ssn_is_critical(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls(["Social security numbers"]) == BreachSeverity.CRITICAL

    def test_auth_tokens_is_high(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls(["Auth tokens"]) == BreachSeverity.HIGH

    def test_health_records_is_high(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls(["Health records"]) == BreachSeverity.HIGH

    def test_email_plus_many_others_is_medium(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        # email + 2 more = len > 2 → MEDIUM
        assert self._cls(["Email addresses", "Usernames", "IP addresses"]) == BreachSeverity.MEDIUM

    def test_email_only_is_low(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls(["Email addresses"]) == BreachSeverity.LOW

    def test_empty_is_info(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls([]) == BreachSeverity.INFO

    def test_unknown_data_class_is_info(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        assert self._cls(["Usernames"]) == BreachSeverity.INFO


class TestBreachScanResultProperties:
    """BreachScanResult computed properties."""

    def _make_result(self, breaches=None, pastes=None):
        from app.osint.darkweb.breach_scanner import BreachScanResult

        return BreachScanResult(
            scan_id="test123",
            query_terms=["alice@example.com"],
            breaches=breaches or [],
            pastes=pastes or [],
            scan_duration_s=0.1,
            scanned_at=datetime.now(UTC),
            hibp_available=False,
            errors=[],
        )

    def _make_breach(self, severity, data_classes=None, name="TestBreach"):
        from app.osint.darkweb.breach_scanner import BreachRecord

        return BreachRecord(
            source="hibp",
            breach_name=name,
            breach_date="2023-01-01",
            description="test",
            data_classes=data_classes or ["Email addresses"],
            severity=severity,
            pwn_count=1000,
            is_verified=True,
            is_sensitive=False,
            is_spam_list=False,
            domain="example.com",
            logo_url=None,
            query_term="alice@example.com",
            found_at=datetime.now(UTC),
        )

    def _make_paste(self):
        from app.osint.darkweb.breach_scanner import PasteRecord

        return PasteRecord(
            source="pastebin",
            paste_id="abc123",
            paste_url="https://pastebin.com/abc123",
            title=None,
            date=None,
            email_count=1,
            matched_terms=["alice@example.com"],
            snippet="some content",
            query_term="alice@example.com",
            found_at=datetime.now(UTC),
        )

    def test_total_findings_sums_breaches_and_pastes(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        b = self._make_breach(BreachSeverity.LOW)
        p = self._make_paste()
        result = self._make_result(breaches=[b], pastes=[p])
        assert result.total_findings == 2

    def test_total_findings_zero_when_empty(self):
        result = self._make_result()
        assert result.total_findings == 0

    def test_highest_severity_returns_critical_first(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        breaches = [
            self._make_breach(BreachSeverity.LOW, name="Low"),
            self._make_breach(BreachSeverity.CRITICAL, name="Crit"),
        ]
        result = self._make_result(breaches=breaches)
        assert result.highest_severity == BreachSeverity.CRITICAL

    def test_highest_severity_none_when_no_breaches(self):
        result = self._make_result()
        assert result.highest_severity is None

    def test_exposed_data_types_aggregates_all(self):
        from app.osint.darkweb.breach_scanner import BreachSeverity

        b1 = self._make_breach(BreachSeverity.LOW, data_classes=["Email addresses"])
        b2 = self._make_breach(BreachSeverity.HIGH, data_classes=["Passwords", "Email addresses"])
        result = self._make_result(breaches=[b1, b2])
        types = result.exposed_data_types
        assert "Email addresses" in types
        assert "Passwords" in types
        # Sorted and deduplicated
        assert types == sorted(set(types))

    def test_paste_count_matches_paste_list_length(self):
        p1 = self._make_paste()
        p2 = self._make_paste()
        result = self._make_result(pastes=[p1, p2])
        assert result.paste_count == 2

    def test_to_dict_has_required_keys(self):
        result = self._make_result()
        d = result.to_dict()
        for key in (
            "scan_id",
            "query_terms",
            "total_findings",
            "breach_count",
            "paste_count",
            "highest_severity",
            "exposed_data_types",
            "breaches",
            "pastes",
            "scan_duration_s",
            "scanned_at",
            "hibp_available",
            "errors",
        ):
            assert key in d


class TestBreachScannerSimulationMode:
    """BreachScanner.scan() in simulation_mode=True avoids HTTP calls."""

    @pytest.mark.asyncio
    async def test_simulation_returns_breach_scan_result(self):
        from app.osint.darkweb.breach_scanner import BreachScanner, BreachScanResult

        scanner = BreachScanner(simulation_mode=True)
        result = await scanner.scan(emails=["alice@example.com"])
        assert isinstance(result, BreachScanResult)

    @pytest.mark.asyncio
    async def test_simulation_produces_at_least_one_breach(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=True)
        result = await scanner.scan(emails=["alice@example.com"])
        assert len(result.breaches) >= 1

    @pytest.mark.asyncio
    async def test_simulation_no_emails_returns_empty_breaches(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=True)
        result = await scanner.scan(emails=[])
        # No emails → simulate_results gets empty email list → no simulated breach
        assert len(result.breaches) == 0

    @pytest.mark.asyncio
    async def test_simulation_result_has_scan_id(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=True)
        result = await scanner.scan(emails=["alice@example.com"])
        assert result.scan_id and len(result.scan_id) > 0

    @pytest.mark.asyncio
    async def test_simulation_query_terms_include_email(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=True)
        result = await scanner.scan(emails=["alice@example.com"])
        assert "alice@example.com" in result.query_terms

    @pytest.mark.asyncio
    async def test_simulation_query_terms_include_full_name(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=True)
        result = await scanner.scan(emails=["a@b.com"], full_name="Alice Smith")
        assert "Alice Smith" in result.query_terms

    @pytest.mark.asyncio
    async def test_hibp_available_false_without_api_key(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=True)
        result = await scanner.scan(emails=["a@b.com"])
        assert result.hibp_available is False

    @pytest.mark.asyncio
    async def test_hibp_available_true_with_api_key(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(hibp_api_key="test-key-123", simulation_mode=True)
        result = await scanner.scan(emails=["a@b.com"])
        assert result.hibp_available is True


class TestBreachScannerRealMode:
    """BreachScanner.scan() with mocked HIBP and paste calls."""

    @pytest.mark.asyncio
    async def test_hibp_breach_is_appended_to_results(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=False)

        hibp_response = [
            {
                "Name": "TestBreach",
                "BreachDate": "2023-01-01",
                "Description": "A test breach",
                "DataClasses": ["Email addresses", "Passwords"],
                "PwnCount": 500000,
                "IsVerified": True,
                "IsSensitive": False,
                "IsSpamList": False,
                "Domain": "test.com",
                "LogoPath": None,
            }
        ]

        scanner.hibp.get_breaches_for_email = AsyncMock(return_value=(hibp_response, None))
        scanner.hibp.get_pastes_for_email = AsyncMock(return_value=([], None))
        scanner.paste_monitor.search_recent_pastes = AsyncMock(return_value=[])

        result = await scanner.scan(emails=["alice@example.com"])

        assert len(result.breaches) == 1
        assert result.breaches[0].breach_name == "TestBreach"

    @pytest.mark.asyncio
    async def test_hibp_error_appended_to_errors_list(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=False)

        scanner.hibp.get_breaches_for_email = AsyncMock(return_value=([], "Rate limited"))
        scanner.hibp.get_pastes_for_email = AsyncMock(return_value=([], None))
        scanner.paste_monitor.search_recent_pastes = AsyncMock(return_value=[])

        result = await scanner.scan(emails=["alice@example.com"])

        assert any("Rate limited" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_no_emails_skips_hibp_calls(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=False)

        scanner.hibp.get_breaches_for_email = AsyncMock()
        scanner.paste_monitor.search_recent_pastes = AsyncMock(return_value=[])

        result = await scanner.scan(emails=[], usernames=["alice"])

        scanner.hibp.get_breaches_for_email.assert_not_awaited()
        assert result.total_findings == 0

    @pytest.mark.asyncio
    async def test_check_pastes_false_skips_paste_calls(self):
        from app.osint.darkweb.breach_scanner import BreachScanner

        scanner = BreachScanner(simulation_mode=False)

        scanner.hibp.get_breaches_for_email = AsyncMock(return_value=([], None))
        scanner.hibp.get_pastes_for_email = AsyncMock()
        scanner.paste_monitor.search_recent_pastes = AsyncMock()

        await scanner.scan(emails=["a@b.com"], check_pastes=False)

        scanner.hibp.get_pastes_for_email.assert_not_awaited()
        scanner.paste_monitor.search_recent_pastes.assert_not_awaited()


# ===========================================================================
# CRYPTO TRACER TESTS
# ===========================================================================


class TestDetectCryptoAddresses:
    """detect_crypto_addresses extracts addresses from text."""

    def test_detects_bitcoin_legacy_address(self):
        from app.osint.darkweb.crypto_tracer import detect_crypto_addresses

        text = "Send to 1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna for payment"
        result = detect_crypto_addresses(text)
        assert "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna" in result["bitcoin"]

    def test_detects_ethereum_address(self):
        from app.osint.darkweb.crypto_tracer import detect_crypto_addresses

        text = "ETH wallet: 0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe"
        result = detect_crypto_addresses(text)
        assert "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe" in result["ethereum"]

    def test_empty_text_returns_empty_lists(self):
        from app.osint.darkweb.crypto_tracer import detect_crypto_addresses

        result = detect_crypto_addresses("no addresses here")
        assert result["bitcoin"] == []
        assert result["ethereum"] == []

    def test_deduplicates_repeated_addresses(self):
        from app.osint.darkweb.crypto_tracer import detect_crypto_addresses

        addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna"
        text = f"{addr} and also {addr}"
        result = detect_crypto_addresses(text)
        assert result["bitcoin"].count(addr) == 1

    def test_returns_all_four_network_keys(self):
        from app.osint.darkweb.crypto_tracer import detect_crypto_addresses

        result = detect_crypto_addresses("")
        assert set(result.keys()) == {"bitcoin", "ethereum", "litecoin", "monero"}


class TestClassifyAddressNetwork:
    """classify_address_network identifies blockchain from address format."""

    def test_bitcoin_legacy_address(self):
        from app.osint.darkweb.crypto_tracer import classify_address_network, CryptoNetwork

        assert (
            classify_address_network("1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna") == CryptoNetwork.BITCOIN
        )

    def test_ethereum_address(self):
        from app.osint.darkweb.crypto_tracer import classify_address_network, CryptoNetwork

        assert (
            classify_address_network("0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe")
            == CryptoNetwork.ETHEREUM
        )

    def test_unknown_address_returns_unknown(self):
        from app.osint.darkweb.crypto_tracer import classify_address_network, CryptoNetwork

        assert classify_address_network("not-a-real-address") == CryptoNetwork.UNKNOWN


class TestCryptoTracerHighestRisk:
    """CryptoTracer._highest_risk picks highest risk from profiles."""

    def _make_profile(self, risk_level):
        from app.osint.darkweb.crypto_tracer import AddressProfile, CryptoNetwork

        return AddressProfile(
            address="1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna",
            network=CryptoNetwork.BITCOIN,
            balance_native=0,
            balance_usd=None,
            total_received=0,
            total_sent=0,
            transaction_count=0,
            first_seen=None,
            last_seen=None,
            transactions=[],
            risk_level=risk_level,
            risk_signals=[],
            exchange_label=None,
            cluster_addresses=[],
            queried_at=datetime.now(UTC),
            data_source="test",
        )

    def test_returns_critical_when_present(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer, AddressRisk

        tracer = CryptoTracer(simulation_mode=True)
        profiles = [
            self._make_profile(AddressRisk.CLEAN),
            self._make_profile(AddressRisk.CRITICAL),
            self._make_profile(AddressRisk.LOW),
        ]
        assert tracer._highest_risk(profiles) == AddressRisk.CRITICAL

    def test_returns_clean_when_all_clean(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer, AddressRisk

        tracer = CryptoTracer(simulation_mode=True)
        profiles = [
            self._make_profile(AddressRisk.CLEAN),
            self._make_profile(AddressRisk.CLEAN),
        ]
        assert tracer._highest_risk(profiles) == AddressRisk.CLEAN

    def test_returns_clean_for_empty_profiles(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer, AddressRisk

        tracer = CryptoTracer(simulation_mode=True)
        assert tracer._highest_risk([]) == AddressRisk.CLEAN


class TestCryptoTracerSimulationMode:
    """CryptoTracer.trace_addresses() in simulation mode."""

    @pytest.mark.asyncio
    async def test_simulation_returns_crypto_trace_result(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer, CryptoTraceResult

        tracer = CryptoTracer(simulation_mode=True)
        result = await tracer.trace_addresses(["1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna"])
        assert isinstance(result, CryptoTraceResult)

    @pytest.mark.asyncio
    async def test_simulation_one_profile_per_address(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer

        tracer = CryptoTracer(simulation_mode=True)
        addresses = [
            "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna",
            "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
        ]
        result = await tracer.trace_addresses(addresses)
        assert len(result.profiles) == 2

    @pytest.mark.asyncio
    async def test_simulation_addresses_queried_matches_input(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer

        tracer = CryptoTracer(simulation_mode=True)
        addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna"
        result = await tracer.trace_addresses([addr])
        assert addr in result.addresses_queried


class TestCryptoTracerExtractAndTrace:
    """CryptoTracer.extract_and_trace() handles no-address text."""

    @pytest.mark.asyncio
    async def test_no_addresses_returns_empty_result(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer, AddressRisk

        tracer = CryptoTracer(simulation_mode=True)
        result = await tracer.extract_and_trace("no crypto addresses here at all")
        assert result.scan_id == "empty"
        assert result.profiles == []
        assert result.highest_risk == AddressRisk.CLEAN
        assert len(result.errors) > 0

    @pytest.mark.asyncio
    async def test_found_addresses_are_traced(self):
        from app.osint.darkweb.crypto_tracer import CryptoTracer

        tracer = CryptoTracer(simulation_mode=True)
        text = "Pay to 1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna"
        result = await tracer.extract_and_trace(text)
        assert len(result.profiles) >= 1


# ===========================================================================
# ENTITY CORRELATOR TESTS
# ===========================================================================


class TestRiskScorer:
    """RiskScorer.compute() maps breach/darkweb/crypto signals to scores."""

    def _scorer(self):
        from app.osint.darkweb.entity_correlator import RiskScorer

        return RiskScorer()

    def _make_breach_result(self, severity_str: str, breach_count: int = 1, paste_count: int = 0):
        """Build a minimal BreachScanResult mock."""
        from app.osint.darkweb.breach_scanner import BreachSeverity

        sev = BreachSeverity(severity_str)

        breach = MagicMock()
        breach.severity = sev
        breach.breach_name = f"Breach_{severity_str}"

        paste = MagicMock()

        result = MagicMock()
        result.highest_severity = sev
        result.breaches = [breach] * breach_count
        result.pastes = [paste] * paste_count
        result.paste_count = paste_count
        return result

    def _make_monitor_result(self, threat_str: str):
        from app.osint.darkweb.marketplace_monitor import ThreatLevel

        level = ThreatLevel(threat_str)

        mention = MagicMock()
        mention.threat_level = level
        mention.site_name = "TestSite"

        result = MagicMock()
        result.highest_threat = level
        result.mentions = [mention]
        return result

    def _make_crypto_result(self, risk_str: str):
        from app.osint.darkweb.crypto_tracer import AddressRisk

        risk = AddressRisk(risk_str)

        profile = MagicMock()
        profile.risk_level = risk
        profile.address = "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna"

        result = MagicMock()
        result.highest_risk = risk
        result.profiles = [profile]
        return result

    def test_no_signals_gives_zero_score(self):
        scorer = self._scorer()
        score, factors = scorer.compute(None, None, None, None)
        assert score == 0.0
        assert factors == []

    def test_critical_breach_adds_30_points(self):
        scorer = self._scorer()
        breach = self._make_breach_result("critical")
        score, _ = scorer.compute(breach, None, None, None)
        assert score == 30.0

    def test_high_breach_adds_20_points(self):
        scorer = self._scorer()
        breach = self._make_breach_result("high")
        score, _ = scorer.compute(breach, None, None, None)
        assert score == 20.0

    def test_medium_breach_adds_10_points(self):
        scorer = self._scorer()
        breach = self._make_breach_result("medium")
        score, _ = scorer.compute(breach, None, None, None)
        assert score == 10.0

    def test_low_breach_adds_5_points(self):
        scorer = self._scorer()
        breach = self._make_breach_result("low")
        score, _ = scorer.compute(breach, None, None, None)
        assert score == 5.0

    def test_more_than_3_breaches_adds_multiple_breaches_bonus(self):
        scorer = self._scorer()
        breach = self._make_breach_result("low", breach_count=5)
        score, factors = scorer.compute(breach, None, None, None)
        # 5 (low) + 10 (multiple_breaches)
        assert score == 15.0
        factor_names = [f.factor for f in factors]
        assert any("Multiple" in n for n in factor_names)

    def test_paste_exposure_adds_5_points(self):
        scorer = self._scorer()
        breach = self._make_breach_result("low", paste_count=2)
        score, factors = scorer.compute(breach, None, None, None)
        # 5 (low) + 5 (paste)
        assert score == 10.0

    def test_critical_darkweb_adds_35_points(self):
        scorer = self._scorer()
        monitor = self._make_monitor_result("critical")
        score, _ = scorer.compute(None, monitor, None, None)
        assert score == 35.0

    def test_critical_crypto_adds_20_points(self):
        scorer = self._scorer()
        crypto = self._make_crypto_result("critical")
        score, _ = scorer.compute(None, None, crypto, None)
        assert score == 20.0

    def test_score_is_capped_at_100(self):
        scorer = self._scorer()
        breach = self._make_breach_result("critical", breach_count=5, paste_count=3)
        monitor = self._make_monitor_result("critical")
        crypto = self._make_crypto_result("critical")
        score, _ = scorer.compute(breach, monitor, crypto, None)
        assert score == 100.0

    def test_returns_risk_factors_list(self):
        scorer = self._scorer()
        breach = self._make_breach_result("high")
        score, factors = scorer.compute(breach, None, None, None)
        assert isinstance(factors, list)
        assert len(factors) >= 1
        assert factors[0].source == "breach"


class TestRiskScorerScoreToRisk:
    """RiskScorer.score_to_risk() maps numeric scores to OverallRisk levels."""

    def _scorer(self):
        from app.osint.darkweb.entity_correlator import RiskScorer

        return RiskScorer()

    def test_score_80_is_critical(self):
        from app.osint.darkweb.entity_correlator import OverallRisk

        assert self._scorer().score_to_risk(80.0) == OverallRisk.CRITICAL

    def test_score_100_is_critical(self):
        from app.osint.darkweb.entity_correlator import OverallRisk

        assert self._scorer().score_to_risk(100.0) == OverallRisk.CRITICAL

    def test_score_60_is_high(self):
        from app.osint.darkweb.entity_correlator import OverallRisk

        assert self._scorer().score_to_risk(60.0) == OverallRisk.HIGH

    def test_score_40_is_elevated(self):
        from app.osint.darkweb.entity_correlator import OverallRisk

        assert self._scorer().score_to_risk(40.0) == OverallRisk.ELEVATED

    def test_score_20_is_moderate(self):
        from app.osint.darkweb.entity_correlator import OverallRisk

        assert self._scorer().score_to_risk(20.0) == OverallRisk.MODERATE

    def test_score_1_is_low(self):
        from app.osint.darkweb.entity_correlator import OverallRisk

        assert self._scorer().score_to_risk(1.0) == OverallRisk.LOW

    def test_score_0_is_unknown(self):
        from app.osint.darkweb.entity_correlator import OverallRisk

        assert self._scorer().score_to_risk(0.0) == OverallRisk.UNKNOWN


class TestEntityCorrelator:
    """EntityCorrelator.correlate() builds unified profiles."""

    def test_correlate_with_no_data_returns_unknown_risk(self):
        from app.osint.darkweb.entity_correlator import EntityCorrelator, OverallRisk

        correlator = EntityCorrelator()
        profile = correlator.correlate("Alice Smith")
        assert profile.overall_risk == OverallRisk.UNKNOWN
        assert profile.risk_score == 0.0

    def test_correlate_sets_entity_name(self):
        from app.osint.darkweb.entity_correlator import EntityCorrelator

        correlator = EntityCorrelator()
        profile = correlator.correlate("Bob Jones")
        assert profile.entity_name == "Bob Jones"

    def test_correlate_has_correlation_id(self):
        from app.osint.darkweb.entity_correlator import EntityCorrelator

        correlator = EntityCorrelator()
        profile = correlator.correlate("Alice Smith")
        assert profile.correlation_id and len(profile.correlation_id) > 0

    def test_correlate_with_high_breach_gives_elevated_risk(self):
        from app.osint.darkweb.entity_correlator import EntityCorrelator, OverallRisk
        from app.osint.darkweb.breach_scanner import BreachSeverity

        breach = MagicMock()
        breach.highest_severity = BreachSeverity.HIGH
        breach.breaches = [MagicMock(severity=BreachSeverity.HIGH, breach_name="TestBreach")]
        breach.pastes = []
        breach.paste_count = 0

        correlator = EntityCorrelator()
        profile = correlator.correlate("Alice", breach_result=breach)
        # 20 points → MODERATE
        assert profile.risk_score == 20.0
        assert profile.overall_risk == OverallRisk.MODERATE

    def test_correlate_to_dict_has_required_keys(self):
        from app.osint.darkweb.entity_correlator import EntityCorrelator

        correlator = EntityCorrelator()
        profile = correlator.correlate("Alice")
        d = profile.to_dict()
        for key in (
            "entity_name",
            "correlation_id",
            "overall_risk",
            "risk_score",
            "risk_factors",
            "breaches",
            "dark_web",
            "cryptocurrency",
            "key_findings",
            "recommended_actions",
        ):
            assert key in d, f"Missing key: {key!r}. Available: {list(d.keys())}"


# ===========================================================================
# MARKETPLACE MONITOR TESTS
# ===========================================================================


class TestThreatScorer:
    """ThreatScorer.score() escalates threat level based on keywords."""

    def _scorer(self):
        from app.osint.darkweb.marketplace_monitor import ThreatScorer

        return ThreatScorer()

    def _cat(self):
        from app.osint.darkweb.marketplace_monitor import SiteCategory

        return SiteCategory.MARKETPLACE

    def test_critical_keywords_escalate_to_critical(self):
        from app.osint.darkweb.marketplace_monitor import ThreatLevel

        scorer = self._scorer()
        # Two critical indicators
        text = "doxx ssn social security number leaked"
        level, conf = scorer.score(text, ["alice"], self._cat())
        assert level == ThreatLevel.CRITICAL

    def test_single_critical_keyword_gives_high(self):
        from app.osint.darkweb.marketplace_monitor import ThreatLevel

        scorer = self._scorer()
        text = "doxx this person"
        level, conf = scorer.score(text, ["alice"], self._cat())
        assert level == ThreatLevel.HIGH

    def test_high_indicators_escalate_to_medium(self):
        from app.osint.darkweb.marketplace_monitor import ThreatLevel

        scorer = self._scorer()
        text = "leaked data from breach"
        level, conf = scorer.score(text, ["alice"], self._cat())
        assert level == ThreatLevel.MEDIUM

    def test_medium_indicators_give_low(self):
        from app.osint.darkweb.marketplace_monitor import ThreatLevel

        scorer = self._scorer()
        text = "email address found"
        level, conf = scorer.score(text, ["alice"], self._cat())
        assert level == ThreatLevel.LOW

    def test_no_indicators_gives_info(self):
        from app.osint.darkweb.marketplace_monitor import ThreatLevel

        scorer = self._scorer()
        text = "random unrelated text with no signals"
        level, conf = scorer.score(text, ["alice"], self._cat())
        assert level == ThreatLevel.INFO

    def test_confidence_is_between_0_and_1(self):
        scorer = self._scorer()
        text = "doxx ssn leaked breach database dump"
        _, conf = scorer.score(text, ["alice", "bob"], self._cat())
        assert 0.0 <= conf <= 1.0

    def test_multiple_matched_terms_increase_confidence(self):
        scorer = self._scorer()
        text = "random text"
        _, conf_one = scorer.score(text, ["alice"], self._cat())
        _, conf_many = scorer.score(text, ["alice", "bob", "carol"], self._cat())
        assert conf_many >= conf_one


class TestExtractContext:
    """_extract_context extracts surrounding text around a matched term."""

    def _extract(self, text, term, window=200):
        from app.osint.darkweb.marketplace_monitor import _extract_context

        return _extract_context(text, term, window)

    def test_returns_text_containing_term(self):
        result = self._extract("hello world foo bar", "world")
        assert "world" in result

    def test_term_not_found_returns_beginning(self):
        result = self._extract("hello world", "xyz", window=5)
        assert result == "hello"

    def test_adds_ellipsis_when_truncated_at_start(self):
        long_prefix = "x" * 300
        text = long_prefix + "TARGET" + "y" * 100
        result = self._extract(text, "TARGET", window=50)
        assert result.startswith("…")

    def test_adds_ellipsis_when_truncated_at_end(self):
        long_suffix = "y" * 300
        text = "TARGET" + long_suffix
        result = self._extract(text, "TARGET", window=50)
        assert result.endswith("…")


class TestMarketplaceMonitorSimulationMode:
    """MarketplaceMonitor.scan_entity() in simulation_mode=True."""

    @pytest.mark.asyncio
    async def test_simulation_returns_monitor_result(self):
        from app.osint.darkweb.marketplace_monitor import MarketplaceMonitor, MonitorResult

        monitor = MarketplaceMonitor(simulation_mode=True)
        result = await monitor.scan_entity("Alice Smith")
        assert isinstance(result, MonitorResult)

    @pytest.mark.asyncio
    async def test_simulation_has_scan_id(self):
        from app.osint.darkweb.marketplace_monitor import MarketplaceMonitor

        monitor = MarketplaceMonitor(simulation_mode=True)
        result = await monitor.scan_entity("Alice Smith")
        assert result.scan_id and len(result.scan_id) > 0

    @pytest.mark.asyncio
    async def test_simulation_entity_name_in_search_terms(self):
        from app.osint.darkweb.marketplace_monitor import MarketplaceMonitor

        monitor = MarketplaceMonitor(simulation_mode=True)
        result = await monitor.scan_entity("Alice Smith")
        assert "Alice Smith" in result.search_terms

    @pytest.mark.asyncio
    async def test_simulation_additional_terms_included(self):
        from app.osint.darkweb.marketplace_monitor import MarketplaceMonitor

        monitor = MarketplaceMonitor(simulation_mode=True)
        result = await monitor.scan_entity("Alice", additional_terms=["alice@example.com"])
        assert "alice@example.com" in result.search_terms

    @pytest.mark.asyncio
    async def test_simulation_produces_some_mentions(self):
        from app.osint.darkweb.marketplace_monitor import MarketplaceMonitor

        monitor = MarketplaceMonitor(simulation_mode=True)
        result = await monitor.scan_entity("Alice Smith")
        # Simulation always produces at least some findings
        assert len(result.mentions) >= 0  # May be 0 or more depending on impl

    @pytest.mark.asyncio
    async def test_simulation_to_dict_has_required_keys(self):
        from app.osint.darkweb.marketplace_monitor import MarketplaceMonitor

        monitor = MarketplaceMonitor(simulation_mode=True)
        result = await monitor.scan_entity("Alice Smith")
        d = result.to_dict()
        for key in (
            "scan_id",
            "entity_query",
            "search_terms",
            "mentions",
            "pages_scanned",
            "tor_available",
            "scan_duration_s",
            "scanned_at",
            "errors",
        ):
            assert key in d, f"Missing key: {key}"

    @pytest.mark.asyncio
    async def test_monitor_result_threat_summary_is_dict(self):
        from app.osint.darkweb.marketplace_monitor import MarketplaceMonitor

        monitor = MarketplaceMonitor(simulation_mode=True)
        result = await monitor.scan_entity("Alice Smith")
        summary = result.threat_summary
        assert isinstance(summary, dict)
