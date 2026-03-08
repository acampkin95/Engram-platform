const fs = require('fs');
const file = 'src/tools/memory-tools.ts';
let code = fs.readFileSync(file, 'utf8');

// There are multiple syntax issues in memory-tools.ts from the previous JS replaces.
// We need to clean up the end of the file.

const cleanEnd = `                case "consolidate_memories": {
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
                                                                message: \`Consolidated \${result.processed} memories\`,
                                                        },
                                                        null,
                                                        2,
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
                }

                default:
                        return null;
        }
}`;

const consolidateIdx = code.indexOf('case "consolidate_memories": {');
if (consolidateIdx !== -1) {
    code = code.substring(0, consolidateIdx) + cleanEnd;
    fs.writeFileSync(file, code);
    console.log('Cleaned up memory-tools.ts syntax');
} else {
    console.log('Failed to find anchor');
}
