#!/usr/bin/env python3
"""Generate Engram Platform Architecture & Feature Factsheet PDF.

Uses ReportLab Platypus for multi-page document with tables, headers/footers,
and structured layout. Run: python3 docs/generate_factsheet_pdf.py
"""

from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import os

# ─── Colour Palette (Engram brand) ──────────────────────────────────────────
VOID = HexColor("#03020A")
AMBER = HexColor("#F2A93B")
VIOLET = HexColor("#7C5CBF")
TEAL = HexColor("#2EC4C4")
DARK_BG = HexColor("#0D0B14")
HEADER_BG = HexColor("#1A1726")
ROW_ALT = HexColor("#F7F5FA")
ROW_WHITE = HexColor("#FFFFFF")
BORDER = HexColor("#D4D0DC")
TEXT_DARK = HexColor("#1A1726")
TEXT_MUTED = HexColor("#6B6880")
LINK_BLUE = HexColor("#4A6FA5")

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "ENGRAM_PLATFORM_FACTSHEET.pdf")


def get_styles():
    """Build custom paragraph styles."""
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="DocTitle",
            parent=styles["Title"],
            fontSize=22,
            leading=28,
            textColor=HEADER_BG,
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="DocSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
            spaceAfter=16,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=styles["Heading1"],
            fontSize=16,
            leading=22,
            textColor=HEADER_BG,
            spaceBefore=14,
            spaceAfter=8,
            borderWidth=0,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubSection",
            parent=styles["Heading2"],
            fontSize=12,
            leading=16,
            textColor=VIOLET,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=TEXT_DARK,
            alignment=TA_LEFT,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodySmall",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=TEXT_DARK,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CodeBlock",
            parent=styles["Code"],
            fontSize=7.5,
            leading=10,
            textColor=HexColor("#2D2B38"),
            backColor=HexColor("#F0EEF4"),
            borderWidth=0,
            leftIndent=8,
            rightIndent=8,
            spaceBefore=4,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CellText",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=TEXT_DARK,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CellBold",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=TEXT_DARK,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            name="CellHeader",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=white,
            fontName="Helvetica-Bold",
        )
    )
    return styles


def header_footer(canvas, doc):
    """Draw header/footer on every page."""
    canvas.saveState()
    w, h = A4

    # Header bar
    canvas.setFillColor(HEADER_BG)
    canvas.rect(0, h - 1.2 * cm, w, 1.2 * cm, fill=True, stroke=False)

    canvas.setFillColor(AMBER)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(1.8 * cm, h - 0.85 * cm, "ENGRAM PLATFORM")

    canvas.setFillColor(HexColor("#A09CB0"))
    canvas.setFont("Helvetica", 7)
    canvas.drawRightString(
        w - 1.8 * cm, h - 0.75 * cm, "Architecture & Feature Factsheet"
    )
    canvas.drawRightString(w - 1.8 * cm, h - 1.0 * cm, "2026-03-17  |  v0.7.0")

    # Amber accent line
    canvas.setStrokeColor(AMBER)
    canvas.setLineWidth(2)
    canvas.line(0, h - 1.2 * cm, w, h - 1.2 * cm)

    # Footer
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(
        1.8 * cm, 1.0 * cm, "Internal Technical Reference  |  Confidential"
    )
    canvas.drawRightString(w - 1.8 * cm, 1.0 * cm, f"Page {doc.page}")

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(1.8 * cm, 1.4 * cm, w - 1.8 * cm, 1.4 * cm)

    canvas.restoreState()


def make_table(data, col_widths, header_color=VIOLET):
    """Build a styled table with alternating rows."""
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), header_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        # Data
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 1), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("LINEBELOW", (0, 0), (-1, 0), 1, header_color),
        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    # Alternating rows
    for i in range(1, len(data)):
        bg = ROW_ALT if i % 2 == 1 else ROW_WHITE
        style_cmds.append(("BACKGROUND", (0, i), (-1, i), bg))

    table.setStyle(TableStyle(style_cmds))
    return table


def p(text, style_name="CellText", styles=None):
    """Shorthand for Paragraph in table cells."""
    if styles is None:
        styles = get_styles()
    return Paragraph(text, styles[style_name])


def build_pdf():
    """Build the 3-page factsheet PDF."""
    styles = get_styles()

    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        title="Engram Platform — Architecture & Feature Factsheet",
        author="Engram Engineering",
    )

    story = []
    usable_w = A4[0] - 3.6 * cm  # ~17.4cm

    # ═══════════════════════════════════════════════════════════════════
    # PAGE 1: Architecture Overview
    # ═══════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("Engram Platform", styles["DocTitle"]))
    story.append(
        Paragraph(
            "Architecture &amp; Feature Factsheet  |  v0.7.0  |  2026-03-17",
            styles["DocSubtitle"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    story.append(
        Paragraph(
            "Engram is a production-grade multi-layer AI memory and intelligence platform. "
            "It gives AI assistants persistent, searchable memory across projects, backed by "
            "an OSINT web crawler, knowledge graph engine, and unified dashboard.",
            styles["Body"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    # --- Service Topology Table ---
    story.append(Paragraph("Service Topology", styles["SectionTitle"]))
    topo_data = [
        ["Service", "Technology", "Port", "Purpose"],
        ["Platform UI", "Next.js 15, React 19", "3002", "Unified frontend dashboard"],
        ["Memory API", "Python 3.11+, FastAPI", "8000", "3-tier vector memory system"],
        [
            "Crawler API",
            "Python 3.11+, FastAPI",
            "11235",
            "OSINT web crawler + AI analysis",
        ],
        ["MCP Server", "TypeScript, Node 20", "3000", "Model Context Protocol bridge"],
        ["Weaviate", "Go (vector DB)", "8080", "Vector storage + semantic search"],
        ["Crawler Redis", "Redis 7", "6379", "Crawler cache + job queue"],
        ["Memory Redis", "Redis 7", "6380", "Memory cache + rate limiting"],
    ]
    story.append(
        make_table(topo_data, [2.6 * cm, 4.0 * cm, 1.4 * cm, usable_w - 8.0 * cm])
    )
    story.append(Spacer(1, 0.4 * cm))

    # --- Data Pipeline ---
    story.append(Paragraph("Data Pipeline", styles["SectionTitle"]))
    story.append(
        Paragraph(
            "<b>Stage 1 — Discover &amp; Scrape (AiCrawler :11235)</b><br/>"
            "Crawl4AI + Playwright browser automation. Alias discovery across 8 platforms. "
            "Deep/batch crawling. LM Studio AI analysis. Image intelligence. "
            "Results cached in ChromaDB + Redis.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Stage 2 — Store &amp; Index (AiMemory :8000)</b><br/>"
            "3-tier memory hierarchy (Project / General / Global). Embedding generation "
            "(OpenAI / DeepInfra / Nomic / local). Knowledge graph entities + relations. "
            "Relevance decay, consolidation, contradiction detection.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Stage 3 — Expose to AI Clients (MCP :3000)</b><br/>"
            "25+ MCP tools for Claude/Cursor. Auto memory hooks (pre: recall, post: store). "
            "OAuth 2.1 with PKCE. Dual transport: stdio (local) + HTTP streaming (remote).",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Stage 4 — Visualise &amp; Manage (Platform :3002)</b><br/>"
            "Memory browser, crawler dashboard, knowledge graph viewer, analytics. "
            "Clerk auth, Zustand v5 state, SWR v2 data fetching, 22-component design system.",
            styles["Body"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    # --- Memory Tiers ---
    story.append(Paragraph("Memory Tier Architecture", styles["SubSection"]))
    tier_data = [
        ["Tier", "Scope", "Isolation", "Use Case"],
        ["1", "Project", "Per-project", "Code insights, decisions, patterns"],
        ["2", "General", "Per-user", "Preferences, workflows, cross-project"],
        ["3", "Global", "Shared", "Best practices, documentation, bootstrap"],
    ]
    story.append(
        make_table(tier_data, [1.2 * cm, 2.5 * cm, 2.8 * cm, usable_w - 6.5 * cm], TEAL)
    )
    story.append(Spacer(1, 0.3 * cm))

    # --- Auth Matrix ---
    story.append(Paragraph("Authentication Matrix", styles["SubSection"]))
    auth_data = [
        ["Service", "Method", "Token Type", "Expiry"],
        ["Memory API", "JWT + API Key", "HS256", "24 hours"],
        ["Crawler API", "JWT (Clerk)", "RS256", "Session"],
        ["MCP Server", "OAuth 2.1 / Bearer", "PKCE", "1 hr / 24 hr"],
        ["Platform", "Clerk", "Session", "Rolling"],
    ]
    story.append(
        make_table(auth_data, [3.0 * cm, 3.8 * cm, 2.8 * cm, usable_w - 9.6 * cm])
    )

    # ═══════════════════════════════════════════════════════════════════
    # PAGE 2: Feature Spec & API Endpoints
    # ═══════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(
        Paragraph("Feature Specification &amp; API Endpoints", styles["SectionTitle"])
    )
    story.append(Spacer(1, 0.2 * cm))

    # --- Feature Matrix ---
    story.append(Paragraph("Feature Matrix", styles["SubSection"]))
    Y = '<font color="#2EC4C4"><b>Y</b></font>'
    feat_data = [
        ["Feature", "Memory", "Crawler", "MCP", "Platform"],
        ["Semantic search", Y, Y, Y, Y],
        ["Knowledge graph", Y, Y, Y, Y],
        ["OSINT alias discovery", "", Y, "", Y],
        ["Dark web monitoring", "", Y, "", Y],
        ["Image intelligence", "", Y, "", Y],
        ["Case management", "", Y, "", Y],
        ["Scheduled crawling", "", Y, "", Y],
        ["RAG pipeline", Y, Y, Y, ""],
        ["Memory decay", Y, "", Y, ""],
        ["Multi-tenancy", Y, "", Y, ""],
        ["OAuth 2.1", "", "", Y, ""],
        ["Real-time WebSocket", "", Y, "", Y],
        ["Investigation mgmt", Y, Y, Y, Y],
    ]
    feat_cols = [4.0 * cm, 2.0 * cm, 2.0 * cm, 2.0 * cm, 2.0 * cm]
    story.append(make_table(feat_data, feat_cols, AMBER))
    story.append(Spacer(1, 0.3 * cm))

    # --- Endpoint Summary ---
    story.append(Paragraph("API Endpoint Summary", styles["SubSection"]))

    # AiMemory endpoints
    story.append(
        Paragraph("<b>Engram-AiMemory</b> — 28 endpoints (Port 8000)", styles["Body"])
    )
    mem_ep = [
        ["Group", "Count", "Key Paths"],
        ["Health", "2", "/health, /health/detailed"],
        ["Auth", "2", "/auth/login, /auth/refresh"],
        [
            "Memories",
            "11",
            "/memories CRUD, /search, /batch, /context, /rag, /consolidate, /decay",
        ],
        [
            "Analytics",
            "6",
            "/stats, /analytics/memory-growth, activity, search-stats, metrics, kg-stats",
        ],
        ["Tenants", "3", "/tenants CRUD"],
        [
            "Knowledge Graph",
            "4",
            "/graph/entities CRUD, /graph/relations, /graph/query",
        ],
    ]
    story.append(make_table(mem_ep, [3.0 * cm, 1.4 * cm, usable_w - 4.4 * cm]))
    story.append(Spacer(1, 0.3 * cm))

    # AiCrawler endpoints
    story.append(
        Paragraph(
            "<b>Engram-AiCrawler</b> — 100+ endpoints (Port 11235)", styles["Body"]
        )
    )
    crawl_ep = [
        ["Group", "Count", "Key Paths"],
        ["Crawl", "7", "/api/crawl/start, batch, deep, status, list, cancel, delete"],
        [
            "OSINT",
            "9",
            "/api/osint/alias/discover, search | image/analyze, search | scan, scan/sync",
        ],
        [
            "Dark Web",
            "8",
            "/api/darkweb/scan/marketplace, breach, crypto, full, correlate, status",
        ],
        [
            "Cases",
            "20",
            "/api/cases/ CRUD, subjects, evidence, notes, link/*, export/*, timeline",
        ],
        ["Chat/LM", "4", "/api/chat/completions, sessions, history, clear"],
        [
            "Data Mgmt",
            "13",
            "/api/data/sets CRUD, migrate, export, offload, archive-rules",
        ],
        [
            "Knowledge Graph",
            "10",
            "/api/knowledge-graph/build, search, merge, export, entities",
        ],
        ["Extraction", "7", "/api/extraction/templates CRUD, fetch-page, preview"],
        ["RAG", "5", "/api/rag/config, preview-chunking, process, status"],
        ["Scheduling", "7", "/api/scheduler/schedules CRUD, toggle, run"],
        [
            "Performance",
            "17",
            "/api/performance/storage/*, cache/*, jobs/*, chroma/*, governor/*",
        ],
        ["Stats/Settings", "6", "/api/stats/dashboard, system | /api/settings/ CRUD"],
    ]
    story.append(make_table(crawl_ep, [2.6 * cm, 1.4 * cm, usable_w - 4.0 * cm]))
    story.append(Spacer(1, 0.3 * cm))

    # MCP tools
    story.append(Paragraph("<b>Engram-MCP</b> — 25 tools (Port 3000)", styles["Body"]))
    mcp_ep = [
        ["Category", "Count", "Tools"],
        [
            "Memory",
            "10",
            "add, search, get, delete, list, batch_add, build_context, rag_query, consolidate, cleanup",
        ],
        ["Entity/Graph", "4", "add_entity, add_relation, query_graph, health_check"],
        ["Investigation", "3", "create_matter, ingest_document, search_matter"],
        [
            "Analytics/Admin",
            "8",
            "export, bulk_delete, confidence_maintenance, analytics, metrics, tenant, growth, activity",
        ],
    ]
    story.append(make_table(mcp_ep, [2.6 * cm, 1.4 * cm, usable_w - 4.0 * cm]))
    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "<b>OAuth 2.1 Endpoints:</b> /.well-known/oauth-authorization-server, /oauth/register, "
            "/oauth/authorize, /oauth/token",
            styles["BodySmall"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    # Platform routes
    story.append(
        Paragraph(
            "<b>Engram-Platform</b> — 7 API routes + 18 pages (Port 3002)",
            styles["Body"],
        )
    )
    plat_ep = [
        ["Route", "Method", "Purpose"],
        ["/api/system/health", "GET", "System health snapshot"],
        ["/api/system/logs", "GET", "Fetch system logs"],
        ["/api/system/logs/stream", "GET (SSE)", "Stream logs real-time"],
        ["/api/system/history", "GET", "System event history"],
        ["/api/system/maintenance", "POST", "Trigger maintenance"],
        ["/api/system/control", "POST", "Control services"],
        ["/api/system/notifications", "POST", "Manage notifications"],
    ]
    story.append(make_table(plat_ep, [4.6 * cm, 2.2 * cm, usable_w - 6.8 * cm]))
    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "<b>Dashboard Pages (18):</b> Home, Memory (Memories, Graph, Analytics, Matters, Timeline), "
            "Crawler (Crawl, OSINT, Investigations, Knowledge Graph, Home), "
            "Intelligence (Chat, Search, Investigations, Knowledge Graph), System Health",
            styles["BodySmall"],
        )
    )

    # ═══════════════════════════════════════════════════════════════════
    # PAGE 3: Code Map & Status
    # ═══════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("Code Map &amp; Current Status", styles["SectionTitle"]))
    story.append(Spacer(1, 0.2 * cm))

    # --- Source File Counts ---
    story.append(Paragraph("Source File Inventory", styles["SubSection"]))
    file_data = [
        ["Subproject", "Language", "Source", "Tests", "Key Entry Point (LOC)"],
        ["AiMemory", "Python", "40", "30", "api.py (1,884)"],
        ["", "TypeScript", "~10", "5", "client.py (1,312)"],
        ["AiCrawler", "Python", "104", "73", "main.py (322)"],
        ["", "TypeScript", "~15", "22", "16 API router files"],
        ["MCP Server", "TypeScript", "34", "22", "server.ts (247)"],
        ["", "", "", "", "tool-definitions.ts (648)"],
        ["Platform", "TypeScript", "244", "554", "layout.tsx (283)"],
        ["", "", "", "", "22 design system components"],
        ["TOTAL", "Mixed", "~447", "~706", ""],
    ]
    story.append(
        make_table(
            file_data, [2.4 * cm, 2.2 * cm, 1.6 * cm, 1.6 * cm, usable_w - 7.8 * cm]
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    # --- Key Module Map ---
    story.append(Paragraph("Key Module Map", styles["SubSection"]))

    # AiMemory
    story.append(
        Paragraph("<b>AiMemory</b> — packages/core/src/memory_system/", styles["Body"])
    )
    mem_map = [
        ["Module", "LOC", "Purpose"],
        ["api.py", "1,884", "FastAPI endpoint definitions (28 routes)"],
        ["system.py", "1,349", "Memory orchestration core (CRUD + maintenance)"],
        [
            "client.py",
            "1,312",
            "Weaviate vector DB client (collections, search, batch)",
        ],
        ["workers.py", "654", "Background jobs (decay, consolidation, cleanup)"],
        ["decay.py", "124", "Relevance decay algorithm (time-based scoring)"],
        ["embeddings.py", "—", "Provider abstraction (OpenAI/DeepInfra/Nomic/local)"],
        ["rag.py", "—", "RAG pipeline (retrieval + synthesis)"],
        ["investigation/", "—", "Legal matter management + document ingestion"],
    ]
    story.append(make_table(mem_map, [2.8 * cm, 1.2 * cm, usable_w - 4.0 * cm], TEAL))
    story.append(Spacer(1, 0.3 * cm))

    # AiCrawler
    story.append(Paragraph("<b>AiCrawler</b> — 01_devroot/app/", styles["Body"]))
    crawl_map = [
        ["Module", "Files", "Purpose"],
        [
            "api/",
            "16",
            "REST API routers (crawl, chat, data, OSINT, cases, KG, RAG, scheduler)",
        ],
        [
            "osint/",
            "13",
            "OSINT engines (alias, image, semantic, threat, email, face, darkweb)",
        ],
        ["services/", "—", "Cache (multi-layer Redis), concurrency governor"],
        ["orchestrators/", "—", "Multi-step OSINT pipeline orchestration"],
        ["storage/", "—", "ChromaDB vector store client"],
        ["websocket/", "—", "WebSocket manager for real-time updates"],
        ["workers/", "—", "Background job workers (crawl, scan, cleanup)"],
    ]
    story.append(
        make_table(crawl_map, [2.8 * cm, 1.2 * cm, usable_w - 4.0 * cm], AMBER)
    )
    story.append(Spacer(1, 0.3 * cm))

    # MCP + Platform (side by side via single table)
    story.append(
        Paragraph("<b>MCP Server</b> — src/ (34 TypeScript files)", styles["Body"])
    )
    mcp_map = [
        ["Module", "LOC", "Purpose"],
        ["tools/tool-definitions.ts", "648", "25+ MCP tool definitions"],
        ["auth/oauth-server.ts", "543", "OAuth 2.1 + PKCE + RFC 7591"],
        ["schemas.ts", "284", "Zod input validation (27 schemas)"],
        ["server.ts", "247", "MCP Server factory (stdio + HTTP)"],
        ["errors.ts", "187", "Typed error hierarchy (8 error classes)"],
        ["circuit-breaker.ts", "—", "Circuit breaker (threshold: 5, reset: 30s)"],
        ["hooks/", "—", "Pre/post tool hooks (auto memory recall/store)"],
    ]
    story.append(make_table(mcp_map, [4.0 * cm, 1.2 * cm, usable_w - 5.2 * cm], VIOLET))
    story.append(Spacer(1, 0.3 * cm))

    story.append(
        Paragraph(
            "<b>Platform</b> — frontend/ (244 source + 94 app files)", styles["Body"]
        )
    )
    plat_map = [
        ["Module", "Count", "Purpose"],
        [
            "app/dashboard/",
            "18 pages",
            "Memory, Crawler, Intelligence, System dashboard routes",
        ],
        [
            "app/api/system/",
            "7 routes",
            "Health, logs, maintenance, control, notifications",
        ],
        [
            "src/design-system/",
            "22 components",
            "Badge, Button, Card, DataTable, Modal, StatCard, Toast...",
        ],
        [
            "src/components/",
            "13 files",
            "ErrorBoundary, DraggableGrid, FilterBar, Skeletons, Theme",
        ],
        [
            "src/hooks/",
            "7 hooks",
            "useHealthPolling, useRAGChat, useWebSocket, useURLState...",
        ],
        [
            "src/lib/",
            "6 files",
            "memory-client, crawler-client, system-client, performance",
        ],
        ["src/stores/", "1 store", "Zustand v5 uiStore (sidebar, services, theme)"],
        ["src/providers/", "3 files", "Clerk, SWR, URLState, Motion providers"],
    ]
    story.append(make_table(plat_map, [3.2 * cm, 2.0 * cm, usable_w - 5.2 * cm]))
    story.append(Spacer(1, 0.3 * cm))

    # --- Docker Compose ---
    story.append(Paragraph("Docker Compose Orchestration", styles["SubSection"]))
    docker_data = [
        ["Service", "Memory", "CPU", "Image"],
        ["memory-api", "1 GB", "1.0", "FastAPI :8000"],
        ["crawler-api", "3 GB", "2.0", "FastAPI :11235"],
        ["mcp-server", "512 MB", "0.5", "Node.js :3000"],
        ["platform", "512 MB", "0.5", "Next.js :3002"],
        ["weaviate", "2 GB", "1.0", "Vector DB :8080"],
        ["crawler-redis", "1 GB", "0.5", "Redis :6379"],
        ["memory-redis", "768 MB", "0.5", "Redis :6380"],
        ["nginx", "256 MB", "0.5", "Reverse proxy :80"],
        ["TOTAL", "10.5 GB", "6.5", "8 services / 469 LOC"],
    ]
    story.append(
        make_table(docker_data, [2.6 * cm, 2.0 * cm, 1.4 * cm, usable_w - 6.0 * cm])
    )
    story.append(Spacer(1, 0.3 * cm))

    # --- Current Status ---
    story.append(Paragraph("Current Status &amp; Gaps", styles["SubSection"]))
    status_data = [
        ["Metric", "Current", "Target", "Gap"],
        ["Overall completion", "70%", "100%", "30%"],
        ["AiMemory test coverage", "~80%", "95%", "15%"],
        ["AiCrawler test coverage", "58%", "85%", "27%"],
        ["Platform test coverage", "Baseline TBD", "80%", "TBD"],
        ["MCP tests", "381 passing", "Coverage reporting", "Pending"],
        ["Docker RAM usage", "10.5 GB", "8.5 GB", "-2 GB"],
        ["NIST compliance", "Partial", "Full", "Encryption, vault, logging"],
    ]
    story.append(
        make_table(status_data, [3.6 * cm, 3.0 * cm, 3.0 * cm, usable_w - 9.6 * cm])
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(
        Paragraph(
            "<i>Generated from live codebase analysis on 2026-03-17. "
            "See PROJECT_ROADMAP.md for the 10-week completion plan.</i>",
            styles["BodySmall"],
        )
    )

    # ─── Build ───────────────────────────────────────────────────────
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
