const fs = require('fs');
const file = 'src/client.ts';
let code = fs.readFileSync(file, 'utf8');

const newMethod = `        async runDecay(params: { tenant_id?: string }): Promise<{ processed: number }> {
                const response = await resilientFetch(\`\${this.baseUrl}/memories/decay\`, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify(params),
                });

                if (!response.ok) {
                        throw createErrorFromStatus(response.status, response.statusText);
                }

                return this.parseJSON<{ processed: number }>(response);
        }`;

if (!code.includes("runDecay")) {
    code = code.replace(/        async cleanupExpired.*?return this.parseJSON<{ removed: number }>\(response\);\n        }/s, `$&` + "\n\n" + newMethod);
    fs.writeFileSync(file, code);
    console.log('Fixed client.ts');
} else {
    console.log('Already fixed client.ts');
}
