const fs = require('fs');

// 1. Patch client.ts
let clientTs = fs.readFileSync('src/client.ts', 'utf8');

const clientAdditions = `
        async getMemoryGrowthAnalytics(tenantId?: string): Promise<unknown> {
                const url = new URL(\`\${this.baseUrl}/analytics/memory-growth\`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }

        async getActivityTimeline(tenantId?: string): Promise<unknown> {
                const url = new URL(\`\${this.baseUrl}/analytics/activity-timeline\`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }

        async getSearchStats(tenantId?: string): Promise<unknown> {
                const url = new URL(\`\${this.baseUrl}/analytics/search-stats\`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }

        async getKnowledgeGraphStats(tenantId?: string): Promise<unknown> {
                const url = new URL(\`\${this.baseUrl}/analytics/knowledge-graph-stats\`);
                if (tenantId) url.searchParams.set("tenant_id", tenantId);
                const response = await resilientFetch(url.toString(), { headers: this.getHeaders() });
                if (!response.ok) throw createErrorFromStatus(response.status, response.statusText);
                return this.parseJSON<unknown>(response);
        }
`;

const insertClientIndex = clientTs.indexOf('async getAnalytics');
if (insertClientIndex > -1) {
    clientTs = clientTs.slice(0, insertClientIndex) + clientAdditions + clientTs.slice(insertClientIndex);
    fs.writeFileSync('src/client.ts', clientTs);
    console.log('Patched client.ts');
}

// 2. Patch schemas.ts
let schemasTs = fs.readFileSync('src/schemas.ts', 'utf8');
const schemaAdditions = `
export const MemoryGrowthSchema = z.object({ tenant_id: z.string().optional() });
export const ActivityTimelineSchema = z.object({ tenant_id: z.string().optional() });
export const SearchStatsSchema = z.object({ tenant_id: z.string().optional() });
export const KnowledgeGraphStatsSchema = z.object({ tenant_id: z.string().optional() });
`;
schemasTs = schemasTs + '\n' + schemaAdditions;
fs.writeFileSync('src/schemas.ts', schemasTs);
console.log('Patched schemas.ts');

// 3. Patch tool-definitions.ts
let toolDefs = fs.readFileSync('src/tools/tool-definitions.ts', 'utf8');
const toolDefsAdditions = `
        {
                name: "get_memory_growth",
                description: "Get memory growth analytics data.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "get_activity_timeline",
                description: "Get user activity timeline analytics.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "get_search_stats",
                description: "Get memory search statistics.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        {
                name: "get_kg_stats",
                description: "Get knowledge graph statistics.",
                inputSchema: { type: "object", properties: { tenant_id: { type: "string" } } },
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
`;
const insertDefsIndex = toolDefs.indexOf('];\n\n/**\n * Entity tool definitions');
if (insertDefsIndex > -1) {
    toolDefs = toolDefs.slice(0, insertDefsIndex) + toolDefsAdditions + toolDefs.slice(insertDefsIndex);
    fs.writeFileSync('src/tools/tool-definitions.ts', toolDefs);
    console.log('Patched tool-definitions.ts');
}

// 4. Patch memory-tools.ts
let memoryTools = fs.readFileSync('src/tools/memory-tools.ts', 'utf8');

// Update imports
const oldImports = `        GetAnalyticsSchema,
        GetSystemMetricsSchema,
        ManageTenantSchema,
        validate,
} from "../schemas.js";`;

const newImports = `        GetAnalyticsSchema,
        GetSystemMetricsSchema,
        ManageTenantSchema,
        MemoryGrowthSchema,
        ActivityTimelineSchema,
        SearchStatsSchema,
        KnowledgeGraphStatsSchema,
        validate,
} from "../schemas.js";`;
memoryTools = memoryTools.replace(oldImports, newImports);

const handlerAdditions = `
                case "get_memory_growth": {
                        const input = validate(MemoryGrowthSchema, args) as z.infer<typeof MemoryGrowthSchema>;
                        const result = await client.getMemoryGrowthAnalytics(input.tenant_id);
                        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: result }, null, 2) }] };
                }

                case "get_activity_timeline": {
                        const input = validate(ActivityTimelineSchema, args) as z.infer<typeof ActivityTimelineSchema>;
                        const result = await client.getActivityTimeline(input.tenant_id);
                        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: result }, null, 2) }] };
                }

                case "get_search_stats": {
                        const input = validate(SearchStatsSchema, args) as z.infer<typeof SearchStatsSchema>;
                        const result = await client.getSearchStats(input.tenant_id);
                        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: result }, null, 2) }] };
                }

                case "get_kg_stats": {
                        const input = validate(KnowledgeGraphStatsSchema, args) as z.infer<typeof KnowledgeGraphStatsSchema>;
                        const result = await client.getKnowledgeGraphStats(input.tenant_id);
                        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: result }, null, 2) }] };
                }
`;

const handlerInsertIndex = memoryTools.indexOf('default:');
if (handlerInsertIndex > -1) {
    memoryTools = memoryTools.slice(0, handlerInsertIndex) + handlerAdditions + '\n                ' + memoryTools.slice(handlerInsertIndex);
    fs.writeFileSync('src/tools/memory-tools.ts', memoryTools);
    console.log('Patched memory-tools.ts');
}
