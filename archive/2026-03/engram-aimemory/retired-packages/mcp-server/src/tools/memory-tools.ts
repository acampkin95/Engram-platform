/**
 * Memory tools for MCP server
 */

import type { MemoryAPIClient } from "../client.js";
import {
  AddMemorySchema,
  BatchAddMemoriesSchema,
  BuildContextSchema,
  CleanupExpiredSchema,
  ConsolidateMemoriesSchema,
  DeleteMemorySchema,
  GetMemorySchema,
  ListMemoriesSchema,
  RagQuerySchema,
  SearchMemorySchema,
  validate,
} from "../schemas.js";

export const MEMORY_TOOLS = [
  {
    name: "add_memory",
    description:
      "Add a new memory to the AI memory system. Memories are stored in one of 3 tiers: Tier 1 (project-scoped), Tier 2 (user-specific, cross-project), or Tier 3 (global/shared).",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The memory content to store",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description:
            "Memory tier: 1=Project (isolated), 2=General (user-specific), 3=Global (shared)",
          default: 1,
        },
        memory_type: {
          type: "string",
          enum: [
            "fact",
            "insight",
            "code",
            "conversation",
            "document",
            "preference",
            "error_solution",
            "workflow",
          ],
          description: "Type of memory being stored",
          default: "fact",
        },
        project_id: {
          type: "string",
          description: "Project identifier (required for Tier 1 memories)",
        },
        user_id: {
          type: "string",
          description: "User identifier for Tier 1/2 memories",
        },
        tenant_id: {
          type: "string",
          description: "Tenant identifier for multi-tenancy",
          default: "default",
        },
        importance: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Importance score from 0 to 1",
          default: 0.5,
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "search_memory",
    description:
      "Search memories using semantic similarity. Returns the most relevant memories based on the query.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description: "Filter by tier (optional)",
        },
        project_id: {
          type: "string",
          description: "Filter by project ID",
        },
        user_id: {
          type: "string",
          description: "Filter by user ID",
        },
        tenant_id: {
          type: "string",
          description: "Filter by tenant ID",
          default: "default",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Maximum results to return",
          default: 10,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_memory",
    description: "Retrieve a specific memory by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "The UUID of the memory",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description: "The tier the memory is stored in",
        },
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
      },
      required: ["memory_id", "tier"],
    },
  },
  {
    name: "delete_memory",
    description: "Delete a memory from the system.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "The UUID of the memory to delete",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description: "The tier the memory is stored in",
        },
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
      },
      required: ["memory_id", "tier"],
    },
  },
  {
    name: "list_memories",
    description: "Get statistics and overview of stored memories across all tiers.",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
      },
    },
  },
  {
    name: "batch_add_memories",
    description:
      "Add multiple memories in a single batch operation. More efficient than adding one by one.",
    inputSchema: {
      type: "object",
      properties: {
        memories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Memory content",
              },
              tier: {
                type: "number",
                enum: [1, 2, 3],
                description: "Memory tier: 1=Project, 2=General, 3=Global",
                default: 1,
              },
              memory_type: {
                type: "string",
                description: "Type of memory being stored",
                default: "fact",
              },
              project_id: {
                type: "string",
                description: "Project identifier",
              },
              user_id: {
                type: "string",
                description: "User identifier",
              },
              tenant_id: {
                type: "string",
                description: "Tenant identifier",
                default: "default",
              },
              importance: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "Importance score from 0 to 1",
                default: 0.5,
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags for categorization",
              },
            },
            required: ["content"],
          },
          description: "Array of memories to add (max 100)",
          maxItems: 100,
        },
      },
      required: ["memories"],
    },
  },
  {
    name: "build_context",
    description:
      "Build a formatted context string from relevant memories for a given query. Useful for assembling prompt context from stored knowledge.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Query to build context for",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description: "Filter by tier (optional)",
        },
        project_id: {
          type: "string",
          description: "Filter by project ID",
        },
        user_id: {
          type: "string",
          description: "Filter by user ID",
        },
        session_id: {
          type: "string",
          description: "Session ID for context scoping",
        },
        max_tokens: {
          type: "number",
          minimum: 100,
          maximum: 32000,
          description: "Maximum token budget for context",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "rag_query",
    description:
      "Perform a RAG (Retrieval-Augmented Generation) query over memories. Returns a synthesis prompt with relevant context for LLM consumption.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Query for RAG retrieval",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description: "Filter by tier (optional)",
        },
        project_id: {
          type: "string",
          description: "Filter by project ID",
        },
        user_id: {
          type: "string",
          description: "Filter by user ID",
        },
        session_id: {
          type: "string",
          description: "Session ID for context scoping",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "consolidate_memories",
    description:
      "Trigger memory consolidation. Merges and summarizes related memories to reduce redundancy and improve retrieval quality.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Consolidate memories for a specific project",
        },
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
      },
    },
  },
  {
    name: "cleanup_expired",
    description:
      "Remove expired memories from the system. Cleans up memories that have passed their expiration date.",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
      },
    },
  },
] as const;

export async function handleMemoryTool(
  name: string,
  args: Record<string, unknown>,
  client: MemoryAPIClient
): Promise<{ content: Array<{ type: string; text: string }> } | null> {
  switch (name) {
    case "add_memory": {
      const input = validate(AddMemorySchema, args);
      const result = await client.addMemory({
        content: input.content,
        tier: input.tier,
        memory_type: input.memory_type,
        project_id: input.project_id,
        user_id: input.user_id,
        tenant_id: input.tenant_id,
        importance: input.importance,
        tags: input.tags,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                memory_id: result.memory_id,
                tier: result.tier,
                message: `Memory added successfully to Tier ${result.tier}`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "search_memory": {
      const input = validate(SearchMemorySchema, args);
      const result = await client.searchMemories({
        query: input.query,
        tier: input.tier,
        project_id: input.project_id,
        user_id: input.user_id,
        tenant_id: input.tenant_id,
        limit: input.limit,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "get_memory": {
      const input = validate(GetMemorySchema, args);
      const memory = await client.getMemory(input.memory_id, input.tier, input.tenant_id);

      if (!memory) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: "Memory not found", memory_id: input.memory_id },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(memory, null, 2),
          },
        ],
      };
    }

    case "delete_memory": {
      const input = validate(DeleteMemorySchema, args);
      const success = await client.deleteMemory(input.memory_id, input.tier, input.tenant_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success,
                memory_id: input.memory_id,
                message: success ? "Memory deleted" : "Failed to delete memory",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "list_memories": {
      const input = validate(ListMemoriesSchema, args);
      const stats = await client.getStats(input.tenant_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                overview: {
                  total: stats.total_memories,
                  by_tier: {
                    project: stats.tier1_count,
                    general: stats.tier2_count,
                    global: stats.tier3_count,
                  },
                  by_type: stats.by_type,
                  average_importance: stats.avg_importance.toFixed(2),
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "batch_add_memories": {
      const input = validate(BatchAddMemoriesSchema, args);
      const result = await client.batchAddMemories({
        memories: input.memories,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                memory_ids: result.memory_ids,
                failed: result.failed,
                total: result.total,
                message: `Batch added ${result.memory_ids.length} memories (${result.failed} failed)`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "build_context": {
      const input = validate(BuildContextSchema, args);
      const result = await client.buildContext({
        query: input.query,
        tier: input.tier,
        project_id: input.project_id,
        user_id: input.user_id,
        session_id: input.session_id,
        max_tokens: input.max_tokens,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                query: result.query,
                context: result.context,
                token_estimate: result.token_estimate,
                message: `Built context with ~${result.token_estimate} tokens`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "rag_query": {
      const input = validate(RagQuerySchema, args);
      const result = await client.ragQuery({
        query: input.query,
        tier: input.tier,
        project_id: input.project_id,
        user_id: input.user_id,
        session_id: input.session_id,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                query: result.query,
                mode: result.mode,
                synthesis_prompt: result.synthesis_prompt,
                source_count: result.source_count,
                context: result.context,
                message: `RAG query completed with ${result.source_count} sources`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "consolidate_memories": {
      const input = validate(ConsolidateMemoriesSchema, args);
      const result = await client.consolidateMemories({
        project_id: input.project_id,
        tenant_id: input.tenant_id,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                processed: result.processed,
                message: `Consolidated ${result.processed} memories`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "cleanup_expired": {
      const input = validate(CleanupExpiredSchema, args);
      const result = await client.cleanupExpired({
        tenant_id: input.tenant_id,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                removed: result.removed,
                message: `Removed ${result.removed} expired memories`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      return null;
  }
}
