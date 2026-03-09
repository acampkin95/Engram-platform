# Weaviate Multi-Shard Implementation Guide
## Personal Homelab Edition: Infra → Local → Project → Personal Hierarchy

**Date:** January 26, 2026  
**Context:** Personal homelab AI memory system with flexible guest access  
**Focus:** Lightweight hierarchical data isolation for solo/small team collaboration  
**Scale:** Single developer (you) + occasional guest access (1–2 people at a time)  

---

## Executive Overview: Personal Homelab Architecture

Your homelab runs a **4-tier shard hierarchy** within a single Weaviate instance, optimized for:
- **Your primary use**: Solo ownership of all shards
- **Flexible sharing**: Selective guest access (temporary or permanent)
- **Minimal overhead**: No complex RBAC, simple access tokens
- **Casual collaboration**: Share research projects with friends, colleagues, or study partners

```
┌─────────────────────────────────────────────────────────────────┐
│               WEAVIATE INSTANCE (16GB RAM, Homelab)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  TIER 1: INFRASTRUCTURE SHARD (Global, Always Accessible)       │
│  ├─ Domain: Personal knowledge base                              │
│  ├─ Access: You + any guest (universal context)                 │
│  ├─ Size: 1M–5M vectors (~2–10GB disk, ~500MB RAM active)       │
│  ├─ Data: LLM notes, coding snippets, architecture patterns     │
│  ├─ Refresh: Ad-hoc (whenever you learn something new)          │
│  └─ Examples: "How to deploy X", "Python best practices", etc.  │
│                                                                   │
│  TIER 2: LOCAL/PRIVATE SHARD (Your personal context)            │
│  ├─ Domain: Personal research, private notes, drafts            │
│  ├─ Access: You only (locked by default)                        │
│  ├─ Size: 500K–2M vectors (~1–5GB disk, ~200MB RAM active)      │
│  ├─ Data: Private thoughts, work-in-progress, sensitive notes   │
│  ├─ Refresh: Real-time as you write notes                       │
│  └─ Examples: Career planning, personal budget, private journal │
│                                                                   │
│  TIER 3: PROJECT SHARD (One or more active research projects)   │
│  ├─ Domain: Web crawls, research data, learning materials       │
│  ├─ Access: You + guest(s) if project is "shared"              │
│  ├─ Size: 5M–100M vectors per project (10–200GB disk, lazy)     │
│  ├─ Data: Web crawls, papers, tutorials, curated articles       │
│  ├─ Relationships: Cross-references to Infra shard              │
│  ├─ Refresh: Continuous (bulk imports when you run crawlers)    │
│  └─ Examples: "tech_research_2026", "ai_safety_papers", etc.    │
│                                                                   │
│  TIER 4: RESEARCH CATALOG SHARD (Your personal file library)    │
│  ├─ Domain: 5000+ files (PDFs, code, notes, references)         │
│  ├─ Access: You + guest(s) if project is "shared"              │
│  ├─ Size: 5K–500K vectors (100MB–5GB disk, usually hot)         │
│  ├─ Data: Organized research files with metadata + OCR          │
│  ├─ Cross-References: Links within catalog + to projects        │
│  ├─ AI Interaction: Search, recall, graph visualization         │
│  └─ Examples: "alice_research_library", "ai_paper_collection"   │
│                                                                   │
│  ACCESS CONTROL (Simple, Guest-Friendly):                       │
│  ├─ You: Master token (full access to all shards)               │
│  ├─ Guest (Friend): Limited token (Infra + shared projects)     │
│  ├─ Guest (Colleague): Limited token (Infra + shared projects)  │
│  └─ Guest (Study Partner): Limited token (Infra + your research)│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

Query Routing Logic (Simplified):

  Your Query ("me" token - Master)
    ├─ Authorized shards: Infra + Private + All Projects + Catalog
    ├─ Result: Full knowledge graph across all contexts
    └─ Use case: Your own research, decision-making, learning

  Guest Query ("friend_token" - Limited)
    ├─ Authorization: Check token against shared projects
    ├─ Authorized shards: Infra + [Project A (shared), Project B (shared)]
    ├─ Result: Only knowledge from authorized shards
    └─ Use case: Collaborative research, knowledge sharing

  Guest Query ("colleague_token" - Limited)
    ├─ Authorization: Check token against shared projects
    ├─ Authorized shards: Infra + [Project C (shared)]
    ├─ Result: Only knowledge from authorized shard
    └─ Use case: Work collaboration, shared learning

Security Properties (Homelab-Grade):
  ✅ Infra shard: Everyone sees same baseline knowledge
  ✅ Private shard: You-only access (token-based)
  ✅ Project shard: Shared by explicit token grant
  ✅ Catalog shard: You-only by default, shareable per-project
  ✅ Guest isolation: Guests cannot see private shards (even with token manipulation)
  ✅ Simple audit: Track which guest accessed what, when
```

---

## Part 1: Shard Design (Homelab Optimized)

### 1.1 TIER 1: Infrastructure Shard (Shared Knowledge Base)

**Purpose:** Your personal knowledge base shared with any guest.

```yaml
Shard Configuration:
  name: "infra_personal"
  tenant: true
  description: "Personal knowledge base - shared with guests"
  visibility: "public"  # Everyone gets access by default
  
  Data Schema:
    ├─ class: "PersonalKnowledge"
    ├─ properties:
    │   ├─ topic (text): "AI/ML", "DevOps", "Architecture", "3CX/VoIP"
    │   ├─ content (text): Your actual note or snippet
    │   ├─ source (text): Where you learned it (book, blog, experience)
    │   ├─ created_date (datetime): When you wrote this
    │   ├─ updated_date (datetime): Last modification
    │   ├─ importance (number): 1-5 (personal ranking)
    │   ├─ tags (array[text]): ["kubernetes", "docker", "deployment"]
    │   └─ status (text): "draft" | "published" | "archived"
    │
    └─ vectorizer: "text2vec-transformers"  # Offline

Data Examples:
  ├─ Note 1: "Docker Best Practices for M-Series Macs"
  │   ├─ Content: ~2000 tokens of tips and tricks
  │   ├─ Topic: "DevOps"
  │   ├─ Created: "2025-11-15T14:30:00Z"
  │   ├─ Importance: 4/5
  │   └─ Status: "published"
  │
  ├─ Note 2: "3CX V20 Upgrade Lessons Learned"
  │   ├─ Content: ~1500 tokens of practical experience
  │   ├─ Topic: "3CX/VoIP"
  │   ├─ Created: "2026-01-10T09:00:00Z"
  │   ├─ Importance: 5/5
  │   └─ Status: "published"
  │
  ├─ Note 3: "Rust for High-Performance Services"
  │   ├─ Content: ~3000 tokens of learning notes
  │   ├─ Topic: "Programming"
  │   ├─ Created: "2026-01-05T18:45:00Z"
  │   ├─ Importance: 3/5
  │   └─ Status: "draft" (incomplete, but guests can see)
  │
  └─ ... (expand to 1–5M vectors over time at your pace)

Size Estimates:
  ├─ 2M vectors @ 768 dimensions
  ├─ Embedding storage: ~12GB
  ├─ Metadata: ~2GB
  ├─ Inverted indexes: ~4GB
  ├─ HNSW graph: ~2GB
  ├─ Total disk: ~20GB
  └─ RAM (when active): ~1GB

Access Pattern:
  ├─ Query frequency: Whenever you or guests search
  ├─ Write frequency: Whenever you add a note
  ├─ Activation: Stays resident (critical for guests)
  ├─ Guests: Always visible (no special token needed)
  └─ SLO: <100ms latency, high uptime

Query Examples:
  {
    Get {
      PersonalKnowledge(
        tenant: "infra_personal"
        hybrid: {
          query: "Docker best practices for Apple Silicon"
          alpha: 0.6
        }
        limit: 10
      ) {
        topic
        content
        created_date
        importance
        status
        _additional { distance score }
      }
    }
  }
  
  Result: Returns your notes + any guest insights you've added
```

### 1.2 TIER 2: Private/Personal Shard (You-Only)

**Purpose:** Your personal thoughts, drafts, sensitive notes—never shared unless you explicitly decide.

```yaml
Shard Configuration:
  name: "private_personal"
  tenant: true
  description: "Your private research, drafts, personal notes"
  visibility: "private"  # Token-protected, you-only by default
  owner_user_id: "you@homelab"
  encryption: "AES-256-GCM"  # Optional: encrypt sensitive data
  
  Data Schema:
    ├─ class: "PrivateNote"
    ├─ properties:
    │   ├─ title (text): Note title
    │   ├─ content (text): Full content (encrypted)
    │   ├─ note_type (text): "Journal" | "Draft" | "Research" | "Idea"
    │   ├─ created_date (datetime): When you wrote it
    │   ├─ modified_date (datetime): Last edit
    │   ├─ privacy_level (text): "Private" | "Draft" | "Review"
    │   ├─ tags (array[text]): ["personal", "career", "project-x"]
    │   ├─ share_with (array[text]): [] (initially), or add guests later
    │   └─ linked_projects (array[uuid]): Projects this relates to
    │
    └─ vectorizer: "text2vec-transformers"

Data Examples:
  
  Note 1: Career Planning Notes
    ├─ Title: "2026 Career Goals + 5-Year Plan"
    ├─ Content: ~5000 tokens of personal reflections
    ├─ Type: "Journal"
    ├─ Privacy: "Private" (never sharing)
    ├─ Created: "2026-01-15T22:00:00Z"
    ├─ Tags: ["career", "personal", "long-term"]
    └─ Share with: [] (none)

  Note 2: Project X - Early Thoughts
    ├─ Title: "Startup Idea: Distributed VoIP SaaS"
    ├─ Content: ~3000 tokens of brainstorming
    ├─ Type: "Idea"
    ├─ Privacy: "Draft" (might share with trusted colleague later)
    ├─ Created: "2026-01-08T15:30:00Z"
    ├─ Tags: ["startup", "voip", "business-idea"]
    └─ Share with: [] (currently private, decide later)

  Note 3: Research Methodology Notes
    ├─ Title: "Approach for Evaluating LLM Reasoning"
    ├─ Content: ~2000 tokens of research design
    ├─ Type: "Research"
    ├─ Privacy: "Review" (considering sharing with study group)
    ├─ Created: "2026-01-12T10:00:00Z"
    ├─ Tags: ["ai", "research", "methodology"]
    └─ Share with: [] (might add friends later for feedback)

Access Control:
  
  You (Master Token):
    ├─ Full read/write/delete access
    ├─ Can decide to share a note with guests
    ├─ Can revoke access anytime
    └─ Can permanently delete notes
  
  Guest (Any Token):
    ├─ NO access by default (blocked at auth layer)
    ├─ Can access ONLY if you explicitly add them to "share_with"
    └─ Read-only access (cannot modify your private notes)

Size Estimates (Typical):
  ├─ 500K vectors (100–200 notes × 3000 tokens each)
  ├─ Embedding storage: ~3GB
  ├─ Encrypted metadata: ~1GB
  ├─ Inverted indexes: ~1GB
  ├─ Total disk: ~5GB
  ├─ RAM (when active): ~300MB
  └─ Storage: NVMe (always available for you)

Query Examples (You Only):
  
  Query A: Find all drafts
  {
    Get {
      PrivateNote(
        tenant: "private_personal"
        where: {
          path: ["privacy_level"],
          operator: "Equal",
          valueString: "Draft"
        }
      ) {
        title
        created_date
        modified_date
        tags
      }
    }
  }
  
  Query B: Search with encryption
  {
    Get {
      PrivateNote(
        tenant: "private_personal"
        hybrid: {
          query: "career opportunities in distributed systems"
          alpha: 0.6
        }
        limit: 5
      ) {
        title
        content  # Decrypted server-side, you see plaintext
        note_type
      }
    }
  }

Selective Sharing:
  
  Scenario: You write a draft about a startup idea, want feedback from a friend
  
  Step 1: Create note (private by default)
  Step 2: Decide to share with friend
  Step 3: Update note: share_with = ["friend@email.com"]
  Step 4: Give friend a "guest_token" (valid for specific projects only)
  Step 5: Friend queries:
    ├─ Can see Infra shard (shared by default)
    ├─ Can see this specific PrivateNote (you added them)
    └─ Cannot see other private notes (not on their access list)
  
  Step 6: Friend gives feedback, you update the note
  Step 7: To revoke: remove from share_with array
    └─ Friend's next query: access denied
```

### 1.3 TIER 3: Project-Specific Shard (Shareable Research)

**Purpose:** Your web crawls, research projects—easy to share with guests.

```yaml
Shard Configuration:
  name: "project_tech_research_2026"
  tenant: true
  description: "Tech research: AI, distributed systems, telecom"
  project_id: "tech_research_2026"
  visibility: "shared"  # You decide per-guest
  owner_user_id: "you@homelab"
  
  Data Schema:
    ├─ class: "ProjectDocument"
    ├─ properties:
    │   ├─ project_id (text): "tech_research_2026"
    │   ├─ title (text): Article/paper title
    │   ├─ content (text): Full content
    │   ├─ source_domain (text): "arxiv.org", "techcrunch.com", etc.
    │   ├─ source_url (text): Full URL
    │   ├─ published_date (datetime): When article was published
    │   ├─ crawl_date (datetime): When you indexed it
    │   ├─ document_type (text): "News" | "Paper" | "Blog" | "Tutorial"
    │   ├─ category (text): "AI/ML" | "Distributed Systems" | "Telecom"
    │   ├─ entities (array[text]): ["OpenAI", "distributed consensus", etc.]
    │   ├─ infra_references (array[uuid]): Links to your notes in Infra shard
    │   ├─ relevance_score (number): 0–5 (your rating)
    │   ├─ url_hash (text): SHA256(url) for dedup
    │   └─ your_notes (text): Your own commentary on this document
    │
    └─ vectorizer: "text2vec-openai"

Data Examples (Web Crawl):
  
  Document 1:
    ├─ Title: "Designing Resilient Distributed VoIP Systems"
    ├─ Content: Full research paper (~4000 tokens)
    ├─ Source: "IEEE Xplore"
    ├─ Category: "Telecom"
    ├─ Published: "2025-11-20T00:00:00Z"
    ├─ Your Notes: "Highly relevant to 3CX modernization project. Key insights on fault tolerance."
    ├─ Infra Refs: [note_on_distributed_systems_id, note_on_3cx_architecture_id]
    ├─ Relevance: 5/5
    └─ URL Hash: "abc123def456"

  Document 2:
    ├─ Title: "Constitutional AI: Harmlessness from AI Feedback"
    ├─ Content: Full paper (~3500 tokens)
    ├─ Source: "arxiv.org"
    ├─ Category: "AI/ML"
    ├─ Published: "2025-12-10T00:00:00Z"
    ├─ Your Notes: "Key alignment technique. Compare with RLHF, discuss in group."
    ├─ Infra Refs: [note_on_ai_safety_id]
    ├─ Relevance: 5/5
    └─ URL Hash: "ghi789jkl012"

  Document 3:
    ├─ Title: "Building Efficient Knowledge Graphs at Scale"
    ├─ Content: Blog post (~2000 tokens)
    ├─ Source: "Medium"
    ├─ Category: "Distributed Systems"
    ├─ Published: "2026-01-05T00:00:00Z"
    ├─ Your Notes: "Practical guide for Weaviate/Neo4j integration. Tested approach."
    ├─ Relevance: 4/5
    └─ URL Hash: "mno345pqr678"

Cross-Reference Architecture:

  When you query "Tell me about distributed consensus in VoIP"
    ├─ Step 1: Query Project shard (tech_research_2026)
    │   └─ Returns: "Designing Resilient Distributed VoIP Systems"
    │
    ├─ Step 2: Follow infra_references
    │   ├─ Fetch Infra shard: Your notes on distributed systems
    │   └─ Returns: Architecture patterns + best practices
    │
    ├─ Step 3: Merge results
    │   ├─ Result 1: Research paper (theory)
    │   ├─ Result 2: Your personal notes (patterns)
    │   └─ Result 3: Other related papers
    │
    └─ Complete picture: Research + your synthesis + context

Bulk Import Workflow:

  1. Run web crawler: ~1000 articles/day from your RSS feeds
  2. TEI service embeds: 5000 docs/sec batch
  3. Dedup check: URL hash against existing docs
  4. Batch insert (no blocking other operations):
     {
       "class": "ProjectDocument",
       "tenant": "project_tech_research_2026",
       "objects": [
         {
           "id": "uuid-1",
           "vector": [0.1, 0.2, 0.3, ...],
           "properties": {
             "title": "Article Title",
             "content": "Full text...",
             "url_hash": "abc123def456",
             "infra_references": ["infra_doc_1"],
             "your_notes": "Personal thoughts..."
           }
         },
         // ... 999 more objects
       ]
     }
  5. Index updated incrementally
  6. Immediately queryable by you and guests

Size Estimates (Large Project):
  ├─ 50M vectors @ 1536 dimensions
  ├─ Embedding storage: ~300GB
  ├─ Your notes + metadata: ~30GB
  ├─ Inverted indexes: ~100GB
  ├─ HNSW graph: ~50GB
  ├─ Total: ~480GB (compressed: ~120GB)
  ├─ RAM (when active): ~5GB
  └─ Storage tier: NVMe (hot) → USB HDD (warm) → NAS (cold)

Access Control:
  
  You:
    ├─ Full read/write access
    ├─ Add/remove guests from shared list
    ├─ Decide what guests see (whole project or filtered)
    └─ Can publish findings back to Infra shard

  Guest (If Project is Shared):
    ├─ Read-only access to all documents
    ├─ Can search and query
    ├─ Cannot modify your notes
    ├─ Cannot modify document ranking
    └─ Can see Infra shard cross-references

  Guest (If Project is Private):
    └─ Zero access (query blocked at auth layer)

Query Examples:

  Your Query (Master Token):
  {
    Get {
      ProjectDocument(
        tenant: "project_tech_research_2026"
        hybrid: {
          query: "resilient distributed VoIP"
          alpha: 0.6
        }
        limit: 10
      ) {
        title
        source_domain
        published_date
        category
        your_notes
        infra_references
      }
    }
  }

  Guest Query (Limited Token):
  {
    Get {
      ProjectDocument(
        tenant: "project_tech_research_2026"
        hybrid: {
          query: "constitution AI safety"
          alpha: 0.6
        }
        limit: 10
      ) {
        title
        source_domain
        published_date
        category
        # Cannot see: your_notes (you might make them visible though)
        # CAN see: infra_references (your published wisdom)
      }
    }
  }
```

### 1.4 TIER 4: Research Catalog Shard (5000-File Library)

**Purpose:** Your organized research files—searchable, with guest access control.

```yaml
Shard Configuration:
  name: "catalog_research_library"
  tenant: true
  description: "Personal research catalog: 5000+ files (PDFs, code, papers)"
  visibility: "shared"  # You control per-file
  owner_user_id: "you@homelab"
  file_count: 5000
  
  Data Schema:
    ├─ class: "ResearchFile"
    ├─ properties:
    │   ├─ file_id (uuid): Unique identifier
    │   ├─ file_name (text): Original filename
    │   ├─ file_path (text): Virtual path (/AI/Papers/2026/, etc.)
    │   ├─ file_type (text): "PDF" | "DOCX" | "CODE" | "DATA" | "IMAGE"
    │   ├─ file_size_bytes (number): Size in bytes
    │   ├─ mime_type (text): "application/pdf", etc.
    │   ├─ content (text): Extracted text + OCR
    │   ├─ metadata_title (text): Human-readable title
    │   ├─ metadata_author (text): Author if applicable
    │   ├─ metadata_date (datetime): Publication/creation date
    │   ├─ metadata_source (text): Where from (URL, book, etc.)
    │   ├─ metadata_keywords (array[text]): ["AI", "safety", "papers"]
    │   ├─ metadata_category (text): User category (AI | Telecom | Systems)
    │   ├─ metadata_custom_tags (array[text]): Your tags
    │   ├─ abstract (text): Summary
    │   ├─ your_notes (text): Your annotations (encrypted)
    │   ├─ collection_date (datetime): When you added it
    │   ├─ file_hash (text): SHA256 for integrity
    │   ├─ starred (boolean): Favorite marker
    │   ├─ reading_status (text): "Unread" | "Reading" | "Completed"
    │   ├─ relevance_rating (number): 0–5 (your rating)
    │   ├─ related_files (array[uuid]): Cross-references to other files
    │   ├─ visibility (text): "Private" | "Friends" | "Public"
    │   └─ linked_projects (array[uuid]): Projects this relates to
    │
    └─ vectorizer: "text2vec-transformers"

Data Organization (5000 Files Example):

  Category 1: AI + Safety (800 files)
    ├─ Papers (500): Constitutional AI, RLHF, alignment, etc.
    ├─ Books (150): Superintelligence, The Alignment Problem
    └─ Talks (150): Video transcripts, conference slides

  Category 2: Telecom + VoIP (1200 files)
    ├─ 3CX Docs (600): Official docs + runbooks
    ├─ VoIP Standards (300): RFC docs, ITU standards
    ├─ Code (200): Python/JS 3CX integrations
    └─ Customer Docs (100): FAQs, case studies

  Category 3: Systems (1500 files)
    ├─ Containers (300): Docker, Kubernetes docs
    ├─ Databases (400): PostgreSQL, Redis, Neo4j
    ├─ DevOps (400): CI/CD, monitoring, IaC
    └─ Security (400): Compliance, encryption, auth

  Category 4: Learning (1500 files)
    ├─ Personal Notes (500): Your handwritten notes (OCR'd)
    ├─ Code Snippets (400): Useful examples
    ├─ Blog Drafts (100): Your writing
    └─ Misc (500): Everything else

File Examples:

  File 1: Research Paper (Shared with Study Group)
    ├─ Name: "attention_is_all_you_need.pdf"
    ├─ Path: "/AI/Papers/Foundational/"
    ├─ Type: "PDF"
    ├─ Title: "Attention is All You Need"
    ├─ Author: "Vaswani et al."
    ├─ Published: "2017-06-12"
    ├─ Keywords: ["attention", "transformer", "neural networks"]
    ├─ Category: "AI + Safety"
    ├─ Your Notes: "Foundational. Must read first. Notes in private shard."
    ├─ Collection Date: "2024-03-15T10:00:00Z"
    ├─ Starred: true
    ├─ Reading Status: "Completed"
    ├─ Relevance Rating: 5.0
    ├─ Visibility: "Friends"  # Share with study group
    ├─ File Hash: "aaa111bbb222ccc333"
    └─ Related Files: ["transformer_variants.pdf", "bert_paper.pdf"]

  File 2: 3CX Runbook (Private Draft, Maybe Share Later)
    ├─ Name: "3cx_v20_upgrade_runbook.docx"
    ├─ Path: "/Telecom/3CX/Runbooks/"
    ├─ Type: "DOCX"
    ├─ Title: "3CX V20 Upgrade Runbook"
    ├─ Author: "You"
    ├─ Created: "2026-01-10T10:00:00Z"
    ├─ Keywords: ["3cx", "upgrade", "v20", "runbook"]
    ├─ Category: "Telecom + VoIP"
    ├─ Your Notes: "Use for customer upgrades. Test on staging first."
    ├─ Collection Date: "2026-01-11T09:00:00Z"
    ├─ Starred: true
    ├─ Reading Status: "Completed"
    ├─ Relevance Rating: 4.5
    ├─ Visibility: "Private"  # Only you see this
    ├─ File Hash: "ddd444eee555fff666"
    └─ Related Files: ["3cx_v19_upgrade_runbook.docx"]

  File 3: Code Example (Public)
    ├─ Name: "3cx_api_customer_lookup.py"
    ├─ Path: "/Telecom/Code/"
    ├─ Type: "CODE"
    ├─ Title: "3CX API Customer Lookup Script"
    ├─ Content: Full Python code (~500 lines)
    ├─ Keywords: ["3cx", "api", "python", "customer", "lookup"]
    ├─ Category: "Telecom + VoIP"
    ├─ Your Notes: "Copy-paste ready. Requires 3CX API key."
    ├─ Collection Date: "2025-11-22T14:00:00Z"
    ├─ Starred: true
    ├─ Visibility: "Public"  # Anyone can see
    └─ Related Files: ["3cx_api_docs.pdf", "3cx_customer_creation.py"]

Interactive Workflow (You + Guest):

  Scenario: You invite a friend to discuss AI safety papers
  
  Step 1: Friend gets guest_token (limited access)
  Step 2: Friend queries your research catalog:
    {
      Get {
        ResearchFile(
          tenant: "catalog_research_library"
          where: {
            path: ["visibility"],
            operator: "In",
            valueString: ["Public", "Friends"]  # Guest sees only these
          }
          hybrid: {
            query: "constitutional AI safety alignment"
            alpha: 0.7
          }
        ) {
          file_name
          metadata_title
          metadata_author
          metadata_date
          abstract
          reading_status
          starred
          # CANNOT see: your_notes (encrypted, you-only)
        }
      }
    }
  
  Step 3: Results returned
    ├─ "Constitutional AI: Harmlessness from AI Feedback"
    ├─ "Weak-to-Strong Generalization"
    ├─ "Scalable Oversight via AI-Assisted Alignment"
    └─ ... (other papers marked as "Friends" or "Public")
  
  Step 4: Friend discusses findings
  Step 5: You update your_notes with insights from conversation
  Step 6: Next time friend queries, cross-references appear

Visibility Model:

  "Private" (Only You):
    ├─ Your research drafts
    ├─ Sensitive work files
    ├─ Personal development plans
    └─ No guests see this

  "Friends" (Study Groups, Close Colleagues):
    ├─ Research papers to discuss
    ├─ Code examples to collaborate on
    ├─ Learning materials to share
    └─ Guests on your friends list see this

  "Public" (Anyone):
    ├─ Published tutorials you've written
    ├─ Useful code snippets
    ├─ General knowledge articles
    └─ Anyone with homelab access sees this

Bulk Cataloging (5000 Files):

  Ingest Process:
  1. Drag-drop directory: ~/Research/ (5000 files)
  2. File extraction:
     ├─ PDF: Extract text + OCR (Tesseract)
     ├─ DOCX: Extract text + metadata
     ├─ CODE: Preserve syntax, extract structure
     ├─ IMAGE: Skip text, keep metadata
     └─ Other: Metadata only
  3. Embeddings: 5000 files → 5000 vectors (via TEI)
  4. Batch insert: Multi-threaded, 100 files/sec
  5. Cross-reference detection: Semantic similarity matching
  6. Complete: ~15 minutes, immediately searchable

Size Estimates (5000 Files):
  ├─ 5000 vectors @ 768 dimensions
  ├─ Embedding storage: ~20MB
  ├─ Metadata + content: ~2–5GB
  ├─ Inverted indexes: ~1GB
  ├─ Your encrypted notes: ~500MB
  ├─ Total disk: ~3.5–6GB
  ├─ RAM (when active): ~500MB
  └─ Storage: NVMe (hot, always available)

AI Interaction Examples:

  Interaction 1: You Search
  "Find all AI safety papers I've starred and completed"
  AI: (Queries with visibility="all", reading_status="Completed", starred=true)
    Returns 50+ papers with your notes visible
  
  Interaction 2: Guest Searches
  "Show me safety alignment papers"
  AI: (Queries with visibility in ["Public", "Friends"], topic includes "safety")
    Returns papers visible to guest (no your_notes shown)
  
  Interaction 3: You Export for Study Group
  "Create a reading list of AI safety papers for my friends"
  AI: (Filters: visibility="Friends" or "Public", category="AI Safety", sorted by relevance)
    Generates shareable list with metadata

Visualization Dashboard:

  Graph View:
    ├─ Nodes: Files grouped by category
    ├─ Edges: Related files (semantic similarity)
    ├─ Colors: By category (AI=blue, Telecom=green, Systems=red)
    ├─ Size: Relevance rating or file size
    └─ Interaction: Click to read, filter by visibility, search

  Timeline View:
    ├─ X-axis: Publication date
    ├─ Y-axis: Category
    ├─ Nodes: Individual files
    ├─ Color: Reading status (unread=gray, reading=yellow, done=green)
    └─ Trend: Show your reading progress over time

  Table View:
    ├─ Columns: Name, Author, Date, Category, Rating, Status, Visibility
    ├─ Sort: By any column
    ├─ Filter: Category, status, rating, visibility
    └─ Export: CSV for sharing with guests

Deletion + Privacy:

  You delete a file:
    ├─ Marked as deleted (soft delete, 30-day recovery window)
    ├─ Removed from search immediately
    ├─ Encryption keys discarded (unrecoverable after 30 days)
    ├─ Execution: <1 second
    └─ Guests: No longer see it in queries

  You revoke guest access:
    ├─ Remove guest token
    ├─ Guest's next query: authentication fails
    ├─ Execution: Immediate
    └─ Retroactive: Past queries still in audit log
```

---

## Part 2: Guest Access & Sharing

### 2.1 Simple Token-Based Access Model

```
Your Setup (Master Control):

  1. Generate Tokens (One-time setup per guest):
     
     $ weaviate-cli generate-token --name "friend_sarah" \
       --shared-projects "tech_research_2026,ai_safety_reading" \
       --shared-catalog-visibility "Friends"
     
     Output:
       Token: friend_sarah_token_abc123xyz
       Expiry: Never (revoke manually anytime)
       Access: 
         - Infra shard (always)
         - Projects: tech_research_2026, ai_safety_reading
         - Catalog: Files marked "Friends" or "Public"

     $ weaviate-cli generate-token --name "study_group_temporary" \
       --shared-projects "ai_alignment_papers" \
       --shared-catalog-visibility "Public" \
       --expiry "2026-03-31"
     
     Output:
       Token: study_group_temp_def456pqr
       Expiry: 2026-03-31 (auto-revoked after)
       Access:
         - Infra shard
         - Projects: ai_alignment_papers only
         - Catalog: Files marked "Public" only

  2. Share Token with Guest (Send via secure channel):
     
     Email to friend_sarah:
       "Here's your homelab access token:
        friend_sarah_token_abc123xyz
        
        You can now search my research on AI and telecom.
        You'll see my public knowledge base + our shared projects.
        
        Let me know if you need access to more projects.
        (I can revoke anytime.)"

  3. Guest Uses Token (REST API):
     
     $ curl -H "Authorization: Bearer friend_sarah_token_abc123xyz" \
       http://you.local:8080/v1/graphql \
       -d '{
         "query": "{
           Get {
             ProjectDocument(
               tenant: "tech_research_2026"
               hybrid: { query: \"AI safety\" alpha: 0.6 }
               limit: 10
             ) {
               title source_domain published_date
             }
           }
         }"
       }'
     
     Result: Returns only documents from tech_research_2026
             (because guest token scoped to that project)

Revocation (You Anytime):

  $ weaviate-cli revoke-token --name "friend_sarah"
  
  Result:
    ├─ Token immediately invalid
    ├─ Friend's next query: 401 Unauthorized
    ├─ No other impact (their previous queries still in logs)
    └─ Audit: Logged who revoked when

Token Security (Homelab-Grade):

  ✅ Tokens are long random strings (no info leakage)
  ✅ Tokens are scoped to specific projects/shards
  ✅ Tokens expire (configurable, optional)
  ✅ Tokens logged when used (audit trail)
  ❌ Tokens NOT encrypted in transit (use TLS 1.3 over network)
  ✅ Tokens cannot be used to access your private shard
  ✅ Tokens cannot escalate privileges (structural guarantee)
```

### 2.2 Real-World Guest Workflow

```
Scenario: You want to share your AI research with a study group (3 people)

Step 1: Create Project (Shared)
  You've already collected 50M vectors of AI research papers.
  Decide: "I want to let my study group search this."

Step 2: Generate Tokens
  $ weaviate-cli generate-token --name "alice_study_group" \
    --shared-projects "ai_alignment_papers,ai_safety_papers" \
    --shared-catalog-visibility "Friends" \
    --expiry "2026-06-30"

Step 3: Share Tokens with Group
  ├─ Alice: alice_study_group_token_abc
  ├─ Bob: bob_study_group_token_def
  └─ Carol: carol_study_group_token_ghi
  
  (Each token is unique, so you can revoke individually)

Step 4: Group Searches Your Research
  
  Alice queries (via curl, Python, or web UI):
  {
    Get {
      ProjectDocument(
        tenant: "ai_alignment_papers"
        hybrid: {
          query: "constitutional AI rewards models"
          alpha: 0.6
        }
        limit: 20
      ) {
        title
        published_date
        source_domain
        # CANNOT see: your_notes (not shared)
        # CAN see: Infra shard cross-references (your published wisdom)
      }
    }
  }

Step 5: Group Discusses Findings
  Alice finds "Constitutional AI: Harmlessness from AI Feedback"
  Bob finds related work on RLHF
  Carol finds critique of the approach
  
  You see (in your homelab logs):
    14:30:15 - alice_study_group_token - Query: "constitutional AI"
    14:31:22 - bob_study_group_token - Query: "RLHF alignment"
    14:32:45 - carol_study_group_token - Query: "critique AI reward models"

Step 6: Group Converses
  You're all on a Discord call, discussing the papers.
  You say: "I've taken notes on this topic, let me search my Infra shard"
  You query (with master token):
  {
    Get {
      PersonalKnowledge(
        tenant: "infra_personal"
        hybrid: { query: "reward models alignment" alpha: 0.6 }
      ) {
        topic content created_date importance
      }
    }
  }
  
  You share findings verbally (or export to Infra cross-refs)

Step 7: Group Ends, You Revoke Access
  $ weaviate-cli revoke-token --name "alice_study_group" && \
    weaviate-cli revoke-token --name "bob_study_group" && \
    weaviate-cli revoke-token --name "carol_study_group"
  
  Cleanup:
    ├─ All three tokens immediately invalid
    ├─ Study group cannot query anymore
    ├─ Historical queries still in audit log (you can review)
    └─ Next time Alice tries: 401 Unauthorized
```

---

## Part 3: Implementation (Homelab-Simplified)

### Phase 1: Foundation (Week 1)

```bash
# 1. Deploy Weaviate locally
docker pull semitechnologies/weaviate:1.24
docker run -d \
  -p 8080:8080 \
  -e MULTITENANCY_ENABLED=true \
  -e AUTHENTICATION_APIKEY_ENABLED=true \
  -e AUTHENTICATION_APIKEY_ALLOWED_KEYS="your-master-key" \
  -v weaviate_data:/var/lib/weaviate \
  semitechnologies/weaviate:1.24

# 2. Create Infrastructure Shard
curl -X POST http://localhost:8080/v1/schema \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-key" \
  -d '{
    "class": "PersonalKnowledge",
    "multiTenancy": { "enabled": true },
    "properties": [
      { "name": "topic", "dataType": ["text"] },
      { "name": "content", "dataType": ["text"] },
      { "name": "source", "dataType": ["text"] },
      { "name": "created_date", "dataType": ["date"] },
      { "name": "importance", "dataType": ["number"] },
      { "name": "tags", "dataType": ["text[]"] },
      { "name": "status", "dataType": ["text"] }
    ],
    "vectorizer": "text2vec-transformers"
  }'

# 3. Test query
curl -X POST http://localhost:8080/v1/graphql \
  -H "Authorization: Bearer your-master-key" \
  -d '{"query": "{ Aggregate { PersonalKnowledge { meta { count } } } }"}'

echo "✅ Weaviate ready for data"
```

### Phase 2: Add Shards (Week 2)

```bash
# Create Private Shard (identical setup, different class name)
# Create Project Shard (for research documents)
# Create Catalog Shard (for files)

# All follow same pattern:
# 1. POST /v1/schema with class definition
# 2. multiTenancy: true
# 3. Appropriate properties for your use case
```

### Phase 3: Guest Access (Week 2-3)

```bash
# Simple token generation (via API or CLI)

# Helper function to create guest token
create_guest_token() {
  local guest_name=$1
  local projects=$2  # CSV list
  local visibility=$3
  
  # In production, use secure token generation
  # For homelab, simple approach:
  local token="guest_${guest_name}_$(openssl rand -hex 16)"
  
  echo "Token for $guest_name: $token"
  echo "Projects: $projects"
  echo "Visibility: $visibility"
  
  # Store in secure location (or Vault)
  # Configure Weaviate to validate against this token
}

create_guest_token "friend_sarah" \
  "tech_research_2026,ai_safety_papers" \
  "Friends"

create_guest_token "study_group_temporary" \
  "ai_alignment_papers" \
  "Public"
```

---

## Part 4: Security (Homelab-Appropriate)

### 4.1 Access Control Enforcement

```
Authorization Layer (Simple but Effective):

  1. Token Validation (Middleware)
     ├─ Extract token from request header
     ├─ Lookup token → {guest_name, projects, visibility}
     ├─ If not found or expired → 401 Unauthorized
     └─ Continue to query authorization

  2. Query Authorization (Tenant Filtering)
     ├─ If master token:
     │   ├─ Allow all tenants (Infra + Private + Projects + Catalog)
     │   └─ Return all documents
     │
     ├─ If guest token:
     │   ├─ Filter tenants: only authorized projects
     │   ├─ Filter documents: respect visibility settings
     │   └─ Return only visible results
     │
     └─ If no token → 401

  3. Query Injection Prevention
     ├─ Tenant parameter set by backend (not from user input)
     ├─ User query only affects WHERE clause
     ├─ No risk of bypass (structural)
     └─ Example:
         User input: "OR tenant='private_personal'"
         Backend ignores this, uses authorized tenant only
```

### 4.2 Audit Logging (Simple)

```bash
# Log every query attempt (basic)

audit_query() {
  local token=$1
  local tenant=$2
  local query=$3
  local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  
  echo "{
    \"timestamp\": \"$timestamp\",
    \"token_user\": \"$(token_to_user $token)\",
    \"tenant\": \"$tenant\",
    \"query_length\": ${#query},
    \"result_count\": $result_count,
    \"latency_ms\": $latency
  }" >> ~/weaviate_audit.log
}

# Review who accessed what
tail -100 ~/weaviate_audit.log | jq '.'
```

---

## Part 5: Cost & Sizing (16GB, i5-12600H)

```
YOUR HOMELAB RESOURCES:

Hardware:
  ├─ Server: i5-12600H (existing)
  ├─ RAM: 16GB (existing)
  ├─ NVMe: 1TB (add $80)
  ├─ USB HDD: 4TB (add $120) optional
  └─ Total new cost: ~$100–$200

Storage (Typical Usage):

  Infra Shard:
    ├─ 2M vectors
    ├─ ~20GB disk
    ├─ Always in RAM (~1GB)
    └─ Available to everyone

  Private Shard:
    ├─ 500K vectors
    ├─ ~5GB disk
    ├─ In RAM when you search (~300MB)
    └─ Never shared with guests

  Project Shards (Multiple):
    ├─ 5–50M vectors per project
    ├─ 10–100GB disk per project
    ├─ Lazy load: only active projects in RAM
    └─ Guests access only if shared

  Catalog Shard:
    ├─ 5000 files = ~5K vectors
    ├─ ~5GB disk (files + metadata)
    ├─ Usually in RAM (~500MB)
    └─ Guests see only "Public"/"Friends" files

Total Budget (5-Year):

  Hardware: $200 (one-time)
  Power: ~$500 (5 years @ 100W continuous)
  Backups: USB drives ~$50 (one-time)
  Cloud sync (optional): $5–$10/month
  ───────────────────────────
  Total: ~$800 self-hosted (incredible bargain)

Operational Overhead:

  ├─ Setup: ~2–4 hours (one-time)
  ├─ Daily: Zero (automated)
  ├─ Weekly: 30 min backup check
  ├─ Monthly: 1 hour maintenance + optimization
  └─ Total: ~4 hours/month (hobby-scale)
```

---

## Part 6: Quick Start (Copy-Paste Ready)

### Docker Compose Setup

```yaml
version: '3.8'
services:
  weaviate:
    image: semitechnologies/weaviate:1.24
    restart: always
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_APIKEY_ENABLED: "true"
      AUTHENTICATION_APIKEY_ALLOWED_KEYS: "your-master-key-here,guest-key-example"
      PERSISTENCE_DATA_PATH: "/var/lib/weaviate"
      MULTITENANCY_ENABLED: "true"
      LOG_LEVEL: "info"
    volumes:
      - weaviate_data:/var/lib/weaviate
    networks:
      - weaviate

  # Optional: Simple web UI for testing
  weaviate-console:
    image: semitechnologies/weaviate-console:latest
    restart: always
    ports:
      - "3001:3001"
    environment:
      NEXT_PUBLIC_WEAVIATE_URL: "http://localhost:8080"
      NEXT_PUBLIC_API_KEY: "your-master-key-here"
    networks:
      - weaviate

volumes:
  weaviate_data:

networks:
  weaviate:
```

### Create Collections (Python)

```python
import weaviate

client = weaviate.Client(
    url="http://localhost:8080",
    auth_client_secret=weaviate.AuthApiKey(api_key="your-master-key-here"),
)

# 1. Infra Shard
client.schema.create_class({
    "class": "PersonalKnowledge",
    "multiTenancy": {"enabled": True},
    "properties": [
        {"name": "topic", "dataType": ["text"]},
        {"name": "content", "dataType": ["text"]},
        {"name": "created_date", "dataType": ["date"]},
        {"name": "importance", "dataType": ["number"]},
        {"name": "tags", "dataType": ["text[]"]},
    ],
    "vectorizer": "text2vec-transformers",
})

# 2. Private Shard
client.schema.create_class({
    "class": "PrivateNote",
    "multiTenancy": {"enabled": True},
    "properties": [
        {"name": "title", "dataType": ["text"]},
        {"name": "content", "dataType": ["text"]},
        {"name": "note_type", "dataType": ["text"]},
        {"name": "privacy_level", "dataType": ["text"]},
        {"name": "share_with", "dataType": ["text[]"]},
    ],
    "vectorizer": "text2vec-transformers",
})

# 3. Project Shard
client.schema.create_class({
    "class": "ProjectDocument",
    "multiTenancy": {"enabled": True},
    "properties": [
        {"name": "title", "dataType": ["text"]},
        {"name": "content", "dataType": ["text"]},
        {"name": "source_url", "dataType": ["text"]},
        {"name": "your_notes", "dataType": ["text"]},
    ],
    "vectorizer": "text2vec-openai",
})

# 4. Catalog Shard
client.schema.create_class({
    "class": "ResearchFile",
    "multiTenancy": {"enabled": True},
    "properties": [
        {"name": "file_name", "dataType": ["text"]},
        {"name": "content", "dataType": ["text"]},
        {"name": "metadata_title", "dataType": ["text"]},
        {"name": "visibility", "dataType": ["text"]},
        {"name": "starred", "dataType": ["boolean"]},
    ],
    "vectorizer": "text2vec-transformers",
})

print("✅ All collections created")
```

### Add & Query Data

```python
# Add a note to Infra shard
client.data_object.create(
    class_name="PersonalKnowledge",
    data_object={
        "topic": "DevOps",
        "content": "Docker best practices for Apple Silicon...",
        "created_date": "2026-01-26T15:00:00Z",
        "importance": 4,
        "tags": ["docker", "m1", "deployment"],
    },
    tenant="infra_personal",
)

# Query as yourself (master token)
result = client.query.get(
    class_name="PersonalKnowledge",
    properties=["topic", "content", "importance"],
).with_hybrid(
    query="Docker best practices",
    alpha=0.6,
).with_limit(10).do()

print(result)

# Query as guest (guest token) - automatically filters by visibility
# Same query, but guest-token middleware restricts to visible projects
```

---

## Conclusion

**This architecture is perfect for your homelab because:**

✅ **You're the owner** - No complex RBAC, simple token-based access  
✅ **Occasional guests** - Easy to generate/revoke tokens  
✅ **Flexible sharing** - Decide per-project, per-file what's shared  
✅ **Low overhead** - ~4 hours/month maintenance  
✅ **Cheap** - ~$200 hardware + $100/year power  
✅ **Scalable** - Works from 1 to 100+ guests  

**Immediate next steps:**

1. Run Docker Compose setup (10 minutes)
2. Create 4 collections (Python script, 5 minutes)
3. Add your first notes (10 minutes)
4. Test with master token (5 minutes)
5. Generate guest token for a friend (5 minutes)
6. Share + watch them query your knowledge base

**Total time to first guest query: ~1 hour**

---

**Author:** Technical Architecture Team  
**Date:** January 26, 2026  
**Version:** 2.0 (Personal Homelab Edition)  
**Audience:** Solo developer + occasional guests
