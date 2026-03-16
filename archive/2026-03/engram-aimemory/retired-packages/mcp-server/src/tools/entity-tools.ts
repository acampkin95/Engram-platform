/**
 * Entity tools for knowledge graph operations
 */

import type { MemoryAPIClient } from "../client.js";
import { AddEntitySchema, AddRelationSchema, QueryGraphSchema, validate } from "../schemas.js";

export const ENTITY_TOOLS = [
  {
    name: "add_entity",
    description:
      "Add an entity to the knowledge graph. Entities are nodes in the graph that represent concepts, people, projects, etc.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the entity",
        },
        entity_type: {
          type: "string",
          description: "Type of entity (e.g., person, project, concept, tool)",
        },
        description: {
          type: "string",
          description: "Description of the entity",
        },
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
        aliases: {
          type: "array",
          items: { type: "string" },
          description: "Alternative names for the entity",
        },
      },
      required: ["name", "entity_type"],
    },
  },
  {
    name: "add_relation",
    description: "Add a relationship between two entities in the knowledge graph.",
    inputSchema: {
      type: "object",
      properties: {
        source_entity: {
          type: "string",
          description: "Name of the source entity",
        },
        relation_type: {
          type: "string",
          description: "Type of relationship (e.g., works_on, depends_on, knows, uses)",
        },
        target_entity: {
          type: "string",
          description: "Name of the target entity",
        },
        weight: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Strength of the relationship (0-1)",
          default: 1,
        },
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
      },
      required: ["source_entity", "relation_type", "target_entity"],
    },
  },
  {
    name: "query_graph",
    description: "Query the knowledge graph for entities and their relationships.",
    inputSchema: {
      type: "object",
      properties: {
        entity_name: {
          type: "string",
          description: "Name of the entity to query",
        },
        depth: {
          type: "number",
          minimum: 1,
          maximum: 3,
          description: "How many hops to traverse",
          default: 1,
        },
        tenant_id: {
          type: "string",
          description: "Tenant ID for multi-tenancy",
          default: "default",
        },
      },
      required: ["entity_name"],
    },
  },
] as const;

export async function handleEntityTool(
  name: string,
  args: Record<string, unknown>,
  _client: MemoryAPIClient
): Promise<{ content: Array<{ type: string; text: string }> } | null> {
  switch (name) {
    case "add_entity": {
      const input = validate(AddEntitySchema, args);
      const result = await _client.addEntity({
        name: input.name,
        entity_type: input.entity_type,
        description: input.description,
        tenant_id: input.tenant_id,
        aliases: input.aliases || [],
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                entity_id: result.entity_id,
                message: `Entity '${args.name}' added to knowledge graph`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
    case "add_relation": {
      const input = validate(AddRelationSchema, args);
      const tenantId = input.tenant_id;
      // Resolve source entity name → ID
      const sourceEntity = await _client.findEntityByName(input.source_entity, tenantId);
      if (!sourceEntity) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: `Source entity '${input.source_entity}' not found. Add it first with add_entity.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      // Resolve target entity name → ID
      const targetEntity = await _client.findEntityByName(input.target_entity, tenantId);
      if (!targetEntity) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: `Target entity '${input.target_entity}' not found. Add it first with add_entity.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      const relation = await _client.addRelation({
        source_entity_id: sourceEntity.entity_id,
        target_entity_id: targetEntity.entity_id,
        relation_type: input.relation_type,
        weight: input.weight,
        tenant_id: tenantId,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                relation_id: relation.relation_id,
                message: `Relation '${input.source_entity}' -[${input.relation_type}]-> '${input.target_entity}' added`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
    case "query_graph": {
      const input = validate(QueryGraphSchema, args);
      const tenantId = input.tenant_id;
      // Resolve entity name → ID
      const entity = await _client.findEntityByName(input.entity_name, tenantId);
      if (!entity) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: `Entity '${input.entity_name}' not found.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      const graphResult = await _client.queryGraph({
        entity_id: entity.entity_id,
        depth: input.depth,
        tenant_id: tenantId,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                root_entity: entity.name,
                root_entity_id: graphResult.root_entity_id,
                entities: graphResult.entities,
                relations: graphResult.relations,
                depth: graphResult.depth,
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
