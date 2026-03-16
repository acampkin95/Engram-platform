/**
 * HTTP client for the AI Memory System API
 */

export interface Memory {
  memory_id: string;
  content: string;
  summary?: string;
  tier: number;
  memory_type: string;
  source: string;
  project_id?: string;
  user_id?: string;
  tenant_id: string;
  importance: number;
  confidence: number;
  tags: string[];
  created_at: string;
  score?: number;
}

export interface SearchResult {
  results: Memory[];
  query: string;
  total: number;
}

export interface KnowledgeEntity {
  entity_id: string;
  name: string;
  entity_type: string;
  description?: string;
  project_id?: string;
  tenant_id: string;
  aliases: string[];
  created_at: string;
}

export interface KnowledgeRelation {
  relation_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  weight: number;
  project_id?: string;
  tenant_id: string;
  context?: string;
  created_at: string;
}

export interface GraphQueryResult {
  root_entity_id: string;
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  depth: number;
}

export interface Stats {
  total_memories: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  by_type: Record<string, number>;
  avg_importance: number;
}

export class MemoryAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const apiKey = process.env.AI_MEMORY_API_KEY;
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }
    return headers;
  }

  async addMemory(data: {
    content: string;
    tier?: number;
    memory_type?: string;
    project_id?: string;
    user_id?: string;
    tenant_id?: string;
    importance?: number;
    tags?: string[];
  }): Promise<{ memory_id: string; tier: number }> {
    const response = await fetch(`${this.baseUrl}/memories`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to add memory: ${response.statusText}`);
    }

    return response.json();
  }

  async searchMemories(params: {
    query: string;
    tier?: number;
    project_id?: string;
    user_id?: string;
    tenant_id?: string;
    limit?: number;
  }): Promise<SearchResult> {
    const response = await fetch(`${this.baseUrl}/memories/search`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to search memories: ${response.statusText}`);
    }

    return response.json();
  }

  async getMemory(memoryId: string, tier: number, tenantId?: string): Promise<Memory | null> {
    const url = new URL(`${this.baseUrl}/memories/${memoryId}`);
    url.searchParams.set("tier", String(tier));
    if (tenantId) {
      url.searchParams.set("tenant_id", tenantId);
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get memory: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteMemory(memoryId: string, tier: number, tenantId?: string): Promise<boolean> {
    const url = new URL(`${this.baseUrl}/memories/${memoryId}`);
    url.searchParams.set("tier", String(tier));
    if (tenantId) {
      url.searchParams.set("tenant_id", tenantId);
    }

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    return response.ok;
  }

  async getStats(tenantId?: string): Promise<Stats> {
    const url = new URL(`${this.baseUrl}/stats`);
    if (tenantId) {
      url.searchParams.set("tenant_id", tenantId);
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get stats: ${response.statusText}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<{
    status: string;
    weaviate: boolean;
    redis: boolean;
  }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async batchAddMemories(data: {
    memories: Array<{
      content: string;
      tier?: number;
      memory_type?: string;
      project_id?: string;
      user_id?: string;
      tenant_id?: string;
      importance?: number;
      tags?: string[];
    }>;
  }): Promise<{ memory_ids: string[]; failed: number; total: number }> {
    const response = await fetch(`${this.baseUrl}/memories/batch`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to batch add: ${response.statusText}`);
    }

    return response.json();
  }

  async buildContext(params: {
    query: string;
    tier?: number;
    project_id?: string;
    user_id?: string;
    session_id?: string;
    max_tokens?: number;
  }): Promise<{ query: string; context: string; token_estimate: number }> {
    const response = await fetch(`${this.baseUrl}/memories/context`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to build context: ${response.statusText}`);
    }

    return response.json();
  }

  async ragQuery(params: {
    query: string;
    tier?: number;
    project_id?: string;
    user_id?: string;
    session_id?: string;
  }): Promise<{
    query: string;
    mode: string;
    synthesis_prompt: string;
    source_count: number;
    context: Record<string, unknown>;
  }> {
    const response = await fetch(`${this.baseUrl}/memories/rag`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed RAG query: ${response.statusText}`);
    }

    return response.json();
  }

  async consolidateMemories(params: {
    project_id?: string;
    tenant_id?: string;
  }): Promise<{ processed: number }> {
    const response = await fetch(`${this.baseUrl}/memories/consolidate`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to consolidate: ${response.statusText}`);
    }

    return response.json();
  }

  async cleanupExpired(params: { tenant_id?: string }): Promise<{ removed: number }> {
    const response = await fetch(`${this.baseUrl}/memories/cleanup`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to cleanup: ${response.statusText}`);
    }

    return response.json();
  }

  async addEntity(data: {
    name: string;
    entity_type: string;
    description?: string;
    project_id?: string;
    tenant_id?: string;
    aliases?: string[];
  }): Promise<{ entity_id: string }> {
    const response = await fetch(`${this.baseUrl}/graph/entities`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to add entity: ${response.statusText}`);
    }
    return response.json();
  }

  async addRelation(data: {
    source_entity_id: string;
    target_entity_id: string;
    relation_type: string;
    weight?: number;
    project_id?: string;
    tenant_id?: string;
    context?: string;
  }): Promise<{ relation_id: string }> {
    const response = await fetch(`${this.baseUrl}/graph/relations`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to add relation: ${response.statusText}`);
    }
    return response.json();
  }

  async queryGraph(params: {
    entity_id: string;
    depth?: number;
    project_id?: string;
    tenant_id?: string;
  }): Promise<GraphQueryResult> {
    const response = await fetch(`${this.baseUrl}/graph/query`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error(`Failed to query graph: ${response.statusText}`);
    }
    return response.json();
  }

  async getEntity(entityId: string, tenantId?: string): Promise<KnowledgeEntity | null> {
    const url = new URL(`${this.baseUrl}/graph/entities/${entityId}`);
    if (tenantId) {
      url.searchParams.set("tenant_id", tenantId);
    }
    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to get entity: ${response.statusText}`);
    }
    return response.json();
  }

  async deleteEntity(entityId: string, tenantId?: string): Promise<boolean> {
    const url = new URL(`${this.baseUrl}/graph/entities/${entityId}`);
    if (tenantId) {
      url.searchParams.set("tenant_id", tenantId);
    }
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return response.ok;
  }

  async findEntityByName(
    name: string,
    tenantId?: string,
    projectId?: string
  ): Promise<KnowledgeEntity | null> {
    const url = new URL(`${this.baseUrl}/graph/entities/by-name`);
    url.searchParams.set("name", name);
    if (tenantId) {
      url.searchParams.set("tenant_id", tenantId);
    }
    if (projectId) {
      url.searchParams.set("project_id", projectId);
    }
    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to find entity by name: ${response.statusText}`);
    }
    return response.json();
  }
  async createMatter(data: {
    matter_id: string;
    title: string;
    description?: string;
    lead_investigator?: string;
    tags?: string[];
  }): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/matters/`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to create matter: ${response.statusText}`);
    }
    return response.json() as Promise<Record<string, unknown>>;
  }

  async ingestDocument(data: {
    matter_id: string;
    content: string;
    source_url: string;
    source_type?: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/matters/${data.matter_id}/evidence`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to ingest document: ${response.statusText}`);
    }
    return ((await response.json()) as unknown[]) ?? [];
  }

  async searchMatter(data: {
    matter_id: string;
    query: string;
    limit?: number;
  }): Promise<{ total: number; results: unknown[] }> {
    const response = await fetch(`${this.baseUrl}/matters/${data.matter_id}/evidence/search`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        matter_id: data.matter_id,
        query: data.query,
        limit: data.limit ?? 10,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to search matter: ${response.statusText}`);
    }
    return response.json() as Promise<{ total: number; results: unknown[] }>;
  }
}
