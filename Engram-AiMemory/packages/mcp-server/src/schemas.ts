/**
 * Zod schemas for MCP tool input validation
 */

import { z } from "zod";

// ============================================
// Common schemas
// ============================================

export const TierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const MemoryTypeSchema = z.enum([
  "fact",
  "insight",
  "code",
  "conversation",
  "document",
  "preference",
  "error_solution",
  "workflow",
]);

export const TenantIdSchema = z.string().default("default");

export const ImportanceSchema = z.number().min(0).max(1).default(0.5);

export const TagsSchema = z.array(z.string()).optional();

// ============================================
// Memory tool schemas
// ============================================

export const AddMemorySchema = z.object({
  content: z.string().min(1, "Content is required"),
  tier: TierSchema.default(1),
  memory_type: MemoryTypeSchema.default("fact"),
  project_id: z.string().optional(),
  user_id: z.string().optional(),
  tenant_id: TenantIdSchema,
  importance: ImportanceSchema,
  tags: TagsSchema,
});

export const SearchMemorySchema = z.object({
  query: z.string().min(1, "Query is required"),
  tier: TierSchema.optional(),
  project_id: z.string().optional(),
  user_id: z.string().optional(),
  tenant_id: TenantIdSchema,
  limit: z.number().min(1).max(100).default(10),
});

export const GetMemorySchema = z.object({
  memory_id: z.string().uuid("Memory ID must be a valid UUID"),
  tier: TierSchema,
  tenant_id: TenantIdSchema,
});

export const DeleteMemorySchema = z.object({
  memory_id: z.string().uuid("Memory ID must be a valid UUID"),
  tier: TierSchema,
  tenant_id: TenantIdSchema,
});

export const ListMemoriesSchema = z.object({
  tenant_id: TenantIdSchema,
});

const MemoryItemSchema = z.object({
  content: z.string().min(1, "Content is required"),
  tier: TierSchema.default(1),
  memory_type: MemoryTypeSchema.default("fact"),
  project_id: z.string().optional(),
  user_id: z.string().optional(),
  tenant_id: TenantIdSchema,
  importance: ImportanceSchema,
  tags: TagsSchema,
});

export const BatchAddMemoriesSchema = z.object({
  memories: z.array(MemoryItemSchema).min(1).max(100),
});

export const BuildContextSchema = z.object({
  query: z.string().min(1, "Query is required"),
  tier: TierSchema.optional(),
  project_id: z.string().optional(),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  max_tokens: z.number().min(100).max(32000).optional(),
});

export const RagQuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
  tier: TierSchema.optional(),
  project_id: z.string().optional(),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
});

export const ConsolidateMemoriesSchema = z.object({
  project_id: z.string().optional(),
  tenant_id: TenantIdSchema,
});

export const CleanupExpiredSchema = z.object({
  tenant_id: TenantIdSchema,
});

// ============================================
// Entity tool schemas
// ============================================

export const AddEntitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  entity_type: z.string().min(1, "Entity type is required"),
  description: z.string().optional(),
  tenant_id: TenantIdSchema,
  aliases: z.array(z.string()).optional(),
});

export const AddRelationSchema = z.object({
  source_entity: z.string().min(1, "Source entity is required"),
  relation_type: z.string().min(1, "Relation type is required"),
  target_entity: z.string().min(1, "Target entity is required"),
  weight: z.number().min(0).max(1).default(1),
  tenant_id: TenantIdSchema,
});

export const QueryGraphSchema = z.object({
  entity_name: z.string().min(1, "Entity name is required"),
  depth: z.number().min(1).max(3).default(1),
  tenant_id: TenantIdSchema,
});

// ============================================
// Type exports
// ============================================

export type AddMemoryInput = z.infer<typeof AddMemorySchema>;
export type SearchMemoryInput = z.infer<typeof SearchMemorySchema>;
export type GetMemoryInput = z.infer<typeof GetMemorySchema>;
export type DeleteMemoryInput = z.infer<typeof DeleteMemorySchema>;
export type ListMemoriesInput = z.infer<typeof ListMemoriesSchema>;
export type BatchAddMemoriesInput = z.infer<typeof BatchAddMemoriesSchema>;
export type BuildContextInput = z.infer<typeof BuildContextSchema>;
export type RagQueryInput = z.infer<typeof RagQuerySchema>;
export type ConsolidateMemoriesInput = z.infer<typeof ConsolidateMemoriesSchema>;
export type CleanupExpiredInput = z.infer<typeof CleanupExpiredSchema>;

export type AddEntityInput = z.infer<typeof AddEntitySchema>;
export type AddRelationInput = z.infer<typeof AddRelationSchema>;
export type QueryGraphInput = z.infer<typeof QueryGraphSchema>;

// ============================================
// Validation helper
// ============================================

import { InvalidInputError } from "./errors.js";

/**
 * Validate input against a schema and throw InvalidInputError on failure
 */
export function validate<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    });

    throw new InvalidInputError(`Validation failed: ${issues.join("; ")}`, {
      issues,
    });
  }

  return result.data;
}

/**
 * Create a safe parser that returns either the parsed data or an error
 */
export function createSafeParser<T>(schema: z.ZodSchema<T>) {
  return (
    input: unknown
  ): { success: true; data: T } | { success: false; error: InvalidInputError } => {
    const result = schema.safeParse(input);

    if (!result.success) {
      const issues = result.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      });

      return {
        success: false,
        error: new InvalidInputError(`Validation failed: ${issues.join("; ")}`, { issues }),
      };
    }

    return { success: true, data: result.data };
  };
}
