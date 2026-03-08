"""
Crawl4AI Tor configuration extensions.

Extends Crawl4AI's BrowserConfig and CrawlerRunConfig for Tor proxy support.
"""

from dataclasses import dataclass, field
from typing import Optional, Any


@dataclass
class TorBrowserConfig:
    """
    Browser configuration for Tor/Onion sites.

    Extends Crawl4AI's BrowserConfig with Tor-specific settings.
    """

    # Tor proxy settings
    tor_host: str = "127.0.0.1"
    tor_port: int = 9050
    tor_control_port: int = 9051

    # Browser settings
    headless: bool = True
    browser_type: str = "chromium"  # chromium, firefox, webkit
    viewport_width: int = 1920
    viewport_height: int = 1080

    # Timeouts (longer for Tor)
    page_timeout: int = 60000  # 60 seconds
    navigation_timeout: int = 90000  # 90 seconds

    # User agent (important for .onion sites)
    user_agent: Optional[str] = None

    # Security settings
    ignore_https_errors: bool = True  # Many .onion sites have self-signed certs
    accept_insecure_certs: bool = True

    # Performance
    disable_images: bool = True  # Faster loading
    disable_javascript: bool = False  # Keep JS for dynamic content
    text_mode: bool = False

    # Extra args
    extra_args: list[str] = field(default_factory=list)

    @property
    def proxy_config(self) -> dict[str, Any]:
        """Get proxy configuration for Playwright."""
        return {
            "server": f"socks5://{self.tor_host}:{self.tor_port}",
        }

    def to_playwright_launch_options(self) -> dict[str, Any]:
        """Convert to Playwright launch options."""
        args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--no-sandbox",
            "--disable-dev-shm-usage",
        ]

        if self.disable_images:
            args.append("--blink-settings=imagesEnabled=false")

        args.extend(self.extra_args)

        return {
            "headless": self.headless,
            "args": args,
            "proxy": self.proxy_config,
            "ignore_https_errors": self.ignore_https_errors,
        }

    def to_playwright_context_options(self) -> dict[str, Any]:
        """Convert to Playwright context options."""
        options = {
            "viewport": {
                "width": self.viewport_width,
                "height": self.viewport_height,
            },
            "ignore_https_errors": self.ignore_https_errors,
            "accept_downloads": False,  # Security for .onion
        }

        if self.user_agent:
            options["user_agent"] = self.user_agent

        return options


@dataclass
class TorCrawlerConfig:
    """
    Crawler run configuration for Tor/Onion sites.

    Extends Crawl4AI's CrawlerRunConfig with Tor-specific settings.
    """

    # Content settings
    word_count_threshold: int = 10
    excluded_tags: list[str] = field(
        default_factory=lambda: ["script", "style", "nav", "footer", "header", "aside"]
    )
    exclude_external_links: bool = True
    exclude_all_images: bool = True

    # Wait settings
    wait_for: Optional[str] = None  # CSS selector or JS expression
    wait_timeout: int = 30000  # 30 seconds
    delay_before_return: int = 1000  # 1 second

    # JavaScript
    js_code: Optional[str] = None
    wait_after_js: int = 2000

    # Screenshots/PDFs
    screenshot: bool = False
    pdf: bool = False

    # Caching
    cache_mode: str = "bypass"  # Don't cache .onion content by default

    # Session
    session_id: Optional[str] = None

    # Extraction
    extraction_strategy: Optional[str] = None

    def to_crawl4ai_config(self) -> dict[str, Any]:
        """Convert to Crawl4AI CrawlerRunConfig kwargs."""
        return {
            "word_count_threshold": self.word_count_threshold,
            "excluded_tags": self.excluded_tags,
            "exclude_external_links": self.exclude_external_links,
            "exclude_all_images": self.exclude_all_images,
            "wait_for": self.wait_for,
            "page_timeout": self.wait_timeout,
            "delay_before_return_html": self.delay_before_return / 1000,
            "js_code": self.js_code,
            "wait_for_js_complete": self.wait_after_js / 1000 if self.js_code else None,
            "screenshot": self.screenshot,
            "pdf": self.pdf,
            "cache_mode": self.cache_mode,
            "session_id": self.session_id,
        }


def create_tor_browser_config(
    tor_host: str = "127.0.0.1", tor_port: int = 9050, **kwargs
) -> TorBrowserConfig:
    """
    Factory function to create Tor browser configuration.

    Args:
        tor_host: Tor SOCKS proxy host
        tor_port: Tor SOCKS proxy port
        **kwargs: Additional configuration options

    Returns:
        TorBrowserConfig instance
    """
    return TorBrowserConfig(tor_host=tor_host, tor_port=tor_port, **kwargs)


def create_tor_crawler_config(wait_for: Optional[str] = None, **kwargs) -> TorCrawlerConfig:
    """
    Factory function to create Tor crawler configuration.

    Args:
        wait_for: CSS selector or JS expression to wait for
        **kwargs: Additional configuration options

    Returns:
        TorCrawlerConfig instance
    """
    return TorCrawlerConfig(wait_for=wait_for, **kwargs)


# User agents for Tor browsing (avoiding detection)
TOR_USER_AGENTS = [
    # Tor Browser default
    "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    # Generic browsers
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
]


def get_random_tor_user_agent() -> str:
    """Get a random user agent suitable for Tor browsing."""
    import random

    return random.choice(TOR_USER_AGENTS)
