"""Tests for fraud_detection.py — Phase 4 pipeline.

Tests pure logic: IdentityResolver, FraudPatternDetector, RelationshipMapper,
RiskScoringEngine, and the FraudDetectionPipeline facade.
No mocks needed — all components are pure functions or in-memory logic.
"""

import pytest

from app.services.fraud_detection import (
    IdentityResolver,
    FraudPatternDetector,
    RelationshipMapper,
    RiskScoringEngine,
    FraudDetectionPipeline,
    ResolvedIdentity,
    _norm_email,
    _norm_phone,
    _norm_name,
    _norm_address,
    _name_similarity,
)


# ─── Normalisation helpers ──────────────────────────────────────────────────


class TestNormHelpers:
    def test_norm_email_lowercases(self):
        assert _norm_email("User@Example.COM") == "user@example.com"

    def test_norm_email_strips_whitespace(self):
        assert _norm_email("  user@example.com  ") == "user@example.com"

    def test_norm_phone_strips_non_digits(self):
        assert _norm_phone("+1 (555) 123-4567") == "+15551234567"

    def test_norm_phone_preserves_plus(self):
        result = _norm_phone("+61412345678")
        assert result.startswith("+")

    def test_norm_name_lowercases_and_collapses_whitespace(self):
        assert _norm_name("  John   DOE  ") == "john doe"

    def test_norm_address_lowercases_and_strips_punctuation(self):
        result = _norm_address("123 Main St., Springfield")
        assert result == "123 main st springfield"

    def test_name_similarity_identical_names(self):
        assert _name_similarity("John Doe", "John Doe") == 1.0

    def test_name_similarity_different_names(self):
        score = _name_similarity("John Doe", "Jane Smith")
        assert score < 0.5

    def test_name_similarity_similar_names(self):
        score = _name_similarity("John Doe", "Jon Doe")
        assert score > 0.7


# ─── IdentityResolver ──────────────────────────────────────────────────────


class TestIdentityResolver:
    @pytest.fixture
    def resolver(self):
        return IdentityResolver()

    def test_single_profile_returns_identity(self, resolver):
        profile = {"entity_id": "e1", "primary_name": "John Doe"}
        result = resolver.resolve([profile])
        assert result.canonical_name == "John Doe"
        assert result.source_count == 1

    def test_merges_emails_from_multiple_profiles(self, resolver):
        profiles = [
            {"entity_id": "e1", "emails": [{"value": "john@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "john@work.com"}]},
        ]
        result = resolver.resolve(profiles)
        assert "john@example.com" in result.emails
        assert "john@work.com" in result.emails

    def test_deduplicates_emails(self, resolver):
        profiles = [
            {"entity_id": "e1", "emails": [{"value": "john@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "JOHN@EXAMPLE.COM"}]},
        ]
        result = resolver.resolve(profiles)
        assert result.emails.count("john@example.com") == 1

    def test_merges_phones(self, resolver):
        profiles = [
            {"entity_id": "e1", "phones": [{"value": "+1 555 123 4567"}]},
        ]
        result = resolver.resolve(profiles)
        assert len(result.phones) == 1

    def test_merges_usernames(self, resolver):
        profiles = [
            {"entity_id": "e1", "usernames": [{"value": "johndoe"}]},
            {"entity_id": "e2", "usernames": [{"value": "john_doe"}]},
        ]
        result = resolver.resolve(profiles)
        assert "johndoe" in result.usernames
        assert "john_doe" in result.usernames

    def test_first_name_becomes_canonical(self, resolver):
        profiles = [
            {"entity_id": "e1", "primary_name": "John Doe"},
            {"entity_id": "e2", "primary_name": "Jane Smith"},
        ]
        result = resolver.resolve(profiles)
        assert result.canonical_name == "John Doe"
        assert "Jane Smith" in result.aliases

    def test_confidence_increases_with_more_sources(self, resolver):
        one = resolver.resolve([{"entity_id": "e1"}])
        many = resolver.resolve([{"entity_id": f"e{i}"} for i in range(5)])
        assert many.confidence > one.confidence

    def test_identity_id_is_deterministic(self, resolver):
        profile = {"entity_id": "e1"}
        r1 = resolver.resolve([profile])
        r2 = resolver.resolve([profile])
        assert r1.identity_id == r2.identity_id

    def test_handles_string_email_values(self, resolver):
        profiles = [{"entity_id": "e1", "emails": ["plain@string.com"]}]
        result = resolver.resolve(profiles)
        assert "plain@string.com" in result.emails

    def test_handles_empty_profiles(self, resolver):
        result = resolver.resolve([{}])
        assert result.source_count == 1
        assert result.canonical_name is None
        assert result.emails == []

    def test_extracts_dob(self, resolver):
        profile = {"entity_id": "e1", "date_of_birth": "1990-05-15"}
        result = resolver.resolve([profile])
        assert result.date_of_birth == "1990-05-15"

    def test_extracts_image_hashes(self, resolver):
        profile = {"entity_id": "e1", "images": [{"image_hash": "abc123"}]}
        result = resolver.resolve([profile])
        assert "abc123" in result.image_hashes


# ─── FraudPatternDetector ──────────────────────────────────────────────────


def _make_identity(**kwargs) -> ResolvedIdentity:
    """Build a minimal ResolvedIdentity for testing."""
    defaults = {
        "identity_id": "test-id",
        "source_count": 1,
        "confidence": 0.5,
    }
    defaults.update(kwargs)
    return ResolvedIdentity(**defaults)


class TestFraudPatternDetector:
    @pytest.fixture
    def detector(self):
        return FraudPatternDetector()

    def test_detects_disposable_email(self, detector):
        identity = _make_identity(emails=["user@mailinator.com"])
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "disposable_email" in signal_ids

    def test_no_disposable_signal_for_real_email(self, detector):
        identity = _make_identity(emails=["user@gmail.com"])
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "disposable_email" not in signal_ids

    def test_detects_no_email_with_many_sources(self, detector):
        identity = _make_identity(emails=[], source_count=3)
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "no_email" in signal_ids

    def test_no_email_signal_with_few_sources(self, detector):
        # Only 1 source — not suspicious to have no email
        identity = _make_identity(emails=[], source_count=1)
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "no_email" not in signal_ids

    def test_detects_email_sprawl(self, detector):
        emails = [f"user{i}@example.com" for i in range(5)]
        identity = _make_identity(emails=emails)
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "email_sprawl" in signal_ids

    def test_detects_generic_name(self, detector):
        identity = _make_identity(canonical_name="John Doe")
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "generic_name" in signal_ids

    def test_detects_implausible_age(self, detector):
        # Use a future year — age will be negative (< 0), which is implausible
        identity = _make_identity(date_of_birth="2099-01-01")
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "implausible_age" in signal_ids

    def test_detects_under_13(self, detector):
        from datetime import datetime

        year = datetime.now().year - 5  # 5 years old
        identity = _make_identity(date_of_birth=f"{year}-01-01")
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "age_under_13" in signal_ids

    def test_detects_no_social_presence(self, detector):
        identity = _make_identity(
            social_profiles=[],
            usernames=[],
            source_count=3,
        )
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "no_social_presence" in signal_ids

    def test_detects_single_source(self, detector):
        identity = _make_identity(source_count=1)
        report = detector.analyse(identity)
        signal_ids = [s.signal_id for s in report.signals]
        assert "single_source" in signal_ids

    def test_report_counts_match_signals(self, detector):
        identity = _make_identity(emails=["user@mailinator.com"], source_count=1)
        report = detector.analyse(identity)
        assert report.total_signals == len(report.signals)
        assert report.high_count == sum(1 for s in report.signals if s.severity == "high")

    def test_image_suspicion_high_adds_signal(self, detector):
        identity = _make_identity()
        report = detector.analyse(identity, image_suspicion_score=0.9)
        signal_ids = [s.signal_id for s in report.signals]
        assert "image_suspicion" in signal_ids

    def test_image_suspicion_moderate_adds_caution_signal(self, detector):
        identity = _make_identity()
        report = detector.analyse(identity, image_suspicion_score=0.4)
        signal_ids = [s.signal_id for s in report.signals]
        assert "image_caution" in signal_ids

    def test_image_suspicion_below_threshold_no_signal(self, detector):
        identity = _make_identity()
        report = detector.analyse(identity, image_suspicion_score=0.1)
        signal_ids = [s.signal_id for s in report.signals]
        assert "image_suspicion" not in signal_ids
        assert "image_caution" not in signal_ids

    def test_clean_identity_has_minimal_signals(self, detector):
        identity = _make_identity(
            canonical_name="Elizabeth Thornton",
            emails=["elizabeth@example.com"],
            phones=["+61412345678"],
            usernames=["elizabeth_t"],
            social_profiles=["https://linkedin.com/in/elizabeth"],
            source_count=4,
            date_of_birth="1985-03-20",
        )
        report = detector.analyse(identity)
        # Should have few or no high/critical signals
        assert report.critical_count == 0
        assert report.high_count == 0


# ─── RelationshipMapper ────────────────────────────────────────────────────


class TestRelationshipMapper:
    @pytest.fixture
    def mapper(self):
        return RelationshipMapper()

    def test_no_links_for_unrelated_profiles(self, mapper):
        profiles = [
            {"entity_id": "e1", "emails": [{"value": "a@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "b@example.com"}]},
        ]
        graph = mapper.build_graph(profiles)
        assert len(graph.links) == 0

    def test_links_entities_sharing_email(self, mapper):
        profiles = [
            {"entity_id": "e1", "emails": [{"value": "shared@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "shared@example.com"}]},
        ]
        graph = mapper.build_graph(profiles)
        assert len(graph.links) == 1
        assert graph.links[0].pivot_type == "email"
        assert graph.links[0].pivot_value == "shared@example.com"

    def test_links_entities_sharing_phone(self, mapper):
        profiles = [
            {"entity_id": "e1", "phones": [{"value": "+61412345678"}]},
            {"entity_id": "e2", "phones": [{"value": "+61412345678"}]},
        ]
        graph = mapper.build_graph(profiles)
        assert len(graph.links) == 1
        assert graph.links[0].pivot_type == "phone"

    def test_links_entities_sharing_username(self, mapper):
        profiles = [
            {"entity_id": "e1", "usernames": [{"value": "hacker99"}]},
            {"entity_id": "e2", "usernames": [{"value": "hacker99"}]},
        ]
        graph = mapper.build_graph(profiles)
        assert len(graph.links) >= 1

    def test_clusters_connected_entities(self, mapper):
        profiles = [
            {"entity_id": "e1", "emails": [{"value": "shared@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "shared@example.com"}]},
            {"entity_id": "e3", "emails": [{"value": "other@example.com"}]},
        ]
        graph = mapper.build_graph(profiles)
        # e1 and e2 should be in the same cluster
        cluster_containing_e1 = next((c for c in graph.clusters if "e1" in c), None)
        assert cluster_containing_e1 is not None
        assert "e2" in cluster_containing_e1

    def test_graph_contains_all_nodes(self, mapper):
        profiles = [
            {"entity_id": "e1"},
            {"entity_id": "e2"},
            {"entity_id": "e3"},
        ]
        graph = mapper.build_graph(profiles)
        assert set(graph.nodes) == {"e1", "e2", "e3"}

    def test_email_link_has_high_confidence(self, mapper):
        profiles = [
            {"entity_id": "e1", "emails": [{"value": "x@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "x@example.com"}]},
        ]
        graph = mapper.build_graph(profiles)
        assert graph.links[0].confidence == 0.95

    def test_custom_graph_id(self, mapper):
        profiles = [{"entity_id": "e1"}]
        graph = mapper.build_graph(profiles, graph_id="custom-id")
        assert graph.graph_id == "custom-id"

    def test_persist_and_load(self, mapper, tmp_path, monkeypatch):
        import app.services.fraud_detection as fd_module

        monkeypatch.setattr(fd_module, "_GRAPH_ROOT", tmp_path / "graphs")
        profiles = [{"entity_id": "e1"}]
        graph = mapper.build_graph(profiles, graph_id="test-graph")
        mapper.persist(graph)
        loaded = mapper.load("test-graph")
        assert loaded is not None
        assert loaded.graph_id == "test-graph"

    def test_load_returns_none_for_unknown_graph(self, mapper, tmp_path, monkeypatch):
        import app.services.fraud_detection as fd_module

        monkeypatch.setattr(fd_module, "_GRAPH_ROOT", tmp_path / "graphs")
        result = mapper.load("nonexistent")
        assert result is None


# ─── RiskScoringEngine ─────────────────────────────────────────────────────


class TestRiskScoringEngine:
    @pytest.fixture
    def scorer(self):
        return RiskScoringEngine()

    @pytest.fixture
    def resolver(self):
        return IdentityResolver()

    @pytest.fixture
    def detector(self):
        return FraudPatternDetector()

    def test_minimal_risk_for_clean_identity(self, scorer, resolver, detector):
        profiles = [{"entity_id": "e1", "primary_name": "Elizabeth Thornton"}]
        identity = resolver.resolve(profiles)
        report = detector.analyse(identity)
        risk = scorer.score(identity, report)
        assert risk.risk_level in ("MINIMAL", "LOW")
        assert risk.risk_score < 0.5

    def test_high_risk_for_suspicious_identity(self, scorer, resolver, detector):
        profiles = [
            {
                "entity_id": "e1",
                "primary_name": "John Doe",
                "emails": ["fake@mailinator.com", "user@yopmail.com"],
            }
        ]
        identity = resolver.resolve(profiles)
        report = detector.analyse(identity, image_suspicion_score=0.9)
        risk = scorer.score(identity, report, image_score=0.9)
        assert risk.risk_level in ("HIGH", "CRITICAL", "MODERATE")
        assert risk.risk_score > 0.1

    def test_risk_score_between_0_and_1(self, scorer, resolver, detector):
        for n_sources in [1, 3, 5]:
            profiles = [{"entity_id": f"e{i}"} for i in range(n_sources)]
            identity = resolver.resolve(profiles)
            report = detector.analyse(identity)
            risk = scorer.score(identity, report)
            assert 0.0 <= risk.risk_score <= 1.0

    def test_fraud_probability_between_0_and_1(self, scorer):
        identity = _make_identity()
        from app.services.fraud_detection import FraudPatternReport

        report = FraudPatternReport(identity_id="test-id")
        risk = scorer.score(identity, report)
        assert 0.0 <= risk.fraud_probability <= 1.0

    def test_network_bonus_increases_score(self, scorer, resolver, detector):
        from app.services.fraud_detection import RelationshipMapper

        mapper = RelationshipMapper()

        profiles = [
            {"entity_id": "e1", "emails": [{"value": "shared@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "shared@example.com"}]},
        ]
        identity = resolver.resolve(profiles)
        report = detector.analyse(identity)

        graph_with_links = mapper.build_graph(profiles)
        graph_no_links = mapper.build_graph([{"entity_id": "e1"}])

        risk_with = scorer.score(identity, report, graph=graph_with_links)
        risk_without = scorer.score(identity, report, graph=graph_no_links)

        assert risk_with.risk_score >= risk_without.risk_score

    def test_recommended_actions_not_empty(self, scorer):
        identity = _make_identity()
        from app.services.fraud_detection import FraudPatternReport

        report = FraudPatternReport(identity_id="test-id")
        risk = scorer.score(identity, report)
        assert len(risk.recommended_actions) > 0

    def test_is_fake_identity_false_for_low_risk(self, scorer, resolver, detector):
        profiles = [{"entity_id": "e1", "primary_name": "Legit Person"}]
        identity = resolver.resolve(profiles)
        report = detector.analyse(identity)
        risk = scorer.score(identity, report)
        assert risk.is_fake_identity is False


# ─── FraudDetectionPipeline ────────────────────────────────────────────────


class TestFraudDetectionPipeline:
    @pytest.fixture
    def pipeline(self):
        return FraudDetectionPipeline()

    def test_run_returns_complete_result(self, pipeline):
        profiles = [{"entity_id": "e1", "primary_name": "Test Person"}]
        result = pipeline.run(profiles, persist_graph=False)
        assert result.identity is not None
        assert result.fraud_report is not None
        assert result.entity_graph is not None
        assert result.risk_assessment is not None

    def test_run_single_convenience_wrapper(self, pipeline):
        profile = {"entity_id": "e1", "primary_name": "Single Person"}
        result = pipeline.run_single(profile)
        assert result.identity.source_count == 1

    def test_pipeline_propagates_image_score(self, pipeline):
        profiles = [{"entity_id": "e1"}]
        result = pipeline.run(profiles, image_suspicion_score=0.9, persist_graph=False)
        signal_ids = [s.signal_id for s in result.fraud_report.signals]
        assert "image_suspicion" in signal_ids

    def test_pipeline_with_multiple_profiles(self, pipeline):
        profiles = [
            {"entity_id": "e1", "emails": [{"value": "shared@example.com"}]},
            {"entity_id": "e2", "emails": [{"value": "shared@example.com"}]},
        ]
        result = pipeline.run(profiles, persist_graph=False)
        assert result.identity.source_count == 2
        assert len(result.entity_graph.links) >= 1

    def test_pipeline_persist_graph(self, pipeline, tmp_path, monkeypatch):
        import app.services.fraud_detection as fd_module

        monkeypatch.setattr(fd_module, "_GRAPH_ROOT", tmp_path / "graphs")
        profiles = [{"entity_id": "e1"}]
        result = pipeline.run(profiles, persist_graph=True)
        graph_file = tmp_path / "graphs" / f"{result.entity_graph.graph_id}.json"
        assert graph_file.exists()

    def test_risk_assessment_has_identity_id(self, pipeline):
        profiles = [{"entity_id": "e1"}]
        result = pipeline.run(profiles, persist_graph=False)
        assert result.risk_assessment.identity_id == result.identity.identity_id
