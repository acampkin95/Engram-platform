<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# darkweb

## Purpose

Darkweb OSINT tools for Tor-based intelligence gathering. Includes breach database monitoring, cryptocurrency tracing, marketplace monitoring, entity correlation, and Tor crawler.

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker |
| `breach_scanner.py` | Scans breach databases (HaveIBeenPwned-style) for email/username |
| `crypto_tracer.py` | Traces cryptocurrency transactions and wallet activity |
| `marketplace_monitor.py` | Monitors darkweb marketplaces (Silk Road copies, forums) |
| `entity_correlator.py` | Links entities across breach databases and marketplaces |
| `tor_crawler.py` | Tor-aware web crawler for .onion sites |

## For AI Agents

### Working In This Directory

1. **Adding a breach source**: Extend `BreachScanner` with new data source connection.
2. **Adding a marketplace**: Create new module in this directory with marketplace-specific scraping logic.
3. **Tor routing**: Use `tor_crawler.py` for any .onion site access; respect Tor network load.

### Testing Requirements

- All breach scanner tests must use mock data (no live database access).
- Marketplace tests must use mocked HTTP responses.
- Crypto tracing tests must use mocked blockchain APIs.

### Common Patterns

- **Async HTTP**: Use aiohttp with Tor socks proxy for .onion access
- **Data normalization**: Convert breach/marketplace data to common schema
- **Error handling**: Gracefully handle Tor connection failures, timeouts
- **Rate limiting**: Respect marketplace and Tor network rate limits

## Dependencies

### Internal
- `app.osint` — Alias discovery, semantic tracking

### External
- Tor proxy (socks5://127.0.0.1:9050)
- Breach database APIs (HaveIBeenPwned, Abuse.ch, etc.)
- Blockchain APIs (for crypto tracing)
- Tor-accessible marketplaces

<!-- MANUAL: -->
