const fs = require('fs');
const file = 'src/schemas.ts';
let code = fs.readFileSync(file, 'utf8');

const badSchema = `export const SearchMemorySchema = z.object({
     query: z.string().min(1, "Query is required"),
     tier: TierSchema.optional(),
     project_id: z.string().optional(),
     user_id: z.string().optional(),
     tenant_id: TenantIdSchema,
     limit: z.number().min(1).max(100).default(10),
});`;

const goodSchema = `export const SearchMemorySchema = z.object({
     query: z.string().min(1, "Query is required"),
     tier: TierSchema.optional(),
     project_id: z.string().optional(),
     user_id: z.string().optional(),
     tenant_id: TenantIdSchema,
     limit: z.number().min(1).max(100).default(10),
     event_only: z.boolean().optional(),
     start_date: z.string().optional(),
     end_date: z.string().optional(),
});`;

code = code.replace(badSchema, goodSchema);
fs.writeFileSync(file, code);
console.log('Updated MCP schemas.ts');

const clientFile = 'src/client.ts';
let clientCode = fs.readFileSync(clientFile, 'utf8');

const badClientSearch = `        async searchMemory(params: {
                query: string;
                tier?: number;
                project_id?: string;
                user_id?: string;
                tenant_id?: string;
                limit?: number;
        }): Promise<{ results: any[] }> {
                const response = await resilientFetch(\`\${this.baseUrl}/memories/search\`, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify(params),
                });`;

const goodClientSearch = `        async searchMemory(params: {
                query: string;
                tier?: number;
                project_id?: string;
                user_id?: string;
                tenant_id?: string;
                limit?: number;
                event_only?: boolean;
                start_date?: string;
                end_date?: string;
        }): Promise<{ results: any[] }> {
                const response = await resilientFetch(\`\${this.baseUrl}/memories/search\`, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify(params),
                });`;

clientCode = clientCode.replace(badClientSearch, goodClientSearch);
fs.writeFileSync(clientFile, clientCode);
console.log('Updated MCP client.ts');

const toolsFile = 'src/tools/memory-tools.ts';
let toolsCode = fs.readFileSync(toolsFile, 'utf8');

const badToolsSearch = `                        const result = await client.searchMemory({
                                query: input.query,
                                tier: input.tier,
                                project_id: input.project_id,
                                user_id: input.user_id,
                                tenant_id: input.tenant_id,
                                limit: input.limit,
                        });`;

const goodToolsSearch = `                        const result = await client.searchMemory({
                                query: input.query,
                                tier: input.tier,
                                project_id: input.project_id,
                                user_id: input.user_id,
                                tenant_id: input.tenant_id,
                                limit: input.limit,
                                event_only: input.event_only,
                                start_date: input.start_date,
                                end_date: input.end_date,
                        });`;

toolsCode = toolsCode.replace(badToolsSearch, goodToolsSearch);
fs.writeFileSync(toolsFile, toolsCode);
console.log('Updated MCP tools.ts');
