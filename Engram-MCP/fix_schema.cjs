const fs = require('fs');
const file = 'src/tools/memory-tools.ts';
let code = fs.readFileSync(file, 'utf8');

// The top of the file doesn't have the RunDecaySchema exported from schemas.ts or defined locally properly.
const schemaImportStr = 'import {\n\tAddMemorySchema,\n\tBatchAddMemoriesSchema,';
const schemaImportRep = 'import {\n\tRunDecaySchema,\n\tAddMemorySchema,\n\tBatchAddMemoriesSchema,';

if (code.includes(schemaImportStr)) {
    code = code.replace(schemaImportStr, schemaImportRep);
} else {
    // If not using destructured import, it might be local. Let's make sure it's at the top.
    const toolImport = 'import { Tool } from "@modelcontextprotocol/sdk/types.js";';
    const localSchema = `\nconst RunDecaySchema = z.object({ tenant_id: z.string().optional() });\n`;
    if (!code.includes('RunDecaySchema')) {
        code = code.replace(toolImport, toolImport + localSchema);
    }
}

// But in my previous step, I injected it here:
if (code.includes('export const RunDecaySchema = z.object({')) {
   // it exists but maybe typescript can't find it if it's below usage.
   // Let's check where it is.
}

fs.writeFileSync(file, code);
