const fs = require('fs');
const file = 'src/tools/memory-tools.ts';
let code = fs.readFileSync(file, 'utf8');

const newToolDef = `
export const RunDecaySchema = z.object({
        tenant_id: z.string().optional(),
});

export const RunDecayTool: Tool = {
        name: "run_decay",
        description: "Manually trigger the memory decay update operation across the tenant. This updates memory relevance scores based on time passed and access frequency.",
        inputSchema: zodToJsonSchema(RunDecaySchema),
};
`;

code = code.replace(/import { Tool } from "@modelcontextprotocol\/sdk\/types.js";\n/, `import { Tool } from "@modelcontextprotocol/sdk/types.js";\nimport { z } from "zod";\nimport { zodToJsonSchema } from "zod-to-json-schema";\n`);

code = code.replace(/export const MEMORY_TOOLS: Tool\[\] = \[/, newToolDef + '\nexport const MEMORY_TOOLS: Tool[] = [\n\t\tRunDecayTool,');

const newHandler = `
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
                                                                message: \`Removed \${result.removed} expired memories\`,
                                                        },
                                                        null,
                                                        2,
                                                ),
                                        },
                                ],
                        };
                }

                case "run_decay": {
                        const input = validate(RunDecaySchema, args);
                        const result = await client.runDecay({
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
                                                                message: \`Manually processed decay for \${result.processed} memories\`,
                                                        },
                                                        null,
                                                        2,
                                                ),
                                        },
                                ],
                        };
                }`;

code = code.replace(/                case "cleanup_expired": {.*?\n                }/s, newHandler);

fs.writeFileSync(file, code);
console.log('Fixed memory-tools.ts');
