"""Tests for app/osint/platforms.py — simple platform configs (shadowed by platforms/ package)."""
import importlib.util
from pathlib import Path


# platforms.py is shadowed by the platforms/ package at runtime.
# Import it directly by file path for coverage tracking.
_PLATFORMS_FILE = Path(__file__).parent.parent / "app" / "osint" / "platforms.py"
_spec = importlib.util.spec_from_file_location("app_osint_platforms_py", _PLATFORMS_FILE)
_platforms_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_platforms_mod)

PlatformConfig = _platforms_mod.PlatformConfig
PLATFORM_CONFIGS = _platforms_mod.PLATFORM_CONFIGS
get_platform = _platforms_mod.get_platform
get_all_platforms = _platforms_mod.get_all_platforms


class TestPlatformConfig:
    def test_platform_config_default_rate_limit(self):
        config = PlatformConfig(
            name="test",
            base_url="https://test.com",
            profile_url_template="https://test.com/{username}",
            search_url_template="https://test.com/search?q={query}",
        )
        assert config.name == "test"
        assert config.rate_limit_delay == 1.0

    def test_platform_config_custom_rate_limit(self):
        config = PlatformConfig(
            name="slow",
            base_url="https://slow.com",
            profile_url_template="https://slow.com/{username}",
            search_url_template="https://slow.com/search?q={query}",
            rate_limit_delay=5.0,
        )
        assert config.rate_limit_delay == 5.0

    def test_all_fields_set(self):
        config = PlatformConfig(
            name="myplatform",
            base_url="https://example.com",
            profile_url_template="https://example.com/{username}",
            search_url_template="https://example.com/search?q={query}",
            rate_limit_delay=2.5,
        )
        assert config.name == "myplatform"
        assert config.base_url == "https://example.com"
        assert "{username}" in config.profile_url_template
        assert "{query}" in config.search_url_template
        assert config.rate_limit_delay == 2.5


class TestPlatformConfigs:
    def test_all_expected_platforms_present(self):
        expected = {
            "twitter",
            "linkedin",
            "instagram",
            "facebook",
            "reddit",
            "tiktok",
            "github",
            "mastodon",
        }
        assert set(PLATFORM_CONFIGS.keys()) == expected

    def test_twitter_config(self):
        p = PLATFORM_CONFIGS["twitter"]
        assert p.name == "twitter"
        assert "x.com" in p.base_url
        assert "{username}" in p.profile_url_template
        assert "{query}" in p.search_url_template
        assert p.rate_limit_delay == 2.0

    def test_linkedin_config(self):
        p = PLATFORM_CONFIGS["linkedin"]
        assert p.name == "linkedin"
        assert "linkedin.com" in p.base_url
        assert p.rate_limit_delay == 3.0

    def test_github_config(self):
        p = PLATFORM_CONFIGS["github"]
        assert p.name == "github"
        assert "github.com" in p.base_url
        assert p.rate_limit_delay == 1.0

    def test_reddit_config(self):
        p = PLATFORM_CONFIGS["reddit"]
        assert "reddit.com" in p.profile_url_template

    def test_tiktok_profile_url_template(self):
        p = PLATFORM_CONFIGS["tiktok"]
        assert "@{username}" in p.profile_url_template

    def test_mastodon_config(self):
        p = PLATFORM_CONFIGS["mastodon"]
        assert "mastodon.social" in p.base_url

    def test_facebook_config(self):
        p = PLATFORM_CONFIGS["facebook"]
        assert "facebook.com" in p.base_url
        assert p.rate_limit_delay == 3.0

    def test_instagram_config(self):
        p = PLATFORM_CONFIGS["instagram"]
        assert "instagram.com" in p.base_url
        assert p.rate_limit_delay == 2.0


class TestGetPlatform:
    def test_get_existing_platform(self):
        p = get_platform("twitter")
        assert p is not None
        assert p.name == "twitter"

    def test_get_platform_case_insensitive(self):
        p = get_platform("TWITTER")
        assert p is not None
        assert p.name == "twitter"

    def test_get_platform_mixed_case(self):
        p = get_platform("GitHub")
        assert p is not None
        assert p.name == "github"

    def test_get_nonexistent_platform_returns_none(self):
        result = get_platform("nonexistent_platform_xyz")
        assert result is None

    def test_get_all_platforms_count(self):
        platforms = get_all_platforms()
        assert len(platforms) == 8

    def test_get_all_platforms_names(self):
        platforms = get_all_platforms()
        names = [p.name for p in platforms]
        assert "twitter" in names
        assert "github" in names
        assert "linkedin" in names

    def test_get_all_platforms_returns_platform_configs(self):
        platforms = get_all_platforms()
        for p in platforms:
            assert isinstance(p, PlatformConfig)
            assert p.name
            assert p.base_url
            assert "{username}" in p.profile_url_template
            assert "{query}" in p.search_url_template
