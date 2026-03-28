"""Entity Deduplication & Merge Service.

Detects when two EntityProfile objects likely represent the same real-world
person, and merges them into a single enriched profile.

Matching strategy (scored):
- Exact match on email → very high confidence (0.95)
- Exact match on phone → high confidence (0.85)
- Fuzzy name match + shared location → medium confidence (0.65)
- Shared username across platforms → high confidence (0.80)
- Shared image hash → very high confidence (0.90)

Merge strategy:
- Union all data points (emails, phones, addresses, etc.)
- Prefer higher-confidence data points when conflicting
- Track merge history for audit trail
- Recalculate completeness after merge
"""


from __future__ import annotations
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, UTC
from difflib import SequenceMatcher

from app.models.entity import (
    EntityProfile,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Match scoring constants
# ---------------------------------------------------------------------------

SCORE_EMAIL_EXACT = 0.95
SCORE_PHONE_EXACT = 0.85
SCORE_USERNAME_EXACT = 0.80
SCORE_IMAGE_HASH = 0.90
SCORE_NAME_FUZZY_HIGH = 0.70  # name similarity >= 0.90
SCORE_NAME_FUZZY_MED = 0.55  # name similarity >= 0.75
SCORE_LOCATION_BONUS = 0.10  # Same city/state adds to name match

MERGE_THRESHOLD = 0.75  # Score above which we auto-merge
REVIEW_THRESHOLD = 0.50  # Score above which we flag for manual review


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class MatchResult:
    """Result of comparing two entities for potential duplication."""

    entity_a_id: str
    entity_b_id: str
    score: float  # 0.0 - 1.0
    reasons: list[str] = field(default_factory=list)
    should_merge: bool = False
    needs_review: bool = False

    def __post_init__(self) -> None:
        self.should_merge = self.score >= MERGE_THRESHOLD
        self.needs_review = REVIEW_THRESHOLD <= self.score < MERGE_THRESHOLD


@dataclass
class MergeResult:
    """Result of merging two entities."""

    merged_entity: EntityProfile
    source_entity_ids: list[str]
    data_points_added: int = 0
    data_points_skipped: int = 0
    conflicts: list[str] = field(default_factory=list)
    merge_timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


# ---------------------------------------------------------------------------
# Deduplication service
# ---------------------------------------------------------------------------


class EntityDeduplicationService:
    """Detects duplicate entities and merges them.

    Usage:
        service = EntityDeduplicationService()

        # Check if two entities are duplicates
        match = service.compare(entity_a, entity_b)
        if match.should_merge:
            merged = service.merge(entity_a, entity_b)

        # Find all duplicates in a collection
        groups = service.find_duplicate_groups(entities)
    """

    def compare(self, entity_a: EntityProfile, entity_b: EntityProfile) -> MatchResult:
        """Compare two entities and return a match score with reasons.

        Args:
            entity_a: First entity
            entity_b: Second entity

        Returns:
            MatchResult with score and explanations
        """
        if entity_a.entity_id == entity_b.entity_id:
            return MatchResult(
                entity_a_id=entity_a.entity_id,
                entity_b_id=entity_b.entity_id,
                score=1.0,
                reasons=["same entity_id"],
            )

        score = 0.0
        reasons: list[str] = []

        # -- Email match (strongest signal) --
        emails_a = {e.value.lower() for e in entity_a.emails}
        emails_b = {e.value.lower() for e in entity_b.emails}
        shared_emails = emails_a & emails_b
        if shared_emails:
            score = max(score, SCORE_EMAIL_EXACT)
            reasons.append(f"shared email(s): {', '.join(list(shared_emails)[:2])}")

        # -- Phone match --
        phones_a = {_normalize_phone(p.value) for p in entity_a.phones}
        phones_b = {_normalize_phone(p.value) for p in entity_b.phones}
        shared_phones = phones_a & phones_b
        if shared_phones:
            score = max(score, SCORE_PHONE_EXACT)
            reasons.append(f"shared phone(s): {len(shared_phones)}")

        # -- Username match --
        usernames_a = {u.value.lower() for u in entity_a.usernames}
        usernames_b = {u.value.lower() for u in entity_b.usernames}
        shared_usernames = usernames_a & usernames_b
        if shared_usernames:
            score = max(score, SCORE_USERNAME_EXACT)
            reasons.append(f"shared username(s): {', '.join(list(shared_usernames)[:2])}")

        # -- Name similarity --
        name_score, name_reason = _compare_names(entity_a, entity_b)
        if name_score > 0:
            # Boost name score if they share location
            location_boost = _check_location_overlap(entity_a, entity_b)
            total_name_score = min(name_score + location_boost, 1.0)
            score = max(score, total_name_score)
            reasons.append(name_reason)
            if location_boost > 0:
                reasons.append("shared location")

        # -- Social profile match --
        social_score, social_reason = _compare_social_profiles(entity_a, entity_b)
        if social_score > 0:
            score = max(score, social_score)
            reasons.append(social_reason)

        # -- Image hash match (if available) --
        image_score, image_reason = _compare_images(entity_a, entity_b)
        if image_score > 0:
            score = max(score, image_score)
            reasons.append(image_reason)

        return MatchResult(
            entity_a_id=entity_a.entity_id,
            entity_b_id=entity_b.entity_id,
            score=round(score, 3),
            reasons=reasons,
        )

    def find_duplicate_groups(
        self,
        entities: list[EntityProfile],
        threshold: float | None = None,
    ) -> list[list[EntityProfile]]:
        """Find groups of entities that are likely duplicates.

        Uses a simple union-find algorithm to group entities that share
        high match scores.

        Args:
            entities: List of EntityProfile objects to check
            threshold: Override the default MERGE_THRESHOLD

        Returns:
            List of groups, each group being a list of duplicate entities.
            Single entities (no duplicates) are not included.
        """
        min_score = threshold or MERGE_THRESHOLD
        n = len(entities)

        if n < 2:
            return []

        # Union-Find
        parent = list(range(n))

        def find(i: int) -> int:
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def union(i: int, j: int) -> None:
            parent[find(i)] = find(j)

        # Compare all pairs (O(n²) — acceptable for ~5 scans/day scale)
        for i in range(n):
            for j in range(i + 1, n):
                match = self.compare(entities[i], entities[j])
                if match.score >= min_score:
                    union(i, j)
                    logger.debug(
                        f"Duplicate found: {entities[i].entity_id} ↔ "
                        f"{entities[j].entity_id} (score={match.score:.2f})"
                    )

        # Group by root
        groups: dict[int, list[EntityProfile]] = {}
        for i, entity in enumerate(entities):
            root = find(i)
            groups.setdefault(root, []).append(entity)

        # Return only groups with 2+ entities
        return [group for group in groups.values() if len(group) > 1]

    def _merge_value_field(
        self,
        merged_list: list,
        secondary_list: list,
        existing: set,
        key_fn: Callable,
        result: MergeResult,
        count_skipped: bool = True,
    ) -> None:
        for item in secondary_list:
            k = key_fn(item)
            if k not in existing:
                merged_list.append(item)
                result.data_points_added += 1
                existing.add(k)
            elif count_skipped:
                result.data_points_skipped += 1

    def _merge_value_fields(
        self,
        merged: EntityProfile,
        secondary: EntityProfile,
        result: MergeResult,
    ) -> None:
        fields = [
            (merged.emails, secondary.emails, lambda e: e.value.lower()),
            (merged.phones, secondary.phones, lambda p: _normalize_phone(p.value)),
            (merged.usernames, secondary.usernames, lambda u: u.value.lower()),
            (merged.addresses, secondary.addresses, lambda a: a.value.lower()),
            (merged.images, secondary.images, lambda i: i.value),
        ]
        for merged_list, sec_list, key_fn in fields:
            existing = {key_fn(item) for item in merged_list}
            count_skipped = merged_list is not merged.images
            self._merge_value_field(merged_list, sec_list, existing, key_fn, result, count_skipped)

    def _merge_social_profiles(
        self,
        merged: EntityProfile,
        secondary: EntityProfile,
        result: MergeResult,
    ) -> None:
        existing = {
            (s.platform, s.username or s.profile_url) for s in merged.social_profiles
        }
        for profile in secondary.social_profiles:
            key = (profile.platform, profile.username or profile.profile_url)
            if key not in existing:
                merged.social_profiles.append(profile)
                result.data_points_added += 1
                existing.add(key)
            else:
                result.data_points_skipped += 1

    def _merge_keywords(
        self, merged: EntityProfile, secondary: EntityProfile
    ) -> None:
        existing = set(merged.keywords)
        for kw in secondary.keywords:
            if kw not in existing:
                merged.keywords.append(kw)
                existing.add(kw)

    def _merge_occupations(
        self,
        merged: EntityProfile,
        secondary: EntityProfile,
        result: MergeResult,
    ) -> None:
        existing = {o.value.lower() for o in merged.occupations}
        for occ in secondary.occupations:
            if occ.value.lower() not in existing:
                merged.occupations.append(occ)
                result.data_points_added += 1
                existing.add(occ.value.lower())

    def _merge_names(
        self,
        merged: EntityProfile,
        primary: EntityProfile,
        secondary: EntityProfile,
        result: MergeResult,
    ) -> None:
        if secondary.primary_name and merged.primary_name:
            for alias in secondary.primary_name.aliases:
                if alias not in merged.primary_name.aliases:
                    merged.primary_name.aliases.append(alias)
        elif secondary.primary_name and not merged.primary_name:
            merged.primary_name = secondary.primary_name
            result.data_points_added += 1

        if (
            primary.primary_name
            and secondary.primary_name
            and primary.primary_name.value != secondary.primary_name.value
        ):
            if merged.primary_name:
                if secondary.primary_name.value not in merged.primary_name.aliases:
                    merged.primary_name.aliases.append(secondary.primary_name.value)
            result.conflicts.append(
                f"Name conflict: '{primary.primary_name.value}' vs "
                f"'{secondary.primary_name.value}' — secondary added as alias"
            )

    def merge(
        self,
        primary: EntityProfile,
        secondary: EntityProfile,
        keep_id: str | None = None,
    ) -> MergeResult:
        """Merge two entities into one.

        The primary entity is the base; data from secondary is merged in.
        If keep_id is specified, the merged entity will use that ID.

        Args:
            primary: Base entity (kept as foundation)
            secondary: Entity to merge into primary
            keep_id: Which entity_id to preserve (default: primary's)

        Returns:
            MergeResult with the merged entity and stats
        """
        import copy

        merged = copy.deepcopy(primary)
        result = MergeResult(
            merged_entity=merged,
            source_entity_ids=[primary.entity_id, secondary.entity_id],
        )

        if keep_id:
            merged.entity_id = keep_id

        # Track merge history
        merged.notes.append(
            {
                "type": "merge_event",
                "merged_from": secondary.entity_id,
                "merged_at": datetime.now(UTC).isoformat(),
                "secondary_completeness": secondary.completeness_score,
            }
        )

        self._merge_value_fields(merged, secondary, result)
        self._merge_social_profiles(merged, secondary, result)
        self._merge_keywords(merged, secondary)
        self._merge_occupations(merged, secondary, result)
        self._merge_names(merged, primary, secondary, result)

        # Merge notes
        merged.notes.extend(secondary.notes)

        # Update timestamps
        merged.updated_at = datetime.now(UTC)

        # Recalculate completeness
        merged.calculate_completeness()

        logger.info(
            f"Merged {secondary.entity_id} into {primary.entity_id}: "
            f"+{result.data_points_added} new, {result.data_points_skipped} skipped"
        )

        return result

    def merge_group(
        self,
        entities: list[EntityProfile],
    ) -> MergeResult:
        """Merge a group of duplicate entities into one.

        The entity with the highest completeness_score is used as the base.

        Args:
            entities: List of duplicate entities to merge

        Returns:
            MergeResult with the fully merged entity
        """
        if not entities:
            raise ValueError("Cannot merge empty list")
        if len(entities) == 1:
            return MergeResult(
                merged_entity=entities[0],
                source_entity_ids=[entities[0].entity_id],
            )

        # Sort by completeness — best entity is the base
        sorted_entities = sorted(
            entities,
            key=lambda e: e.completeness_score,
            reverse=True,
        )

        primary = sorted_entities[0]
        total_added = 0
        total_skipped = 0
        all_conflicts: list[str] = []
        all_ids = [e.entity_id for e in sorted_entities]

        # Merge each secondary into primary iteratively
        current = primary
        for secondary in sorted_entities[1:]:
            merge_result = self.merge(current, secondary)
            current = merge_result.merged_entity
            total_added += merge_result.data_points_added
            total_skipped += merge_result.data_points_skipped
            all_conflicts.extend(merge_result.conflicts)

        return MergeResult(
            merged_entity=current,
            source_entity_ids=all_ids,
            data_points_added=total_added,
            data_points_skipped=total_skipped,
            conflicts=all_conflicts,
        )


# ---------------------------------------------------------------------------
# Comparison helpers
# ---------------------------------------------------------------------------


def _normalize_phone(phone: str) -> str:
    """Normalize phone to digits only."""
    digits = "".join(c for c in phone if c.isdigit())
    # Strip leading country code 1 for US numbers
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def _compare_names(
    entity_a: EntityProfile,
    entity_b: EntityProfile,
) -> tuple[float, str]:
    """Compare entity names using fuzzy matching.

    Returns (score, reason_string).
    """
    name_a = entity_a.primary_name
    name_b = entity_b.primary_name

    if not name_a or not name_b:
        return 0.0, ""

    # Exact match
    if name_a.value.lower() == name_b.value.lower():
        return SCORE_NAME_FUZZY_HIGH + 0.05, f"exact name match: '{name_a.value}'"

    # Fuzzy full name match
    similarity = SequenceMatcher(None, name_a.value.lower(), name_b.value.lower()).ratio()

    if similarity >= 0.90:
        return (
            SCORE_NAME_FUZZY_HIGH,
            f"name similarity {similarity:.0%}: '{name_a.value}' ↔ '{name_b.value}'",
        )
    if similarity >= 0.75:
        return (
            SCORE_NAME_FUZZY_MED,
            f"name similarity {similarity:.0%}: '{name_a.value}' ↔ '{name_b.value}'",
        )

    # Check if one is an alias of the other
    aliases_a = set(name_a.aliases) | {name_a.value}
    aliases_b = set(name_b.aliases) | {name_b.value}
    shared_aliases = {a.lower() for a in aliases_a} & {b.lower() for b in aliases_b}
    if shared_aliases:
        return SCORE_NAME_FUZZY_MED, f"shared alias: {', '.join(list(shared_aliases)[:2])}"

    return 0.0, ""


def _check_location_overlap(
    entity_a: EntityProfile,
    entity_b: EntityProfile,
) -> float:
    """Return location overlap bonus score."""
    cities_a = {a.city.lower() for a in entity_a.addresses if a.city}
    cities_b = {a.city.lower() for a in entity_b.addresses if a.city}

    if cities_a & cities_b:
        return SCORE_LOCATION_BONUS

    states_a = {a.state.lower() for a in entity_a.addresses if a.state}
    states_b = {a.state.lower() for a in entity_b.addresses if a.state}

    if states_a & states_b:
        return SCORE_LOCATION_BONUS / 2

    return 0.0


def _compare_social_profiles(
    entity_a: EntityProfile,
    entity_b: EntityProfile,
) -> tuple[float, str]:
    """Compare social profiles for matches."""
    profiles_a = {
        (s.platform.lower(), (s.username or "").lower())
        for s in entity_a.social_profiles
        if s.username
    }
    profiles_b = {
        (s.platform.lower(), (s.username or "").lower())
        for s in entity_b.social_profiles
        if s.username
    }

    shared = profiles_a & profiles_b
    if shared:
        examples = [f"{p[0]}:{p[1]}" for p in list(shared)[:2]]
        return SCORE_USERNAME_EXACT, f"shared social profile(s): {', '.join(examples)}"

    return 0.0, ""


def _compare_images(
    entity_a: EntityProfile,
    entity_b: EntityProfile,
) -> tuple[float, str]:
    """Compare image hashes for face/identity match."""
    # Only compare images that have a hash (set during image analysis)
    hashes_a = {img.image_hash for img in entity_a.images if img.image_hash}
    hashes_b = {img.image_hash for img in entity_b.images if img.image_hash}

    shared_hashes = hashes_a & hashes_b
    if shared_hashes:
        return SCORE_IMAGE_HASH, f"shared image hash(es): {len(shared_hashes)}"

    return 0.0, ""
