const fs = require('fs');
const file = 'src/tools/memory-tools.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("run_decay")) {
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

    code = code.replace(/export const MEMORY_TOOLS: Tool\[\] = \[/, newToolDef + '\nexport const MEMORY_TOOLS: Tool[] = [\n\t\tRunDecayTool,');

    const handlerRegex = /case "cleanup_expired": \{[^\}]+\n\s*\}/g;
    const cleanupHandler = `case "cleanup_expired": {
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

    // Note: this approach is a bit fragile if there are inner braces in the string
    // Let's use a simple string replace for the whole case block
    const oldCaseStr = 'case "cleanup_expired": {';
    const oldCaseEnd = '    }';

    // Instead of regex, let's find the exact block since JS replacement can be tricky
    let parts = code.split('case "cleanup_expired": {');
    if (parts.length === 2) {
        let afterPart = parts[1];
        let caseEndIdx = afterPart.indexOf('    }');
        let afterCase = afterPart.substring(caseEndIdx + 5);
        code = parts[0] + cleanupHandler + "\n\n" + afterCase;
        fs.writeFileSync(file, code);
        console.log('Fixed memory-tools.ts via manual block replace');
    } else {
        console.log('Could not find cleanup_expired case block');
    }
} else {
    console.log('already has run_decay');
}
