"""
Dark web search engine aggregator.

Implements 16 search engines from Robin:
- Ahmia, OnionLand, Torgle, Amnesia
- Kaizer, Anima, Tornado, TorNet
- Torland, Find Tor, Excavator, Onionway
- Tor66, OSS, Torgol, The Deep Searches
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Any
from urllib.parse import quote_plus, urljoin

from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

from crawl4ai_darkweb_osint.config import get_config, DiscoveryConfig
from crawl4ai_darkweb_osint.tor_proxy import TorSession, create_tor_requests_session

logger = logging.getLogger(__name__)


class SearchEngineStatus(Enum):
    """Status of a search engine."""

    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    RATE_LIMITED = "rate_limited"
    ERROR = "error"


@dataclass
class SearchEngine:
    """Definition of a dark web search engine."""

    name: str
    display_name: str
    search_url: str
    result_selector: str
    title_selector: str = "a"
    link_selector: str = "a"
    description_selector: str = "p, span, div"
    requires_onion: bool = True
    status: SearchEngineStatus = SearchEngineStatus.AVAILABLE
    last_check: Optional[datetime] = None

    def build_search_url(self, query: str) -> str:
        """Build search URL for a query."""
        encoded_query = quote_plus(query)
        return self.search_url.replace("{QUERY}", encoded_query)


@dataclass
class SearchResult:
    """A single search result."""

    url: str
    title: str
    description: str
    engine: str
    rank: int
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def is_onion(self) -> bool:
        """Check if URL is an .onion address."""
        return ".onion" in self.url.lower()


# Define the 16 search engines from Robin
SEARCH_ENGINES: dict[str, SearchEngine] = {
    "ahmia": SearchEngine(
        name="ahmia",
        display_name="Ahmia",
        search_url="https://ahmia.fi/search/?q={QUERY}",
        result_selector="li.result",
        title_selector="h4 a",
        link_selector="h4 a",
        description_selector="p",
        requires_onion=False,  # Clearnet search for onion sites
    ),
    "onionland": SearchEngine(
        name="onionland",
        display_name="OnionLand",
        search_url="http://3bbad7fauom4d6sgppalyqddsqbf5u5p56b5k5uk2zxsy3d6ey2jobad.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "torgle": SearchEngine(
        name="torgle",
        display_name="Torgle",
        search_url="http://torgle.xyz/search.php?q={QUERY}",
        result_selector=".search-result",
        title_selector="a.title",
        link_selector="a.title",
        description_selector=".description",
    ),
    "amnesia": SearchEngine(
        name="amnesia",
        display_name="Amnesia",
        search_url="http://amnesia4qsqhc7f3kbfx5utdgv6ut5jjq6a7j6kqg7v3gcx4wbhqrid.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector=".description",
    ),
    "kaizer": SearchEngine(
        name="kaizer",
        display_name="Kaizer",
        search_url="http://kaizer4qbv5oj3fwxkwpnckvwhwrlmrax73q42p3lhcugod4wim4etad.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "anima": SearchEngine(
        name="anima",
        display_name="Anima",
        search_url="http://animawp3pmnycvxg4qtwi6xa3nnhistrym426bufnqozwkhdff3vcuqd.onion/search?q={QUERY}",
        result_selector=".search-result",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "tornado": SearchEngine(
        name="tornado",
        display_name="Tornado",
        search_url="http://tornadobsvzr3cwqgjwtbuikphxb7j5wv6kqdlh54nwgvwd5tpgceid.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a.title",
        link_selector="a.title",
        description_selector=".desc",
    ),
    "tornet": SearchEngine(
        name="tornet",
        display_name="TorNet",
        search_url="http://tornetnb4lwak7vhgd4zphmhkfz6vnkpucblzxsnefhlawmsbkkhoad.onion/search?q={QUERY}",
        result_selector=".result-item",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "torland": SearchEngine(
        name="torland",
        display_name="Torland",
        search_url="http://torland6x5y5z5x7t2h2v3s5h6j7s5d4f5g6h7j8k9l0m1n2b3v4c5x6z7a8b9c0d1e2.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "findtor": SearchEngine(
        name="findtor",
        display_name="Find Tor",
        search_url="http://findtorrxk5qe7pwj4lfow3x5vaktq2bzptvblmcymgkquz5dg4qngyd.onion/search?q={QUERY}",
        result_selector=".search-result",
        title_selector="a",
        link_selector="a",
        description_selector=".desc",
    ),
    "excavator": SearchEngine(
        name="excavator",
        display_name="Excavator",
        search_url="http://excavatorcb6qdnwjhkvxq2exawtybehbzv3jfltpscunfevqmw7c4lkyd.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "onionway": SearchEngine(
        name="onionway",
        display_name="Onionway",
        search_url="http://onionway4v7vmgfd4wkxqqw7m2k5mmnqe3jgwkxfjc3alrj2aeo4gqad.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector=".description",
    ),
    "tor66": SearchEngine(
        name="tor66",
        display_name="Tor66",
        search_url="http://tor66sezptdl2gbtcz7w4jpn3skd4kpwvsftrb5wizb4v4nx3irrr3ad.onion/search?q={QUERY}",
        result_selector=".search-result",
        title_selector="a",
        link_selector="a",
        description_selector=".description",
    ),
    "oss": SearchEngine(
        name="oss",
        display_name="OSS",
        search_url="http://ossovxq3e4anbknj7axod4fwqjw3avp7g752bqysjfmfbvjzwxl3dvad.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "torgol": SearchEngine(
        name="torgol",
        display_name="Torgol",
        search_url="http://torgol5kzqosmcik4c3v4mxhpq4qux2vntnlnmrk4qnnrctbvq5kcbqd.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector="p",
    ),
    "thedeepsearch": SearchEngine(
        name="thedeepsearch",
        display_name="The Deep Searches",
        search_url="http://thedeepsearch7o3gbtwlcjiqmzqgqksjss4pwsovtb4vgww7s5qcd4oyd.onion/search?q={QUERY}",
        result_selector=".result",
        title_selector="a",
        link_selector="a",
        description_selector=".description",
    ),
}


class DarkWebDiscoveryEngine:
    """
    Main class for dark web discovery.

    Aggregates results from multiple search engines via Tor.
    """

    def __init__(
        self,
        config: Optional[DiscoveryConfig] = None,
        engines: Optional[list[str]] = None,
    ):
        self.config = config or get_config().discovery
        self.engines = engines or self.config.engines
        self._engine_status: dict[str, SearchEngineStatus] = {}

    @property
    def available_engines(self) -> list[str]:
        """Get list of available engine names."""
        return [name for name, engine in SEARCH_ENGINES.items() if name in self.engines]

    async def search(
        self,
        query: str,
        engines: Optional[list[str]] = None,
        max_results: Optional[int] = None,
    ) -> list[SearchResult]:
        """
        Search across multiple dark web engines.

        Args:
            query: Search query
            engines: Override default engines
            max_results: Override max results per engine

        Returns:
            List of search results from all engines
        """
        engine_names = engines or self.engines
        max_per_engine = max_results or self.config.max_results_per_engine

        # Use async session for parallel requests
        all_results = []

        async with TorSession() as session:
            # Create tasks for parallel execution
            tasks = []
            for engine_name in engine_names:
                if engine_name in SEARCH_ENGINES:
                    task = self._search_engine(
                        session,
                        engine_name,
                        query,
                        max_per_engine,
                    )
                    tasks.append(task)

            # Run with semaphore to limit concurrency
            semaphore = asyncio.Semaphore(self.config.parallel_engines)

            async def limited_search(task):
                async with semaphore:
                    return await task

            results = await asyncio.gather(
                *[limited_search(t) for t in tasks],
                return_exceptions=True,
            )

            for result in results:
                if isinstance(result, list):
                    all_results.extend(result)
                elif isinstance(result, Exception):
                    logger.error(f"Search task failed: {result}")

        return all_results

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def _search_engine(
        self,
        session: TorSession,
        engine_name: str,
        query: str,
        max_results: int,
    ) -> list[SearchResult]:
        """Search a single engine."""
        engine = SEARCH_ENGINES.get(engine_name)
        if not engine:
            logger.warning(f"Unknown engine: {engine_name}")
            return []

        results = []

        try:
            url = engine.build_search_url(query)

            async with await session.get(url) as response:
                if response.status != 200:
                    self._engine_status[engine_name] = SearchEngineStatus.UNAVAILABLE
                    return []

                html = await response.text()
                results = self._parse_results(html, engine, max_results)
                self._engine_status[engine_name] = SearchEngineStatus.AVAILABLE

        except asyncio.TimeoutError:
            self._engine_status[engine_name] = SearchEngineStatus.ERROR
            logger.warning(f"Timeout searching {engine_name}")

        except Exception as e:
            self._engine_status[engine_name] = SearchEngineStatus.ERROR
            logger.error(f"Error searching {engine_name}: {e}")

        return results

    def _parse_results(
        self,
        html: str,
        engine: SearchEngine,
        max_results: int,
    ) -> list[SearchResult]:
        """Parse search results from HTML."""
        results = []

        try:
            soup = BeautifulSoup(html, "html.parser")
            result_elements = soup.select(engine.result_selector)

            for rank, elem in enumerate(result_elements[:max_results], 1):
                # Extract title
                title_elem = elem.select_one(engine.title_selector)
                title = title_elem.get_text(strip=True) if title_elem else "No title"

                # Extract link
                link_elem = elem.select_one(engine.link_selector)
                href = link_elem.get("href", "") if link_elem else ""

                # Handle relative URLs
                if href and not href.startswith(("http://", "https://")):
                    href = urljoin(engine.search_url.split("/search")[0], href)

                # Extract description
                desc_elem = elem.select_one(engine.description_selector)
                description = desc_elem.get_text(strip=True) if desc_elem else ""

                # Clean up description
                description = re.sub(r"\s+", " ", description)[:500]

                if href:
                    results.append(
                        SearchResult(
                            url=href,
                            title=title,
                            description=description,
                            engine=engine.name,
                            rank=rank,
                        )
                    )

        except Exception as e:
            logger.error(f"Error parsing results from {engine.name}: {e}")

        return results

    def get_engine_status(self) -> dict[str, dict[str, Any]]:
        """Get status of all configured engines."""
        status = {}

        for name in self.engines:
            engine = SEARCH_ENGINES.get(name)
            if engine:
                status[name] = {
                    "display_name": engine.display_name,
                    "status": self._engine_status.get(name, SearchEngineStatus.AVAILABLE).value,
                    "requires_onion": engine.requires_onion,
                }

        return status


# Sync wrapper for compatibility
def search_sync(
    query: str,
    engines: Optional[list[str]] = None,
    max_results: int = 50,
) -> list[SearchResult]:
    """
    Synchronous search function using requests.

    For use in non-async contexts.
    """
    config = get_config()
    engine_names = engines or config.discovery.engines
    all_results = []

    # Create requests session with Tor proxy
    session = create_tor_requests_session(
        host=config.tor.host,
        port=config.tor.port,
    )

    for engine_name in engine_names:
        engine = SEARCH_ENGINES.get(engine_name)
        if not engine:
            continue

        try:
            url = engine.build_search_url(query)
            response = session.get(url, timeout=config.discovery.timeout_per_engine)

            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                result_elements = soup.select(engine.result_selector)

                for rank, elem in enumerate(result_elements[:max_results], 1):
                    title_elem = elem.select_one(engine.title_selector)
                    title = title_elem.get_text(strip=True) if title_elem else "No title"

                    link_elem = elem.select_one(engine.link_selector)
                    href = link_elem.get("href", "") if link_elem else ""

                    desc_elem = elem.select_one(engine.description_selector)
                    description = desc_elem.get_text(strip=True) if desc_elem else ""

                    if href:
                        all_results.append(
                            SearchResult(
                                url=href,
                                title=title,
                                description=description,
                                engine=engine.name,
                                rank=rank,
                            )
                        )

        except Exception as e:
            logger.error(f"Error searching {engine_name}: {e}")

    return all_results


# CLI entry point
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Dark web search")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--engines", nargs="+", help="Engines to use")
    parser.add_argument("--max", type=int, default=10, help="Max results per engine")
    parser.add_argument("--status", action="store_true", help="Show engine status")

    args = parser.parse_args()

    async def main():
        engine = DarkWebDiscoveryEngine()

        if args.status:
            print(json.dumps(engine.get_engine_status(), indent=2))
        else:
            results = await engine.search(
                args.query,
                engines=args.engines,
                max_results=args.max,
            )

            for r in results:
                print(f"[{r.engine}] {r.title}")
                print(f"  {r.url}")
                print(f"  {r.description[:100]}...")
                print()

    asyncio.run(main())
