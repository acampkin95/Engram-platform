"""Tests for EntityDeduplicationService.

Tests compare, merge, find_duplicate_groups, and merge_group behaviors.
No mocks needed — pure logic with real EntityProfile objects.
"""

import pytest

from app.services.entity_deduplication import (
    EntityDeduplicationService,
    MERGE_THRESHOLD,
    REVIEW_THRESHOLD,
    SCORE_EMAIL_EXACT,
    SCORE_PHONE_EXACT,
    SCORE_USERNAME_EXACT,
    SCORE_IMAGE_HASH,
    _normalize_phone,
)
from app.models.entity import (
    EntityProfile,
    NameInfo,
    EmailInfo,
    PhoneInfo,
    UsernameInfo,
    AddressInfo,
    ImageReference,
    SocialProfile,
)


# ─── Helpers ───────────────────────────────────────────────────────────────


def make_entity(
    name: str = None,
    emails: list = None,
    phones: list = None,
    usernames: list = None,
    addresses: list = None,
    images: list = None,
    social_profiles: list = None,
) -> EntityProfile:
    """Build a minimal EntityProfile for testing."""
    e = EntityProfile()
    if name:
        e.primary_name = NameInfo(value=name)
    if emails:
        e.emails = [EmailInfo(value=em) for em in emails]
    if phones:
        e.phones = [PhoneInfo(value=ph) for ph in phones]
    if usernames:
        e.usernames = [UsernameInfo(value=u) for u in usernames]
    if addresses:
        e.addresses = [AddressInfo(value=a) for a in addresses]
    if images:
        e.images = images
    if social_profiles:
        e.social_profiles = social_profiles
    return e


@pytest.fixture
def service():
    return EntityDeduplicationService()


# ─── _normalize_phone ──────────────────────────────────────────────────────


class TestNormalizePhone:
    def test_strips_non_digits(self):
        assert _normalize_phone("+1 (555) 123-4567") == "5551234567"

    def test_strips_us_country_code(self):
        # 11 digits starting with 1 → strip leading 1
        assert _normalize_phone("15551234567") == "5551234567"

    def test_preserves_non_us_numbers(self):
        result = _normalize_phone("+61412345678")
        assert "61412345678" in result or result.startswith("61")


# ─── compare — same entity ─────────────────────────────────────────────────


class TestCompare:
    def test_same_entity_id_scores_1(self, service):
        e = make_entity(name="John Doe")
        result = service.compare(e, e)
        assert result.score == 1.0
        assert result.should_merge is True

    def test_shared_email_triggers_merge(self, service):
        a = make_entity(emails=["john@example.com"])
        b = make_entity(emails=["john@example.com"])
        result = service.compare(a, b)
        assert result.score >= SCORE_EMAIL_EXACT
        assert result.should_merge is True

    def test_shared_email_case_insensitive(self, service):
        a = make_entity(emails=["John@Example.COM"])
        b = make_entity(emails=["john@example.com"])
        result = service.compare(a, b)
        assert result.should_merge is True

    def test_different_emails_no_email_signal(self, service):
        a = make_entity(emails=["alice@example.com"])
        b = make_entity(emails=["bob@example.com"])
        result = service.compare(a, b)
        assert result.score < SCORE_EMAIL_EXACT

    def test_shared_phone_triggers_merge(self, service):
        a = make_entity(phones=["5551234567"])
        b = make_entity(phones=["555-123-4567"])
        result = service.compare(a, b)
        assert result.score >= SCORE_PHONE_EXACT
        assert result.should_merge is True

    def test_shared_username_triggers_merge(self, service):
        a = make_entity(usernames=["johndoe99"])
        b = make_entity(usernames=["johndoe99"])
        result = service.compare(a, b)
        assert result.score >= SCORE_USERNAME_EXACT
        assert result.should_merge is True

    def test_shared_username_case_insensitive(self, service):
        a = make_entity(usernames=["JohnDoe99"])
        b = make_entity(usernames=["johndoe99"])
        result = service.compare(a, b)
        assert result.should_merge is True

    def test_exact_name_match_produces_score(self, service):
        a = make_entity(name="John Doe")
        b = make_entity(name="John Doe")
        result = service.compare(a, b)
        assert result.score > 0

    def test_similar_name_produces_score(self, service):
        a = make_entity(name="John Doe")
        b = make_entity(name="Jon Doe")
        result = service.compare(a, b)
        assert result.score > 0

    def test_completely_different_entities_low_score(self, service):
        a = make_entity(name="Alice Smith", emails=["alice@example.com"])
        b = make_entity(name="Bob Jones", emails=["bob@other.com"])
        result = service.compare(a, b)
        assert result.score < REVIEW_THRESHOLD

    def test_shared_image_hash_triggers_merge(self, service):
        img_a = ImageReference(value="http://img.example.com/a.jpg", image_hash="abc123")
        img_b = ImageReference(value="http://img.example.com/b.jpg", image_hash="abc123")
        a = make_entity(images=[img_a])
        b = make_entity(images=[img_b])
        result = service.compare(a, b)
        assert result.score >= SCORE_IMAGE_HASH
        assert result.should_merge is True

    def test_result_has_reasons(self, service):
        a = make_entity(emails=["shared@example.com"])
        b = make_entity(emails=["shared@example.com"])
        result = service.compare(a, b)
        assert len(result.reasons) > 0

    def test_needs_review_flag_set_correctly(self, service):
        # Name similarity alone (no exact matches) — should be needs_review not should_merge
        a = make_entity(name="Jonathan Doe")
        b = make_entity(name="Jon Doe")
        result = service.compare(a, b)
        # Check flags are consistent with score
        if result.score >= MERGE_THRESHOLD:
            assert result.should_merge is True
            assert result.needs_review is False
        elif result.score >= REVIEW_THRESHOLD:
            assert result.should_merge is False
            assert result.needs_review is True
        else:
            assert result.should_merge is False
            assert result.needs_review is False

    def test_location_boost_applied_with_name(self, service):
        a = make_entity(name="John Doe", addresses=["123 Main St, Springfield, IL"])
        b = make_entity(name="John Doe", addresses=["456 Oak Ave, Springfield, IL"])
        # Manually set city
        a.addresses[0].city = "springfield"
        b.addresses[0].city = "springfield"
        result = service.compare(a, b)
        assert result.score > 0
        # Location boost should be in reasons
        assert any("location" in r.lower() for r in result.reasons)

    def test_shared_social_profile_triggers_merge(self, service):
        sp_a = SocialProfile(
            value="https://twitter.com/johndoe", platform="twitter", username="johndoe"
        )
        sp_b = SocialProfile(
            value="https://twitter.com/johndoe", platform="twitter", username="johndoe"
        )
        a = make_entity(social_profiles=[sp_a])
        b = make_entity(social_profiles=[sp_b])
        result = service.compare(a, b)
        assert result.score >= SCORE_USERNAME_EXACT


# ─── merge ─────────────────────────────────────────────────────────────────


class TestMerge:
    def test_merged_entity_has_primary_id_by_default(self, service):
        primary = make_entity(name="John Doe", emails=["john@example.com"])
        secondary = make_entity(name="Jon Doe", emails=["jon@other.com"])
        result = service.merge(primary, secondary)
        assert result.merged_entity.entity_id == primary.entity_id

    def test_keep_id_overrides_entity_id(self, service):
        primary = make_entity(name="John Doe")
        secondary = make_entity(name="Jon Doe")
        result = service.merge(primary, secondary, keep_id="custom-id")
        assert result.merged_entity.entity_id == "custom-id"

    def test_merges_emails_from_secondary(self, service):
        primary = make_entity(emails=["john@example.com"])
        secondary = make_entity(emails=["john@work.com"])
        result = service.merge(primary, secondary)
        emails = [e.value for e in result.merged_entity.emails]
        assert "john@example.com" in emails
        assert "john@work.com" in emails

    def test_does_not_duplicate_shared_email(self, service):
        primary = make_entity(emails=["shared@example.com"])
        secondary = make_entity(emails=["shared@example.com"])
        result = service.merge(primary, secondary)
        emails = [e.value.lower() for e in result.merged_entity.emails]
        assert emails.count("shared@example.com") == 1
        assert result.data_points_skipped >= 1

    def test_merges_phones(self, service):
        primary = make_entity(phones=["5551234567"])
        secondary = make_entity(phones=["5559876543"])
        result = service.merge(primary, secondary)
        assert len(result.merged_entity.phones) == 2

    def test_merges_usernames(self, service):
        primary = make_entity(usernames=["johndoe"])
        secondary = make_entity(usernames=["john_doe_99"])
        result = service.merge(primary, secondary)
        usernames = [u.value for u in result.merged_entity.usernames]
        assert "johndoe" in usernames
        assert "john_doe_99" in usernames

    def test_data_points_added_counted(self, service):
        primary = make_entity(emails=["a@example.com"])
        secondary = make_entity(emails=["b@example.com", "c@example.com"])
        result = service.merge(primary, secondary)
        assert result.data_points_added == 2

    def test_source_entity_ids_recorded(self, service):
        primary = make_entity()
        secondary = make_entity()
        result = service.merge(primary, secondary)
        assert primary.entity_id in result.source_entity_ids
        assert secondary.entity_id in result.source_entity_ids

    def test_conflicting_names_added_as_alias(self, service):
        primary = make_entity(name="John Doe")
        secondary = make_entity(name="Jon Doe")
        result = service.merge(primary, secondary)
        assert len(result.conflicts) > 0
        # Secondary name should be in aliases
        assert "Jon Doe" in result.merged_entity.primary_name.aliases

    def test_merge_event_recorded_in_notes(self, service):
        primary = make_entity()
        secondary = make_entity()
        result = service.merge(primary, secondary)
        merge_notes = [
            n
            for n in result.merged_entity.notes
            if isinstance(n, dict) and n.get("type") == "merge_event"
        ]
        assert len(merge_notes) >= 1

    def test_merges_keywords(self, service):
        primary = make_entity()
        primary.keywords = ["fraud", "osint"]
        secondary = make_entity()
        secondary.keywords = ["identity", "fraud"]  # "fraud" is duplicate
        result = service.merge(primary, secondary)
        assert "identity" in result.merged_entity.keywords
        assert result.merged_entity.keywords.count("fraud") == 1


# ─── find_duplicate_groups ─────────────────────────────────────────────────


class TestFindDuplicateGroups:
    def test_empty_list_returns_empty(self, service):
        assert service.find_duplicate_groups([]) == []

    def test_single_entity_returns_empty(self, service):
        e = make_entity(name="John")
        assert service.find_duplicate_groups([e]) == []

    def test_two_identical_email_entities_grouped(self, service):
        a = make_entity(emails=["shared@example.com"])
        b = make_entity(emails=["shared@example.com"])
        c = make_entity(emails=["other@example.com"])
        groups = service.find_duplicate_groups([a, b, c])
        assert len(groups) == 1
        group_ids = {e.entity_id for e in groups[0]}
        assert a.entity_id in group_ids
        assert b.entity_id in group_ids
        assert c.entity_id not in group_ids

    def test_no_duplicates_returns_empty(self, service):
        entities = [
            make_entity(emails=["a@example.com"]),
            make_entity(emails=["b@example.com"]),
            make_entity(emails=["c@example.com"]),
        ]
        groups = service.find_duplicate_groups(entities)
        assert groups == []

    def test_transitive_duplicates_grouped_together(self, service):
        # a shares email with b, b shares phone with c → all in same group
        a = make_entity(emails=["shared@example.com"])
        b = make_entity(emails=["shared@example.com"], phones=["5551234567"])
        c = make_entity(phones=["5551234567"])
        groups = service.find_duplicate_groups([a, b, c])
        assert len(groups) == 1
        assert len(groups[0]) == 3

    def test_custom_threshold(self, service):
        # With a very low threshold, even vaguely similar entities group
        a = make_entity(name="John Doe")
        b = make_entity(name="John Doe")
        groups = service.find_duplicate_groups([a, b], threshold=0.5)
        assert len(groups) >= 1


# ─── merge_group ───────────────────────────────────────────────────────────


class TestMergeGroup:
    def test_raises_on_empty_list(self, service):
        with pytest.raises(ValueError):
            service.merge_group([])

    def test_single_entity_returned_unchanged(self, service):
        e = make_entity(name="John Doe")
        result = service.merge_group([e])
        assert result.merged_entity.entity_id == e.entity_id

    def test_merges_all_entities_in_group(self, service):
        a = make_entity(emails=["a@example.com"])
        b = make_entity(emails=["b@example.com"])
        c = make_entity(emails=["c@example.com"])
        result = service.merge_group([a, b, c])
        emails = [e.value for e in result.merged_entity.emails]
        assert "a@example.com" in emails
        assert "b@example.com" in emails
        assert "c@example.com" in emails

    def test_all_source_ids_recorded(self, service):
        a = make_entity()
        b = make_entity()
        c = make_entity()
        result = service.merge_group([a, b, c])
        assert a.entity_id in result.source_entity_ids
        assert b.entity_id in result.source_entity_ids
        assert c.entity_id in result.source_entity_ids

    def test_highest_completeness_entity_is_base(self, service):
        # Entity with more data has higher completeness
        rich = make_entity(
            name="John Doe",
            emails=["john@example.com"],
            phones=["5551234567"],
            usernames=["johndoe"],
        )
        rich.calculate_completeness()

        sparse = make_entity(name="John Doe")
        sparse.calculate_completeness()

        result = service.merge_group([sparse, rich])
        # Rich entity should be the base (highest completeness)
        assert result.merged_entity.entity_id == rich.entity_id
