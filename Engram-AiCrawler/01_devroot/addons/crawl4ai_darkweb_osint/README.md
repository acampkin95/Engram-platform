# Crawl4AI Dark Web OSINT Addon

A modular addon for dark web OSINT discovery and extraction, integrating Robin's 16 search engine aggregator with Crawl4AI's browser-based extraction capabilities.

## Features

- **16 Dark Web Search Engines**: Ahmia, OnionLand, Torgle, Amnesia, Kaizer, Anima, Tornado, TorNet, Torland, Find Tor, Excavator, Onionway, Tor66, OSS, Torgol, The Deep Searches
- **Tor SOCKS5 Proxy**: Full Tor integration with health checks and retry logic
- **LLM-Powered Analysis**: Query refinement and semantic filtering via LM Studio, Ollama, OpenAI, Anthropic, or Minimax
- **Browser-Based Extraction**: Crawl4AI Playwright extraction for .onion sites with JS rendering
- **4 Analysis Presets**: Threat Intel, Ransomware/Malware, Personal Identity, Corporate Espionage
- **Interactive Setup Wizard**: First-run configuration UI
- **Unified Dashboard**: Dark Web OSINT tab in the main Crawl4AI dashboard

## Installation

### 1. Drag & Drop

Simply copy this folder to the `addons/` directory in your Crawl4AI installation:

```bash
cp -r crawl4ai_darkweb_osint /path/to/crawl4ai/01_devroot/addons/
```

The addon will be auto-detected on startup.

### 2. Install Dependencies

```bash
pip install requests[socks] aiohttp pydantic tenacity
```

Optional dependencies:
```bash
# For LLM providers
pip install openai anthropic

# For Tor control
pip install stem
```

### 3. Tor Setup

Ensure Tor is running:

```bash
# macOS
brew install tor
brew services start tor

# Linux
sudo apt install tor
sudo systemctl start tor

# Docker
docker run -d -p 9050:9050 -p 9051:9051 --name tor dperson/tor
```

### 4. Run Setup Wizard

On first run, access the setup wizard via the UI or run:

```bash
python -m crawl4ai_darkweb_osint.setup_wizard
```

## Configuration

### Environment Variables

```bash
# Tor Proxy
DARKWEB_TOR_PROXY_HOST=127.0.0.1
DARKWEB_TOR_PROXY_PORT=9050
DARKWEB_TOR_CONTROL_PORT=9051

# LLM Provider (lmstudio, ollama, openai, anthropic, minimax)
DARKWEB_LLM_PROVIDER=lmstudio
DARKWEB_LLM_MODEL=glm-5
DARKWEB_LLM_BASE_URL=http://localhost:1234/v1

# Discovery
DARKWEB_DISCOVERY_MAX_RESULTS=50
DARKWEB_DISCOVERY_TIMEOUT=30
```

### Docker Configuration

Add to your `docker-compose.yml`:

```yaml
services:
  tor:
    image: dperson/tor
    ports:
      - "9050:9050"
      - "9051:9051"
    networks:
      - crawl4ai-network
```

## API Endpoints

### Discovery

```bash
# Search dark web
POST /api/darkweb/discover
{
  "query": "ransomware gang",
  "engines": ["ahmia", "onionland"],
  "max_results": 50
}

# Get engine status
GET /api/darkweb/engines/status
```

### Extraction

```bash
# Extract content from .onion URL
POST /api/darkweb/extract
{
  "url": "http://example.onion",
  "js_rendering": true,
  "screenshot": false
}

# Get extraction status
GET /api/darkweb/extract/status/{id}
```

### Analysis

```bash
# Analyze extracted content
POST /api/darkweb/analyze
{
  "content": "...",
  "preset": "threat_intel",
  "extract_artifacts": true
}

# Get report
GET /api/darkweb/report/{id}
```

## Usage Examples

### Python API

```python
from crawl4ai_darkweb_osint import (
    TorSession,
    get_discovery_engine,
    get_config
)

# Check Tor connection
async with TorSession() as session:
    is_connected = await session.check_connection()
    print(f"Tor connected: {is_connected}")

# Search dark web
DiscoveryEngine = get_discovery_engine()
engine = DiscoveryEngine()
results = await engine.search("threat intelligence")
```

### Command Line

```bash
# Check Tor connection
python -m crawl4ai_darkweb_osint.tor_proxy --check

# Run discovery
python -m crawl4ai_darkweb_osint.discovery.search "ransomware"

# Run setup wizard
python -m crawl4ai_darkweb_osint.setup_wizard
```

## Architecture

```
crawl4ai_darkweb_osint/
├── manifest.json          # Addon metadata
├── __init__.py            # Entry point
├── config.py              # Configuration management
├── tor_proxy.py           # Tor SOCKS5 integration
├── llm_providers.py       # LLM provider abstraction
├── setup_wizard.py        # Interactive setup
├── discovery/
│   ├── __init__.py
│   ├── search.py          # 16 search engines
│   ├── query_refine.py    # LLM query refinement
│   └── dedup.py           # Result deduplication
├── extraction/
│   ├── __init__.py
│   ├── tor_config.py      # Crawl4AI Tor config
│   ├── onion_strategy.py  # Onion extraction
│   └── cleaner.py         # Content cleaning
├── analysis/
│   ├── __init__.py
│   ├── presets.py         # 4 analysis presets
│   ├── artifacts.py       # Artifact extraction
│   └── report.py          # Report generation
├── api/
│   ├── __init__.py
│   ├── discovery.py       # Discovery endpoints
│   ├── extraction.py      # Extraction endpoints
│   └── analysis.py        # Analysis endpoints
└── ui/
    ├── __init__.py
    ├── dashboard.py       # Dashboard page
    └── components/        # React components
```

## Security Considerations

- **Never** disable Tor when accessing .onion sites
- **Never** store credentials in source code
- Use environment variables for API keys
- Rate limit requests to avoid IP bans
- Respect robots.txt and terms of service
- Be aware of legal implications in your jurisdiction

## Troubleshooting

### Tor Connection Issues

```bash
# Check if Tor is running
curl --socks5 127.0.0.1:9050 https://check.torproject.org/

# Check Tor control port
telnet 127.0.0.1 9051
```

### LLM Provider Issues

```bash
# Test LM Studio connection
curl http://localhost:1234/v1/models

# Test Ollama connection
curl http://localhost:11434/api/tags
```

### Search Engine Failures

Some engines may be temporarily unavailable. The addon handles failures gracefully and returns results from available engines.

## License

MIT License

## Credits

- Based on [Robin](https://github.com/apurvsinghgautam/robin) by Apurvsingh Gautam
- Powered by [Crawl4AI](https://github.com/unclecode/crawl4ai) by Unclecode
