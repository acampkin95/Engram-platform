# AI Memory System - Planning Draft

## User Requirements (Synthesized)

### Core Architecture
- **3-Tier Memory System**:
  1. **Project Shard**: Per-project isolated memory
  2. **General/Long-term**: Shared across projects but user-specific
  3. **Global/Shared Bootstrap**: Base knowledge available to all

### Technology Stack
- **Vector Database**: Full relationship-vector database (Weaviate based on existing work)
- **Cache**: Redis for caching and optimization
- **Web GUI**: Data visualizers, knowledge graph maps, data explorer
- **MCP Framework**: Full MCP server integration
- **Agent Compatibility**: Snippet and static memory files for other AI agents

### Key Features
- Sharding per project
- Interactive knowledge graph visualization
- Data explorer dashboard
- Cache optimization
- Cross-agent memory compatibility (.claude, .cursor style files)

### Prior Art
- Existing architecture document: `Ubuntu_Memory_Knowledge_Server_Architecture.md`
- Existing Weaviate research in `05_research/`
- Existing Python implementations in `01_devroot/`

## Research Findings

### Vector DB Recommendations
- Weaviate: Best for relationship + vector hybrid, multi-tenancy built-in
- Redis: Already integrated, good for caching layer
- Neo4j: Alternative for pure graph, but less suited for vectors

### MCP Framework
- Model Context Protocol specification available
- Existing implementations: spatial-memory-mcp, pageindex-mcp, mcp-server-weaviate
- Can implement custom tools for memory operations

### Visualization Stack
- react-force-graph-2d: For knowledge graph visualization
- @xyflow/react: For interactive node graphs
- recharts: For data analytics
- Next.js + Tailwind for dashboard

## Plan Structure

### Phase 1: Foundation
- Core 3-tier architecture
- Weaviate schema design
- Redis caching layer
- MCP server setup

### Phase 2: Project Sharding
- Per-project tenant isolation
- Memory file compatibility
- Snippet management

### Phase 3: Web Dashboard
- Knowledge graph visualizer
- Data explorer
- Interactive UI

### Phase 4: Optimization
- Cache strategies
- Performance tuning
- Cross-agent compatibility
