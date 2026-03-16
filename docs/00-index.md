# Engram Platform Documentation Index

**Version:** 1.0.0 | **Last Updated:** March 2026

---

## Documentation Overview

This directory contains comprehensive documentation for the Engram Platform. All manuals are designed to be over 2000 words and provide detailed guidance for deployment, maintenance, and administration.

---

## Getting Started

New to Engram? Start with the [project README](../README.md) for an overview and quick start, then return here for detailed documentation.

---

## Primary Manuals

| Manual | File | Description |
|--------|------|-------------|
| **Deployment Manual** | [01-deployment-manual.md](01-deployment-manual.md) | Complete deployment guide with prerequisites, Docker configuration, production setup, and security hardening |
| **Maintenance Manual** | [02-maintenance-manual.md](02-maintenance-manual.md) | Routine maintenance schedules, backup procedures, performance tuning, and disaster recovery |
| **Architecture Manual** | [03-architecture-manual.md](03-architecture-manual.md) | System architecture, component diagrams, data flow, and integration points |
| **Troubleshooting Manual** | [04-troubleshooting-manual.md](04-troubleshooting-manual.md) | Diagnostic methodology, common issues, error reference, and emergency procedures |
| **MCP Manual** | [05-mcp-manual.md](05-mcp-manual.md) | MCP server (Engram-MCP) installation, configuration, tools reference, and integration guides |
| **Admin Manual** | [06-admin-manual.md](06-admin-manual.md) | User management, tenant administration, security configuration, and audit logging |
| **Pre-Commit Guide** | [07-pre-commit-guide.md](07-pre-commit-guide.md) | Git hooks for code quality, secrets detection, and formatting enforcement |

---

## Reference Sheets

| Reference | File | Description |
|-----------|------|-------------|
| **Environment Variables** | [reference/environment-variables.md](reference/environment-variables.md) | Complete list of all environment variables with descriptions and defaults |
| **Ports & Network** | [reference/ports-network.md](reference/ports-network.md) | Service ports, internal URLs, and network architecture |
| **Commands** | [reference/commands.md](reference/commands.md) | Quick reference for Docker, API, Git, and system commands |

---

## Quick Navigation

### By Task

| Task | Primary Document | Section |
|------|------------------|---------|
| Initial deployment | Deployment Manual | Docker Deployment |
| Production setup | Deployment Manual | Production Deployment |
| Daily maintenance | Maintenance Manual | Routine Maintenance Schedule |
| Backup creation | Maintenance Manual | Backup Procedures |
| System architecture | Architecture Manual | High-Level Architecture |
| API structure | Architecture Manual | API Architecture |
| Debugging issues | Troubleshooting Manual | Diagnostic Methodology |
| Error resolution | Troubleshooting Manual | Common Issues and Solutions |
| MCP integration | MCP Manual | Integration Guides |
| Tool reference | MCP Manual | Tool Reference |
| User management | Admin Manual | User Management |
| Tenant setup | Admin Manual | Tenant Management |
| Security config | Admin Manual | Security Administration |

### By Role

| Role | Essential Documents |
|------|---------------------|
| **DevOps Engineer** | Deployment, Maintenance, Troubleshooting |
| **Backend Developer** | Architecture, MCP, API Reference |
| **Frontend Developer** | Architecture, Commands Reference |
| **System Administrator** | Admin, Maintenance, Security sections |
| **Security Officer** | Admin Manual (Security), Troubleshooting |

---

## Autopilot Integration

### AGENTS.md Autopilot

The Engram Platform includes an `AGENTS.md` file at the repository root that provides AI assistants with project context. This enables:

- **Automatic context loading** - AI assistants understand project structure
- **Code pattern recognition** - Consistent coding standards enforcement
- **Navigation assistance** - Quick location of relevant files

#### AGENTS.md Location

```
/Engram/
├── AGENTS.md                    # Root context file
├── Engram-AiMemory/
│   └── AGENTS.md               # Memory system context
├── Engram-AiCrawler/
│   └── AGENTS.md               # Crawler context
├── Engram-MCP/
│   └── AGENTS.md               # MCP server context
└── Engram-Platform/
    └── AGENTS.md               # Platform frontend context
```

#### AGENTS.md Structure

Each `AGENTS.md` contains:

1. **Overview** - Project description and purpose
2. **Structure** - Directory layout and file organization
3. **Where to Look** - Task-to-location mapping
4. **Conventions** - Coding standards and patterns
5. **Commands** - Common development commands
6. **Anti-Patterns** - Things to avoid

### CLAUDE.md Autopilot

The `CLAUDE.md` file provides Claude-specific instructions for working with this codebase:

#### Key Features

- **Infrastructure credentials** - SSH access and server information
- **Project rules** - Documentation standards and session logging
- **Quality control** - Review and verification requirements

#### CLAUDE.md Location

```
/Engram/
├── CLAUDE.md                    # Root Claude instructions
└── .claude/
    └── CLAUDE.md               # User-specific Claude config
```

### Using Autopilot

When working with AI assistants on this project:

1. **Context is automatic** - AI reads AGENTS.md for project context
2. **Reference these docs** - Point AI to specific manuals as needed
3. **Follow conventions** - AI will enforce patterns from AGENTS.md
4. **Use reference sheets** - Quick lookups for commands and variables

---

## Documentation Standards

### File Naming Convention

```
NN-manual-name.md           # Primary manuals (NN = 01-99)
reference/topic-name.md     # Reference sheets
```

### Manual Structure

Each manual follows this structure:

1. **Title and Metadata** - Version, date, classification
2. **Table of Contents** - Linked sections
3. **Overview** - Introduction and purpose
4. **Main Content** - Organized by topic
5. **Reference Tables** - Quick lookup data
6. **Document Control** - Author and review dates

### Word Count Requirement

All primary manuals must be **2000+ words** to ensure comprehensive coverage.

---

## External Resources

### Official Documentation

| Resource | URL | Description |
|----------|-----|-------------|
| Weaviate Docs | https://weaviate.io/developers/weaviate | Vector database documentation |
| FastAPI Docs | https://fastapi.tiangolo.com/ | Python web framework |
| Next.js Docs | https://nextjs.org/docs | React framework |
| Clerk Docs | https://clerk.com/docs | Authentication |
| MCP Spec | https://modelcontextprotocol.io/ | Model Context Protocol |

### Infrastructure

| Resource | Description |
|----------|-------------|
| Tailscale Admin | VPN management console |
| Clerk Dashboard | User authentication management |
| Docker Hub | Container image registry |

---

## Contributing to Documentation

### Update Process

1. **Make changes** - Edit the appropriate markdown file
2. **Verify word count** - Ensure 2000+ words for manuals
3. **Update table of contents** - If adding new sections
4. **Update this index** - If adding new documents
5. **Update review date** - In document control section

### Style Guide

- **Headers**: Use ATX style (`# Header`)
- **Lists**: Use `-` for unordered, `1.` for ordered
- **Code blocks**: Specify language (```bash, ```python, etc.)
- **Tables**: Use pipe format with header separator
- **Links**: Use relative paths for internal links

### Quality Checklist

- [ ] Word count meets minimum (2000+ for manuals)
- [ ] All code examples are tested
- [ ] Links are valid
- [ ] Tables are properly formatted
- [ ] Table of contents matches sections
- [ ] Document control updated

---

## Shared Utilities

| Resource | Description |
|----------|-------------|
| [engram-shared](../engram-shared/README.md) | Shared Python package (logging, config, HTTP, auth, health) |
| [engram-shared Quickstart](../engram-shared/QUICKSTART.md) | Code examples and usage guide |
| [Dependency Audit](../aistore/reports/DEPENDENCY_AUDIT_OPTIMISED.md) | Latest dependency audit with removal recommendations |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | March 2026 | Initial documentation release |

---

## Document Control

| Author | Review Date | Next Review |
|--------|-------------|-------------|
| Engram Team | March 2026 | September 2026 |

---

## Quick Start for AI Assistants

If you're an AI assistant reading this documentation:

1. **Start with AGENTS.md** - Read the root AGENTS.md for project overview
2. **Check CLAUDE.md** - Review any specific instructions
3. **Use this index** - Navigate to relevant documentation
4. **Reference sheets** - Use for quick lookups
5. **Follow conventions** - Maintain consistency with existing patterns

```
Recommended reading order for new AI sessions:
1. /AGENTS.md          → Project context
2. /CLAUDE.md          → Specific instructions
3. /docs/00-index.md   → This file
4. Task-specific manual → As needed
```

---

*This documentation is maintained as part of the Engram Platform. For questions or contributions, contact the Engram Team.*
