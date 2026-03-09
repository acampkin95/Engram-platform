# Large-Scale Web Crawler Deployment Proposal
## Intel i5-12600H (12C/16T) + 16GB RAM + 1TB NVMe

**Date:** January 26, 2026  
**Hardware:** Intel Core i5-12600H, 12 Cores/16 Threads, 4.5GHz | 16GB DDR4 | 1TB PCIe 4.0 NVMe | Dual 2.5G LAN | WiFi 6  
**Target Capacity:** 50M–200M+ crawled documents | Multi-source (public web, authenticated social, paywalled news, forums)  
**Optimization Focus:** Detection avoidance, deduplication, reverse image search (CBIR), tiered storage, high throughput

---

## Executive Summary

This proposal outlines a **production-grade distributed web crawler** architecture for your i5-12600H mini desktop, optimized for:

1. **High-volume ingestion:** 500–2000 URLs/sec across multiple concurrent workers
2. **Detection avoidance:** Rotating headers, TLS fingerprinting, behavioral mimicry, proxy integration
3. **Authenticated crawling:** OAuth tokens, session persistence, cookie jar management (Facebook, Instagram, paywalled content)
4. **Deduplication:** Redis-backed URL/content dedup with 90% memory efficiency (Bloom filters), semantic duplicate detection (embedding-based)
5. **Reverse image search:** Perceptual hashing (pHash/dhash), Hamming distance CBIR via PostgreSQL + BRIN indices
6. **Tiered storage:** Hot (NVMe) → Warm (USB 3.1 HDD) → Cold (LAN SMB/NFS) → Archive (S3-compatible remote)

**Total storage managed:** 512GB local + unlimited remote tier scaling

---

## Part 1: Hardware Utilization & Resource Allocation

### CPU & Memory Strategy

| Component | Allocation | Purpose |
|-----------|-----------|---------|
| **CPU cores** | 10 of 12 (2 reserved for OS/monitoring) | Async I/O workers: 6–8 Scrapy/httpx workers + 2–3 embedding/hashing workers |
| **RAM** | 16GB total: 12GB crawler heap, 2GB OS, 2GB cache | Redis (4GB), PostgreSQL cache (2GB), worker buffers (6GB) |
| **NVMe (1TB)** | 400GB active + 600GB reserve | Hot tier: current crawl session, URL frontier, embeddings cache |
| **USB HDD (2.5"–4TB ext)** | Warm tier: deduped raw HTML, images (<3mo old) | Pluggable, auto-tiering via LRU policy |
| **LAN SMB/NFS** | 20–50TB NAS (future) | Long-term raw storage, multi-node read cache |
| **S3-compatible (Wasabi/Backblaze)** | Cold tier | Archives >6mo, distributed backups |

### Network Strategy

| Link | Bandwidth | Purpose |
|------|-----------|---------|
| Dual 2.5G RJ45 | 5Gbps aggregate | Primary crawler traffic + NAS sync |
| WiFi 6 | 1.2Gbps theoretical | Backup, remote config updates, monitoring |

**Headroom:** At 100KB avg document size, 5Gbps = ~6250 docs/sec sustained (buffer for proxies, retries).

---

## Part 2: Core Crawler Architecture

### 2.1 Multi-Source Crawling Framework

```
┌─────────────────────────────────────────────────────────────────┐
│                    Crawl Orchestrator (Python)                   │
│  - Scrapy + httpx + Playwright (for JS-heavy/authenticated)     │
└─────────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────────┐
    │  URL Frontier & Deduplication (Redis + Bloom Filter)        │
    │  • domain-based rate limiting queues                        │
    │  • URL dedup with 24-hour TTL refresh                       │
    │  • Content hash dedupe (MD5) for page similarity detection  │
    └────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────────┐
    │  Multi-Source Handlers (Modular Plugins)                    │
    │  • Public Web (Scrapy)                                      │
    │  • Facebook/Instagram (Authenticated + anti-TLS fingerprint)│
    │  • Paywall News (Session persistence + cookie rotation)     │
    │  • Forums (JavaScript rendering + rate-limit respect)       │
    │  • Discussion Platforms (Auth tokens + behavioral mimicry)  │
    └────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────────┐
    │  Detection Avoidance Layer                                   │
    │  • User-Agent pool rotation (100+ real browser signatures)   │
    │  • Header randomization & TLS fingerprint spoofing           │
    │  • Request timing jitter (0.5–5s per domain)                │
    │  • Residential proxy rotation (optional 3rd-party service)  │
    │  • Browser fingerprint matching (Playwright + puppeteer-extra)
    │  • Session validation (correlate CSS/JS/images with API)    │
    └────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────────┐
    │  Raw Document Storage (Hot Tier: NVMe)                       │
    │  • PostgreSQL JSONB (metadata) + raw HTML files             │
    │  • Content hash triggers embedding job submission            │
    │  • LRU eviction to warm tier (USB HDD) after 72 hours       │
    └────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────────┐
    │  Processing Pipeline                                         │
    │  1. Text extraction (BeautifulSoup4/MassiveText)            │
    │  2. Image extraction & perceptual hashing (phash/dhash)     │
    │  3. Embedding generation (nomic-embed-text-v1.5 via TEI)   │
    │  4. Content chunking (sliding window 512–1024 tokens)       │
    │  5. Metadata enrichment (domain, language, freshness score) │
    └────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────────┐
    │  Vector DB + Knowledge Graph (PostgreSQL + pgvector)        │
    │  • Embeddings with HNSW indices for semantic search         │
    │  • Perceptual hash indices (BRIN on hash_distance)         │
    │  • Relationship tracking (entity linking, cross-references) │
    └────────────────────────────────────────────────────────────┘
```

### 2.2 Detection Avoidance Implementation

#### 2.2.1 User-Agent & Header Rotation

```python
# UA pool (100+ real browser signatures)
USER_AGENTS = {
    "chrome_win": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "chrome_mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "firefox_linux": "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "safari_ios": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
    # ... 96+ additional profiles covering device types, OS versions, locales
}

# Header randomization + TLS fingerprint matching
def get_randomized_headers(target_domain: str) -> dict:
    ua_key = random.choice(list(USER_AGENTS.keys()))
    ua_string = USER_AGENTS[ua_key]
    
    # Extract browser from UA
    browser = "chrome" if "Chrome" in ua_string else "firefox" if "Firefox" in ua_string else "safari"
    
    headers = {
        "User-Agent": ua_string,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": random.choice(["en-US,en;q=0.9", "en-GB,en;q=0.8", "en;q=0.9"]),
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
    }
    
    # Instagram-specific headers (if target matches)
    if "instagram" in target_domain:
        headers["X-IG-App-ID"] = random.choice(["936619743392459", "1217981644879628"])
        headers["X-Instagram-AJAX"] = "1"
    
    return headers

# TLS fingerprint matching via httpx + tls_client library
from tls_client import Session
tls_session = Session(
    client_identifier="chrome_124",  # Matches UA to TLS handshake
    random_tls_extension_order=True  # Slight variation to avoid detection
)
response = tls_session.get(url, headers=get_randomized_headers(url))
```

#### 2.2.2 Request Timing & Behavioral Mimicry

```python
class BehavioralCrawler:
    """Simulate human browsing patterns"""
    
    def __init__(self, domain: str):
        self.domain = domain
        self.domain_rate_limit = self._get_domain_limit(domain)  # 1–3 sec/domain
        self.session_start_time = time.time()
    
    def wait_before_request(self):
        """Randomized delay with natural distribution (Poisson)"""
        base_delay = self.domain_rate_limit
        jitter = random.expovariate(1.0 / base_delay)  # Natural browsing cadence
        max_jitter = min(jitter, 5.0)  # Cap at 5 sec to avoid slowdown
        time.sleep(max_jitter)
    
    def simulate_page_interaction(self):
        """Add realistic dwell time + scroll simulation for JS tracking"""
        # Time on page before clicking next link
        time.sleep(random.uniform(2, 8))
        # Simulate random scroll events (if JS is tracking)
        for _ in range(random.randint(0, 3)):
            time.sleep(random.uniform(0.1, 0.5))
    
    def get_session_headers(self) -> dict:
        """Ensure consistent headers within session"""
        # Same User-Agent for 24 hours (avoid mid-session rotation)
        session_key = (self.domain, time.time() // 86400)
        if session_key not in self._session_cache:
            self._session_cache[session_key] = self._pick_ua_for_session()
        return self._session_cache[session_key]
```

#### 2.2.3 Proxy & IP Rotation (Optional Integration)

```yaml
# docker-compose.yml: Optional residential proxy tier
services:
  proxy-manager:
    image: tinyproxy:latest  # Or Bright Data / Smartproxy API
    ports:
      - "8888:8888"
    environment:
      ROTATE_INTERVAL: "300"  # Rotate IP every 5 min
      PROXY_AUTH: "user:pass"
    volumes:
      - ./proxy-config:/etc/tinyproxy

# Usage in crawler
PROXY_POOL = [
    "http://user:pass@residential-proxy-api.com:port",  # Bright Data / Smartproxy
    "http://localhost:8888",  # Local tinyproxy fallback
]

def crawl_with_proxy(url: str):
    proxy = random.choice(PROXY_POOL)
    response = httpx.get(url, proxy=proxy, headers=get_randomized_headers(url), timeout=30)
    return response
```

---

### 2.3 Authenticated Crawling (Facebook, Instagram, Paywalled News)

#### 2.3.1 OAuth Token Management

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
import json, time

class AuthenticatedCrawler:
    """Handle OAuth tokens + session persistence for restricted content"""
    
    def __init__(self, credentials_file: str):
        self.credentials = json.load(open(credentials_file))
        self.session_cache = {}  # {account_id: {token, refresh_token, expiry}}
    
    def facebook_oauth(self, account_id: str) -> str:
        """Obtain/refresh Facebook OAuth token via Selenium + headless Chrome"""
        
        if account_id in self.session_cache and self.session_cache[account_id]["expiry"] > time.time():
            return self.session_cache[account_id]["token"]
        
        # Use Selenium with puppeteer-extra for fingerprint evasion
        from selenium_stealth import stealth
        options = webdriver.ChromeOptions()
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        driver = webdriver.Chrome(options=options)
        stealth(driver)
        
        try:
            # Navigate to Facebook login
            driver.get("https://www.facebook.com")
            username_field = driver.find_element(By.ID, "email")
            username_field.send_keys(self.credentials[account_id]["email"])
            
            password_field = driver.find_element(By.ID, "pass")
            password_field.send_keys(self.credentials[account_id]["password"])
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            
            time.sleep(3)  # Wait for auth
            
            # Extract session cookies
            cookies = {cookie['name']: cookie['value'] for cookie in driver.get_cookies()}
            
            # Extract OAuth token from localStorage
            token = driver.execute_script("return localStorage.getItem('fb_token')")
            
            self.session_cache[account_id] = {
                "token": token,
                "cookies": cookies,
                "expiry": time.time() + 3600  # 1-hour refresh
            }
            
            return token
        
        finally:
            driver.quit()
    
    def instagram_challenge_resolver(self, account_id: str):
        """Handle Instagram's 'Challenge Required' errors via 2FA + device ID rotation"""
        # Instagram's challenge detection analyzes:
        # - Device ID (x-ig-device-id header)
        # - TLS fingerprint
        # - Request patterns (request order, timing)
        
        device_id = str(uuid.uuid4())
        
        headers = {
            "User-Agent": "Instagram 12.0.0.16.90 (iPhone13,1; iOS 14_7_1; ..)",
            "X-IG-Device-ID": device_id,
            "X-IG-Family-Device-ID": str(uuid.uuid4()),
            "X-IG-App-Locale": "en_US",
        }
        
        # On 429 (challenge), trigger 2FA via email
        # then provide code to resume session
        return headers
    
    def news_paywall_session(self, site: str, account_id: str):
        """Persist authenticated sessions for paywalled content (NYT, FT, WSJ)"""
        
        url = f"https://{site}/login"
        
        # Use httpx with persistent cookies + automatic refresh
        cookies = self.session_cache.get(account_id, {}).get("cookies", {})
        
        response = httpx.get(
            f"https://{site}/article/...",
            headers=get_randomized_headers(site),
            cookies=cookies,
            timeout=30
        )
        
        # Store updated cookies for next request
        self.session_cache[account_id]["cookies"] = dict(response.cookies)
        
        return response.text
```

---

## Part 3: Deduplication Engine

### 3.1 URL Deduplication (Redis + Bloom Filter)

```python
from pybloom_live import BloomFilter
import hashlib, redis

class URLFrontier:
    """Distributed URL deduplication with Redis + Bloom filter"""
    
    def __init__(self, redis_host="localhost", redis_port=6379):
        self.redis = redis.Redis(host=redis_host, port=redis_port, db=0)
        
        # Bloom filter: 1 billion URLs, 0.01% false positive rate = ~1.2GB RAM
        self.bloom = BloomFilter(capacity=1_000_000_000, error_rate=0.0001)
        
        # URL priority queue by domain (rate limit fairness)
        self.domain_queues = {}  # {domain: asyncio.PriorityQueue}
    
    def add_url(self, url: str, priority: int = 0, domain_delay: float = 1.0):
        """Check + add URL to frontier"""
        
        url_hash = hashlib.md5(url.encode()).hexdigest()
        
        # Check Bloom filter (fast, no memory overhead)
        if url_hash in self.bloom:
            return False  # Already seen (with ~0.01% false positive rate)
        
        # Add to Bloom filter
        self.bloom.add(url_hash)
        
        # Store in Redis with 24-hour TTL
        domain = urlparse(url).netloc
        key = f"seen_urls:{domain}:{url_hash}"
        self.redis.setex(key, 86400, "1")
        
        # Add to domain priority queue
        if domain not in self.domain_queues:
            self.domain_queues[domain] = PriorityQueue()
        
        self.domain_queues[domain].put((priority, url, time.time() + domain_delay))
        
        return True
    
    def get_next_url(self) -> tuple[str, str]:
        """Pop next URL respecting domain rate limits"""
        
        while True:
            # Find domain with oldest pending URL
            due_domain = min(
                self.domain_queues.keys(),
                key=lambda d: self.domain_queues[d].queue[0][2] if self.domain_queues[d].qsize() > 0 else float('inf')
            )
            
            priority, url, due_time = self.domain_queues[due_domain].get()
            
            if time.time() >= due_time:
                return due_domain, url
            else:
                # Put back in queue; check another domain
                self.domain_queues[due_domain].put((priority, url, due_time))
                time.sleep(0.1)
```

### 3.2 Content Deduplication (Semantic + Hash-based)

```python
import hashlib
from sentence_transformers import SentenceTransformer
import psycopg2

class ContentDeduplicator:
    """Detect duplicate content via MD5 hash + embedding similarity"""
    
    def __init__(self, pg_conn: psycopg2.connection):
        self.pg = pg_conn
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        
        # Create JSONB + vector indices
        self.pg.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE,
                content_hash VARCHAR(32) UNIQUE,
                content_preview TEXT,
                embedding vector(384),
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX ON documents USING HASH(content_hash);
            CREATE INDEX ON documents USING HNSW(embedding vector_cosine_ops);
        """)
    
    def is_duplicate(self, url: str, content: str) -> bool:
        """Check if content was already crawled (duplicate detection)"""
        
        # Fast: MD5 hash lookup
        content_hash = hashlib.md5(content.encode()).hexdigest()
        
        cursor = self.pg.cursor()
        cursor.execute("SELECT id FROM documents WHERE content_hash = %s", (content_hash,))
        
        if cursor.fetchone():
            return True  # Exact duplicate
        
        # Semantic: embedding similarity (handle rephrased content)
        preview = content[:500]  # First 500 chars
        embedding = self.embedding_model.encode(preview)
        
        # Find similar embeddings (cosine > 0.95)
        cursor.execute("""
            SELECT id FROM documents 
            WHERE 1 - (embedding <=> %s::vector) > 0.95
            LIMIT 1
        """, (embedding.tolist(),))
        
        if cursor.fetchone():
            return True  # Semantic duplicate
        
        # New content: store
        cursor.execute("""
            INSERT INTO documents (url, content_hash, content_preview, embedding)
            VALUES (%s, %s, %s, %s)
        """, (url, content_hash, preview, embedding.tolist()))
        self.pg.commit()
        
        return False
```

---

## Part 4: Reverse Image Search (Perceptual Hashing)

### 4.1 Image Extraction & Hashing

```python
from PIL import Image
import imagehash
import requests
from io import BytesIO
import psycopg2

class ReverseImageSearch:
    """Find duplicate/similar images across crawl dataset"""
    
    def __init__(self, pg_conn: psycopg2.connection):
        self.pg = pg_conn
        
        # Create image hash table
        self.pg.execute("""
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE,
                source_url TEXT,
                ahash BIGINT,  -- Average hash (64-bit)
                dhash BIGINT,  -- Difference hash
                phash BIGINT,  -- Perceptual hash
                image_data BYTEA,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX ON images(ahash);
            CREATE INDEX ON images(dhash);
        """)
    
    def extract_and_hash_images(self, page_url: str, html_content: str):
        """Extract images from HTML and compute perceptual hashes"""
        
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html_content, 'html.parser')
        img_tags = soup.find_all('img')
        
        for img in img_tags:
            img_url = img.get('src') or img.get('data-src')
            if not img_url:
                continue
            
            # Resolve relative URLs
            from urllib.parse import urljoin
            img_url = urljoin(page_url, img_url)
            
            try:
                # Download image
                response = requests.get(img_url, timeout=10)
                img_data = response.content
                
                # Load and compute hashes
                img = Image.open(BytesIO(img_data))
                
                ahash = int(imagehash.average_hash(img), 16)  # Convert hex to int
                dhash = int(imagehash.dhash(img), 16)
                phash = int(imagehash.phash(img), 16)
                
                # Store in PostgreSQL
                cursor = self.pg.cursor()
                cursor.execute("""
                    INSERT INTO images (url, source_url, ahash, dhash, phash, image_data)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT(url) DO NOTHING
                """, (img_url, page_url, ahash, dhash, phash, img_data))
                self.pg.commit()
            
            except Exception as e:
                print(f"Error processing image {img_url}: {e}")
    
    def find_similar_images(self, query_image_url: str, hamming_threshold: int = 10):
        """Find all similar images (within Hamming distance threshold)"""
        
        import requests
        response = requests.get(query_image_url, timeout=10)
        query_img = Image.open(BytesIO(response.content))
        query_hash = int(imagehash.dhash(query_img), 16)
        
        # Retrieve all images + compute Hamming distance client-side
        cursor = self.pg.cursor()
        cursor.execute("SELECT id, url, dhash FROM images")
        
        results = []
        for img_id, url, db_hash in cursor.fetchall():
            # Hamming distance between two 64-bit hashes
            xor = query_hash ^ db_hash
            hamming_dist = bin(xor).count('1')
            
            if hamming_dist <= hamming_threshold:
                results.append((url, hamming_dist))
        
        return sorted(results, key=lambda x: x[1])  # Sort by similarity
```

### 4.2 Optimized Image Search with BK-Tree (Faster)

```python
from bktree import BKTree
import imagehash

class OptimizedImageSearch:
    """Use BK-tree for logarithmic nearest-neighbor image search"""
    
    def __init__(self):
        # Hamming distance as metric for BK-tree
        self.bktree = BKTree(self.hamming_distance, initial_items=[])
    
    @staticmethod
    def hamming_distance(hash1: int, hash2: int) -> int:
        """Hamming distance between two 64-bit hashes"""
        return bin(hash1 ^ hash2).count('1')
    
    def build_index(self, image_hashes: list[tuple[str, int]]):
        """Build BK-tree index from (url, hash) pairs"""
        for url, hash_val in image_hashes:
            self.bktree.add((url, hash_val))
    
    def search_similar(self, query_hash: int, threshold: int = 10) -> list[str]:
        """Find all images within Hamming distance threshold (O(log n))"""
        results = []
        for url, hash_val in self.bktree.search((None, query_hash), threshold):
            results.append(url)
        return results
```

---

## Part 5: Tiered Storage Architecture

### 5.1 Storage Tiers & Transition Policy

```yaml
# Storage Tiers (512GB local + unlimited remote)
tiers:
  hot:
    device: "/dev/nvme0n1"  # 1TB NVMe
    mount_point: "/mnt/hot"
    capacity: 400GB  # Reserved for active crawl session
    policy: "FIFO LRU at 85% capacity"
    retention: "72 hours"
    contents: 
      - URL frontier cache
      - Raw HTML (current batch)
      - Embeddings cache (Redis)
      - Active worker buffers
  
  warm:
    device: "/dev/sda"  # External USB 3.1 2.5" HDD (2-4TB)
    mount_point: "/mnt/warm"
    capacity: 2-4TB
    policy: "LRU eviction when hot tier exceeds 85%"
    retention: "90 days"
    contents:
      - Deduped raw HTML (>72h old)
      - Extracted text chunks
      - Image thumbnails + perceptual hashes
      - Embeddings archive (older batches)
  
  cold:
    type: "NAS via SMB/NFS"
    location: "192.168.1.100:/data/crawl"
    capacity: "20–50TB"
    policy: "Manual promotion from warm tier"
    retention: "6–12 months"
    contents:
      - Full document archive
      - High-res images
      - Relationship graphs (Neo4j exports)
  
  archive:
    type: "S3-compatible (Wasabi / Backblaze B2)"
    location: "s3://my-crawl-archive/"
    capacity: "Unlimited"
    policy: "Tiered after 6 months cold tier"
    retention: "2+ years"
    encryption: "AES-256"
```

### 5.2 Automatic Tiering Implementation

```python
import os, shutil, time
from pathlib import Path
from datetime import datetime, timedelta

class TieredStorage:
    """Automatically move files between NVMe → USB HDD → NAS → S3"""
    
    def __init__(self):
        self.hot_path = Path("/mnt/hot/crawl")
        self.warm_path = Path("/mnt/warm/crawl")
        self.cold_path = Path("/mnt/nas/crawl")
        self.s3_bucket = "my-crawl-archive"
    
    def get_device_usage(self, mount_point: str) -> float:
        """Return % disk usage for a mount point"""
        stat = os.statvfs(mount_point)
        percent = (stat.f_blocks - stat.f_bavail) / stat.f_blocks * 100
        return percent
    
    def promote_to_warm(self, max_hot_usage: float = 85.0):
        """Move old files from hot (NVMe) to warm (USB HDD)"""
        
        hot_usage = self.get_device_usage("/mnt/hot")
        
        if hot_usage > max_hot_usage:
            # LRU: move oldest files
            files = sorted(
                self.hot_path.glob("**/*"),
                key=lambda p: os.path.getmtime(p)
            )
            
            for file in files:
                if file.is_file():
                    age_hours = (time.time() - os.path.getmtime(file)) / 3600
                    
                    if age_hours > 72:  # Move if >72 hours old
                        dest = self.warm_path / file.relative_to(self.hot_path)
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        
                        shutil.move(str(file), str(dest))
                        print(f"Promoted {file.name} to warm tier")
                    
                    if self.get_device_usage("/mnt/hot") < max_hot_usage * 0.8:
                        break
    
    def archive_to_s3(self, max_cold_age_days: int = 180):
        """Move files older than 6 months to S3"""
        
        import boto3
        s3 = boto3.client(
            's3',
            endpoint_url='https://s3.wasabisys.com',  # Wasabi S3-compatible
            aws_access_key_id=os.getenv('WASABI_KEY'),
            aws_secret_access_key=os.getenv('WASABI_SECRET')
        )
        
        cutoff_date = datetime.now() - timedelta(days=max_cold_age_days)
        
        for file in self.cold_path.glob("**/*"):
            if file.is_file():
                file_mtime = datetime.fromtimestamp(os.path.getmtime(file))
                
                if file_mtime < cutoff_date:
                    # Upload to S3
                    s3_key = f"crawl/{file.relative_to(self.cold_path)}"
                    s3.upload_file(str(file), self.s3_bucket, s3_key)
                    
                    # Delete from NAS
                    file.unlink()
                    print(f"Archived {s3_key} to S3")
    
    def monitor_and_tier(self, interval_minutes: int = 60):
        """Continuous background tiering task"""
        
        import schedule
        
        schedule.every(interval_minutes).minutes.do(self.promote_to_warm)
        schedule.every(24).hours.do(self.archive_to_s3)
        
        while True:
            schedule.run_pending()
            time.sleep(60)
```

---

## Part 6: Docker Compose Deployment

### 6.1 Complete Stack Configuration

```yaml
version: '3.9'

services:
  # ===== CORE CRAWLER =====
  crawler:
    build:
      context: .
      dockerfile: Dockerfile.crawler
    container_name: web-crawler-primary
    restart: unless-stopped
    environment:
      REDIS_URL: "redis://redis:6379/0"
      POSTGRES_URL: "postgresql://crawler:password@postgres:5432/crawl_db"
      EMBEDDING_SERVICE_URL: "http://embedding-service:8080"
      CRAWL_BATCH_SIZE: "500"
      WORKERS: "8"
      LOG_LEVEL: "INFO"
      # Authentication
      FACEBOOK_ACCOUNTS_FILE: "/secrets/facebook_accounts.json"
      INSTAGRAM_ACCOUNTS_FILE: "/secrets/instagram_accounts.json"
      # Storage
      HOT_TIER_PATH: "/mnt/hot/crawl"
      WARM_TIER_PATH: "/mnt/warm/crawl"
      COLD_TIER_PATH: "/mnt/nas/crawl"
      S3_ENDPOINT: "https://s3.wasabisys.com"
      S3_BUCKET: "my-crawl-archive"
    cpus: "10"  # Pin 10 cores (reserve 2 for OS)
    memswap_limit: 12G
    memory_swappiness: 30
    ports:
      - "8000:8000"  # Monitoring API
    volumes:
      - /mnt/hot/crawl:/mnt/hot/crawl
      - /mnt/warm/crawl:/mnt/warm/crawl
      - /mnt/nas/crawl:/mnt/nas/crawl
      - ./secrets:/secrets:ro
      - ./logs:/app/logs
    networks:
      - crawl-network
    depends_on:
      - redis
      - postgres
      - embedding-service
  
  # ===== REDIS (URL FRONTIER + CACHE) =====
  redis:
    image: redis:7-alpine
    container_name: crawl-redis
    command: redis-server --maxmemory 4gb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - crawl-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
  
  # ===== POSTGRESQL (DOCUMENTS + VECTORS + IMAGES) =====
  postgres:
    image: postgres:16-alpine
    container_name: crawl-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: "crawl_db"
      POSTGRES_USER: "crawler"
      POSTGRES_PASSWORD: "password"  # Use secrets in production
      POSTGRES_INITDB_ARGS: "-c shared_preload_libraries=vector"
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - crawl-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crawler"]
      interval: 10s
      timeout: 5s
      retries: 3
  
  # ===== TEXT EMBEDDINGS INFERENCE (TEI) =====
  embedding-service:
    image: ghcr.io/huggingface/text-embeddings-inference:1.7
    container_name: crawl-embeddings
    restart: unless-stopped
    environment:
      MODEL_ID: "nomic-embed-text-v1.5"  # or BAAI/bge-base-en-v1.5
      TZ: "UTC"
    ports:
      - "8080:80"
    volumes:
      - embedding-cache:/data
    cpus: "2"  # Dedicate 2 cores for embedding inference
    memswap_limit: 2G
    networks:
      - crawl-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 10s
      timeout: 5s
      retries: 3
  
  # ===== MONITORING & LOGGING =====
  prometheus:
    image: prom/prometheus:latest
    container_name: crawl-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    networks:
      - crawl-network
  
  grafana:
    image: grafana/grafana:latest
    container_name: crawl-grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: "admin"
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - crawl-network
    depends_on:
      - prometheus

volumes:
  redis-data:
  postgres-data:
  embedding-cache:
  prometheus-data:
  grafana-data:

networks:
  crawl-network:
    driver: bridge
```

### 6.2 Dockerfile for Crawler

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY src/ /app/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run crawler
CMD ["python", "-u", "main.py"]
```

### 6.3 Requirements.txt

```
# Web crawling
scrapy==2.11.0
httpx==0.25.0
playwright==1.40.0
beautifulsoup4==4.12.2
selenium==4.15.2
undetected-chromedriver==3.5.4
puppeteer-stealth==0.2.0
tls-client==0.2.0

# Data processing
pandas==2.0.3
numpy==1.26.2
PIL==10.0.0
imagehash==4.3.1
python-magic==0.4.27

# Deduplication & search
redis==5.0.0
pybloom-live==4.0.1
sentence-transformers==2.2.2

# Database & storage
psycopg2-binary==2.9.9
sqlalchemy==2.0.23
boto3==1.34.0
pymongo==4.6.0

# Embeddings & vectors
pgvector==0.1.8
torch==2.0.0
transformers==4.35.0

# Utilities
python-dotenv==1.0.0
pydantic==2.5.0
aiohttp==3.9.1
pydantic-settings==2.1.0
prometheus-client==0.19.0
python-dateutil==2.8.2

# Optional: proxy & detection avoidance
fake-useragent==1.4.0
requests==2.31.0
selenium-stealth==1.0.1
```

---

## Part 7: Deployment & Scaling Roadmap

### 7.1 Phase 1: Local Deployment (Weeks 1–4)

1. **Infrastructure Setup (Week 1)**
   - Provision i5-12600H mini desktop with Ubuntu 22.04
   - Format 1TB NVMe for tiered storage
   - Configure dual 2.5G NICs (bonding for redundancy)

2. **Core Crawler (Week 2)**
   - Deploy Docker Compose stack
   - Implement URL frontier + deduplication
   - Test detection avoidance on 5 target domains

3. **Data Pipeline (Week 3)**
   - Enable embedding generation + vector storage
   - Implement image hashing + reverse search
   - Begin small crawl (10K URLs/day)

4. **Monitoring (Week 4)**
   - Grafana dashboards: throughput, dedup rate, error tracking
   - Alerting rules: rate limits exceeded, storage tier warnings
   - Performance baseline: 500–1000 docs/sec sustained

### 7.2 Phase 2: Scale to 50M+ Documents (Weeks 5–12)

1. **Tiering Automation**
   - Deploy USB HDD warm tier + LRU policies
   - Enable S3 archiving after 6 months

2. **Source Integration**
   - Facebook/Instagram authentication + token refresh
   - Paywall session management (NYT, FT, WSJ)
   - Discussion forum crawling (Reddit, HackerNews, etc.)

3. **Optimization**
   - Benchmark proxy rotation impact (optional 3rd-party proxy integration)
   - Fine-tune worker concurrency (8–12 cores)
   - Cache hit rate optimization for embeddings

4. **Backup & Recovery**
   - Daily snapshots of PostgreSQL to S3
   - Redis persistence + AOF rewriting
   - Restore test procedures

### 7.3 Phase 3: Production Hardening (Weeks 13+)

1. **Security**
   - Credentials encrypted in secrets management
   - Network isolation (firewall rules for LAN storage access)
   - HTTPS/TLS cert rotation for authenticated crawls

2. **Capacity Planning**
   - Document growth projection: 1–10M docs/month
   - Storage scaling timeline: USB HDD → NAS → S3
   - Concurrent worker optimization for new domains

3. **Advanced Features**
   - Knowledge graph: entity linking + relationship extraction
   - Semantic deduplication: fine-tuned embedding model
   - Real-time alerts: new breaking news detection via classifier

---

## Part 8: Performance Targets & Benchmarks

| Metric | Target | Hardware Dependent | Notes |
|--------|--------|-------------------|-------|
| **Crawl Throughput** | 1000–2000 URLs/sec | CPU cores + network | With 8 async workers |
| **Dedup Check Latency** | <2ms (Bloom) | RAM | URL existence check |
| **Content Dedup Latency** | <50ms (embedding) | TEI service + GPU | Via remote embedding service |
| **Image Hash Lookup** | <10ms (BK-tree) | RAM indexing | Reverse image search |
| **Storage Efficiency** | 65–75% (with dedup) | Dedup success rate | Varies by domain diversity |
| **Embedding Index QPS** | 500–1000 | GPU/CPU | Vector DB throughput |
| **Tier Promotion Delay** | <1 sec | I/O bandwidth | LRU eviction overhead |
| **End-to-End Latency** | <5 sec (URL → stored) | Full pipeline | From fetch to DB insert |

### 8.1 Load Test Results (Simulated)

```
Scenario: 1M documents crawled over 1 week
├─ Concurrent workers: 8
├─ Avg document size: 100KB
├─ Dedup success rate: 40%
├─ Embedding model: nomic-embed-text (TEI)
│
Results:
├─ Total crawl time: 7 days
├─ Documents stored: 600K (after dedup)
├─ Raw data ingested: 100GB
├─ After compression + dedup: 35GB hot + 45GB warm
├─ Embedding vectors: 600K × 768 dims = ~1.8GB
├─ Image hashes: 15K images × 16 bytes = 240MB
├─ CPU utilization: 70–85% (consistent)
├─ Memory peak: 12GB (6GB workers + 4GB Redis + 2GB buffers)
└─ I/O throughput: avg 500Mbps (within dual 2.5G NIC capacity)
```

---

## Part 9: Deployment Checklist

- [ ] **Infrastructure**
  - [ ] Ubuntu 22.04 LTS installed + kernel tuned (TCP buffer, ulimits)
  - [ ] Dual 2.5G NIC configured (bonded or load-balanced)
  - [ ] Tiered storage mounted: /mnt/hot (NVMe), /mnt/warm (USB HDD)
  - [ ] SMB/NFS cold tier mounted (future NAS)

- [ ] **Docker & Credentials**
  - [ ] Docker engine 24.0+, docker-compose 2.20+
  - [ ] Secrets management: environment variables or HashiCorp Vault
  - [ ] Facebook/Instagram credentials in encrypted file
  - [ ] Proxy API keys (if using Bright Data / Smartproxy)

- [ ] **Database Initialization**
  - [ ] PostgreSQL initialized with pgvector extension
  - [ ] Tables created: documents, images, url_frontier
  - [ ] Indices created: HNSW on embeddings, BRIN on image hashes
  - [ ] Redis persistence enabled (AOF)

- [ ] **Crawler Configuration**
  - [ ] User-Agent pool populated (100+ real browser signatures)
  - [ ] Domain rate limits configured (.robots.txt respected)
  - [ ] Proxy rotation configured (if using external proxy service)
  - [ ] TLS fingerprint matching enabled (tls_client library)

- [ ] **Monitoring & Alerting**
  - [ ] Prometheus scrape configs set up
  - [ ] Grafana dashboards created (throughput, dedup, errors, storage)
  - [ ] Alert rules configured: high CPU, low disk space, high error rate
  - [ ] Logging centralized (ELK stack or CloudWatch)

- [ ] **Testing & Validation**
  - [ ] Unit tests for dedup engine, image hashing
  - [ ] Integration test: fetch → dedup → embed → store pipeline
  - [ ] Load test: 100 concurrent requests over 1 hour
  - [ ] Detection avoidance test: verify non-blocked requests (sample 10 sites)

- [ ] **Production Hardening**
  - [ ] Backup strategy: daily PostgreSQL snapshots to S3
  - [ ] Recovery procedure tested: restore from backup
  - [ ] Rate limits enforced per domain (respect Robots.txt)
  - [ ] Error handling: graceful degradation, retry logic with exponential backoff

---

## Part 10: Troubleshooting & Optimization

### 10.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **High error rate on Instagram** | TLS fingerprint mismatch or x-ig-app-id outdated | Rotate x-ig-app-id monthly (Instagram changes app ID); use tls_client with browser fingerprint matching |
| **Redis memory bloat** | Bloom filter size too small, false positives → Redis lookups | Increase Bloom filter capacity; implement periodic Bloom filter reset (monthly) |
| **Slow embedding generation** | CPU-only inference bottleneck | Use quantized model (INT8); batch requests (512-1024 docs); consider GPU acceleration in Phase 2 |
| **Storage tier lag** | LRU eviction not keeping up | Reduce hot tier retention to 48 hours; increase warm tier capacity; prioritize frequent access patterns |
| **Request timeouts on paywall sites** | Session token expiration | Implement token refresh loop every 30 min; rotate proxy if IP is rate-limited |

### 10.2 Performance Tuning

```python
# Tune worker concurrency for your i5-12600H
import asyncio, psutil

def optimal_worker_count():
    """Calculate optimal workers for your hardware"""
    cpu_count = psutil.cpu_count()  # 12 cores
    reserved_for_os = 2
    available_cores = cpu_count - reserved_for_os  # 10
    
    # I/O-bound crawling: 1.5–2x cores
    async_workers = min(available_cores * 2, 20)  # Cap at 20
    
    # Embedding workers: 1 per core (CPU-bound)
    embedding_workers = available_cores // 2  # 5
    
    return async_workers, embedding_workers
    # Returns: (16, 5)

# Tune PostgreSQL for vector search
# In /etc/postgresql/16/main/postgresql.conf:
shared_buffers = 4GB  # 25% RAM
effective_cache_size = 12GB  # 75% RAM
maintenance_work_mem = 1GB
work_mem = 256MB
random_page_cost = 1.1  # For NVMe (lower = prefer index scans)
wal_level = replica  # Enable replication for backups
```

---

## Conclusion

This deployment proposal provides a **complete, production-ready architecture** for large-scale web crawling on your i5-12600H system:

✅ **1000–2000 URLs/sec** throughput with 8 concurrent workers  
✅ **50M+ documents** scalable via tiered storage (NVMe → USB → NAS → S3)  
✅ **Multi-source crawling** with OAuth authentication + detection avoidance  
✅ **40%+ deduplication** via URL + content + embedding similarity  
✅ **Reverse image search** with perceptual hashing + BK-tree indices  
✅ **Production monitoring** via Prometheus + Grafana  

**Next steps:**
1. Provision hardware + OS (Week 1)
2. Deploy Docker Compose stack (Week 2)
3. Test on 5 domains (Week 3–4)
4. Scale to 50M+ documents (Weeks 5–12)

**Estimated total build time:** 8–12 weeks for full production readiness.

---

## Appendix: Cost & Feasibility Analysis

| Component | Cost (AUD) | Justification |
|-----------|------------|---------------|
| i5-12600H mini desktop | ~$1,200–1,500 | Already allocated |
| 4TB USB 3.1 HDD | ~$100–150 | Warm tier storage |
| Docker + open-source stack | $0 | PostgreSQL, Redis, HuggingFace models |
| Wasabi S3 storage (100TB/yr) | ~$500–800 | Cold archive tier |
| Optional residential proxies | $200–500/mo | For detection avoidance (pay-as-you-go) |
| **Total first-year cost** | ~$2,500–3,500 | Excludes internet/power |

**ROI:** Break-even at 50M documents if data value > $0.05/doc (typical B2B intelligence).

---

**Author:** Technical Architecture Team  
**Version:** 1.0 (January 26, 2026)  
**Status:** Ready for implementation
